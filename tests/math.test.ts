import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLatticeMatrix, calculateLatticeFromMatrix, cartesianToFractional, fractionalToCartesian, invertMatrix } from '../src/utils/math';
import { createSupercell, transformUnitCell, IDENTITY_MATRIX, Matrix3x3 } from '../src/utils/unitCellTransform';
import { parsePOSCAR } from '../src/parsers/poscar';
import { assertStructureValid, parseFiniteNumber } from '../src/utils/validation';
import type { Vec3 } from '../src/types/crystal';

const near = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const fixture = () => parsePOSCAR('test\n1\n2 0 0\n0 3 0\n0 0 4\nC\n1\nSelective dynamics\nDirect\n-0.25 1.5 0.75 T F T');
const transform = (rotationMatrix: Matrix3x3, normalizeRange = true, translationVector: [number, number, number] = [0, 0, 0]) => ({ rotationMatrix, translationVector, normalizeRange });

test('triclinic lattice conversions preserve fractional coordinates and cell volume', () => {
  const matrix = buildLatticeMatrix(3.2, 4.1, 5.6, 82, 77, 65);
  const lattice = calculateLatticeFromMatrix(matrix);
  near(lattice.a, 3.2); near(lattice.b, 4.1); near(lattice.c, 5.6);
  near(lattice.alpha, 82); near(lattice.beta, 77); near(lattice.gamma, 65);
  const frac = { x: -2.5, y: 1.25, z: 0.7 };
  const restored = cartesianToFractional(fractionalToCartesian(frac, matrix), matrix);
  near(restored.x, frac.x); near(restored.y, frac.y); near(restored.z, frac.z);
});

test('singular, non-finite and impossible-angle lattices are rejected', () => {
  const singular: [Vec3, Vec3, Vec3] = [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
  assert.throws(() => invertMatrix(singular));
  assert.throws(() => calculateLatticeFromMatrix(singular));
  assert.throws(() => buildLatticeMatrix(1, 1, 1, 10, 10, 170));
  assert.throws(() => buildLatticeMatrix(1, NaN, 1, 90, 90, 90));
  assert.throws(() => buildLatticeMatrix(1, 1, 1, 90, 90, 180));
});

test('numeric parsing accepts complete finite decimal/exponent syntax only', () => {
  assert.equal(parseFiniteNumber(' -1.25D+2 ', 'test'), -125);
  for (const value of ['', 'NaN', 'Infinity', '1x', '0x10', '1e999']) assert.throws(() => parseFiniteNumber(value, 'test'));
});

test('supercell expands atoms and cell together without dropping metadata or mutating input', () => {
  const original = fixture();
  original.atoms[0].occupancy = 0.5;
  original.atoms[0].colorOverride = '#123456';
  const before = structuredClone(original);
  const expanded = createSupercell(original, 2, 3, 1);
  assert.equal(expanded.atoms.length, 6);
  near(expanded.lattice!.volume, original.lattice!.volume * 6);
  assert.equal(new Set(expanded.atoms.map(atom => atom.id)).size, 6);
  assert.equal(expanded.atoms[5].occupancy, 0.5);
  assert.equal(expanded.atoms[5].colorOverride, '#123456');
  assert.deepEqual(expanded.atoms[5].selectiveDynamics, [true, false, true]);
  near(expanded.atoms[0].cartesian.x, original.atoms[0].cartesian.x);
  assert.deepEqual(original, before);
});

test('supercell rejects fractional, negative, non-finite and oversized replication before work', () => {
  for (const count of [0, -1, 0.5, NaN, Infinity, 2001, Number.MAX_SAFE_INTEGER]) assert.throws(() => createSupercell(fixture(), count, 1, 1));
});

test('identity cell transform preserves unwrapped coordinates when normalization is off', () => {
  const original = fixture();
  const result = transformUnitCell(original, transform(IDENTITY_MATRIX, false));
  assert.equal(result.atoms.length, 1);
  assert.deepEqual(result.atoms[0].fractional, original.atoms[0].fractional);
  assert.deepEqual(result.atoms[0].cartesian, original.atoms[0].cartesian);
});

test('normalization and translated cell origins select the correct periodic images', () => {
  const original = fixture();
  const result = transformUnitCell(original, transform(IDENTITY_MATRIX, true, [0.25, 0.25, 0.25]));
  assert.deepEqual(result.atoms[0].fractional, { x: 0.5, y: 0.25, z: 0.5 });
  near(result.lattice!.volume, original.lattice!.volume);
});

test('sheared and negative-determinant integer transforms preserve expected atom counts', () => {
  const original = fixture();
  for (const matrix of [ [[2, 1, 0], [0, 1, 0], [0, 0, 1]], [[-2, 0, 0], [0, 1, 0], [0, 0, 1]] ] as Matrix3x3[]) {
    const result = transformUnitCell(original, transform(matrix));
    assert.equal(result.atoms.length, 2);
    near(result.lattice!.volume, original.lattice!.volume * 2);
    for (const atom of result.atoms) assert.ok(Object.values(atom.fractional).every(value => value >= 0 && value < 1));
  }
});

test('primitive transform accepts real motif translations and rejects chemically incompatible reductions', () => {
  const original = parsePOSCAR('two sites\n1\n2 0 0\n0 3 0\n0 0 4\nC\n2\nDirect\n0 0 0\n0.5 0 0');
  const params = transform([[0.5, 0, 0], [0, 1, 0], [0, 0, 1]]);
  const result = transformUnitCell(original, params);
  assert.equal(result.atoms.length, 1);
  near(result.lattice!.volume, original.lattice!.volume / 2);
  original.atoms[1].element = 'O';
  assert.throws(() => transformUnitCell(original, params), /周期平移/);
});

test('transforms reject singular, enormous, search-heavy and non-finite matrices', () => {
  for (const matrix of [ [[0, 0, 0], [0, 1, 0], [0, 0, 1]], [[2001, 0, 0], [0, 1, 0], [0, 0, 1]], [[1, 10000, 0], [0, 1, 10000], [0, 0, 1]], [[NaN, 0, 0], [0, 1, 0], [0, 0, 1]] ] as Matrix3x3[]) {
    assert.throws(() => transformUnitCell(fixture(), transform(matrix)));
  }
  assert.throws(() => transformUnitCell(fixture(), transform(IDENTITY_MATRIX, true, [Infinity, 0, 0])));
});

test('integer transforms preserve coincident source atoms and metadata', () => {
  const original = fixture();
  original.atoms.push({ ...structuredClone(original.atoms[0]), id: 2, occupancy: 0.25, name: 'disorder site' });
  const result = transformUnitCell(original, transform(IDENTITY_MATRIX));
  assert.equal(result.atoms.length, 2);
  assert.equal(result.atoms[1].name, 'disorder site');
  assert.equal(result.atoms[1].occupancy, 0.25);
});

test('structure validation rejects duplicate IDs, invalid occupancy and non-finite edits', () => {
  const duplicate = fixture();
  duplicate.atoms.push(structuredClone(duplicate.atoms[0]));
  assert.throws(() => assertStructureValid(duplicate), /ID/);
  const occupancy = fixture(); occupancy.atoms[0].occupancy = -0.1;
  assert.throws(() => assertStructureValid(occupancy), /占据率/);
  const coordinates = fixture(); coordinates.atoms[0].cartesian.x = NaN;
  assert.throws(() => assertStructureValid(coordinates), /NaN/);
});
