import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpatialIndex } from '../src/renderer/spatialIndex';
import { disposeObjectTree } from '../src/renderer/resources';
import { exportPixelBudget, planImageExport } from '../src/renderer/exportPlan';
import { CrystalScene } from '../src/renderer/CrystalScene';
import { MAX_BOND_SEGMENTS } from '../src/renderer/limits';
import type { Atom } from '../src/types/crystal';

const atom = (id: number, x: number, y = 0, z = 0): Atom => ({
  id, element: 'C', cartesian: { x, y, z }, fractional: { x, y, z },
});

// Exercise the real scene pipeline and Three.js objects without creating a GPU
// context in Node. Only viewport lighting/camera work is replaced by a no-op.
function sceneHarness() {
  const scene: any = Object.create(CrystalScene.prototype);
  Object.assign(scene, {
    scene: new THREE.Scene(), structureGroup: new THREE.Group(),
    currentStructure: null, displayedAtomsCache: null, disposed: false,
    contextLost: false, exporting: false, renderError: null,
    batchDepth: 0, rebuildPending: false, renderedBondCount: 0,
    materialCache: new Map(), selectedAtomIds: new Set(), hiddenAtomIds: new Set(),
    polyhedraCenters: new Set(), polyhedraLigands: new Set(), polyhedraBonds: new Set(),
    customBonds: [], measurements: [], measureQueue: [],
    unitSphereGeo: new THREE.SphereGeometry(1, 8, 6),
    unitCylinderGeo: new THREE.CylinderGeometry(1, 1, 1, 8),
    materialType: 'flat', renderMode: 'ball-and-stick', bgColor: 'white', showAxes: false,
    visualSettings: {
      atomScale: 1, bondRadius: 0.05, bondTolerance: 1.15, bondStyle: 'single',
      bondColorMode: 'uniform', elementColors: {}, elementRadii: {},
      showBoundaryAtoms: false, showPolyhedra: false, showHBonds: false,
      showOutline: false, showShadows: false, showLabels: 'none', ligandViewRadius: null,
    },
    fitCameraToStructure() {}, updateLightingAndShadows() {},
  });
  for (const name of ['atomGroup', 'bondGroup', 'latticeGroup', 'outlineGroup', 'polyhedraGroup', 'hbondGroup', 'labelGroup', 'measurementGroup', 'shadowGroup']) {
    scene[name] = new THREE.Group();
    scene.structureGroup.add(scene[name]);
  }
  return scene;
}

function releaseHarness(scene: any) {
  disposeObjectTree(scene.structureGroup);
  scene.unitSphereGeo.dispose();
  scene.unitCylinderGeo.dispose();
}

test('atom geometry, radii, thermal axes, isolation filter and outline controls affect real scene objects', () => {
  const scene = sceneHarness();
  try {
    const atoms = [atom(1, 0), atom(2, 1.4), atom(3, 20)];
    atoms[0].displacement = [.04, .09, .16, 0, 0, 0];
    scene.currentStructure = { title: 'controls', isPeriodic: false, atoms };
    Object.assign(scene.visualSettings, { atomStacks: 12, atomSlices: 16, atomSpecular: { r: 0, g: 128, b: 255 }, atomShininess: 0, showOutline: true, outlineWidth: 1 });
    scene.rebuildScene();
    assert.equal(scene.unitSphereGeo.parameters.widthSegments, 16); assert.equal(scene.unitSphereGeo.parameters.heightSegments, 12);
    const mesh = scene.atomGroup.children[0];
    assert.ok(mesh.material instanceof THREE.MeshPhongMaterial); assert.equal(mesh.material.shininess, 0);
    const thin = scene.outlineGroup.children[0].scale.x - mesh.scale.x;
    scene.visualSettings.outlineWidth = 4; scene.rebuildScene();
    const thick = scene.outlineGroup.children[0].scale.x - scene.atomGroup.children[0].scale.x;
    assert.ok(Math.abs(thick / thin - 4) < 1e-10);
    scene.visualSettings.radiiType = 'covalent'; scene.rebuildScene(); assert.equal(scene.atomGroup.children[0].scale.x, .76);
    scene.visualSettings.radiiType = 'vdw'; scene.rebuildScene(); assert.equal(scene.atomGroup.children[0].scale.x, 1.7);
    scene.visualSettings.radiiType = 'ionic';scene.visualSettings.ionicRadii={C:{charge:2,coordination:6,radius:.72}};scene.rebuildScene();assert.equal(scene.atomGroup.children[0].scale.x,.72);
    scene.visualSettings.atomStyle = 'ellipsoids'; scene.rebuildScene();
    assert.ok(Math.abs(scene.atomGroup.children[0].scale.x - Math.sqrt(2.365973884 * .04)) < 1e-10);
    scene.visualSettings.hideNonbonding = true; scene.rebuildScene();
    assert.deepEqual(scene.getDisplayedAtoms().map((a: Atom) => a.id), [1, 2]);
    assert.equal(scene.getDisplayedCounts().atomsCount, 2);
  } finally { releaseHarness(scene); }
});

