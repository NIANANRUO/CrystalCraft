import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { encodeProject, parseProject, ProjectHistory, type ProjectState } from '../src/project';
import { parsePOSCAR } from '../src/parsers/poscar';
import { parseCIF, exportCIF } from '../src/parsers/cif';
import { TEST_POSCAR } from './fixtures/structures';
import { DEFAULT_POLYHEDRA_SETTINGS } from '../src/types/crystal';
import { displacementAxes, cifTensor, rotateTensor, tensorMatrix } from '../src/utils/displacement';
import { buildLatticeMatrix } from '../src/utils/math';
import { batchOpaqueMeshes, instanceAtomId, renderedInstanceCount } from '../src/renderer/instances';
import { createMaterial } from '../src/renderer/materials';
import { disposeObjectTree } from '../src/renderer/resources';
import { importStructure } from '../src/importStructure';

export const projectFixture = (): ProjectState => ({
  structure: parsePOSCAR(TEST_POSCAR), materialType: 'comic', renderMode: 'ball-and-stick', showLattice: true, showAxes: true,
  visualSettings: { atomScale: 1, bondRadius: .055, bondTolerance: 1.15, bondStyle: 'aromatic', bondColorMode: 'uniform', doubleBondGap: .14,
    elementColors: {}, elementRadii: {}, showPolyhedra: false, showHBonds: false, showOutline: true, showShadows: true,
    showFog: false, showLabels: 'none', isOrthographic: false, autoRotate: false, autoRotateSpeed: 2, ligandViewRadius: null,
    showBoundaryAtoms: true, polyhedraSettings: structuredClone(DEFAULT_POLYHEDRA_SETTINGS) },
});
test('versioned project round trip preserves all source data and zero-valued rendering controls', () => {
  const state = projectFixture();
  Object.assign(state.visualSettings, { atomShininess: 0, labelOffsetZ: 0, outlineWidth: 0, atomStacks: 8, atomSlices: 64 });
  assert.deepEqual(parseProject(encodeProject(state)), JSON.parse(JSON.stringify(state)));
  assert.throws(() => parseProject(encodeProject(state).replace('"version":2', '"version":9000')), /版本/);
  assert.deepEqual(parseProject(encodeProject(state).replace('"version":2','"version":1')),JSON.parse(JSON.stringify(state)));
});
test('hostile projects reject invalid nested values before altering an application', () => {
  const mutations = [
    (p: any) => p.visualSettings.atomStacks = 1e8,
    (p: any) => p.visualSettings.bondRadius = null,
    (p: any) => p.visualSettings.elementColors.C = 'url(evil)',
    (p: any) => p.visualSettings.polyhedraSettings.material.opacity = 1000,
    (p: any) => p.structure.atoms[1].id = p.structure.atoms[0].id,
    (p: any) => p.structure.atoms[0].displacement = [-1, 1, 1, 0, 0, 0],
    (p: any) => p.materialType = 'missing',
    (p: any) => p.structure.lattice.a = 1,
    (p: any) => p.structure.atoms[0].cartesian.x += 1,
  ];
  for (const mutate of mutations) { const state = projectFixture(); mutate(state); assert.throws(() => parseProject(JSON.stringify({ kind: 'CrystalCraftProject', version: 1, state }))); }
  assert.throws(() => parseProject('{"__proto__":{},"version":1}'), /非法/);
});
test('history restores independent snapshots, bounds storage and invalidates redo after a branch', () => {
  const h = new ProjectHistory(), p = projectFixture();
  h.observe(p); p.structure.title = 'second'; h.observe(p); p.structure.title = 'third'; h.observe(p);
  assert.equal(h.undo()!.structure.title, 'second'); assert.equal(h.undo()!.structure.title, 'Synthetic QA cell');
  assert.equal(h.redo()!.structure.title, 'second'); p.structure.title = 'branch'; h.observe(p); assert.equal(h.redo(), null);
  for (let i = 0; i < 50; i++) { p.structure.title = String(i); h.observe(p); }
  assert.equal(h.past.length, 30);
});
test('thermal principal axes reconstruct rotated covariance and reject indefinite tensors', () => {
  const u: [number, number, number, number, number, number] = [.04, .09, .16, .01, .02, -.01];
  const axes = displacementAxes(u);
  const rotation = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(axes.quaternion));
  const d = axes.scale.toArray().map(v => v*v / 2.365973884);
  const rebuilt = rotation.clone().multiply(new THREE.Matrix3().set(d[0], 0, 0, 0, d[1], 0, 0, 0, d[2])).multiply(rotation.clone().transpose());
  rebuilt.elements.forEach((value, i) => assert.ok(Math.abs(value - tensorMatrix(u).elements[i]) < 1e-10));
  assert.throws(() => displacementAxes([1, 1, 1, 2, 0, 0]), /正定/);
  const matrix = buildLatticeMatrix(4, 5, 6, 70, 80, 110);
  const result = cifTensor(cifTensor(u, matrix), matrix, true);
  result.forEach((value, i) => assert.ok(Math.abs(value - u[i]) < 1e-10));
  assert.deepEqual(rotateTensor(u, buildLatticeMatrix(4, 4, 4, 90, 90, 90), [[-1,0,0],[0,-1,0],[0,0,-1]]).map(v => Math.round(v * 100)), u.map(v => Math.round(v * 100)));
});
const cif = `data_thermal
_cell_length_a 4
_cell_length_b 5
_cell_length_c 6
_cell_angle_alpha 70
_cell_angle_beta 80
_cell_angle_gamma 110
_symmetry_Int_Tables_number 1
_publ_section_title 'Retained source metadata'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_U_iso_or_equiv
C1 C .1 .2 .3 .03
loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
C1 .04 .06 .08 .01 .01 -.01
`;
test('CIF thermal tensors survive triclinic export and exact source is archived separately', () => {
  const parsed = parseCIF(cif), result = parseCIF(exportCIF(parsed));
  assert.equal(parsed.sourceCif!.text, cif);
  result.atoms[0].displacement!.forEach((value, i) => assert.ok(Math.abs(value - parsed.atoms[0].displacement![i]) < 1e-8));
  assert.throws(() => parseCIF(cif.replace('C1 .04 .06 .08 .01 .01 -.01', 'C1 -.04 .06 .08 .01 .01 -.01')), /正定/);
  assert.throws(() => parseCIF(cif.replace('_atom_site_aniso_U_23\n', '').replace(' .01 -.01\n', ' .01\n')), /完整六个/);
});
test('instancing preserves world transforms, ray picking and logical counts, and releases instance buffers', () => {
  const group = new THREE.Group(), cache = new Map<string, THREE.Material>();
  const geometry = new THREE.SphereGeometry(1, 8, 6), material = createMaterial('comic', '#ff0000', false, cache);
  for (let i = 0; i < 500; i++) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(i * 3, 0, 0); mesh.scale.set(.5, .7, .9); mesh.userData.atomId = i + 1; group.add(mesh); }
  batchOpaqueMeshes(group, cache); assert.equal(group.children.length, 1); assert.equal(renderedInstanceCount(group), 500);
  const batch = group.children[0] as THREE.InstancedMesh; group.updateMatrixWorld(true);
  const hits = new THREE.Raycaster(new THREE.Vector3(9, 0, 10), new THREE.Vector3(0, 0, -1)).intersectObject(batch);
  assert.ok(hits.length > 0); assert.equal(instanceAtomId(hits[0]), 4);
  const m = new THREE.Matrix4(); batch.getMatrixAt(3, m); assert.equal(m.elements[12], 9);
  let disposed = 0; batch.addEventListener('dispose', () => disposed++);
  disposeObjectTree(group); assert.equal(disposed, 1); cache.forEach(m => m.dispose());
});
test('transparent and transmission materials retain individual sorting', () => {
  for (const type of ['glass', 'frosted'] as const) {
    const group = new THREE.Group(), cache = new Map<string, THREE.Material>(), geometry = new THREE.SphereGeometry();
    for (let i = 0; i < 5; i++) group.add(new THREE.Mesh(geometry, createMaterial(type, '#fff', false, cache)));
    batchOpaqueMeshes(group, cache); assert.equal(group.children.length, 5); disposeObjectTree(group);
  }
});

test('magnetic CIF, truncated volumetric grids, and disguised multi-frame trajectories are explicit errors', () => {
  assert.throws(() => parseCIF(cif + '\n_atom_site_moment.crystalaxis_x 1\n'), /磁性/);
  for (const name of ['CHGCAR', 'LOCPOT', 'ELFCAR']) assert.throws(() => importStructure(TEST_POSCAR, name), /体网格|网格格式/);
  for (const name of ['XDATCAR', 'example.mcif']) assert.throws(() => importStructure(TEST_POSCAR, name), /尚不支持/);
  assert.throws(() => parsePOSCAR(TEST_POSCAR.replace('Direct', 'Direct configuration= 1')), /多帧/);
});
