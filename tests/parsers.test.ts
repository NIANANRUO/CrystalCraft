import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXYZ, exportXYZ } from '../src/parsers/xyz';
import { parsePOSCAR, exportPOSCAR } from '../src/parsers/poscar';
import { parseCIF, exportCIF } from '../src/parsers/cif';
import { TEST_LEGACY_SITE_ORDER_CIF, TEST_ROUNDED_HEXAGONAL_CIF, TEST_ROUNDED_PLANAR_CIF } from './fixtures/cif';

const near = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const poscar = (scale = '1', coordinates = 'Direct\n0.25 0.5 0.75', lattice = '1 0 0\n0 1 0\n0 0 1') => `sample\n${scale}\n${lattice}\nC\n1\n${coordinates}\n`;
const cifCell = `data_test
_cell_length_a 4
_cell_length_b 5
_cell_length_c 6
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90`;
const cifAtoms = `loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
C1 C 0.1 0.2 0.3 0.5`;
const cif = (extra = '', atoms = cifAtoms) => `${cifCell}\n${extra}\n${atoms}\n`;

test('XYZ keeps a blank mandatory comment and all atoms, including CRLF/BOM files', () => {
  const structure = parseXYZ('\uFEFF2\r\n\r\nC 0 0 0\r\nO 1.2 -2 3\r\n', 'blank.xyz');
  assert.equal(structure.title, 'blank.xyz');
  assert.equal(structure.atoms.length, 2);
  assert.deepEqual(structure.atoms[1].cartesian, { x: 1.2, y: -2, z: 3 });
  assert.equal(parseXYZ(exportXYZ(structure)).atoms.length, 2);
});

test('XYZ rejects truncated, extra-frame, non-finite and malformed numeric input', () => {
  for (const invalid of ['2\ncomment\nC 0 0 0', '1\ncomment\nC 0 0 0\nH 1 0 0', '1\ncomment\nC NaN 0 0', '1\ncomment\nC Infinity 0 0', '1\ncomment\nC 1e309 0 0', '1\ncomment\nC 1oops 0 0', '1\ncomment\nC 0 0', '0\ncomment\n', '2001\ncomment\n']) {
    assert.throws(() => parseXYZ(invalid));
  }
});

test('text parsers reject binary input and exports keep titles on one line', () => {
  assert.throws(() => parseXYZ('1\n\0\nC 0 0 0'));
  const structure = parseXYZ('1\ncomment\nC 0 0 0');
  structure.title = 'name\n999\r\nC 1 2 3';
  assert.equal(exportXYZ(structure).split('\n').length, 3);
});

test('POSCAR three-axis scales affect vector components and Cartesian positions', () => {
  const structure = parsePOSCAR(poscar('2 3 4', 'Cartesian\n0.25 0.5 0.75', '1 1 0\n0 1 0\n0 0 1'));
  assert.deepEqual(structure.lattice!.matrix[0], { x: 2, y: 3, z: 0 });
  assert.deepEqual(structure.atoms[0].cartesian, { x: 0.5, y: 1.5, z: 3 });
  near(structure.atoms[0].fractional.x, 0.25);
  near(structure.atoms[0].fractional.y, 0.25);
  near(structure.atoms[0].fractional.z, 0.75);
});

test('POSCAR negative scale means target volume, including left-handed cells', () => {
  const structure = parsePOSCAR(poscar('-48', 'Cartesian\n0.5 0.25 0.125', '1 0 0\n0 2 0\n0 0 -3'));
  near(structure.lattice!.volume, 48);
  assert.deepEqual(structure.atoms[0].cartesian, { x: 1, y: 0.5, z: 0.25 });
  near(structure.atoms[0].fractional.z, -1 / 24);
});

test('POSCAR Selective dynamics and deliberately unwrapped coordinates survive export', () => {
  const original = parsePOSCAR(poscar('1', 'Selective dynamics\nDirect\n-0.25 1.5 0.75 T F T'));
  const restored = parsePOSCAR(exportPOSCAR(original));
  assert.equal(restored.hasSelectiveDynamics, true);
  assert.deepEqual(restored.atoms[0].selectiveDynamics, [true, false, true]);
  assert.deepEqual(restored.atoms[0].fractional, original.atoms[0].fractional);
});