test('large scenes instance atom and bond meshes, keep logical counts and release matrices on rebuild', () => {
  const scene = sceneHarness();
  try {
    scene.materialType = 'comic';
    scene.currentStructure = { title: '500', isPeriodic: false, atoms: Array.from({ length: 500 }, (_, i) => atom(i + 1, i * 1.4)) };
    scene.rebuildScene();
    assert.equal(scene.getStatusMessage(), null); assert.equal(scene.getDisplayedCounts().atomsCount, 500);
    assert.equal(scene.getDisplayedCounts().bondsCount, 499);
    assert.ok(scene.atomGroup.children[0] instanceof THREE.InstancedMesh);
    assert.ok(scene.bondGroup.children.length < 10);
    let released = 0; scene.atomGroup.children[0].addEventListener('dispose', () => released++);
    scene.rebuildScene(); assert.equal(released, 1); assert.equal(scene.getDisplayedCounts().atomsCount, 500);
  } finally { releaseHarness(scene); }
});

test('portrait camera fitting keeps the whole structure inside both projection modes', () => {
  const corners: Atom[] = [];
  for (const x of [-10, 10]) for (const y of [-6, 6]) for (const z of [-3, 3]) corners.push(atom(corners.length, x, y, z));
  for (const aspect of [0.5, 1.5]) {
    for (const orthographic of [false, true]) {
      const scene = sceneHarness();
      try {
        delete scene.fitCameraToStructure;
        scene.currentStructure = { title: 'framing', isPeriodic: false, atoms: corners };
        scene.perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        scene.orthoCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
        scene.activeCamera = orthographic ? scene.orthoCamera : scene.perspCamera;
        scene.controls = { target: new THREE.Vector3(), update() {} };
        scene.fitCameraToStructure();
        scene.activeCamera.updateMatrixWorld();
        for (const corner of corners) {
          const projected = new THREE.Vector3(corner.cartesian.x, corner.cartesian.y, corner.cartesian.z).project(scene.activeCamera);
          assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && Math.abs(projected.z) < 1,
            `clipped atom ${corner.id}, aspect=${aspect}, orthographic=${orthographic}`);
        }
      } finally { releaseHarness(scene); }
    }
  }
});

test('portrait resize preserves observation direction and restores the original framing on return', () => {
  const scene = sceneHarness();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { devicePixelRatio: 1 } });
  try {
    scene.perspCamera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 1000);
    scene.orthoCamera = new THREE.OrthographicCamera(-15, 15, 10, -10, 0.1, 1000);
    scene.controls = { target: new THREE.Vector3(1, 2, 3) };
    for (const camera of [scene.perspCamera, scene.orthoCamera]) {
      camera.position.set(11, 12, 33);
      camera.lookAt(scene.controls.target);
    }
    scene.container = { clientWidth: 300, clientHeight: 600 };
    scene.renderer = { setPixelRatio() {}, setSize() {} };
    const orientation = scene.perspCamera.quaternion.clone();
    const initialPosition = scene.perspCamera.position.clone();
    scene.resize();
    assert.ok(scene.perspCamera.quaternion.equals(orientation));
    const projected = new THREE.Vector3(11, 2, 3);
    scene.perspCamera.updateMatrixWorld();
    assert.ok(Math.abs(projected.project(scene.perspCamera).x) < 1);
    scene.container.clientWidth = 900;
    scene.resize();
    assert.ok(scene.perspCamera.position.distanceTo(initialPosition) < 1e-10);
    assert.equal(scene.orthoCamera.top, 10);
    assert.equal(scene.orthoCamera.right, 15);
    assert.deepEqual(scene.controls.target.toArray(), [1, 2, 3]);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    releaseHarness(scene);
  }
});

