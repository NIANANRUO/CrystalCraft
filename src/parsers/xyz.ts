import { CrystalStructure, Atom, Vec3 } from '../types/crystal';
import { assertAtomCount, assertElementToken, assertStructureValid, assertTextSize, parseFiniteNumber, sanitizeSingleLine } from '../utils/validation';

export function parseXYZ(content: string, filename = 'molecule.xyz'): CrystalStructure {
  assertTextSize(content);
  // The comment is a mandatory line, but it may be empty. Filtering empty lines
  // here used to shift the first atom into the comment and silently drop it.
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
  if (lines.length < 3) {
    throw new Error('XYZ 文件行数过少');
  }

  if (!/^\d+$/.test(lines[0].trim())) {
    throw new Error('无效的原子数目: ' + lines[0]);
  }
  const numAtoms = Number(lines[0].trim());
  assertAtomCount(numAtoms);
  if (lines.length < numAtoms + 2) throw new Error(`XYZ 声明 ${numAtoms} 个原子，但坐标数据不完整。`);
  if (lines.slice(numAtoms + 2).some(line => line.trim())) throw new Error('XYZ 含额外原子或多个轨迹帧，请拆分为单帧结构后导入。');

  const comment = lines[1].trim();
  if (/(?:^|\s)(?:Lattice|Properties|pbc)\s*=/i.test(comment)) throw new Error('检测到 Extended XYZ 的晶格、周期性或属性字段。当前仅支持基本 XYZ；请转换为 CIF/POSCAR，避免丢失周期或原子属性信息。');
  const atoms: Atom[] = [];

  for (let i = 2; i < 2 + numAtoms; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 4) throw new Error(`XYZ 第 ${i + 1} 行缺少原子坐标。`);
    if (parts.length > 4) throw new Error(`XYZ 第 ${i + 1} 行包含额外属性列。当前仅支持元素和三个坐标，请先转换格式以保留其他属性。`);

    const element = parts[0];
    assertElementToken(element);
    const x = parseFiniteNumber(parts[1], `XYZ 第 ${i + 1} 行 x`);
    const y = parseFiniteNumber(parts[2], `XYZ 第 ${i + 1} 行 y`);
    const z = parseFiniteNumber(parts[3], `XYZ 第 ${i + 1} 行 z`);

    const cartesian: Vec3 = { x, y, z };

    atoms.push({
      id: i - 1,
      element,
      cartesian,
      fractional: { ...cartesian }, // placeholder if non-periodic
      selected: false
    });
  }

  const structure: CrystalStructure = {
    title: comment || filename,
    atoms,
    isPeriodic: false,
    format: 'xyz'
  };
  assertStructureValid(structure, false);
  return structure;
}

export function exportXYZ(structure: CrystalStructure): string {
  assertStructureValid(structure, false);
  const lines: string[] = [];
  lines.push(structure.atoms.length.toString());
  lines.push(sanitizeSingleLine(structure.title || 'Exported by CrystalCraft'));

  structure.atoms.forEach(atom => {
    lines.push(
      `${atom.element.padEnd(4)}  ${atom.cartesian.x.toFixed(6).padStart(12)}  ${atom.cartesian.y.toFixed(6).padStart(12)}  ${atom.cartesian.z.toFixed(6).padStart(12)}`
    );
  });

  return lines.join('\n');
}