test('POSCAR exports group species and their coordinates consistently', () => {
  const structure = parsePOSCAR('test\n1\n1 0 0\n0 1 0\n0 0 1\nC O\n2 1\nDirect\n0 0 0\n0.1 0.2 0.3\n0.4 0.5 0.6');
  structure.atoms = [structure.atoms[0], structure.atoms[2], structure.atoms[1]];
  const restored = parsePOSCAR(exportPOSCAR(structure));
  assert.deepEqual(restored.atoms.map(atom => atom.element), ['C', 'C', 'O']);
  assert.deepEqual(restored.atoms[2].fractional, { x: 0.4, y: 0.5, z: 0.6 });
});

test('POSCAR rejects invalid scale, singular lattice, bad counts, truncated coordinates and flags', () => {
  for (const scale of ['0', '1 2', '1 -2 3', 'NaN', '1e999']) assert.throws(() => parsePOSCAR(poscar(scale)));
  assert.throws(() => parsePOSCAR(poscar('1', 'Direct\n0 0 0', '1 0 0\n2 0 0\n0 0 1')));
  assert.throws(() => parsePOSCAR(poscar().replace('\nC\n1\n', '\nC\n1.5\n')));
  assert.throws(() => parsePOSCAR(poscar().replace('\nC\n1\n', '\nC O\n1\n')));
  assert.throws(() => parsePOSCAR(poscar('1', 'Direct\n0 0')));
  assert.throws(() => parsePOSCAR(poscar('1', 'Direct\nNaN 0 0')));
  assert.throws(() => parsePOSCAR(poscar('1', 'Selective dynamics\nDirect\n0 0 0 T F')));
  assert.throws(() => parsePOSCAR(poscar('1', 'Unknown\n0 0 0')));
});

test('CIF explicit inversion symmetry expands general sites, deduplicates special sites and preserves occupancy', () => {
  const structure = parseCIF(cif(`_space_group_IT_number 2
_space_group_name_H-M_alt 'P -1'
loop_
_space_group_symop_id
_space_group_symop_operation_xyz
1 'x,y,z'
2 '-x,-y,-z'`, `${cifAtoms}\nO1 O 0 0 0 1`));
  assert.equal(structure.atoms.length, 3);
  assert.deepEqual(structure.atoms.map(atom => atom.occupancy), [0.5, 0.5, 1]);
  near(structure.atoms[1].fractional.x, 0.9);
  near(structure.atoms[1].fractional.y, 0.8);
  near(structure.atoms[1].fractional.z, 0.7);
  const restored = parseCIF(exportCIF(structure));
  assert.equal(restored.atoms.length, 3);
  near(restored.lattice!.volume, structure.lattice!.volume);
  restored.atoms.forEach((atom, index) => {
    assert.equal(atom.element, structure.atoms[index].element);
    assert.equal(atom.occupancy, structure.atoms[index].occupancy);
    near(atom.cartesian.x, structure.atoms[index].cartesian.x);
    near(atom.cartesian.y, structure.atoms[index].cartesian.y);
    near(atom.cartesian.z, structure.atoms[index].cartesian.z);
  });
  assert.throws(() => exportPOSCAR(structure), /占据率/);
});

test('CIF tokenization supports wrapped rows, quoted labels, comments and uncertainty exponents', () => {
  const structure = parseCIF(cif(`_audit_creation_method
;line one
line two
;`, cifAtoms.replace('C1 C 0.1 0.2 0.3 0.5', "'C label' C\n1.0(2)e-1 2D-1 # inline comment\n.3 0.5")));
  assert.equal(structure.atoms[0].name, 'C label');
  assert.deepEqual(structure.atoms[0].fractional, { x: 0.1, y: 0.2, z: 0.3 });
});