test('spatial candidates retain every exact neighbor across negative cell boundaries', () => {
  const atoms = Array.from({ length: 200 }, (_, id) => atom(id, (id % 13 - 6) * 0.41, (id % 17 - 8) * 0.31, (id % 19 - 9) * 0.27));
  const index = new SpatialIndex(atoms, 0.7);
  for (const origin of atoms.filter((_, i) => i % 9 === 0)) {
    for (const radius of [0, 0.7, 1.45]) {
      const distance = (a: Atom) => Math.hypot(a.cartesian.x - origin.cartesian.x, a.cartesian.y - origin.cartesian.y, a.cartesian.z - origin.cartesian.z);
      const expected = atoms.filter(a => distance(a) <= radius).map(a => a.id).sort((a, b) => a - b);
      const found = index.query(origin.cartesian, radius).filter(a => distance(a) <= radius).map(a => a.id).sort((a, b) => a - b);
      assert.deepEqual(found, expected);
    }
  }
  assert.throws(() => new SpatialIndex(atoms, 0));
  assert.throws(() => new SpatialIndex([atom(0, NaN)], 1));
  assert.throws(() => index.query({ x: Infinity, y: 0, z: 0 }, 1));
  assert.throws(() => index.query({ x: 0, y: 0, z: 0 }, 1e20));
});

test('recursive disposal releases shared resources once and preserves scene-owned caches', () => {
  const root = new THREE.Group();
  const nested = new THREE.Group();
  root.add(nested);
  const geometry = new THREE.BoxGeometry();
  const retainedGeometry = new THREE.SphereGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const otherMaterial = new THREE.MeshBasicMaterial({ map: texture });
  const retainedMaterial = new THREE.MeshBasicMaterial();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  const counts = new Map<object, number>();
  const resources = [geometry, retainedGeometry, texture, material, otherMaterial, retainedMaterial, sprite.material, sprite.geometry];
  resources.forEach(resource => resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) || 0) + 1)));
  nested.add(new THREE.Mesh(geometry, [material, otherMaterial]), new THREE.Mesh(geometry, material), sprite);
  root.add(new THREE.Mesh(retainedGeometry, retainedMaterial));
  disposeObjectTree(root, new Set([retainedGeometry]), new Set([retainedMaterial]));
  for (const resource of [geometry, texture, material, otherMaterial, sprite.material]) assert.equal(counts.get(resource), 1);
  for (const resource of [retainedGeometry, retainedMaterial, sprite.geometry]) assert.equal(counts.get(resource), undefined);
  retainedGeometry.dispose();
  retainedMaterial.dispose();
});

test('every image preset including 8K remains available with bounded supersampling', () => {
  for (const width of [1920, 2560, 3840, 5120, 7680]) {
    for (const aspect of [1, 4 / 3, 16 / 9]) {
      for (const quality of ['normal', 'high', 'ultra'] as const) {
        const plan = planImageExport(width, aspect, quality, 16384, exportPixelBudget(8));
        assert.equal(plan.width, width);
        assert.equal(plan.height, Math.round(width / aspect));
        assert.ok(plan.renderWidth <= 16384 && plan.renderHeight <= 16384);
        assert.ok(plan.renderWidth * plan.renderHeight <= exportPixelBudget(8));
      }
    }
  }
  assert.equal(planImageExport(7680, 1, 'ultra', 16384, exportPixelBudget(8)).sampleScale, 1);
  assert.throws(() => planImageExport(7680, 1, 'normal', 16384, exportPixelBudget(2)), /降低分辨率/);
  assert.throws(() => planImageExport(3840, 1, 'normal', 2048), /降低分辨率/);
  for (const width of [NaN, Infinity, -1, 8193]) assert.throws(() => planImageExport(width, 1, 'normal', 16384));
  assert.throws(() => planImageExport(1920, 0, 'normal', 16384));
});

