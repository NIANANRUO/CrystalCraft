import { cifTensor, rotateTensor, displacementAxes, Tensor } from '../utils/displacement';
import { CrystalStructure, Atom, Vec3 } from '../types/crystal';
import { buildLatticeMatrix, calculateLatticeFromMatrix, cartesianToFractional, fractionalToCartesian } from '../utils/math';
import { assertAtomCount, assertElementToken, assertFiniteVector, assertStructureValid, assertTextSize, parseFiniteNumber, sanitizeSingleLine } from '../utils/validation';
import { ELEMENTS } from '../constants/elements';
import { SPACE_GROUP_NUMBERS } from './spaceGroups';

type Token = { value: string; quoted: boolean };
type Loop = { headers: string[]; rows: string[][] };
const normalizeTag = (tag: string) => tag.toLowerCase().replace(/\./g, '_');
const reserved = (token: Token) => !token.quoted && /^(?:_|loop_$|stop_$|data_|save_|global_$)/i.test(token.value);

// CIF rows are whitespace-delimited, not line-delimited. Quoted values, comments,
// and semicolon text fields are tokenized before loop columns are assigned.
function tokenize(content: string): Token[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
  const tokens: Token[] = [];
  const add = (value: string, quoted = false) => {
    if (tokens.length >= 250_000) throw new Error('CIF 数据项过多，请拆分文件后再导入。');
    tokens.push({ value, quoted });
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (line.startsWith(';')) {
      const parts = [line.slice(1)];
      let closed = false;
      while (++lineIndex < lines.length) {
        if (lines[lineIndex].startsWith(';')) { closed = true; break; }
        parts.push(lines[lineIndex]);
      }
      if (!closed) throw new Error('CIF 多行文本缺少结束分号。');
      add(parts.join('\n'), true);
      continue;
    }
    let cursor = 0;
    while (cursor < line.length) {
      if (/\s/.test(line[cursor])) { cursor++; continue; }
      if (line[cursor] === '#') break;
      const quote = line[cursor];
      if (quote === '"' || quote === "'") {
        const start = ++cursor;
        while (cursor < line.length && !(line[cursor] === quote && (cursor + 1 === line.length || /[\s#]/.test(line[cursor + 1])))) cursor++;
        if (cursor >= line.length) throw new Error(`CIF 第 ${lineIndex + 1} 行引号未闭合。`);
        add(line.slice(start, cursor++), true);
      } else {
        const start = cursor;
        while (cursor < line.length && !/\s/.test(line[cursor])) cursor++;
        add(line.slice(start, cursor));
      }
    }
  }
  return tokens;
}

function readCIF(content: string, filename: string): { title: string; values: Map<string, string>; loops: Loop[] } {
  const tokens = tokenize(content);
  const values = new Map<string, string>();
  const loops: Loop[] = [];
  let title = filename;
  let blocks = 0;
  let cursor = 0;
  while (cursor < tokens.length) {
    const token = tokens[cursor++];
    const key = normalizeTag(token.value);
    if (!token.quoted && key.startsWith('data_')) {
      if (++blocks > 1) throw new Error('CIF 含多个 data_ 数据块，请拆分后选择一个结构导入。');
      title = token.value.slice(5) || filename;
    } else if (!token.quoted && key === 'loop_') {
      const headers: string[] = [];
      while (cursor < tokens.length && !tokens[cursor].quoted && tokens[cursor].value.startsWith('_')) headers.push(normalizeTag(tokens[cursor++].value));
      if (headers.length === 0 || new Set(headers).size !== headers.length) throw new Error('CIF loop_ 列名缺失或重复。');
      const data: string[] = [];
      while (cursor < tokens.length && !reserved(tokens[cursor])) data.push(tokens[cursor++].value);
      if (data.length % headers.length !== 0) throw new Error(`CIF loop_ 数据不完整：${headers[0]} 的列数与值不匹配。`);
      const rows: string[][] = [];
      for (let index = 0; index < data.length; index += headers.length) rows.push(data.slice(index, index + headers.length));
      loops.push({ headers, rows });
      if (tokens[cursor]?.value.toLowerCase() === 'stop_') cursor++;
    } else if (!token.quoted && key.startsWith('_')) {
      if (!tokens[cursor] || reserved(tokens[cursor])) throw new Error(`CIF 数据项 ${key} 缺少值。`);
      if (values.has(key)) throw new Error(`CIF 数据项 ${key} 重复。`);
      values.set(key, tokens[cursor++].value);
    } else {
      throw new Error(`不支持或无效的 CIF 数据项：${token.value.slice(0, 50)}`);
    }
  }
  return { title, values, loops };
}

function cifNumber(value: string | undefined, label: string): number {
  // Uncertainty belongs to the mantissa: 5.6402(3), 1.2(2)e-3.
  const cleaned = (value ?? '').replace(/^(.*?)(\(\d+\))([eEdD][+-]?\d+)?$/, '$1$3');
  return parseFiniteNumber(cleaned, label);
}

function cleanElement(value: string | undefined, isTypeSymbol: boolean): string {
  const match = value?.match(/^([A-Z][a-z]?)/);
  if (!match) throw new Error(`CIF 原子元素名称无效：${value ?? '(缺失)'}`);
  if (isTypeSymbol) {
    assertElementToken(value!);
    // CIF type symbols may carry oxidation states. Retain unknown species labels
    // (including VASP4 E1 placeholders) rather than silently renaming them.
    return ELEMENTS[match[1]] && /^(?:[A-Z][a-z]?)(?:\d+[+-]|[+-]\d*)?$/.test(value!) ? match[1] : value!;
  }
  return match[1];
}

type Symmetry = { rows: [number, number, number][]; translation: number[] };
const wrap = (value: number) => {
  const normalized = value - Math.floor(value);
  return normalized > 1 - 1e-9 || normalized < 1e-9 ? 0 : normalized;
};

// Parse only affine crystallographic expressions. Never eval uploaded content.
function parseSymmetry(expression: string): Symmetry {
  const parts = expression.toLowerCase().replace(/\s/g, '').split(',');
  if (parts.length !== 3) throw new Error(`CIF 对称操作必须包含三个坐标：${expression}`);
  const rows: [number, number, number][] = [];
  const translation: number[] = [];
  for (const part of parts) {
    if (part.length > 128) throw new Error('CIF 对称操作表达式过长。');
    const row: [number, number, number] = [0, 0, 0];
    let shift = 0;
    let offset = 0;
    while (offset < part.length) {
      const remaining = part.slice(offset);
      if (offset && !/^[+-]/.test(remaining)) throw new Error(`不支持的 CIF 对称操作：${expression}`);
      const match = remaining.match(/^([+-]?)(?:(\d+)?\*?([xyz])|(\d+(?:\.\d*)?|\.\d+)(?:\/(\d+))?)/);
      if (!match) throw new Error(`不支持的 CIF 对称操作：${expression}`);
      const sign = match[1] === '-' ? -1 : 1;
      if (match[3]) row['xyz'.indexOf(match[3])] += sign * Number(match[2] || 1);
      else shift += sign * Number(match[4]) / Number(match[5] || 1);
      offset += match[0].length;
    }
    if (!part || ![...row, shift].every(Number.isFinite) || row.some(value => Math.abs(value) > 12) || Math.abs(shift) > 1e6) throw new Error(`无效的 CIF 对称操作：${expression}`);
    rows.push(row);
    translation.push(wrap(shift));
  }
  const [a, b, c] = rows;
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  if (Math.abs(Math.abs(det) - 1) > 1e-8) throw new Error('CIF 对称操作的旋转部分必须保持晶胞体积。');
  return { rows, translation };
}

// Conventional centring by International Tables number (spglib database/spg.csv).
const CENTRING = 'PPPPCPPCCPPCPPCPPPPCCFIIPPPPPPPPPPCCCAAAAFFIIIPPPPPPPPPPPPPPPPCCCCCCFFIIIIPPPPIIPIPPPPIIPPPPPPPPIIPPPPPPPPIIIIPPPPPPPPIIIIPPPPPPPPPPPPPPPPIIIIPPPRPRPPPPPPRPPPPRRPPPPRRPPPPPPPPPPPPPPPPPPPPPPPPPPPPFIPIPPFFIPIPPFFIPPIPFIPFIPPPPFFFFII';
const POINT_GROUP_RANGES = [[1, 1], [2, 2], [9, 2], [15, 4], [46, 4], [74, 8], [82, 4], [88, 8], [122, 8], [142, 16], [146, 3], [148, 6], [161, 6], [167, 12], [174, 6], [176, 12], [190, 12], [194, 24], [199, 12], [206, 24], [220, 24], [230, 48]];

function validateSymmetry(operations: Symmetry[], matrix: [Vec3, Vec3, Vec3], groupNumber?: number): void {
  if (!operations.length) return;
  const identity = (op: Symmetry) => op.rows.every((row, i) => row.every((value, j) => value === (i === j ? 1 : 0)));
  if (!operations.some(op => identity(op) && op.translation.every(value => value === 0))) throw new Error('CIF 对称操作缺少恒等操作 x,y,z，请提供完整操作表。');
  const rotations = new Map<string, Symmetry[]>();
  const dot = (u: Vec3, v: Vec3) => u.x * v.x + u.y * v.y + u.z * v.z;
  const gram = matrix.map(a => matrix.map(b => dot(a, b)));
  for (const operation of operations) {
    const key = operation.rows.flat().join(',');
    rotations.set(key, [...(rotations.get(key) ?? []), operation]);
    // Volume preservation alone also permits shears: a symmetry must preserve
    // the cell metric, otherwise expansion changes distances and chemistry.
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let transformed = 0;
      for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) transformed += operation.rows[k][i] * gram[k][l] * operation.rows[l][j];
      if (Math.abs(transformed - gram[i][j]) > 1e-5 * Math.sqrt(gram[i][i] * gram[j][j])) throw new Error('CIF 对称操作与晶格参数不相容，请检查晶胞设置。');
    }
  }
  if (groupNumber !== undefined) {
    const pointOrder = POINT_GROUP_RANGES.find(([last]) => groupNumber <= last)![1];
    const centring = CENTRING[groupNumber - 1];
    // R space groups support both primitive rhombohedral and hexagonal settings;
    // the rotation matrices and metric decide which explicit list is compatible.
    const primitiveR = centring === 'R' && Math.abs(gram[0][0] - gram[1][1]) < 1e-5 * gram[0][0]
      && Math.abs(gram[0][0] - gram[2][2]) < 1e-5 * gram[0][0]
      && Math.abs(gram[0][1] - gram[0][2]) < 1e-5 * gram[0][0]
      && Math.abs(gram[0][1] - gram[1][2]) < 1e-5 * gram[0][0];
    const copies = centring === 'F' ? 4 : centring === 'R' ? (primitiveR ? 1 : 3) : centring === 'P' ? 1 : 2;
    if (rotations.size !== pointOrder || operations.length !== pointOrder * copies) throw new Error(`CIF 空间群 ${groupNumber} 的对称操作表不完整或与声明不一致；请提供完整操作表或展开为 P1。`);
  }
  // Closure catches missing operations even when no group number is declared.
  for (const a of operations) for (const b of operations) {
    const rows = a.rows.map(row => [0, 1, 2].map(j => row.reduce((sum, coefficient, k) => sum + coefficient * b.rows[k][j], 0)));
    const shift = a.rows.map((row, i) => wrap(row.reduce((sum, coefficient, j) => sum + coefficient * b.translation[j], a.translation[i])));
    const matches = rotations.get(rows.flat().join(',')) ?? [];
    if (!matches.some(op => op.translation.every((value, i) => {
      const difference = Math.abs(value - shift[i]);
      return Math.min(difference, 1 - difference) < 1e-7;
    }))) throw new Error('CIF 对称操作表未闭合，缺少操作；请提供完整操作表或展开为 P1。');
  }
}

export function parseCIF(content: string, filename = 'structure.cif'): CrystalStructure {
  assertTextSize(content);
  const { title, values, loops } = readCIF(content, filename);
  const tags = [...values.keys(), ...loops.flatMap(loop => loop.headers)];
  if (tags.some(tag => /(?:symop_magn|atom_site_moment|space_group_magn)/.test(tag))) throw new Error('磁性 CIF 尚不支持，请先提取普通单帧 CIF。');
  const a = cifNumber(values.get('_cell_length_a'), '晶胞长度 a');
  const b = cifNumber(values.get('_cell_length_b'), '晶胞长度 b');
  const c = cifNumber(values.get('_cell_length_c'), '晶胞长度 c');
  const alpha = cifNumber(values.get('_cell_angle_alpha'), '晶胞角 alpha');
  const beta = cifNumber(values.get('_cell_angle_beta'), '晶胞角 beta');
  const gamma = cifNumber(values.get('_cell_angle_gamma'), '晶胞角 gamma');
  const matrix = buildLatticeMatrix(a, b, c, alpha, beta, gamma);
  const lattice = calculateLatticeFromMatrix(matrix);

  const symmetryTags = ['_space_group_symop_operation_xyz', '_symmetry_equiv_pos_as_xyz'];
  const expressions: string[] = [];
  for (const tag of symmetryTags) {
    if (values.has(tag)) expressions.push(values.get(tag)!);
    loops.forEach(loop => {
      const index = loop.headers.indexOf(tag);
      if (index !== -1) expressions.push(...loop.rows.map(row => row[index]));
    });
  }
  if (expressions.length > 384) throw new Error('CIF 对称操作数过多，请先展开为 P1 结构。');
  const groupNumberValue = values.get('_space_group_it_number') ?? values.get('_symmetry_int_tables_number');
  const groupName = values.get('_space_group_name_h-m_alt') ?? values.get('_symmetry_space_group_name_h-m') ?? values.get('_space_group_name_hall');
  let groupNumber = groupNumberValue !== undefined && !['?', '.'].includes(groupNumberValue) ? cifNumber(groupNumberValue, '空间群编号') : undefined;
  if (groupNumber !== undefined && (!Number.isInteger(groupNumber) || groupNumber < 1 || groupNumber > 230)) throw new Error('CIF 空间群编号必须为 1 到 230 的整数。');
  const normalizedName = groupName?.replace(/[\s_]/g, '').toUpperCase();
  const namedNumber = normalizedName ? SPACE_GROUP_NUMBERS[normalizedName] : undefined;
  if (groupNumber !== undefined && namedNumber !== undefined && namedNumber !== groupNumber) throw new Error('CIF 空间群名称与编号冲突。');
  groupNumber ??= namedNumber;
  if (groupNumber === undefined && normalizedName && !['?', '.'].includes(normalizedName)) throw new Error('无法核实此 CIF 空间群名称，请补充 1–230 的空间群编号及完整对称操作，或展开为 P1。');
  const nonP1 = groupNumber !== undefined && groupNumber !== 1;
  if (nonP1 && expressions.length <= 1) {
    throw new Error('此 CIF 声明了非 P1 空间群，但未提供完整对称操作；请先用晶体学软件展开为 P1，避免导入缺失原子的结构。');
  }
  const operationMap = new Map<string, Symmetry>();
  expressions.map(parseSymmetry).forEach(op => operationMap.set(`${op.rows.flat().join(',')}|${op.translation.map(value => value.toFixed(8)).join(',')}`, op));
  const operations = [...operationMap.values()];
  validateSymmetry(operations, matrix, groupNumber);

  const tensors = new Map<string, Tensor>();
  for (const loop of loops) {
    const labelIndex = loop.headers.indexOf('_atom_site_aniso_label');
    if (labelIndex === -1) continue;
    const prefix = loop.headers.includes('_atom_site_aniso_u_11') ? 'u' : 'b';
    const indices = ['11', '22', '33', '12', '13', '23'].map(ij => loop.headers.indexOf(`_atom_site_aniso_${prefix}_${ij}`));
    if (indices.some(index => index === -1)) throw new Error('CIF 各向异性热位移数据必须包含完整六个 Uij 或 Bij 分量。');
    for (const row of loop.rows) {
      if (tensors.has(row[labelIndex])) throw new Error('CIF 热位移位点标签重复。');
      const u = indices.map(i => cifNumber(row[i], '热位移张量') / (prefix === 'b' ? 8 * Math.PI ** 2 : 1)) as Tensor;
      const cart = cifTensor(u, matrix); displacementAxes(cart); tensors.set(row[labelIndex], cart);
    }
  }
  const atoms: Atom[] = [];
  let sourceCount = 0;
  for (const loop of loops) {
    const fracIndices = ['x', 'y', 'z'].map(axis => loop.headers.indexOf(`_atom_site_fract_${axis}`));
    const cartIndices = ['x', 'y', 'z'].map(axis => loop.headers.indexOf(`_atom_site_cartn_${axis}`));
    const hasFractional = fracIndices.every(index => index !== -1);
    const hasCartesian = cartIndices.every(index => index !== -1);
    if (!hasFractional && !hasCartesian) {
      if ([...fracIndices, ...cartIndices].some(index => index !== -1)) throw new Error('CIF 原子坐标列不完整，必须包含 x、y、z。');
      continue;
    }
    const symbolIndex = loop.headers.indexOf('_atom_site_type_symbol');
    const labelIndex = loop.headers.indexOf('_atom_site_label');
    const occupancyIndex = loop.headers.indexOf('_atom_site_occupancy');
    const multiplicityIndex = loop.headers.indexOf('_atom_site_symmetry_multiplicity');
    for (const row of loop.rows) {
      assertAtomCount(++sourceCount);
      const element = cleanElement(row[symbolIndex] ?? row[labelIndex], symbolIndex !== -1);
      const name = row[labelIndex] ?? `${element}${atoms.length + 1}`;
      const indices = hasFractional ? fracIndices : cartIndices;
      const vector: Vec3 = { x: cifNumber(row[indices[0]], `${name} x`), y: cifNumber(row[indices[1]], `${name} y`), z: cifNumber(row[indices[2]], `${name} z`) };
      const fractional = hasFractional ? vector : cartesianToFractional(vector, matrix);
      assertFiniteVector(fractional, `${name} 分数坐标`);
      const occupancy = occupancyIndex === -1 ? 1 : cifNumber(row[occupancyIndex], `${name} 占据率`);
      if (occupancy < 0 || occupancy > 1) throw new Error(`${name} 占据率必须在 0 到 1 之间。`);
      let displacement = tensors.get(name);
      if (!displacement) {
        const uIndex = loop.headers.indexOf('_atom_site_u_iso_or_equiv'), bIndex = loop.headers.indexOf('_atom_site_b_iso_or_equiv');
        const i = uIndex !== -1 ? uIndex : bIndex;
        if (i !== -1 && !['.', '?'].includes(row[i])) {
          const u = cifNumber(row[i], `${name} 热位移`) / (uIndex === -1 ? 8 * Math.PI ** 2 : 1);
          if (u < 0) throw new Error('CIF 各向同性热位移不能为负数。');
          if (u > 0) { displacement = [u, u, u, 0, 0, 0]; displacementAxes(displacement); }
        }
      }
      // Preserve unwrapped P1 coordinates. Only symmetry expansion needs wrapping.
      const images = operations.length > 1 ? operations.map(operation => {
        const coords = operation.rows.map((r, i) => wrap(r[0] * fractional.x + r[1] * fractional.y + r[2] * fractional.z + operation.translation[i]));
        return { x: coords[0], y: coords[1], z: coords[2] };
      }) : [fractional];
      const seen = new Set<string>();
      for (const [imageIndex, coords] of images.entries()) {
        const key = `${element}|${occupancy}|${coords.x.toFixed(8)}|${coords.y.toFixed(8)}|${coords.z.toFixed(8)}`;
        if (operations.length > 1 && seen.has(key)) continue;
        seen.add(key);
        assertAtomCount(atoms.length + 1);
        atoms.push({ id: atoms.length + 1, element, name, fractional: coords, cartesian: fractionalToCartesian(coords, matrix), occupancy, selected: false, displacement: displacement && operations.length > 1 ? rotateTensor(displacement, matrix, operations[imageIndex].rows) : displacement });
      }
      if (multiplicityIndex !== -1 && !['.', '?'].includes(row[multiplicityIndex])) {
        const multiplicity = cifNumber(row[multiplicityIndex], `${name} 对称多重度`);
        if (multiplicity !== seen.size) throw new Error(`${name} 的对称展开数量与声明的多重度不一致，请检查对称操作表。`);
      }
    }
  }
  const structure: CrystalStructure = { title, lattice, atoms, isPeriodic: true, format: 'cif' };
  assertStructureValid(structure, false);
  structure.sourceCif = { text: content, originalGeometry: geometrySignature(structure) };
  return structure;
}

export function geometrySignature(structure: CrystalStructure): string {
  return JSON.stringify({ matrix: structure.lattice?.matrix, atoms: structure.atoms.map(a => [a.element, a.fractional, a.occupancy ?? 1, a.displacement]) });
}

export function exportCIF(structure: CrystalStructure): string {
  assertStructureValid(structure, false);
  if (!structure.lattice) throw new Error('非周期性体系无法导出为 CIF 格式');
  // Derive parameters from the authoritative matrix, never stale UI metadata.
  const lattice = calculateLatticeFromMatrix(structure.lattice.matrix);
  const { a, b, c, alpha, beta, gamma } = lattice;
  const title = sanitizeSingleLine(structure.title || 'crystal').replace(/[^A-Za-z0-9_.-]/g, '_');
  const lines = [
    `data_${title || 'crystal'}`,
    `_audit_creation_method 'CrystalCraft Web Editor'`,
    `_symmetry_space_group_name_H-M 'P 1'`,
    `_symmetry_Int_Tables_number 1`,
    '',
    `_cell_length_a ${a.toFixed(10)}`,
    `_cell_length_b ${b.toFixed(10)}`,
    `_cell_length_c ${c.toFixed(10)}`,
    `_cell_angle_alpha ${alpha.toFixed(8)}`,
    `_cell_angle_beta ${beta.toFixed(8)}`,
    `_cell_angle_gamma ${gamma.toFixed(8)}`,
    `_cell_volume ${lattice.volume.toFixed(8)}`,
    '',
    'loop_', '_atom_site_label', '_atom_site_type_symbol', '_atom_site_fract_x', '_atom_site_fract_y', '_atom_site_fract_z', '_atom_site_occupancy'
  ];
  structure.atoms.forEach((atom, index) => {
    const { x, y, z } = atom.fractional;
    lines.push(`${atom.element}${index + 1} ${atom.element} ${x.toFixed(10)} ${y.toFixed(10)} ${z.toFixed(10)} ${(atom.occupancy ?? 1).toFixed(8)}`);
  });
  const displaced = structure.atoms.filter(atom => atom.displacement);
  if (displaced.length) {
    lines.push('', 'loop_', '_atom_site_aniso_label', ...['11', '22', '33', '12', '13', '23'].map(ij => `_atom_site_aniso_U_${ij}`));
    structure.atoms.forEach((atom, index) => {
      if (atom.displacement) lines.push(`${atom.element}${index + 1} ${cifTensor(atom.displacement, structure.lattice!.matrix, true).map(v => v.toFixed(10)).join(' ')}`);
    });
  }
  return lines.join('\n') + '\n';
}
