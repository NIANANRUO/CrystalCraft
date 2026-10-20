import { Vec3, Lattice } from '../types/crystal';
import { assertFiniteVector, assertLatticeMatrix } from './validation';

export function dot(v1: Vec3, v2: Vec3): number {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

export function cross(v1: Vec3, v2: Vec3): Vec3 {
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x
  };
}

export function norm(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function dist(v1: Vec3, v2: Vec3): number {
  const dx = v1.x - v2.x;
  const dy = v1.y - v2.y;
  const dz = v1.z - v2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Convert fractional coordinates to Cartesian using lattice matrix [vA, vB, vC]
export function fractionalToCartesian(frac: Vec3, matrix: [Vec3, Vec3, Vec3]): Vec3 {
  assertFiniteVector(frac, '分数坐标');
  const [a, b, c] = matrix;
  const result = {
    x: frac.x * a.x + frac.y * b.x + frac.z * c.x,
    y: frac.x * a.y + frac.y * b.y + frac.z * c.y,
    z: frac.x * a.z + frac.y * b.z + frac.z * c.z
  };
  assertFiniteVector(result, '笛卡尔坐标');
  return result;
}

// 3x3 Matrix determinant
export function matrixDet(m: [Vec3, Vec3, Vec3]): number {
  const [a, b, c] = m;
  return dot(a, cross(b, c));
}

// 3x3 Matrix Inversion
export function invertMatrix(m: [Vec3, Vec3, Vec3]): [Vec3, Vec3, Vec3] {
  assertLatticeMatrix(m);
  const det = matrixDet(m);

  const [a, b, c] = m;
  const invDet = 1 / det;

  const rowA = cross(b, c);
  const rowB = cross(c, a);
  const rowC = cross(a, b);

  return [
    { x: rowA.x * invDet, y: rowA.y * invDet, z: rowA.z * invDet },
    { x: rowB.x * invDet, y: rowB.y * invDet, z: rowB.z * invDet },
    { x: rowC.x * invDet, y: rowC.y * invDet, z: rowC.z * invDet }
  ];
}

// Convert Cartesian to fractional coordinates
export function cartesianToFractional(cart: Vec3, matrix: [Vec3, Vec3, Vec3]): Vec3 {
  assertFiniteVector(cart, '笛卡尔坐标');
  const inv = invertMatrix(matrix);
  const result = {
    x: cart.x * inv[0].x + cart.y * inv[0].y + cart.z * inv[0].z,
    y: cart.x * inv[1].x + cart.y * inv[1].y + cart.z * inv[1].z,
    z: cart.x * inv[2].x + cart.y * inv[2].y + cart.z * inv[2].z
  };
  assertFiniteVector(result, '分数坐标');
  return result;
}

// Calculate lattice parameters from matrix
export function calculateLatticeFromMatrix(matrix: [Vec3, Vec3, Vec3]): Lattice {
  assertLatticeMatrix(matrix);
  const [va, vb, vc] = matrix;
  const a = norm(va);
  const b = norm(vb);
  const c = norm(vc);

  const radToDeg = 180 / Math.PI;
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(vb, vc) / (b * c)))) * radToDeg;
  const beta = Math.acos(Math.max(-1, Math.min(1, dot(va, vc) / (a * c)))) * radToDeg;
  const gamma = Math.acos(Math.max(-1, Math.min(1, dot(va, vb) / (a * b)))) * radToDeg;

  const volume = Math.abs(dot(va, cross(vb, vc)));

  return {
    matrix,
    a,
    b,
    c,
    alpha,
    beta,
    gamma,
    volume
  };
}

// Construct lattice vectors from a, b, c, alpha, beta, gamma
export function buildLatticeMatrix(
  a: number,
  b: number,
  c: number,
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number
): [Vec3, Vec3, Vec3] {
  if (![a, b, c].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('晶胞长度必须为大于零的有限数值。');
  }
  if (![alphaDeg, betaDeg, gammaDeg].every(value => Number.isFinite(value) && value > 0 && value < 180)) {
    throw new Error('晶胞角度必须在 0° 与 180° 之间。');
  }
  const degToRad = Math.PI / 180;
  const alpha = alphaDeg * degToRad;
  const beta = betaDeg * degToRad;
  const gamma = gammaDeg * degToRad;

  const cosA = Math.cos(alpha);
  const cosB = Math.cos(beta);
  const cosC = Math.cos(gamma);
  const sinC = Math.sin(gamma);

  const vA: Vec3 = { x: a, y: 0, z: 0 };
  const vB: Vec3 = { x: b * cosC, y: b * sinC, z: 0 };

  const gramDet = 1 - cosA * cosA - cosB * cosB - cosC * cosC + 2 * cosA * cosB * cosC;
  if (gramDet <= 0) throw new Error('晶胞角度组合不能构成非退化的三维晶格。');
  const term = Math.sqrt(gramDet);

  const vCz = (c * term) / sinC;
  const vCy = (c * (cosA - cosB * cosC)) / sinC;
  const vCx = c * cosB;

  const vC: Vec3 = { x: vCx, y: vCy, z: vCz };

  const matrix: [Vec3, Vec3, Vec3] = [vA, vB, vC];
  assertLatticeMatrix(matrix);
  return matrix;
}