test('cached atom reads are safe before initialization and scene batches report final counts once', () => {
  const scene = sceneHarness();
  try {
    assert.deepEqual(scene.getDisplayedAtoms(), []);
    const counts: unknown[] = [];
    scene.onCountsChange = (value: unknown) => counts.push(value);
    scene.batchUpdates(() => {
      scene.setStructure({ title: 'pair', isPeriodic: false, atoms: [atom(0, 0), atom(1, 1.2)] });
      scene.setRenderMode('ball-and-stick');
      scene.setSelectedAtomIds([0, 1], false);
    });
    assert.deepEqual(counts, [{ atomsCount: 2, bondsCount: 1, polyhedraCount: 0, hbondsCount: 0 }]);
    assert.deepEqual(scene.getSelectedAtomIds(), [0, 1]);
    assert.equal(scene.getDisplayedAtoms(), scene.getDisplayedAtoms());
    assert.equal(scene.getStatusMessage(), null);
  } finally { releaseHarness(scene); }
});

test('boundary budget failures clear every rendered group, retain source atoms, and recover', () => {
  const scene = sceneHarness();
  try {
    const atoms = Array.from({ length: 1000 }, (_, i) => atom(i, (i % 10) * 0.005, (Math.floor(i / 10) % 10) * 0.005, Math.floor(i / 100) * 0.005));
    const source = {
      title: 'dense boundary', isPeriodic: true, atoms,
      lattice: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90, volume: 1,
        matrix: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }] },
    };
    scene.visualSettings.showBoundaryAtoms = true;
    scene.renderMode = 'space-filling';
    scene.setStructure(source);
    assert.match(scene.getStatusMessage(), /超过 6000/);
    assert.equal(scene.currentStructure, source);
    assert.equal(scene.currentStructure.atoms.length, 1000);
    assert.deepEqual(scene.getDisplayedAtoms(), []);
    assert.deepEqual(scene.getDisplayedCounts(), { atomsCount: 0, bondsCount: 0, polyhedraCount: 0, hbondsCount: 0 });
    for (const group of scene.structureGroup.children) assert.equal(group.children.length, 0);
    scene.visualSettings.showBoundaryAtoms = false;
    scene.rebuildScene();
    assert.equal(scene.getStatusMessage(), null);
    assert.equal(scene.getDisplayedCounts().atomsCount, atoms.length);
    assert.equal(scene.getDisplayedAtoms(), atoms);
  } finally { releaseHarness(scene); }
});

test('manual distant bonds survive spatial filtering, and both segment styles enforce the budget', () => {
  const scene = sceneHarness();
  try {
    scene.setStructure({ title: 'manual', isPeriodic: false, atoms: [atom(0, 0), atom(1, 20)] });
    assert.equal(scene.getDisplayedCounts().bondsCount, 0);
    scene.customBonds = [{ id1: 0, id2: 1 }];
    scene.rebuildScene();
    assert.equal(scene.getDisplayedCounts().bondsCount, 1);
    const realGroup = scene.bondGroup;
    scene.bondGroup = { children: { length: MAX_BOND_SEGMENTS } };
    assert.throws(() => scene.createStickSegment(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0.05, '#fff'), /化学键过于密集/);
    assert.throws(() => scene.createTaperedStickSegment(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0.08, 0.02, '#fff'), /化学键过于密集/);
    scene.bondGroup = realGroup;
  } finally { releaseHarness(scene); }
});

test('structure visibility hides all structure layers without dropping geometry or lattice state', () => {
  const scene = sceneHarness();
  try {
    scene.setStructure({ title: 'visible pair', isPeriodic: false, atoms: [atom(0, 0), atom(1, 1.2)] });
    const mesh = scene.atomGroup.children[0];
    const cache = scene.getDisplayedAtoms();
    scene.setVisualSettings({ showStructure: false });
    for (const group of scene.structureGroup.children.filter((group: THREE.Group) => group !== scene.latticeGroup)) assert.equal(group.visible, false);
    assert.equal(scene.latticeGroup.visible, true);
    assert.equal(scene.atomGroup.children[0], mesh);
    assert.equal(scene.getDisplayedAtoms(), cache);
    scene.setVisualSettings({ showStructure: true });
    for (const group of scene.structureGroup.children) assert.equal(group.visible, true);
    assert.equal(scene.atomGroup.children[0], mesh);
    assert.equal(scene.getDisplayedCounts().atomsCount, 2);
  } finally { releaseHarness(scene); }
});

