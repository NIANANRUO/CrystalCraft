import { CrystalStructure, Atom, Vec3 } from '../types/crystal';
import { calculateLatticeFromMatrix, fractionalToCartesian, cartesianToFractional, matrixDet } from '../utils/math';
import { assertAtomCount, assertElementToken, assertStructureValid, assertTextSize, parseFiniteNumber, sanitizeSingleLine } from '../utils/validation';

function vectorFromLine(line: string | undefined, label: string): Vec3 {
  const parts = (line ?? '').split(/\s+/);
  return { x: parseFiniteNumber(parts[0], `${label} x`), y: parseFiniteNumber(parts[1], `${label} y`), z: parseFiniteNumber(parts[2], `${label} z`) };
}

export function parsePOSCAR(content: string, filename = 'POSCAR'): CrystalStructure {
  assertTextSize(content);
  if (/direct\s+configuration\s*=/i.test(content)) throw new Error('多帧轨迹尚不支持，请提取单帧 POSCAR 后导入。');
  const rawLines = content.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
  const title = rawLines[0].trim() || filename;
  const lines = rawLines.slice(1).map(line => line.trim()).filter(Boolean);
  if (lines.length < 6) throw new Error('POSCAR 晶格与原子数据行数不足。');

  const scaleTokens = lines[0].split(/[#!]/)[0].trim().split(/\s+/);
  if (scaleTokens.length !== 1 && scaleTokens.length !== 3) throw new Error('POSCAR 缩放因子必须为一个数或三个正数。');
  const scales = scaleTokens.map(token => parseFiniteNumber(token, 'POSCAR 缩放因子'));
  if (scales.some(value => value === 0) || (scales.length === 3 && scales.some(value => value < 0))) {
    throw new Error('POSCAR 三轴缩放因子必须大于零；单一缩放因子不能为零。');
  }
  const rawMatrix: [Vec3, Vec3, Vec3] = [vectorFromLine(lines[1], '晶格 a'), vectorFromLine(lines[2], '晶格 b'), vectorFromLine(lines[3], '晶格 c')];
  // A negative single scale specifies the target volume; three scales apply to
  // Cartesian x/y/z components, including Cartesian-mode atom positions.
  calculateLatticeFromMatrix(rawMatrix);
  const singleScale = scales[0] < 0 ? Math.cbrt(-scales[0] / Math.abs(matrixDet(rawMatrix))) : scales[0];
  const [sx, sy, sz] = scales.length === 3 ? scales : [singleScale, singleScale, singleScale];
  const scaleVector = (v: Vec3): Vec3 => ({ x: v.x * sx, y: v.y * sy, z: v.z * sz });
  const matrix = rawMatrix.map(scaleVector) as [Vec3, Vec3, Vec3];
  const lattice = calculateLatticeFromMatrix(matrix);

  let cursor = 4;
  const firstParts = lines[cursor].split(/[#!]/)[0].trim().split(/\s+/);
  // Numeric-looking malformed counts must not be mistaken for element names.
  const vasp4 = /^[+\-\d.]/.test(firstParts[0]);
  const elementSymbols: string[] = vasp4 ? [] : firstParts;
  if (!vasp4) cursor++;
  const countTokens = (lines[cursor++] ?? '').split(/[#!]/)[0].trim().split(/\s+/);
  if (!countTokens.every(token => /^\d+$/.test(token))) throw new Error('POSCAR 原子计数必须为非负整数。');
  const elementCounts = countTokens.map(Number);
  if (!elementCounts.every(Number.isSafeInteger)) throw new Error('POSCAR 原子计数过大。');
  const totalAtoms = elementCounts.reduce((sum, count) => sum + count, 0);
  assertAtomCount(totalAtoms);
  if (vasp4) {
    const titleTokens = title.split(/[\s,_\-]+/).filter(token => /^[A-Z][a-z]?$/.test(token));
    elementSymbols.push(...(titleTokens.length === elementCounts.length ? titleTokens : elementCounts.map((_, index) => `E${index + 1}`)));
  }
  if (elementSymbols.length !== elementCounts.length) throw new Error('POSCAR 元素名称数与计数列数不一致。');
  elementSymbols.forEach(assertElementToken);

  const hasSelectiveDynamics = /^s/i.test(lines[cursor] ?? '');
  if (hasSelectiveDynamics) cursor++;
  const coordinateLine = lines[cursor++] ?? '';
  if (!/^[dfck]/i.test(coordinateLine)) throw new Error('POSCAR 缺少有效的 Direct 或 Cartesian 坐标类型。');
  const isDirect = /^[df]/i.test(coordinateLine);
  if (lines.length - cursor < totalAtoms) throw new Error(`POSCAR 声明 ${totalAtoms} 个原子，但坐标数据不完整。`);

  const atoms: Atom[] = [];
  elementSymbols.forEach((element, elementIndex) => {
    for (let index = 0; index < elementCounts[elementIndex]; index++) {
      const coordinateLine = lines[cursor++];
      const raw = vectorFromLine(coordinateLine, `原子 ${atoms.length + 1}`);
      const cartesian = isDirect ? fractionalToCartesian(raw, matrix) : scaleVector(raw);
      const fractional = isDirect ? raw : cartesianToFractional(cartesian, matrix);
      let selectiveDynamics: [boolean, boolean, boolean] | undefined;
      if (hasSelectiveDynamics) {
        const flags = coordinateLine.split(/\s+/).slice(3, 6);
        if (flags.length !== 3 || !flags.every(flag => /^[TF]$/i.test(flag))) throw new Error(`原子 ${atoms.length + 1} 缺少有效的三个 T/F 选择性弛豫标记。`);
        selectiveDynamics = flags.map(flag => /^t$/i.test(flag)) as [boolean, boolean, boolean];
      }
      atoms.push({ id: atoms.length + 1, element, fractional, cartesian, selectiveDynamics, selected: false });
    }
  });
  const structure: CrystalStructure = { title, lattice, atoms, isPeriodic: true, format: 'poscar', coordType: isDirect ? 'Direct' : 'Cartesian', hasSelectiveDynamics };
  assertStructureValid(structure, false);
  return structure;
}

export function exportPOSCAR(structure: CrystalStructure): string {
  assertStructureValid(structure, false);
  if (!structure.lattice) throw new Error('非周期性体系无法导出为 POSCAR 格式');
  if (structure.atoms.some(atom => atom.occupancy !== undefined && atom.occupancy !== 1)) {
    throw new Error('POSCAR 不支持部分占据率；请导出 CIF 以保留占据率，或先构建明确的有序结构。');
  }
  const lines = [sanitizeSingleLine(structure.title || 'Exported by CrystalCraft'), '1.0'];
  structure.lattice.matrix.forEach(vector => {
    lines.push(`   ${vector.x.toFixed(12).padStart(18)} ${vector.y.toFixed(12).padStart(18)} ${vector.z.toFixed(12).padStart(18)}`);
  });
  const groups = new Map<string, Atom[]>();
  structure.atoms.forEach(atom => {
    if (!groups.has(atom.element)) groups.set(atom.element, []);
    groups.get(atom.element)!.push(atom);
  });
  lines.push('  ' + [...groups.keys()].map(symbol => symbol.padEnd(5)).join(' '));
  lines.push('  ' + [...groups.values()].map(atoms => String(atoms.length).padEnd(5)).join(' '));
  const hasSelective = structure.hasSelectiveDynamics || structure.atoms.some(atom => atom.selectiveDynamics !== undefined);
  if (hasSelective) lines.push('Selective dynamics');
  lines.push('Direct');
  groups.forEach(atoms => atoms.forEach(atom => {
    // Preserve slab and deliberately unwrapped coordinates exactly as entered.
    const fractional = atom.fractional;
    let line = `  ${fractional.x.toFixed(10).padStart(16)} ${fractional.y.toFixed(10).padStart(16)} ${fractional.z.toFixed(10).padStart(16)}`;
    if (hasSelective) line += '   ' + (atom.selectiveDynamics ?? [true, true, true]).map(flag => flag ? 'T' : 'F').join('   ');
    lines.push(line);
  }));
  return lines.join('\n') + '\n';
}
