import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLYHEDRA_SETTINGS } from '../src/types/crystal';
import { loadSavedPolyhedraSettings, POLYHEDRA_STORAGE_KEY, savePolyhedraDefaults } from '../src/components/savedPolyhedraSettings';

const copyDefaults = () => structuredClone(DEFAULT_POLYHEDRA_SETTINGS);

function withStorage(storage: object, run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

const loadRaw = (raw: string | null) => {
  let result;
  withStorage({ getItem: (key: string) => { assert.equal(key, POLYHEDRA_STORAGE_KEY); return raw; } }, () => {
    result = loadSavedPolyhedraSettings();
  });
  return result;
};

test('polyhedra defaults survive valid save/load and legacy optional fields', () => {
  const settings = copyDefaults();
  settings.style = 6;
  settings.centralElements = ['Mo', 'Ti'];
  settings.material = { specular: { r: 0, g: 128, b: 255 }, shininess: 0, opacity: 255 };
  settings.elementColors = { Mo: { r: 255, g: 0, b: 128, a: 0 } };
  settings.edges = { show: false, lineWidth: 10, color: { r: 0, g: 255, b: 128 } };
  assert.deepEqual(loadRaw(JSON.stringify(settings)), settings);
  delete settings.centerMode;
  delete settings.customAtomIds;
  assert.deepEqual(loadRaw(JSON.stringify(settings)), settings);
});

test('missing, corrupt, oversized, and non-object saved settings safely fall back', () => {
  for (const raw of [null, '', '{', 'null', 'false', '42', '[]', '{}', '"settings"', ' '.repeat(100_001)]) {
    assert.equal(loadRaw(raw), null);
  }
});

test('legacy saved defaults discard structure-specific selections on load', () => {
  for (const centerMode of ['all', 'custom'] as const) {
    const settings = { ...copyDefaults(), centerMode, customAtomIds: [0, 17, 90] };
    assert.deepEqual(loadRaw(JSON.stringify(settings)), { ...settings, centerMode: 'all', customAtomIds: [] });
  }
  const emptyCustom = { ...copyDefaults(), centerMode: 'custom', customAtomIds: [] };
  assert.deepEqual(loadRaw(JSON.stringify(emptyCustom)), { ...emptyCustom, centerMode: 'all' });
});

test('invalid nested values and out-of-range settings cannot enter rendering', () => {
  const mutations: Array<(settings: any) => void> = [
    s => { s.style = 0; }, s => { s.style = 7; }, s => { s.style = 1.5; },
    s => { s.centerMode = 'unknown'; },
    s => { s.centralElements = 'Mo'; }, s => { s.centralElements = ['<script>']; },
    s => { s.centralElements = Array(119).fill('Mo'); },
    s => { s.customAtomIds = [-1]; }, s => { s.customAtomIds = [1.1]; },
    s => { s.customAtomIds = [Number.MAX_SAFE_INTEGER + 1]; }, s => { s.customAtomIds = ['1']; },
    s => { s.material = null; }, s => { s.material.opacity = 256; }, s => { s.material.opacity = -1; },
    s => { s.material.shininess = 101; }, s => { s.material.specular.r = null; },
    s => { s.material.specular.b = 256; }, s => { s.material.specular.g = '255'; },
    s => { s.edges = null; }, s => { s.edges.show = 1; },
    s => { s.edges.lineWidth = 0; }, s => { s.edges.lineWidth = 10.1; },
    s => { s.edges.color.r = -1; }, s => { s.elementColors = []; },
    s => { s.elementColors = { Mo: { r: 0, g: 0, b: 0, a: 256 } }; },
    s => { s.elementColors = { Mo: { r: 0, g: 0, b: 0 } }; },
    s => { s.elementColors = { constructor: { r: 0, g: 0, b: 0, a: 255 } }; },
  ];
  for (const mutate of mutations) {
    const settings = copyDefaults();
    mutate(settings);
    assert.equal(loadRaw(JSON.stringify(settings)), null, mutate.toString());
  }
  assert.equal(loadRaw(JSON.stringify(copyDefaults()).replace('"shininess":100', '"shininess":1e999')), null);
});

test('storage failures do not throw or claim successful persistence', () => {
  withStorage({
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
  }, () => {
    assert.equal(loadSavedPolyhedraSettings(), null);
    assert.equal(savePolyhedraDefaults(copyDefaults()), false);
  });
});

test('saved defaults never reuse structure-specific atom IDs or mutate current settings', () => {
  const settings = copyDefaults();
  settings.centerMode = 'custom';
  settings.customAtomIds = [0, 17, 90];
  const original = structuredClone(settings);
  let raw: string | null = null;
  withStorage({
    getItem: () => raw,
    setItem: (key: string, value: string) => { assert.equal(key, POLYHEDRA_STORAGE_KEY); raw = value; },
  }, () => {
    assert.equal(savePolyhedraDefaults(settings), true);
    assert.deepEqual(loadSavedPolyhedraSettings(), { ...settings, centerMode: 'all', customAtomIds: [] });
  });
  assert.deepEqual(settings, original);
});
