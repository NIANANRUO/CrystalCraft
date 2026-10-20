import test from 'node:test';
import assert from 'node:assert/strict';
import { readStartupOptions, MATERIALS,LEGACY_MATERIALS } from '../src/config';
import { importStructure } from '../src/importStructure';

test('hostile URL values cannot produce nonfinite numbers or unknown presets', () => {
  const options = readStartupOptions('?material=evil&bondStyle=evil&atomScale=NaN&bondRadius=Infinity&lightIntensity=-100&ambientIntensity=1e99&propertiesTab=missing&zoom=100000');
  assert.equal(options.material, 'comic');
  assert.equal(options.bondStyle, 'aromatic');
  assert.equal(options.atomScale, 1);
  assert.equal(options.bondRadius, 0.055);
  assert.equal(options.lightIntensity, 0.5);
  assert.equal(options.ambientIntensity, 2.5);
  assert.equal(options.propertiesTab, 'polyhedra');
  assert.equal(options.zoom, 90);
});

test('all existing material presets remain reachable by URL', () => {
  assert.equal(LEGACY_MATERIALS.length, 20);assert.equal(MATERIALS.length,31);
  assert.deepEqual(MATERIALS.slice(0,20),LEGACY_MATERIALS);
  for (const material of MATERIALS) assert.equal(readStartupOptions(`?material=${material}`).material, material);
});

test('file importer preserves blank XYZ comment and does not reinterpret malformed named files', () => {
  const xyz = '2\n\nH 0 0 0\nH 0 0 0.74\n';
  assert.equal(importStructure(xyz, 'molecule.xyz').atoms.length, 2);
  assert.equal(importStructure(xyz, 'molecule.txt').atoms.length, 2);
  assert.throws(() => importStructure(xyz, 'molecule.cif'));
  assert.throws(() => importStructure('', 'empty.xyz'));
});
