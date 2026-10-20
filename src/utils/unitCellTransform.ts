import { Vec3, Atom, CrystalStructure } from '../types/crystal';
import { calculateLatticeFromMatrix, fractionalToCartesian } from './math';
import { assertAtomCount, assertFiniteVector, assertStructureValid, MAX_ABS_COORDINATE, MAX_TRANSFORM_CANDIDATES } from './validation';

export type Matrix3x3 = [[number, number, number], [number, number, number], [number, number, number]];
export interface TransformParams {
  rotationMatrix: Matrix3x3;
  translationVector: [number, number, number];
  normalizeRange: boolean;
}
export const IDENTITY_MATRIX: Matrix3x3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const ZERO_VECTOR: [number, number, number] = [0, 0, 0];

export function determinant3x3(m: Matrix3x3): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

export function inverse3x3(m: Matrix3x3): Matrix3x3 | null {
  const det = determinant3x3(m);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10 || !m.flat().every(Number.isFinite)) return null;
  return [
    [(m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det, (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det, (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det],
    [(m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det, (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det],
    [(m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det, (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det, (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det]
  ];
}

export function multiplyMatrixVec(m: Matrix3x3, v: [number, number, number]): [number, number, number] {
  return m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as [number, number, number];
}

/** VESTA convention: A' = A P; x' = P^-1 (x + n - p). */
export function transformUnitCell(structure: CrystalStructure, params: TransformParams): CrystalStructure {
  if(structure.volumeData)throw new Error('请先在体数据属性中移除体数据，再进行晶胞变换。');
  assertStructureValid(structure, false);
  if (!structure.lattice) throw new Error('当前结构无晶格信息，无法进行晶胞变换。');
  const P = params.rotationMatrix;
  const p = params.translationVector;
  if (!Array.isArray(P) || P.length !== 3 || P.some(row => !Array.isArray(row) || row.length !== 3)
    || !P.flat().every(value => Number.isFinite(value) && Math.abs(value) <= MAX_ABS_COORDINATE)) {
    throw new Error('变换矩阵必须为有限且合理的 3×3 数值。');
  }
  if (!Array.isArray(p) || p.length !== 3) throw new Error('平移向量必须包含三个有限数值。');
  assertFiniteVector({ x: p[0], y: p[1], z: p[2] }, '平移向量');
  const invP = inverse3x3(P);
  if (!invP) throw new Error('变换矩阵奇异或数值不稳定，无法作为有效晶格基底。');
  const matrix = [0, 1, 2].map(column => fractionalToCartesian({ x: P[0][column], y: P[1][column], z: P[2][column] }, structure.lattice!.matrix)) as [Vec3, Vec3, Vec3];
  const lattice = calculateLatticeFromMatrix(matrix);
  const determinant = Math.abs(determinant3x3(P));
  const integerBasis = P.flat().every(Number.isInteger);
  const expectedCount = determinant * structure.atoms.length;
  if (Math.abs(expectedCount - Math.round(expectedCount)) > 1e-7) throw new Error('此变换不能得到完整的周期晶胞：晶胞体积与原子数比例不相容。');
  assertAtomCount(Math.round(expectedCount));
  if (!integerBasis) {
    // A nonsingular matrix need not define a periodic cell of this crystal.
    // Validate new lattice translations against the original motif before any
    // atom is discarded by a fractional/primitive-cell transformation.
    const groups = new Map<string, Atom[]>();
    const signature = (atom: Atom) => JSON.stringify([atom.element, atom.occupancy ?? 1, atom.charge ?? 0, atom.selectiveDynamics]);
    structure.atoms.forEach(atom => groups.set(signature(atom), [...(groups.get(signature(atom)) ?? []), atom]));
    let checks = 0;
    for (let column = 0; column < 3; column++) {
      const translation = P.map(row => row[column]);
      if (translation.every(Number.isInteger)) continue;
      for (const group of groups.values()) {
        const remaining = new Set(group);
        for (const atom of group) {
          const shifted = [atom.fractional.x, atom.fractional.y, atom.fractional.z].map((value, axis) => value + translation[axis]);
          let found: Atom | undefined;
          for (const candidate of remaining) {
            if (++checks > MAX_TRANSFORM_CANDIDATES) throw new Error('原胞验证需要比较过多原子，请减小结构或使用整数超胞变换。');
            const coordinates = [candidate.fractional.x, candidate.fractional.y, candidate.fractional.z];
            if (coordinates.every((value, axis) => Math.abs(value - shifted[axis] - Math.round(value - shifted[axis])) < 1e-7)) { found = candidate; break; }
          }
          if (!found) throw new Error('此变换的基矢不是结构的周期平移；继续会丢失原子或改变化学组成，请检查变换矩阵。');
          remaining.delete(found);
        }
      }
    }
  }

  // The image of the unit cube is a parallelotope. Its axis-aligned bounds
  // enclose all candidate old-cell translations, including sheared cells.
  const minimum = P.map(row => row.reduce((sum, value) => sum + Math.min(0, value), 0));
  const maximum = P.map(row => row.reduce((sum, value) => sum + Math.max(0, value), 0));
  const EPS = 1e-9;
  const inside = (v: number[]) => v.every(value => value >= -EPS && value < 1 - EPS);
  const atoms: Atom[] = [];
  let candidates = 0;
  for (const atom of structure.atoms) {
    const origin = [atom.fractional.x, atom.fractional.y, atom.fractional.z];
    // For unwrapped coordinates select translation representatives independently
    // of the atom/origin, so identity transforms actually preserve slab positions.
    const canonical = origin.map(value => value - Math.floor(value));
    const offsets = params.normalizeRange ? origin.map((value, axis) => p[axis] - value) : integerBasis ? [0, 0, 0] : canonical.map(value => -value);
    const low = minimum.map((value, axis) => Math.floor(value + offsets[axis] - EPS));
    const high = maximum.map((value, axis) => Math.ceil(value + offsets[axis] + EPS));
    candidates += high.reduce((product, value, axis) => product * (value - low[axis] + 1), 1);
    if (!Number.isSafeInteger(candidates) || candidates > MAX_TRANSFORM_CANDIDATES) {
      throw new Error('晶胞变换需要搜索过多周期镜像，请减小矩阵或拆分操作。');
    }
    for (let nx = low[0]; nx <= high[0]; nx++) {
      for (let ny = low[1]; ny <= high[1]; ny++) {
        for (let nz = low[2]; nz <= high[2]; nz++) {
          if (!params.normalizeRange && !inside(multiplyMatrixVec(invP, integerBasis ? [nx, ny, nz] : [canonical[0] + nx, canonical[1] + ny, canonical[2] + nz]))) continue;
          const transformed = multiplyMatrixVec(invP, [origin[0] + nx - p[0], origin[1] + ny - p[1], origin[2] + nz - p[2]]);
          if (params.normalizeRange && !inside(transformed)) continue;
          const coordinates = params.normalizeRange ? transformed.map(value => Math.abs(value) < EPS ? 0 : value) : transformed;
          const fractional: Vec3 = { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
          assertAtomCount(atoms.length + 1);
          // Do not merge nearby or coincident source atoms: they may represent
          // distinct labels, disorder, occupancies, or independently edited sites.
          atoms.push({ ...atom, id: atoms.length + 1, fractional, cartesian: fractionalToCartesian(fractional, matrix), selected: false });
        }
      }
    }
  }
  if (atoms.length !== Math.round(expectedCount)) throw new Error('晶胞变换后的原子数与体积比例不一致，无法可靠构建此晶胞。');
  const result = { ...structure, title: `${structure.title} (Transformed)`, lattice, atoms };
  assertStructureValid(result, false);
  return result;
}

/** Replicate without modifying the input structure or dropping atom metadata. */
export function createSupercell(structure: CrystalStructure, nx: number, ny: number, nz: number): CrystalStructure {
  assertStructureValid(structure, false);
  if (!structure.lattice) throw new Error('当前结构无晶格信息，无法构建超胞。');
  const repeats = [nx, ny, nz];
  if (!repeats.every(value => Number.isSafeInteger(value) && value >= 1)) throw new Error('超胞复制倍数必须为大于零的整数。');
  assertAtomCount(structure.atoms.length * nx * ny * nz);
  const matrix = structure.lattice.matrix.map((vector, axis) => ({ x: vector.x * repeats[axis], y: vector.y * repeats[axis], z: vector.z * repeats[axis] })) as [Vec3, Vec3, Vec3];
  const lattice = calculateLatticeFromMatrix(matrix);
  const atoms: Atom[] = [];
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        structure.atoms.forEach(atom => {
          const fractional = { x: (atom.fractional.x + ix) / nx, y: (atom.fractional.y + iy) / ny, z: (atom.fractional.z + iz) / nz };
          atoms.push({ ...atom, id: atoms.length + 1, fractional, cartesian: fractionalToCartesian(fractional, matrix), selected: false });
        });
      }
    }
  }
  const result = { ...structure, title: `${structure.title} (${nx}x${ny}x${nz} 超胞)`, lattice, atoms };
  assertStructureValid(result, false);
  return result;
}
