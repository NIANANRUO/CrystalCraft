import { CrystalStructure, Vec3 } from '../types/crystal';
import { assertVolumeData } from '../volume/data';
import { displacementAxes } from './displacement';

// Conservative budgets for a browser renderer with per-atom meshes and pair searches.
// Keep these shared by import, editing, replication, and rendering entry points.
export const MAX_ATOMS = 2000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ABS_COORDINATE = 1_000_000;
export const MAX_TRANSFORM_CANDIDATES = 2_000_000;

export function assertTextSize(content: string): void {
  if (content.length > MAX_FILE_BYTES || new TextEncoder().encode(content).length > MAX_FILE_BYTES) {
    throw new Error('文件超过 10 MiB，请拆分结构后再导入。');
  }
  if (content.includes('\0')) throw new Error('文件包含二进制空字符，请选择文本结构文件。');
}

export function assertAtomCount(count: number, allowEmpty = false): void {
  if (!Number.isSafeInteger(count) || count < (allowEmpty ? 0 : 1)) {
    throw new Error('原子数必须为有效的非负整数，导入结构至少需要一个原子。');
  }
  if (count > MAX_ATOMS) {
    throw new Error(`结构包含 ${count} 个原子，超过浏览器安全上限 ${MAX_ATOMS}；请减小结构或复制倍数。`);
  }
}

export function parseFiniteNumber(value: string | undefined, label: string): number {
  const normalized = (value ?? '').trim().replace(/[dD]/g, 'e');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) {
    throw new Error(`${label}不是有效数字：${value ?? '(缺失)'}`);
  }
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`${label}必须是有限数值。`);
  return number;
}

export function assertFiniteVector(vector: Vec3, label = '坐标'): void {
  if (!vector || ![vector.x, vector.y, vector.z].every(Number.isFinite)) {
    throw new Error(`${label}包含缺失值、NaN 或无穷大。`);
  }
  if ([vector.x, vector.y, vector.z].some(value => Math.abs(value) > MAX_ABS_COORDINATE)) {
    throw new Error(`${label}绝对值不能超过 ${MAX_ABS_COORDINATE}，请检查单位或输入。`);
  }
}

export function assertLatticeMatrix(matrix: [Vec3, Vec3, Vec3]): void {
  if (!Array.isArray(matrix) || matrix.length !== 3) throw new Error('晶格必须包含三个矢量。');
  matrix.forEach(vector => assertFiniteVector(vector, '晶格矢量'));
  const [a, b, c] = matrix;
  const lengths = matrix.map(vector => Math.hypot(vector.x, vector.y, vector.z));
  const volume = a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x);
  // Use a relative determinant to reject collinear and numerically unstable cells
  // without rejecting legitimate small cells merely because their units are small.
  const relativeVolume = Math.abs(volume) / (lengths[0] * lengths[1] * lengths[2]);
  if (lengths.some(length => length < 1e-6) || !Number.isFinite(relativeVolume) || relativeVolume < 1e-10) {
    throw new Error('晶格长度必须大于零，三个晶格矢量不能共面或接近奇异。');
  }
}

export function assertElementToken(element: string): void {
  // Retain VASP species labels and unknown-species placeholders while preventing
  // whitespace/newline injection into exported tabular formats.
  if (typeof element !== 'string' || !/^[A-Za-z][A-Za-z0-9_+\-]{0,31}$/.test(element)) {
    throw new Error(`无效的元素或物种名称：${String(element).slice(0, 40)}`);
  }
}

export function assertStructureValid(structure: CrystalStructure, allowEmpty = true): void {
  if (!structure || typeof structure !== 'object' || !Array.isArray(structure.atoms)) throw new Error('结构缺少有效的原子数组。');
  assertAtomCount(structure.atoms.length, allowEmpty);
  if (structure.isPeriodic && !structure.lattice) throw new Error('周期结构缺少晶格。');
  if (structure.lattice) assertLatticeMatrix(structure.lattice.matrix);
  if(structure.volumeData!==undefined)assertVolumeData(structure.volumeData,structure);
  if(structure.scalarSource!==undefined&&(typeof structure.scalarSource!=='string'||structure.scalarSource.length>1000))throw new Error('标量来源记录无效。');
  const ids = new Set<number>();
  for (const atom of structure.atoms) {
    if (!atom || typeof atom !== 'object' || Array.isArray(atom)) throw new Error('原子记录必须为对象。');
    if (!Number.isSafeInteger(atom.id) || atom.id < 1 || ids.has(atom.id)) throw new Error('原子 ID 必须为互不重复的正整数。');
    ids.add(atom.id);
    assertElementToken(atom.element);
    assertFiniteVector(atom.cartesian, `原子 ${atom.id} 的笛卡尔坐标`);
    assertFiniteVector(atom.fractional, `原子 ${atom.id} 的分数坐标`);
    if (atom.name !== undefined && (typeof atom.name !== 'string' || atom.name.length > 128 || /[\0\r\n]/.test(atom.name))) throw new Error('原子位点名称必须为不超过 128 字符的单行文本。');
    if (atom.charge !== undefined && (!Number.isFinite(atom.charge) || Math.abs(atom.charge) > 1000)) throw new Error('原子电荷无效。');
    if (atom.selected !== undefined && typeof atom.selected !== 'boolean') throw new Error('原子选择标记无效。');
    if (atom.selectiveDynamics !== undefined && (!Array.isArray(atom.selectiveDynamics) || atom.selectiveDynamics.length !== 3 || !atom.selectiveDynamics.every(flag => typeof flag === 'boolean'))) throw new Error('原子弛豫约束必须为三个布尔 T/F 标记。');
    if (atom.displacement !== undefined) {
      if (!Array.isArray(atom.displacement) || atom.displacement.length !== 6 || !atom.displacement.every(Number.isFinite)) throw new Error('原子位移张量必须为六个有限数值。');
      displacementAxes(atom.displacement);
    }
    if (atom.colorOverride !== undefined && (typeof atom.colorOverride !== 'string' || !/^#[a-f\d]{6}$/i.test(atom.colorOverride))) throw new Error('原子颜色无效。');
    if (atom.radiusOverride !== undefined && (!Number.isFinite(atom.radiusOverride) || atom.radiusOverride <= 0 || atom.radiusOverride > 5)) throw new Error('原子半径无效。');
    if(atom.scalarData!==undefined){
      const data=atom.scalarData;
      if(!data||typeof data!=='object'||Array.isArray(data)||Object.entries(data).some(([key,value])=>!['esp','orbital','spin','bFactor'].includes(key)||!Number.isFinite(value)||Math.abs(value)>1e9||(key==='bFactor'&&value<0)))throw new Error('原子标量数据无效。');
    }
    if (atom.occupancy !== undefined && (!Number.isFinite(atom.occupancy) || atom.occupancy < 0 || atom.occupancy > 1)) {
      throw new Error(`原子 ${atom.id} 的占据率必须在 0 到 1 之间。`);
    }
  }
}

export function sanitizeSingleLine(text: string): string {
  return text.replace(/[\r\n\u2028\u2029\0]/g, ' ').trim();
}