test('full settings records with only lighting or visibility changes retain geometry', () => {
  const scene = sceneHarness();
  try {
    scene.setStructure({ title: 'pair', isPeriodic: false, atoms: [atom(0, 0), atom(1, 1.2)] });
    const mesh = scene.atomGroup.children[0];
    let updates = 0;
    scene.updateLightingAndShadows = () => { updates++; };
    scene.setVisualSettings({ ...scene.visualSettings, lightAzimuth: 90 });
    assert.equal(updates, 1);
    assert.equal(scene.atomGroup.children[0], mesh);
    scene.setVisualSettings({ ...scene.visualSettings, showStructure: false });
    assert.equal(scene.atomGroup.visible, false);
    assert.equal(scene.atomGroup.children[0], mesh);
  } finally { releaseHarness(scene); }
});

test('transparent export encoding failure restores live renderer, projection, controls and loop', async () => {
  const scene = sceneHarness();
  const descriptors = new Map(['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { deviceMemory: 8 } });
    let width = 800, height = 600, ratio = 2, alpha = 1, color = new THREE.Color('#123456');
    const gl = {
      MAX_VIEWPORT_DIMS: 1, MAX_RENDERBUFFER_SIZE: 2,
      getParameter: (key: number) => key === 1 ? [16384, 16384] : 16384,
      get drawingBufferWidth() { return width; }, get drawingBufferHeight() { return height; },
      isContextLost: () => false,
    };
    const bg = new THREE.Color('#abcdef');
    scene.scene.background = bg;
    scene.currentStructure = { atoms: [atom(0, 0)] };
    scene.container = { clientWidth: 800, clientHeight: 600 };
    scene.perspCamera = new THREE.PerspectiveCamera(45, 4 / 3);
    scene.orthoCamera = new THREE.OrthographicCamera(-4, 4, 3, -3);
    scene.activeCamera = scene.perspCamera;
    scene.controls = { enabled: true };
    scene.dirLight = new THREE.DirectionalLight();
    const shadowSize = scene.dirLight.shadow.mapSize.clone();
    let stopped = 0, restarted = 0;
    scene.stopLoop = () => { stopped++; };
    scene.startLoop = () => { restarted++; };
    scene.resize = () => {};
    scene.renderer = {
      capabilities: { maxTextureSize: 16384 }, getContext: () => gl,
      getPixelRatio: () => ratio, setPixelRatio: (value: number) => { ratio = value; },
      getSize: (target: THREE.Vector2) => target.set(width, height),
      setSize: (w: number, h: number) => { width = w; height = h; },
      getClearColor: (target: THREE.Color) => target.copy(color), getClearAlpha: () => alpha,
      setClearColor: (value: THREE.ColorRepresentation, valueAlpha: number) => { color = new THREE.Color(value); alpha = valueAlpha; },
      render() { assert.equal(scene.scene.background, null); assert.equal(alpha, 0); assert.equal(scene.controls.enabled, false); },
      domElement: { toBlob(callback: (value: Blob | null) => void) { callback(null); } },
    };
    await assert.rejects(scene.renderHighResImage({ width: 1920, transparent: true, quality: 'normal', aspectRatio: '1:1' }), /未能编码图像/);
    assert.equal(scene.scene.background, bg);
    assert.equal(color.getHexString(), '123456');
    assert.deepEqual([width, height, ratio, alpha], [800, 600, 2, 1]);
    assert.equal(scene.perspCamera.aspect, 4 / 3);
    assert.equal(scene.controls.enabled, true);
    assert.equal(scene.exporting, false);
    assert.deepEqual(scene.dirLight.shadow.mapSize, shadowSize);
    assert.deepEqual([stopped, restarted], [1, 1]);
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    releaseHarness(scene);
  }
});
