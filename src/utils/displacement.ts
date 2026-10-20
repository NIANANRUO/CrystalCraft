import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Atom, Vec3 } from '../types/crystal';

export type Tensor = NonNullable<Atom['displacement']>;
export function tensorMatrix(u: Tensor): Matrix3 {
  return new Matrix3().set(u[0], u[3], u[4], u[3], u[1], u[5], u[4], u[5], u[2]);
}
export function matrixTensor(m: Matrix3): Tensor {
  const e = m.elements;
  return [e[0], e[4], e[8], (e[1] + e[3]) / 2, (e[2] + e[6]) / 2, (e[5] + e[7]) / 2];
}
export function basisMatrix(matrix: [Vec3, Vec3, Vec3]): Matrix3 {
  const [a, b, c] = matrix;
  return new Matrix3().set(a.x, b.x, c.x, a.y, b.y, c.y, a.z, b.z, c.z);
}
/** IUCr Uij uses reciprocal-axis lengths: Ucart = A D* Uij D* Aᵀ. */
export function cifTensor(u: Tensor, matrix: [Vec3, Vec3, Vec3], inverse = false): Tensor {
  const a = basisMatrix(matrix);
  const e = a.clone().invert().elements;
  const d = [Math.hypot(e[0], e[3], e[6]), Math.hypot(e[1], e[4], e[7]), Math.hypot(e[2], e[5], e[8])];
  let t = a.multiply(new Matrix3().set(d[0], 0, 0, 0, d[1], 0, 0, 0, d[2]));
  if (inverse) t = t.invert();
  return matrixTensor(t.clone().multiply(tensorMatrix(u)).multiply(t.clone().transpose()));
}
export function rotateTensor(u: Tensor, matrix: [Vec3, Vec3, Vec3], rows: number[][]): Tensor {
  const a = basisMatrix(matrix);
  const r = new Matrix3().set(...rows.flat() as [number, number, number, number, number, number, number, number, number]);
  const t = a.clone().multiply(r).multiply(a.clone().invert());
  return matrixTensor(t.clone().multiply(tensorMatrix(u)).multiply(t.clone().transpose()));
}
/** Jacobi diagonalization of a real symmetric tensor; 50% 3D probability surface. */
export function displacementAxes(u: Tensor) {
  if (!Array.isArray(u) || u.length !== 6 || !u.every(Number.isFinite)) throw new Error('热位移张量必须包含六个有限数值。');
  const a = [[u[0], u[3], u[4]], [u[3], u[1], u[5]], [u[4], u[5], u[2]]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 32; iteration++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const c = Math.cos(angle), s = Math.sin(angle);
    const app = a[p][p], aqq = a[q][q], apq = a[p][q];
    a[p][p] = c*c*app - 2*s*c*apq + s*s*aqq;
    a[q][q] = s*s*app + 2*s*c*apq + c*c*aqq;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) { const kp = a[k][p], kq = a[k][q]; a[k][p] = a[p][k] = c*kp - s*kq; a[k][q] = a[q][k] = s*kp + c*kq; }
      const vp = v[k][p], vq = v[k][q]; v[k][p] = c*vp - s*vq; v[k][q] = s*vp + c*vq;
    }
  }
  const values = [a[0][0], a[1][1], a[2][2]];
  if (values.some(value => value <= 0 || value > 100)) throw new Error('热位移张量须为正定，主轴方差范围为 (0, 100] Å²。');
  const basis = new Matrix4().makeBasis(...[0, 1, 2].map(i => new Vector3(v[0][i], v[1][i], v[2][i])) as [Vector3, Vector3, Vector3]);
  return { scale: new Vector3(...values.map(value => Math.sqrt(2.365973884 * value)) as [number, number, number]), quaternion: new Quaternion().setFromRotationMatrix(basis) };
}