test('legacy CIF multiplicity accepts both historical site-order and Wyckoff conventions', () => {
  for (const content of [TEST_LEGACY_SITE_ORDER_CIF, TEST_LEGACY_SITE_ORDER_CIF.replace('C1 C 1', 'C1 C 2').replace('O1 O 2', 'O1 O 1')]) {
    const structure = parseCIF(content);
    assert.equal(structure.atoms.length, 3);
    assert.deepEqual(structure.atoms.map(a => [a.element, a.occupancy]), [['C', .5], ['C', .5], ['O', 1]]);
    assert.equal(structure.sourceCif!.text, content);
    const restored = parseCIF(exportCIF(structure));
    assert.equal(restored.atoms.length, 3);
    restored.atoms.forEach((a, i) => { assert.equal(a.occupancy, structure.atoms[i].occupancy); near(a.cartesian.x, structure.atoms[i].cartesian.x); });
  }
});

test('modern CIF multiplicity/order tags are authoritative and validate their distinct meanings', () => {
  const modern = TEST_LEGACY_SITE_ORDER_CIF.replace('_atom_site_symmetry_multiplicity', '_atom_site_site_symmetry_multiplicity\n_atom_site_site_symmetry_order\n_atom_site_symmetry_multiplicity')
    .replace('C1 C 1', 'C1 C 2 1 3').replace('O1 O 2', 'O1 O 1 2 3');
  assert.equal(parseCIF(modern).atoms.length, 3); // Ambiguous obsolete metadata is superseded.
  assert.equal(parseCIF(modern.replace(/_atom_site_/g, '_atom_site.')).atoms.length, 3);
  assert.throws(() => parseCIF(modern.replace('C1 C 2 1 3', 'C1 C 1 1 2')), /位点多重度/);
  assert.throws(() => parseCIF(modern.replace('C1 C 2 1 3', 'C1 C 2 2 2')), /位点对称阶/);
  assert.equal(parseCIF(modern.replace('C1 C 2 1 3', 'C1 C ? ? 1')).atoms.length, 3);
});

test('CIF rejects genuinely inconsistent legacy multiplicities and malformed site declarations', () => {
  for (const value of ['0', '-1', '1.5', '193', 'NaN', '3']) {
    assert.throws(() => parseCIF(TEST_LEGACY_SITE_ORDER_CIF.replace('C1 C 1', `C1 C ${value}`)));
  }
  assert.equal(parseCIF(TEST_LEGACY_SITE_ORDER_CIF.replace('C1 C 1', 'C1 C ?')).atoms.length, 3);
  const invalid = TEST_LEGACY_SITE_ORDER_CIF.replace('_atom_site_symmetry_multiplicity', '_atom_site_site_symmetry_order').replace('C1 C 1', 'C1 C 2');
  assert.throws(() => parseCIF(invalid), /位点对称阶/);
});

test('rounded hexagonal special positions deduplicate geometrically and retain the intended 12 sites', () => {
  const structure = parseCIF(TEST_ROUNDED_HEXAGONAL_CIF);
  assert.equal(structure.atoms.length, 12);
  assert.deepEqual(['Zr1', 'Zr2', 'Si1', 'N1'].map(label => structure.atoms.filter(a => a.name === label).length), [4, 2, 2, 4]);
  assert.deepEqual(structure.atoms[0].fractional, { x: .33333333, y: .66666667, z: .13712345 });
  const withoutMetadata = TEST_ROUNDED_HEXAGONAL_CIF.replace('_atom_site_symmetry_multiplicity', '_unused_column');
  assert.equal(parseCIF(withoutMetadata).atoms.length, 12);
  assert.equal(parseCIF(exportCIF(structure)).atoms.length, 12);
});

test('symmetry-site dedup handles periodic faces without merging distinct source sites or resolved images', () => {
  const nearBoundary = TEST_LEGACY_SITE_ORDER_CIF.replace('C1 C 1 .15 .27 .31 .5', 'C1 C 2 1 0 .5 .5');
  assert.equal(parseCIF(nearBoundary).atoms.length, 2);
  const splitRows = nearBoundary + 'C2 C 2 1 0 .5 .5\n';
  assert.equal(parseCIF(splitRows).atoms.length, 3); // Disorder/source rows remain independent.
  const closeButResolved = TEST_LEGACY_SITE_ORDER_CIF.replace('C1 C 1 .15 .27 .31 .5', 'C1 C 1 .00002 0 0 .5');
  assert.equal(parseCIF(closeButResolved).atoms.length, 3);
});

test('five-decimal special-site rounding is propagated through symmetry without dropping free-coordinate precision', () => {
  const structure = parseCIF(TEST_ROUNDED_PLANAR_CIF);
  assert.equal(structure.atoms.length, 6);
  assert.deepEqual(structure.atoms[0].fractional, { x: .18183, y: .36365, z: .25 });
  assert.equal(parseCIF(TEST_ROUNDED_PLANAR_CIF.replace('.18183 .36365', '1.8183e-1 3.6365D-1')).atoms.length, 6);
  assert.equal(parseCIF(TEST_ROUNDED_PLANAR_CIF.replace('_atom_site_symmetry_multiplicity', '_unused_column')).atoms.length, 6);
  // The same nominal offset explicitly recorded with high precision is resolved;
  // experimental uncertainty is not an instruction to move or merge atoms.
  const resolved = TEST_ROUNDED_PLANAR_CIF.replace('_atom_site_symmetry_multiplicity', '_unused_column')
    .replace('.18183 .36365', '.181830000(5000) .363650000(5000)');
  assert.equal(parseCIF(resolved).atoms.length, 12);
});

test('small lattice units do not collapse symmetry-distinct positions under a Cartesian tolerance', () => {
  const small = TEST_LEGACY_SITE_ORDER_CIF.replace('_cell_length_a 6', '_cell_length_a .00001')
    .replace('_cell_length_b 7', '_cell_length_b .00001').replace('_cell_length_c 8', '_cell_length_c .00001');
  assert.equal(parseCIF(small).atoms.length, 3);
});

test('CIF keeps unwrapped P1 and distinct coincident source sites on roundtrip', () => {
  const structure = parseCIF(cif('', cifAtoms.replace('0.1 0.2 0.3', '-0.1 1.2 0.3') + '\nC2 C -0.1 1.2 0.3 0.5'));
  const restored = parseCIF(exportCIF(structure));
  assert.equal(restored.atoms.length, 2);
  assert.deepEqual(restored.atoms[0].fractional, { x: -0.1, y: 1.2, z: 0.3 });
});

test('CIF refuses missing or incomplete non-P1 symmetry instead of silently losing atoms', () => {
  for (const group of ['_space_group_IT_number 2', "_space_group_name_H-M_alt 'F m -3 m'", "_space_group_name_H-M_alt 'P 21/c'"]) {
    assert.throws(() => parseCIF(cif(group)), /完整对称操作/);
  }
  assert.throws(() => parseCIF(cif(`_space_group_IT_number 19
loop_
_space_group_symop_operation_xyz
'x,y,z'
'-x,-y,z'`)), /不完整/);
  assert.throws(() => parseCIF(cif(`loop_
_space_group_symop_operation_xyz
'x,y,z'
'x+1/3,y,z'`)), /未闭合/);
  assert.throws(() => parseCIF(cif("_space_group_IT_number 1\n_space_group_name_H-M_alt 'P -1'")), /冲突/);
});

test('CIF rejects metric-incompatible, malformed and executable symmetry expressions', () => {
  for (const operation of ['y,x,z', 'x+y,y,z', 'x/0,y,z', 'x,0,z', 'globalThis.alert(1),y,z']) {
    assert.throws(() => parseCIF(cif(`loop_\n_space_group_symop_operation_xyz\n'x,y,z'\n'${operation}'`)));
  }
});

test('CIF rejects partial loops, missing coordinates, multiple structures and non-finite atoms', () => {
  assert.throws(() => parseCIF(cif('', cifAtoms.replace('0.3 0.5', '0.3'))), /不完整/);
  assert.throws(() => parseCIF(cif('', cifAtoms.replace('_atom_site_fract_z', '_unrelated'))), /坐标列不完整/);
  assert.throws(() => parseCIF(cif() + '\ndata_second\n'), /多个/);
  assert.throws(() => parseCIF(cif('', cifAtoms.replace('0.1', 'NaN'))));
  assert.throws(() => parseCIF(cif('', cifAtoms.replace('0.5', '1.1'))), /占据率/);
  assert.throws(() => parseCIF(cif().replace('_cell_angle_gamma 90', '_cell_angle_gamma 0')));
});
