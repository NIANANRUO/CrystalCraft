import { displacementAxes } from '../utils/displacement';
import { batchOpaqueMeshes, instanceAtomId, renderedInstanceCount } from './instances';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { 
  CrystalStructure, 
  PresetMaterialType, 
  RenderMode, 
  Atom, 
  VisualSettings, 
  LabelMode, 
  MeasureMode, 
  MeasurementItem,
  PolyhedraSettings,
  DEFAULT_POLYHEDRA_SETTINGS
} from '../types/crystal';
import { getElement, getDisplayRadius } from '../constants/elements';
import { createMaterial, getOutlineMaterial, updateGlobalLightDir } from './materials';
import { NEW_MATERIALS,materialBackground } from '../materialCatalog';
import {drawMaterialCaption} from './materialCaption';
import { disposeMaterial, disposeObjectTree } from './resources';
import { SpatialIndex } from './spatialIndex';
import { exportPixelBudget, planImageExport, type ImageExportOptions } from './exportPlan';
import { collectAtomLegend, planAtomLegend, drawAtomLegend, type AtomLegendEntry } from './atomLegend';
import { DEFAULT_IMAGE_DPI, assertImageDpi, setPngDpi } from './imageResolution';
import { assertAtomCount } from '../utils/validation';
import { assertRenderBudget, MAX_DISPLAYED_ATOMS, MAX_BOND_SEGMENTS, MAX_WEAK_INTERACTIONS, MAX_POLYHEDRON_LIGANDS, MAX_POLYHEDRA_POINTS } from './limits';
import { dist } from '../utils/math';
import { atomSiteLabel, bondSearchRadius, createBondMatcher, expandBondRuleAtoms, ruleMatchesDirection, matchesBondRule } from '../utils/bonding';
import { VolumeLayer, VolumeStatus } from '../volume/VolumeLayer';

export class CrystalScene {
  private container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  
  // Dual Cameras (Perspective & Orthographic)
  public perspCamera: THREE.PerspectiveCamera;
  public orthoCamera: THREE.OrthographicCamera;
  public activeCamera: THREE.Camera;
  public controls: OrbitControls;

  // Render groups
  private structureGroup: THREE.Group;
  private atomGroup: THREE.Group;
  private bondGroup: THREE.Group;
  private latticeGroup: THREE.Group;
  private outlineGroup: THREE.Group;
  private polyhedraGroup: THREE.Group;
  private hbondGroup: THREE.Group;
  private labelGroup: THREE.Group;
  private measurementGroup: THREE.Group;
  private shadowGroup: THREE.Group;
  private volumeLayer?: VolumeLayer;

  // Polyhedra internal tracking
  private polyhedraCenters = new Set<number>();
  private polyhedraLigands = new Set<number>();
  private polyhedraBonds = new Set<string>();


  // Lighting
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private fillLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  // State
  private currentStructure: CrystalStructure | null = null;
  private materialType: PresetMaterialType = 'comic';
  private renderMode: RenderMode = 'ball-and-stick';
  private showLattice = true;
  private showAxes = true;
  private bgColor: 'dark' | 'white' = 'white';
  private selectedAtomIds: Set<number> = new Set();
  private hiddenAtomIds: Set<number> = new Set();
  private customBonds: Array<{ id1: number; id2: number }> = [];

  // Measurement state
  public measureMode: MeasureMode = 'none';
  private measureQueue: number[] = [];
  public measurements: MeasurementItem[] = [];

  // Visual Customization Settings
  private visualSettings: VisualSettings = {
    atomScale: 1.0,
    bondRadius: 0.055,
    bondTolerance: 1.15,
    bondStyle: 'aromatic', // 芳香共振键 (一实一虚)
    bondColorMode: 'uniform', // 统一灰蓝 (单一圆柱贯通)
    customBondColor: '#8fa4ba',
    doubleBondGap: 0.14, // 0.14 Å: 确保实键与断开键之间有约 1:1 直径的宽敞清脆空隙
    aromaticGapRatio: 0.20, // 0.20: 虚键中间精致适度的缺口比例
    elementColors: {},
    elementRadii: {},
    showPolyhedra: false,
    polyhedraSettings: {
      ...DEFAULT_POLYHEDRA_SETTINGS,
      material: { ...DEFAULT_POLYHEDRA_SETTINGS.material },
      edges: { ...DEFAULT_POLYHEDRA_SETTINGS.edges },
      elementColors: {}
    },
    showHBonds: false,
    showOutline: true,
    showShadows: true,
    showFog: false,
    showLabels: 'none',
    isOrthographic: false,
    autoRotate: false,
    autoRotateSpeed: 2.0,
    ligandViewRadius: null,
    showBoundaryAtoms: true,
    lightAzimuth: 45,
    lightAltitude: 50,
    lightIntensity: 2.5,
    ambientIntensity: 0.85,
    headlightMode: false
  };

  // Shared geometries
  private unitSphereGeo = new THREE.SphereGeometry(1, 32, 24);
  private unitCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 16);

  // Raycaster & Observers
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pointerDownPos = { x: 0, y: 0 };
  private disposed = false;
  private contextLost = false;
  private exporting = false;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private materialCache = new Map<string, THREE.Material>();
  private displayedAtomsCache: Atom[] | null = null;
  private batchDepth = 0;
  private rebuildPending = false;
  private renderedBondCount = 0;
  private renderError: string | null = null;
  private needsRender = true;
  private invalidate() { this.needsRender = true; }
  private onControlsChange = () => this.invalidate();

  // Callbacks
  public onAtomSelect?: (atom: Atom | null, allSelected?: Atom[]) => void;
  public onMeasurementComplete?: (item: MeasurementItem) => void;
  public onMeasurementModeChange?: (mode: MeasureMode) => void;
  public onMeasurementProgress?: (step: number, total: number, pickedAtoms: number[]) => void;
  public onStatusChange?: (message: string | null) => void;
  public onVolumeStateChange?: (status: VolumeStatus) => void;
  public onCountsChange?: (counts: ReturnType<CrystalScene['getDisplayedCounts']>) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / height;

    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 2. Dual Cameras
    this.perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.perspCamera.position.set(10, 10, 15);

    const orthoFrustum = 12;
    this.orthoCamera = new THREE.OrthographicCamera(
      -orthoFrustum * aspect, orthoFrustum * aspect,
      orthoFrustum, -orthoFrustum,
      0.1, 1000
    );
    this.orthoCamera.position.set(10, 10, 15);

    this.activeCamera = this.perspCamera;

    // 3. Controls
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.addEventListener('change', this.onControlsChange);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // 4. Setup Lighting
    this.setupLighting();

    // 5. Structure Hierarchy
    this.structureGroup = new THREE.Group();
    this.atomGroup = new THREE.Group();
    this.bondGroup = new THREE.Group();
    this.latticeGroup = new THREE.Group();
    this.outlineGroup = new THREE.Group();
    this.polyhedraGroup = new THREE.Group();
    this.hbondGroup = new THREE.Group();
    this.labelGroup = new THREE.Group();
    this.measurementGroup = new THREE.Group();
    this.shadowGroup = new THREE.Group();

    this.structureGroup.add(this.shadowGroup);
    this.structureGroup.add(this.polyhedraGroup);
    this.structureGroup.add(this.bondGroup);
    this.structureGroup.add(this.hbondGroup);
    this.structureGroup.add(this.atomGroup);
    this.structureGroup.add(this.outlineGroup);
    this.structureGroup.add(this.labelGroup);
    this.structureGroup.add(this.measurementGroup);
    this.structureGroup.add(this.latticeGroup);
    this.scene.add(this.structureGroup);
    this.volumeLayer=new VolumeLayer(status=>{
      if(this.disposed)return;
      this.invalidate();this.onVolumeStateChange?.(status);this.onStatusChange?.(this.getStatusMessage());
    });
    this.structureGroup.add(this.volumeLayer.group);

    // 6. Responsive ResizeObserver
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    // 7. Interaction & Loop
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.startLoop();
  }

  private setupLighting() {
    this.setupEnvironment();

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.85);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.dirLight.position.set(15, 25, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.025;
    this.dirLight.shadow.radius = 2.0;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 120;
    const d = 15;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    this.fillLight.position.set(-20, 10, 15);
    this.scene.add(this.fillLight);
    this.scene.add(this.fillLight.target);

    this.rimLight = new THREE.DirectionalLight(0xfef08a, 0.60);
    this.rimLight.position.set(-5, -15, -25);
    this.scene.add(this.rimLight);
  }

  private setupEnvironment() {
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let roomScene: RoomEnvironment | null = null;
    try {
      pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      roomScene = new RoomEnvironment();
      this.environmentTarget?.dispose();
      this.environmentTarget = pmremGenerator.fromScene(roomScene, 0.04);
      this.scene.environment = this.environmentTarget.texture;
    } catch (e) {
      console.warn('RoomEnvironment fallback:', e);
      this.scene.environment = null;
    } finally {
      roomScene?.dispose();
      pmremGenerator?.dispose();
    }
  }

  public setStructure(structure: CrystalStructure | null) {
    const previous = this.currentStructure;
    const geometryChanged = !previous || !structure ||
      previous.atoms.length !== structure.atoms.length ||
      JSON.stringify(previous.lattice?.matrix) !== JSON.stringify(structure.lattice?.matrix) ||
      previous.atoms.some((atom, i) => {
        const next = structure.atoms[i];
        return atom.id !== next.id || atom.cartesian.x !== next.cartesian.x ||
          atom.cartesian.y !== next.cartesian.y || atom.cartesian.z !== next.cartesian.z ||
          atom.fractional.x !== next.fractional.x || atom.fractional.y !== next.fractional.y || atom.fractional.z !== next.fractional.z;
      });
    this.currentStructure = structure;
    if (geometryChanged) {
      this.selectedAtomIds.clear();
      this.hiddenAtomIds.clear();
      this.customBonds = [];
      this.measurements = [];
      this.measureQueue = [];
    }
    this.rebuildScene();
    if (geometryChanged) this.fitCameraToStructure();
  }

  public setMaterialPreset(preset: PresetMaterialType) {
    this.materialType = preset;
    if (preset === 'clay') {
      // Nature Cover Clay has soft subsurface shadows without black ink outlines
      this.visualSettings.showOutline = false;
      this.visualSettings.showShadows = true;
    } else if (preset === 'mof') {
      // MOF framework: auto enable polyhedra cages and technical outline
      this.visualSettings.showOutline = true;
      this.visualSettings.showPolyhedra = true;
    } else if (preset === 'popart') {
      this.visualSettings.showOutline = true;
      this.visualSettings.showShadows = true;
    } else if (['comic', 'handdrawn', 'flat2d', 'toon', 'bubble'].includes(preset)) {
      this.visualSettings.showOutline = true;
    } else if (['plastic', 'glossy', 'metallic', 'glass', 'smooth'].includes(preset)) {
      this.visualSettings.showOutline = false;
      this.visualSettings.showShadows = true;
    } else if (preset === 'flat') {
      this.visualSettings.showOutline = true;
      this.visualSettings.showShadows = false;
    }
    this.setBackgroundColor(this.bgColor);
    this.rebuildScene();
  }

  public setRenderMode(mode: RenderMode) {
    this.renderMode = mode;
    this.rebuildScene();
  }

  public toggleLattice(show?: boolean) {
    this.invalidate();
    this.showLattice = show !== undefined ? show : !this.showLattice;
    this.latticeGroup.visible = this.showLattice;
  }

  public toggleAxes(show?: boolean) {
    this.showAxes = show !== undefined ? show : !this.showAxes;
    this.rebuildLattice();
  }

  public selectAtom(atomId: number | null) {
    this.selectedAtomIds.clear();
    if (atomId !== null) {
      this.selectedAtomIds.add(atomId);
    }
    this.rebuildScene();
    this.notifyAtomSelection(atomId);
  }

  public toggleSelectAtom(atomId: number) {
    if (this.selectedAtomIds.has(atomId)) {
      this.selectedAtomIds.delete(atomId);
    } else {
      this.selectedAtomIds.add(atomId);
    }
    this.rebuildScene();
    this.notifyAtomSelection(atomId);
  }

  public setSelectedAtomIds(atomIds: number[], notify = true) {
    if (atomIds.length === this.selectedAtomIds.size && atomIds.every(id => this.selectedAtomIds.has(id))) return;
    this.selectedAtomIds = new Set(atomIds);
    this.rebuildScene();
    const lastId = atomIds.length > 0 ? atomIds[atomIds.length - 1] : null;
    if (notify) this.notifyAtomSelection(lastId);
  }

  public getSelectedAtomIds(): number[] {
    return Array.from(this.selectedAtomIds);
  }

  public getSelectedAtoms(): Atom[] {
    if (!this.currentStructure) return [];
    return this.currentStructure.atoms.filter(a => this.selectedAtomIds.has(a.id));
  }

  private notifyAtomSelection(lastId: number | null) {
    if (!this.onAtomSelect || !this.currentStructure) return;
    const primary = lastId !== null ? this.currentStructure.atoms.find(a => a.id === lastId) || null : null;
    const allSelected = this.currentStructure.atoms.filter(a => this.selectedAtomIds.has(a.id));
    this.onAtomSelect(primary, allSelected);
  }

  // Camera projection toggle (透视 vs 正交)
  public toggleOrthographic(isOrtho?: boolean) {
    this.invalidate();
    const targetOrtho = isOrtho !== undefined ? isOrtho : !this.visualSettings.isOrthographic;
    this.visualSettings.isOrthographic = targetOrtho;

    const oldCam = this.activeCamera;
    const newCam = targetOrtho ? this.orthoCamera : this.perspCamera;

    newCam.position.copy(oldCam.position);
    newCam.quaternion.copy(oldCam.quaternion);

    this.activeCamera = newCam;
    this.controls.object = newCam;
    this.controls.update();
  }

  // Visual settings getters and setters
  public getVisualSettings(): VisualSettings {
    return { ...this.visualSettings };
  }

  public setVisualSettings(settings: Partial<VisualSettings>) {
    const oldFog = this.visualSettings.showFog;
    const oldOrtho = this.visualSettings.isOrthographic;
    const oldShadows = this.visualSettings.showShadows;

    const lightingKeys = ['lightAzimuth', 'lightAltitude', 'lightIntensity', 'ambientIntensity', 'headlightMode'];
    // React passes the full settings record; only changed fields should choose
    // the update path, otherwise moving a light rebuilds every atom and bond.
    const keys = (Object.keys(settings) as (keyof VisualSettings)[])
      .filter(key => settings[key] !== this.visualSettings[key]);
    if (keys.length === 0) return;
    this.invalidate();
    const isPureLighting = keys.length > 0 && keys.every(k => lightingKeys.includes(k));

    this.visualSettings = {
      ...this.visualSettings,
      ...settings
    };

    // Hide the complete structure while retaining its geometry for immediate
    // recovery; lattice and orientation axes have independent visibility.
    const structureVisible = this.visualSettings.showStructure !== false;
    if(this.volumeLayer)this.volumeLayer.group.visible=structureVisible;
    [this.atomGroup, this.bondGroup, this.outlineGroup, this.polyhedraGroup,
      this.hbondGroup, this.labelGroup, this.measurementGroup, this.shadowGroup]
      .forEach(group => { group.visible = structureVisible; });
    if (keys.length === 1 && keys[0] === 'showStructure') return;

    // Fast-path: If only lighting parameters changed, smoothly update lights without rebuilding geometries
    if (isPureLighting) {
      this.updateLightingAndShadows();
      return;
    }

    // Fast-path: If only showShadows toggled, update mesh shadow properties and shadow camera directly
    if (keys.length === 1 && this.visualSettings.showShadows !== oldShadows) {
      this.updateShadowCastReceive(this.visualSettings.showShadows);
      this.updateLightingAndShadows();
      return;
    }

    // Fog toggle
    if (this.visualSettings.showFog !== oldFog) {
      this.scene.fog = this.visualSettings.showFog ? new THREE.Fog(materialBackground(this.materialType,this.bgColor==='white'?'#ffffff':'#0a0e17'), 12, 45) : null;
    }

    // Camera projection change
    if (this.visualSettings.isOrthographic !== oldOrtho) {
      this.toggleOrthographic(this.visualSettings.isOrthographic);
    }

    // Auto rotate
    this.controls.autoRotate = this.visualSettings.autoRotate;
    this.controls.autoRotateSpeed = this.visualSettings.autoRotateSpeed;

    this.rebuildScene();
  }

  // Presentation Mode (一键白底出版报告级视图)
  public applyPresentationPreset() {
    this.setBackgroundColor('white');
    this.setMaterialPreset('comic');
    this.setRenderMode('ball-and-stick');
    this.setVisualSettings({
      atomScale: 1.0,
      bondRadius: 0.055,
      bondTolerance: 1.15,
      bondStyle: 'aromatic',
      bondColorMode: 'uniform',
      customBondColor: '#8fa4ba',
      doubleBondGap: 0.14,
      aromaticGapRatio: 0.20,
      showOutline: true,
      showShadows: true,
      showFog: false,
      isOrthographic: false
    });
    this.fitCameraToStructure();
  }

  // Atom-specific color override
  public setAtomColor(atomId: number, color: string | null) {
    if (!this.currentStructure) return;
    const atom = this.currentStructure.atoms.find(a => a.id === atomId);
    if (atom) {
      if (color) atom.colorOverride = color;
      else delete atom.colorOverride;
      this.rebuildScene();
    }
  }

  // Element-wide color override
  public setElementColor(element: string, color: string | null) {
    if (color) this.visualSettings.elementColors[element] = color;
    else delete this.visualSettings.elementColors[element];
    this.rebuildScene();
  }

  // Atom-specific radius override
  public setAtomRadius(atomId: number, radius: number | null) {
    if (!this.currentStructure) return;
    const atom = this.currentStructure.atoms.find(a => a.id === atomId);
    if (atom) {
      if (radius !== null && radius > 0) atom.radiusOverride = radius;
      else delete atom.radiusOverride;
      this.rebuildScene();
    }
  }

  // Element-wide radius override
  public setElementRadius(element: string, radius: number | null) {
    if (radius !== null && radius > 0) this.visualSettings.elementRadii[element] = radius;
    else delete this.visualSettings.elementRadii[element];
    this.rebuildScene();
  }

  // Atom Visibility (隐藏/显示全部)
  public hideSelectedAtoms() {
    this.selectedAtomIds.forEach(id => this.hiddenAtomIds.add(id));
    this.selectedAtomIds.clear();
    this.rebuildScene();
    if (this.onAtomSelect) this.onAtomSelect(null);
  }

  public showAllAtoms() {
    this.hiddenAtomIds.clear();
    this.rebuildScene();
  }

  // Manual bond addition
  public addManualBond(id1: number, id2: number) {
    if (id1 === id2) return;
    this.customBonds.push({ id1, id2 });
    this.rebuildScene();
  }

  // Measurement tool
  public setMeasureMode(mode: MeasureMode) {
    this.measureMode = mode;
    this.measureQueue = [];
    if (this.onMeasurementModeChange) {
      this.onMeasurementModeChange(mode);
    }
  }

  public clearMeasurements() {
    this.invalidate();
    this.measurements = [];
    this.measureQueue = [];
    this.clearGroup(this.measurementGroup);
  }

  public updateSelectedAtomElement(newElement: string) {
    if (!this.currentStructure || this.selectedAtomIds.size === 0) return;
    this.currentStructure.atoms.forEach(atom => {
      if (this.selectedAtomIds.has(atom.id)) {
        atom.element = newElement;
      }
    });
    this.rebuildScene();
  }

  public deleteSelectedAtom() {
    if (!this.currentStructure || this.selectedAtomIds.size === 0) return;
    this.currentStructure.atoms = this.currentStructure.atoms.filter(
      atom => !this.selectedAtomIds.has(atom.id)
    );
    this.selectedAtomIds.clear();
    this.rebuildScene();
    if (this.onAtomSelect) this.onAtomSelect(null);
  }

  public addAtom(element: string, fracCoords: { x: number; y: number; z: number }) {
    if (!this.currentStructure) return;
    const nextId = this.currentStructure.atoms.length > 0 
      ? Math.max(...this.currentStructure.atoms.map(a => a.id)) + 1 
      : 1;

    let cartesian = { ...fracCoords };
    if (this.currentStructure.lattice) {
      const [va, vb, vc] = this.currentStructure.lattice.matrix;
      cartesian = {
        x: fracCoords.x * va.x + fracCoords.y * vb.x + fracCoords.z * vc.x,
        y: fracCoords.x * va.y + fracCoords.y * vb.y + fracCoords.z * vc.y,
        z: fracCoords.x * va.z + fracCoords.y * vb.z + fracCoords.z * vc.z
      };
    }

    const newAtom: Atom = {
      id: nextId,
      element,
      fractional: fracCoords,
      cartesian,
      selected: true
    };

    this.currentStructure.atoms.push(newAtom);
    this.selectAtom(nextId);
  }

  public getEffectiveAtomColor(atom: Atom): string {
    if (atom.colorOverride) return atom.colorOverride;
    if (this.visualSettings.elementColors[atom.element]) {
      return this.visualSettings.elementColors[atom.element];
    }
    return getElement(atom.element).color;
  }

  private atomMaterial(atom: Atom, selected: boolean) {
    const color = this.getEffectiveAtomColor(atom);
    const wireframe = this.renderMode === 'wireframe';
    if (!NEW_MATERIALS.includes(this.materialType) && (this.visualSettings.atomSpecular !== undefined || this.visualSettings.atomShininess !== undefined)) {
      const specular = this.visualSettings.atomSpecular ?? { r: 204, g: 204, b: 204 };
      const shine = this.visualSettings.atomShininess ?? 20;
      const key = `atom-phong:${color}:${selected}:${JSON.stringify(specular)}:${shine}:${this.renderMode}`;
      if (!this.materialCache.has(key)) this.materialCache.set(key, new THREE.MeshPhongMaterial({
        color, specular: new THREE.Color().setRGB(specular.r / 255, specular.g / 255, specular.b / 255, THREE.SRGBColorSpace),
        shininess: shine * 2, emissive: selected ? '#334155' : '#000000', wireframe
      }));
      return this.materialCache.get(key)!;
    }
    return createMaterial(this.materialType, color, selected, this.materialCache, wireframe, {
      textureStrength: this.visualSettings.textureStrength, textureScale: this.visualSettings.textureScale, role: 'atom'
    });
  }

  public getEffectiveAtomRadius(atom: Atom): number {
    const scale = this.visualSettings.atomScale;
    if (this.renderMode === 'space-filling') {
      return getElement(atom.element).vdwRadius * scale;
    }
    if (this.renderMode === 'wireframe') {
      return 0.15 * scale;
    }

    const baseRadius = atom.radiusOverride ?? 
      this.visualSettings.elementRadii[atom.element] ?? 
      (this.visualSettings.radiiType === 'vdw' ? getElement(atom.element).vdwRadius : this.visualSettings.radiiType === 'covalent' ? getElement(atom.element).radius : this.visualSettings.radiiType==='ionic' ? this.visualSettings.ionicRadii?.[atom.element]?.radius??getDisplayRadius(atom.element) : getDisplayRadius(atom.element));

    if (this.renderMode === 'stick') {
      return Math.min(baseRadius, 0.20) * scale;
    }
    return baseRadius * scale;
  }

  // --- Rendering Pipeline ---
  public batchUpdates(update: () => void) {
    this.batchDepth++;
    try { update(); }
    finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.rebuildPending) {
        this.rebuildPending = false;
        this.rebuildScene();
      }
    }
  }

  public rebuildScene() {
    this.invalidate();
    if (this.disposed) return;
    if (this.batchDepth > 0) { this.rebuildPending = true; return; }
    this.clearRenderedStructure();
    this.renderError = null;
    try {
      if (this.currentStructure) assertAtomCount(this.currentStructure.atoms.length, true);
      this.displayedAtomsCache = this.computeDisplayedAtoms();
      if (this.visualSettings.hideNonbonding) {
        const atoms = this.displayedAtomsCache;
        const radius = bondSearchRadius(atoms, this.visualSettings);
        const index = new SpatialIndex(atoms, radius);
        const matches = createBondMatcher(this.visualSettings);
        this.displayedAtomsCache = atoms.filter(a => index.query(a.cartesian, radius).some(b => a.id !== b.id && matches(a, b)));
      }
      const large = (this.currentStructure?.atoms.length ?? 0) >= 500;
      const slices = this.visualSettings.atomSlices ?? (large ? 16 : 32), stacks = this.visualSettings.atomStacks ?? (large ? 12 : 24);
      if (this.unitSphereGeo.parameters.widthSegments !== slices || this.unitSphereGeo.parameters.heightSegments !== stacks) {
        this.unitSphereGeo.dispose(); this.unitSphereGeo = new THREE.SphereGeometry(1, slices, stacks);
      }
      if (this.currentStructure && this.currentStructure.atoms.length > 0) {
        this.renderPolyhedra();
        this.renderAtoms();
        this.renderBonds();
        if (this.getDisplayedAtoms().length >= 500) {
          batchOpaqueMeshes(this.atomGroup, this.materialCache);
          batchOpaqueMeshes(this.bondGroup, this.materialCache);
          batchOpaqueMeshes(this.outlineGroup, this.materialCache);
        }
        this.renderHBonds();
        this.renderLabels();
        this.renderMeasurements();
        this.updateLightingAndShadows();
        this.rebuildLattice();
      }
    } catch (error) {
      // Never leave a partially built crystal under a successful-looking UI.
      // Keep source data/settings so reducing complexity can recover the view.
      this.clearRenderedStructure();
      this.renderError = error instanceof Error ? error.message : '结构渲染失败，请降低显示复杂度后重试。';
    } finally {
      this.volumeLayer?.update(this.renderError?undefined:this.currentStructure?.volumeData,this.visualSettings.volumeSettings,this.visualSettings.showStructure!==false);
      this.pruneMaterialCache();
      this.onCountsChange?.(this.getDisplayedCounts());
      this.onStatusChange?.(this.getStatusMessage());
    }
  }

  private clearRenderedStructure() {
    this.displayedAtomsCache = [];
    this.renderedBondCount = 0;
    this.polyhedraCenters.clear();
    this.polyhedraLigands.clear();
    this.polyhedraBonds.clear();
    this.clearGroup(this.atomGroup);
    this.clearGroup(this.bondGroup);
    this.clearGroup(this.latticeGroup);
    this.clearGroup(this.outlineGroup);
    this.clearGroup(this.polyhedraGroup);
    this.clearGroup(this.hbondGroup);
    this.clearGroup(this.labelGroup);
    this.clearGroup(this.measurementGroup);
    this.clearGroup(this.shadowGroup);
  }

  public getStatusMessage(): string | null {
    return this.contextLost ? '图形上下文已中断，正在等待浏览器恢复。当前结构仍保留。' : this.renderError ?? this.volumeLayer?.error ?? null;
  }

  // React reads this during render: it must be cheap, side-effect free and never
  // start a potentially failing boundary expansion.
  public getDisplayedAtoms(): Atom[] {
    return this.displayedAtomsCache ?? [];
  }

  private computeDisplayedAtoms(): Atom[] {
    return this.currentStructure ? expandBondRuleAtoms(this.currentStructure, this.visualSettings) : [];
  }

  private renderAtoms() {
    if (!this.currentStructure) return;

    const displayedAtoms = this.getDisplayedAtoms();

    // Filter out hidden atoms and LigandView cutoff
    let centerPos: THREE.Vector3 | null = null;
    if (this.visualSettings.ligandViewRadius !== null) {
      const metalAtom = this.currentStructure.atoms.find(a => 
        ['Mo', 'Ti', 'Fe', 'Co', 'Ni', 'Cu', 'Zr', 'Pt', 'Au', 'Ru'].includes(a.element)
      ) || this.currentStructure.atoms[0];
      if (metalAtom) {
        centerPos = new THREE.Vector3(metalAtom.cartesian.x, metalAtom.cartesian.y, metalAtom.cartesian.z);
      }
    }

    displayedAtoms.forEach(atom => {
      const effectiveId = atom.originalId ?? atom.id;
      if (this.hiddenAtomIds.has(effectiveId)) return;

      // VESTA Polyhedral Style filtering:
      if (this.visualSettings.showPolyhedra) {
        const polyStyle = this.visualSettings.polyhedraSettings?.style ?? 2;
        if (polyStyle === 4) {
          // Style 4: Polyhedra + Central atom (coordinating ligand atoms are hidden)
          if (!this.polyhedraCenters.has(effectiveId) && this.polyhedraLigands.has(effectiveId)) {
            return;
          }
        } else if (polyStyle === 5) {
          // Style 5: Polyhedra only (both central and coordinating atoms inside polyhedra are hidden)
          if (this.polyhedraCenters.has(effectiveId) || this.polyhedraLigands.has(effectiveId)) {
            return;
          }
        }
      }

      const p = new THREE.Vector3(atom.cartesian.x, atom.cartesian.y, atom.cartesian.z);
      if (centerPos && this.visualSettings.ligandViewRadius !== null) {
        if (p.distanceTo(centerPos) > this.visualSettings.ligandViewRadius) {
          return;
        }
      }

      const isSelected = this.selectedAtomIds.has(effectiveId);
      const r = this.getEffectiveAtomRadius(atom);
      const mat = this.atomMaterial(atom, isSelected);

      const mesh = new THREE.Mesh(this.unitSphereGeo, mat);
      mesh.position.copy(p);
      mesh.scale.set(r, r, r);
      if (this.visualSettings.atomStyle === 'ellipsoids' && atom.displacement) {
        const axes = displacementAxes(atom.displacement);
        mesh.scale.copy(axes.scale).multiplyScalar(this.visualSettings.atomScale); mesh.quaternion.copy(axes.quaternion);
      }
      mesh.userData = { atomId: effectiveId };
      mesh.castShadow = this.visualSettings.showShadows;
      mesh.receiveShadow = this.visualSettings.showShadows;
      this.atomGroup.add(mesh);

      // Silhouette outline (对所有材质响应 showOutline 开关，xray 与 glow 自带边缘辉光无需硬黑描边)
      if (this.visualSettings.showOutline && this.renderMode !== 'wireframe' && !['xray','glow','cyber','lidar'].includes(this.materialType)) {
        const outlineMesh = new THREE.Mesh(this.unitSphereGeo, getOutlineMaterial(this.materialType, this.materialCache));
        outlineMesh.position.copy(p);
        const thickness = Math.max(0.012, Math.min(0.038, r * 0.065)) * (this.visualSettings.outlineWidth ?? 2) / 2;
        outlineMesh.scale.copy(mesh.scale).addScalar(thickness); outlineMesh.quaternion.copy(mesh.quaternion);
        outlineMesh.raycast = () => {};
        this.outlineGroup.add(outlineMesh);
      }
    });
  }

  private createStickSegment(
    pStart: THREE.Vector3, 
    pEnd: THREE.Vector3, 
    radius: number, 
    color: string
  ) {
    const dir = new THREE.Vector3().subVectors(pEnd, pStart);
    const len = dir.length();
    if (len < 0.001) return;
    this.assertBondSegmentBudget();

    const mid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);

    const orientation = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    const target = dir.clone().normalize();
    if (Math.abs(target.dot(up)) > 0.999) {
      up.set(1, 0, 0);
    }
    orientation.lookAt(pStart, pEnd, up);
    orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const rotationQuat = new THREE.Quaternion().setFromRotationMatrix(orientation);

    const mat=createMaterial(this.materialType,color,false,this.materialCache,false,{textureStrength:this.visualSettings.textureStrength,textureScale:this.visualSettings.textureScale,role:'bond'});
    const mesh = new THREE.Mesh(this.unitCylinderGeo, mat);
    mesh.position.copy(mid);
    mesh.quaternion.copy(rotationQuat);
    mesh.scale.set(radius, len, radius);
    mesh.castShadow = this.visualSettings.showShadows;
    mesh.receiveShadow = this.visualSettings.showShadows;
    this.bondGroup.add(mesh);

    if (this.visualSettings.showOutline && this.renderMode !== 'wireframe' && this.materialType !== 'xray' && this.materialType !== 'glow') {
      const outlineMesh = new THREE.Mesh(this.unitCylinderGeo, getOutlineMaterial(this.materialType, this.materialCache));
      outlineMesh.position.copy(mid);
      outlineMesh.quaternion.copy(rotationQuat);
      const outlineRadius = radius + Math.min(0.008, Math.max(0.003, radius * 0.20)) * (this.visualSettings.outlineWidth ?? 2) / 2;
      outlineMesh.scale.set(outlineRadius, len + 0.006, outlineRadius);
      outlineMesh.raycast = () => {};
      this.outlineGroup.add(outlineMesh);
    }
  }

  // Tapered Conical Bond Segment (圆台/渐变锥形键)
  private createTaperedStickSegment(
    pStart: THREE.Vector3,
    pEnd: THREE.Vector3,
    rStart: number,
    rEnd: number,
    color: string
  ) {
    const dir = new THREE.Vector3().subVectors(pEnd, pStart);
    const len = dir.length();
    if (len < 0.001) return;
    this.assertBondSegmentBudget();

    const mid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
    const normDir = dir.clone().normalize();
    const rotationQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normDir
    );

    // Three.js CylinderGeometry: radiusTop (+Y / pEnd), radiusBottom (-Y / pStart), height, segments
    const geo = new THREE.CylinderGeometry(rEnd, rStart, len, 20);
    const mat=createMaterial(this.materialType,color,false,this.materialCache,false,{textureStrength:this.visualSettings.textureStrength,textureScale:this.visualSettings.textureScale,role:'bond'});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.quaternion.copy(rotationQuat);
    mesh.castShadow = this.visualSettings.showShadows;
    mesh.receiveShadow = this.visualSettings.showShadows;
    this.bondGroup.add(mesh);

    if (this.visualSettings.showOutline && this.renderMode !== 'wireframe' && this.materialType !== 'xray' && this.materialType !== 'glow') {
      const outlineRStart = rStart + Math.min(0.007, Math.max(0.003, rStart * 0.10)) * (this.visualSettings.outlineWidth ?? 2) / 2;
      const outlineREnd = rEnd + Math.min(0.005, Math.max(0.0025, rEnd * 0.16)) * (this.visualSettings.outlineWidth ?? 2) / 2;
      const outlineGeo = new THREE.CylinderGeometry(outlineREnd, outlineRStart, len + 0.004, 20);
      const outlineMesh = new THREE.Mesh(outlineGeo, getOutlineMaterial(this.materialType, this.materialCache));
      outlineMesh.position.copy(mid);
      outlineMesh.quaternion.copy(rotationQuat);
      outlineMesh.raycast = () => {};
      this.outlineGroup.add(outlineMesh);
    }
  }

  private assertBondSegmentBudget() {
    assertRenderBudget(this.bondGroup.children.length + 1, MAX_BOND_SEGMENTS, '当前结构的化学键过于密集，已停止构建以保护浏览器。请降低成键容差或切换空间填充模式。');
  }

  private renderBonds() {
    if (!this.currentStructure || this.renderMode === 'space-filling') return;

    const atoms = this.getDisplayedAtoms();
    const baseBondRadius = this.renderMode === 'stick' 
      ? Math.max(0.12, this.visualSettings.bondRadius * 1.8) 
      : this.visualSettings.bondRadius;
    const bondStyle = this.visualSettings.bondStyle;
    const matches = createBondMatcher(this.visualSettings);

    const isDarkBond = this.visualSettings.bondColorMode === 'dark';
    const isSplit = this.visualSettings.bondColorMode === 'split';
    // 在 ceramic (C4D 影棚瓷光) 模式下，若未指定自定义键色，默认使用经典高对比黑曜石/暗金属冷黑 (#1c1917)
    const defaultBondColor = (this.materialType === 'ceramic' && (!this.visualSettings.customBondColor || this.visualSettings.customBondColor === '#8fa4ba'))
      ? '#1c1917'
      : (this.visualSettings.customBondColor || '#8fa4ba');
    const uniformBondColor = isDarkBond ? '#18181b' : defaultBondColor;
    const searchRadius = bondSearchRadius(atoms, this.visualSettings);
    const spatialIndex = new SpatialIndex(atoms, searchRadius);
    const atomIndices = new Map(atoms.map((atom, i) => [atom, i]));
    const customNeighbors = new Map<number, Set<number>>();
    for (const { id1, id2 } of this.customBonds) {
      if (!customNeighbors.has(id1)) customNeighbors.set(id1, new Set());
      if (!customNeighbors.has(id2)) customNeighbors.set(id2, new Set());
      customNeighbors.get(id1)!.add(id2);
      customNeighbors.get(id2)!.add(id1);
    }

    for (let i = 0; i < atoms.length; i++) {
      const a1 = atoms[i];
      const effId1 = a1.originalId ?? a1.id;
      if (this.hiddenAtomIds.has(effId1)) continue;
      const col1 = this.getEffectiveAtomColor(a1);

      const candidates = new Set(spatialIndex.query(a1.cartesian, searchRadius).map(atom => atomIndices.get(atom)!));
      const manualIds = customNeighbors.get(effId1);
      if (manualIds) atoms.forEach((atom, j) => { if (manualIds.has(atom.originalId ?? atom.id)) candidates.add(j); });
      for (const j of [...candidates].sort((a, b) => a - b)) {
        if (j <= i) continue;
        const a2 = atoms[j];
        const effId2 = a2.originalId ?? a2.id;
        if (this.hiddenAtomIds.has(effId2)) continue;
        if (!this.visualSettings.bondSettings?.enabled && a1.isBoundary && a2.isBoundary) continue;

        const col2 = this.getEffectiveAtomColor(a2);

        const d = dist(a1.cartesian, a2.cartesian);
        const isCustom = manualIds?.has(effId2) ?? false;
        if (matches(a1, a2, d) || isCustom) {
          // VESTA Polyhedral Style filtering:
          if (this.visualSettings.showPolyhedra) {
            const polyStyle = this.visualSettings.polyhedraSettings?.style ?? 2;
            if (polyStyle === 3 || polyStyle === 4 || polyStyle === 5) {
              const bondKey1 = `${effId1}_${effId2}`;
              const bondKey2 = `${effId2}_${effId1}`;
              if (this.polyhedraBonds.has(bondKey1) || this.polyhedraBonds.has(bondKey2)) {
                continue; // Suppress internal coordination bond
              }
            }
          }

          this.renderedBondCount++;

          const p1 = new THREE.Vector3(a1.cartesian.x, a1.cartesian.y, a1.cartesian.z);
          const p2 = new THREE.Vector3(a2.cartesian.x, a2.cartesian.y, a2.cartesian.z);
          const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

          let isDouble = false;
          if (bondStyle === 'aromatic' || bondStyle === 'auto' || bondStyle === 'double' || bondStyle === 'parallel') {
            if (a1.element === 'C' && a2.element === 'C' && d <= 1.48) {
              isDouble = true;
            } else if (
              ((a1.element === 'C' && a2.element === 'N') || (a1.element === 'N' && a2.element === 'C')) &&
              d <= 1.42
            ) {
              isDouble = true;
            } else if (bondStyle === 'double' || bondStyle === 'parallel') {
              isDouble = true;
            }
          }

          if (bondStyle === 'tapered') {
            const rad1 = this.getEffectiveAtomRadius(a1);
            const rad2 = this.getEffectiveAtomRadius(a2);

            // User-controlled Taper Radii from visualSettings
            const userRoot = this.visualSettings.taperRootRadius ?? 0.085;
            const userTip = this.visualSettings.taperTipRadius ?? 0.020;
            const taperMode = this.visualSettings.taperMode ?? 'directional';

            // In Pop Art mode, default to signature contrasting crimson red (#b91c1c)
            const bondColor = (this.materialType === 'popart' && uniformBondColor === '#8fa4ba')
              ? '#b91c1c'
              : uniformBondColor;

            if (taperMode === 'hourglass') {
              // 双向收腰 (两头在原子处为粗端，中点处为细端)
              if (isSplit) {
                this.createTaperedStickSegment(p1, midPoint, userRoot, userTip, col1);
                this.createTaperedStickSegment(midPoint, p2, userTip, userRoot, col2);
              } else {
                this.createTaperedStickSegment(p1, midPoint, userRoot, userTip, bondColor);
                this.createTaperedStickSegment(midPoint, p2, userTip, userRoot, bondColor);
              }
            } else {
              // 单向渐变锥形 (Directional Taper)
              // 优先按原子大小确定方向 (大原子为粗端，小原子为细端)
              let rStart = userRoot;
              let rEnd = userTip;
              if (rad1 < rad2 - 0.04) {
                // a1 比 a2 明显小，则 a1 处为细端，a2 处为粗端
                rStart = userTip;
                rEnd = userRoot;
              } else if (Math.abs(rad1 - rad2) <= 0.04) {
                // 两原子大小几乎相同 (如碳-碳键)
                // 依原子顺序保持单向锥度，呈现统一规律的渐变层次
                rStart = userRoot;
                rEnd = userTip;
              }

              if (isSplit) {
                const rMid = (rStart + rEnd) * 0.5;
                this.createTaperedStickSegment(p1, midPoint, rStart, rMid, col1);
                this.createTaperedStickSegment(midPoint, p2, rMid, rEnd, col2);
              } else {
                this.createTaperedStickSegment(p1, p2, rStart, rEnd, bondColor);
              }
            }
          } else if (!isDouble || bondStyle === 'single') {
            if (isSplit) {
              this.createStickSegment(p1, midPoint, baseBondRadius, col1);
              this.createStickSegment(midPoint, p2, baseBondRadius, col2);
            } else {
              // 一整根统一无拼缝的单键
              this.createStickSegment(p1, p2, baseBondRadius, uniformBondColor);
            }
          } else {
            const bondDir = new THREE.Vector3().subVectors(p2, p1).normalize();
            let norm = new THREE.Vector3().crossVectors(bondDir, new THREE.Vector3(0, 0, 1));
            if (norm.lengthSq() < 0.001) {
              norm = new THREE.Vector3().crossVectors(bondDir, new THREE.Vector3(0, 1, 0));
            }
            norm.normalize();

            // 双键圆柱半径: 0.035 Å (精炼纤细)
            const doubleRadius = Math.max(0.026, baseBondRadius * 0.65);
            // 平行间距: 留出清晰通透的留白空隙
            const doubleGap = Math.max(this.visualSettings.doubleBondGap, doubleRadius * 3.6);
            const halfGap = doubleGap * 0.5;

            // 1. Continuous Main Solid Line (主实线圆柱 - 一整根统一贯通，绝对不使用两截拼接！)
            const p1Solid = p1.clone().addScaledVector(norm, -halfGap);
            const p2Solid = p2.clone().addScaledVector(norm, -halfGap);
            const solidColor = isSplit ? (a1.element === a2.element ? col1 : uniformBondColor) : uniformBondColor;
            this.createStickSegment(p1Solid, p2Solid, doubleRadius, solidColor);

            // 2. Secondary Line (另一侧: 平行实线 vs 一实一虚断开短柱)
            if (bondStyle === 'parallel') {
              const p1B = p1.clone().addScaledVector(norm, halfGap);
              const p2B = p2.clone().addScaledVector(norm, halfGap);
              const secondaryColor = isSplit ? (a1.element === a2.element ? col2 : uniformBondColor) : uniformBondColor;
              this.createStickSegment(p1B, p2B, doubleRadius, secondaryColor);
            } else {
              // Aromatic (芳香共振双键: 一实一虚对称短柱)
              // 侧边虚线短柱从两个原子向内延伸，留出精致适度的中央断口缺口 (默认 20%，两端短柱各占 40%)
              const rad1 = this.getEffectiveAtomRadius(a1);
              const rad2 = this.getEffectiveAtomRadius(a2);
              const visibleSpan = Math.max(0.12, d - rad1 - rad2);

              const gapRatio = this.visualSettings.aromaticGapRatio ?? 0.20;
              // 精致断口宽度: 约占可见距离的 20%，或至少 2.2 倍圆柱半径，保证清晰断开但不空旷
              const centralGap = Math.max(doubleRadius * 2.2, visibleSpan * gapRatio);
              const visibleStubLen = Math.max(0.05, (visibleSpan - centralGap) * 0.5);

              // 延伸到原子球体内部的总长度
              const stubLen1 = rad1 + visibleStubLen;
              const stubLen2 = rad2 + visibleStubLen;

              // Stub 1: 从原子1延伸出短柱 (与实键保持同色统一)
              const p1Dash = p1.clone().addScaledVector(norm, halfGap);
              const stub1End = p1Dash.clone().addScaledVector(bondDir, stubLen1);
              const stub1Color = isSplit ? col1 : uniformBondColor;
              this.createStickSegment(p1Dash, stub1End, doubleRadius, stub1Color);

              // Stub 2: 从原子2延伸出短柱
              const p2Dash = p2.clone().addScaledVector(norm, halfGap);
              const stub2Start = p2Dash.clone().addScaledVector(bondDir, -stubLen2);
              const stub2Color = isSplit ? col2 : uniformBondColor;
              this.createStickSegment(stub2Start, p2Dash, doubleRadius, stub2Color);
            }
          }
        }
      }
    }
  }

  // Coordination Polyhedra (VESTA 风格配位多面体专用渲染)
  private renderPolyhedra() {
    this.polyhedraCenters.clear();
    this.polyhedraLigands.clear();
    this.polyhedraBonds.clear();

    if (!this.currentStructure || !this.visualSettings.showPolyhedra) return;

    const settings = this.visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS;
    const style = settings.style ?? 2;

    // Style 1 is "Atoms & Bonds" without polyhedral faces or edges
    if (style === 1) return;

    const displayedAtoms = this.getDisplayedAtoms();
    // Only primary unit-cell atoms can be centers (to avoid outer duplicate polyhedra)
    const baseAtoms = this.currentStructure.atoms;
    const centralElements = settings.centralElements && settings.centralElements.length > 0
      ? settings.centralElements
      : DEFAULT_POLYHEDRA_SETTINGS.centralElements;

    const tolerance = this.visualSettings.bondTolerance || 1.15;
    const matConfig = settings.material || DEFAULT_POLYHEDRA_SETTINGS.material;
    const edgeConfig = settings.edges || DEFAULT_POLYHEDRA_SETTINGS.edges;

    const centerMode = settings.centerMode || 'all';
    const customAtomIds = settings.customAtomIds || [];
    const bondRules = this.visualSettings.bondSettings?.enabled ? this.visualSettings.bondSettings.rules : null;
    const maxLigandRadius = Math.max(...displayedAtoms.map(atom => getElement(atom.element).radius), 0.1);
    const ligandRadius = bondRules ? bondSearchRadius(displayedAtoms, this.visualSettings) : Math.max(2.85, 2 * maxLigandRadius * tolerance * 1.12);
    const ligandIndex = new SpatialIndex(displayedAtoms, ligandRadius);
    let totalLigandPoints = 0;
    let coordinationChecks = 0;

    baseAtoms.forEach(centerAtom => {
      const effCenterId = centerAtom.originalId ?? centerAtom.id;
      if (this.hiddenAtomIds.has(effCenterId)) return;

      if (centerMode === 'custom') {
        // Custom mode: only user-designated atom IDs are polyhedra centers
        if (!customAtomIds.includes(effCenterId)) return;
      } else {
        // All mode: all atoms matching centralElements are polyhedra centers
        if (!bondRules && !centralElements.includes(centerAtom.element)) return;
      }
      if (bondRules && !bondRules.some(r => r.showPolyhedra && r.searchMode !== 'molecule' &&
        (r.searchByLabel ? atomSiteLabel(centerAtom) : centerAtom.element) === r.atom1)) return;

      const pCenter = new THREE.Vector3(centerAtom.cartesian.x, centerAtom.cartesian.y, centerAtom.cartesian.z);
      const rCenter = getElement(centerAtom.element).radius;

      // Find coordinating ligand atoms among displayedAtoms
      const ligands: { atom: Atom; pos: THREE.Vector3; dist: number }[] = [];

      const candidates = new Set(ligandIndex.query(centerAtom.cartesian, ligandRadius));
      const manualLigandIds = new Set<number>();
      this.customBonds.forEach(({ id1, id2 }) => {
        if (id1 === effCenterId) manualLigandIds.add(id2);
        if (id2 === effCenterId) manualLigandIds.add(id1);
      });
      if (manualLigandIds.size) displayedAtoms.forEach(atom => { if (manualLigandIds.has(atom.originalId ?? atom.id)) candidates.add(atom); });
      candidates.forEach(ligand => {
        const effLigandId = ligand.originalId ?? ligand.id;
        if (ligand.id === centerAtom.id || (!bondRules && effLigandId === effCenterId) || this.hiddenAtomIds.has(effLigandId)) return;

        const pLig = new THREE.Vector3(ligand.cartesian.x, ligand.cartesian.y, ligand.cartesian.z);
        const d = pCenter.distanceTo(pLig);
        if (d < (bondRules ? 1e-8 : 0.4)) return;

        const rLig = getElement(ligand.element).radius;
        // In VESTA, coordination is based on bonding connectivity or distance cutoff
        const maxCoordDist = Math.max((rCenter + rLig) * (tolerance * 1.12), 2.85);
        const isCustomBond = manualLigandIds.has(effLigandId);

        const ruleCoordination = bondRules?.some(r => {
          assertRenderBudget(++coordinationChecks, 4_000_000, '多面体规则搜索过于复杂，请减少规则或缩小键长范围后重试。');
          return r.showPolyhedra && r.searchMode !== 'molecule' && ruleMatchesDirection(r, centerAtom, ligand) && matchesBondRule(r, centerAtom, ligand, d);
        });
        if ((bondRules ? ruleCoordination : d <= maxCoordDist) || isCustomBond) {
          assertRenderBudget(ligands.length + 1, MAX_POLYHEDRON_LIGANDS, '单个配位中心的邻接原子过多。请降低成键容差或指定较少的多面体中心后重试。');
          ligands.push({ atom: ligand, pos: pLig, dist: d });
        }
      });

      if (ligands.length >= 3) {
        totalLigandPoints += ligands.length;
        assertRenderBudget(totalLigandPoints, MAX_POLYHEDRA_POINTS, '配位多面体的总复杂度超过浏览器预算。请指定较少的多面体中心后重试。');
        // Record center, ligands, and internal bonds
        this.polyhedraCenters.add(effCenterId);
        ligands.forEach(lig => {
          const effLigId = lig.atom.originalId ?? lig.atom.id;
          this.polyhedraLigands.add(effLigId);
          this.polyhedraBonds.add(`${effCenterId}_${effLigId}`);
          this.polyhedraBonds.add(`${effLigId}_${effCenterId}`);
        });

        // Compute 3D geometry
        const ligandPoints = ligands.map(l => l.pos);
        let polyGeo: ConvexGeometry | null = null;
        try {
          if (ligandPoints.length >= 4) {
            try {
              polyGeo = new ConvexGeometry(ligandPoints);
            } catch {
              // Nearly coplanar or collinear fallback
              const v1 = new THREE.Vector3().subVectors(ligandPoints[1], ligandPoints[0]);
              const v2 = new THREE.Vector3().subVectors(ligandPoints[2], ligandPoints[0]);
              const norm = new THREE.Vector3().crossVectors(v1, v2).normalize().multiplyScalar(0.08);
              const thickPoints = [
                ...ligandPoints.map(p => p.clone().add(norm)),
                ...ligandPoints.map(p => p.clone().sub(norm))
              ];
              polyGeo = new ConvexGeometry(thickPoints);
            }
          } else if (ligandPoints.length === 3) {
            // Planar triangle (e.g. BO3, CO3) with slight thickness
            const v1 = new THREE.Vector3().subVectors(ligandPoints[1], ligandPoints[0]);
            const v2 = new THREE.Vector3().subVectors(ligandPoints[2], ligandPoints[0]);
            const norm = new THREE.Vector3().crossVectors(v1, v2).normalize().multiplyScalar(0.06);
            const thickPoints = [
              ...ligandPoints.map(p => p.clone().add(norm)),
              ...ligandPoints.map(p => p.clone().sub(norm))
            ];
            polyGeo = new ConvexGeometry(thickPoints);
          }
        } catch (e) {
          console.warn('ConvexGeometry generation error for atom', centerAtom.element, centerAtom.id, e);
        }

        if (polyGeo) {
          // Resolve Color (RGBA)
          const customColor = settings.elementColors?.[centerAtom.element];
          let faceColor: THREE.Color;
          let faceOpacity: number;

          if (customColor) {
            faceColor = new THREE.Color(customColor.r / 255, customColor.g / 255, customColor.b / 255);
            faceOpacity = customColor.a / 255;
          } else {
            const defaultHex = this.getEffectiveAtomColor(centerAtom);
            faceColor = new THREE.Color(defaultHex);
            faceOpacity = (matConfig.opacity ?? 204) / 255;
          }

          // Specular & Shininess
          const shininess = matConfig.shininess ?? 100;
          const roughness = Math.max(0.05, 1.0 - (shininess / 100) * 0.9);
          const specular = matConfig.specular || { r: 255, g: 255, b: 255 };
          const specColor = new THREE.Color(specular.r / 255, specular.g / 255, specular.b / 255);

          // Faces (rendered if not style 6)
          if (style !== 6) {
            const polyMat = new THREE.MeshPhysicalMaterial({
              color: faceColor,
              transparent: true,
              opacity: faceOpacity,
              roughness: roughness,
              metalness: 0.05,
              specularColor: specColor,
              specularIntensity: 1.0,
              flatShading: true,
              side: THREE.DoubleSide,
              depthWrite: false
            });

            const polyMesh = new THREE.Mesh(polyGeo, polyMat);
            polyMesh.castShadow = this.visualSettings.showShadows;
            polyMesh.receiveShadow = this.visualSettings.showShadows;
            this.polyhedraGroup.add(polyMesh);
          }

          // Edges (rendered if edgeConfig.show is true or style === 6)
          if (edgeConfig.show || style === 6) {
            const edgeGeo = new THREE.EdgesGeometry(polyGeo);
            const edgeRgb = edgeConfig.color || { r: 180, g: 180, b: 180 };
            const edgeMat = new THREE.LineBasicMaterial({
              color: new THREE.Color(edgeRgb.r / 255, edgeRgb.g / 255, edgeRgb.b / 255),
              transparent: true,
              opacity: 0.95,
              linewidth: edgeConfig.lineWidth ?? 1.0
            });
            const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
            this.polyhedraGroup.add(edgeLines);
          }
          // EdgesGeometry copies the vertices; style 6 never attaches the source hull.
          if (style === 6) polyGeo.dispose();
        }
      }
    });
  }

  /**
   * 结构光影与打光系统 (Illumination & Real-time Atom Shadow Mapping)
   * 专为分子/晶体设计：光打在原子上产生的三维真实感投射阴影（原子互遮、化学键遮蔽），彻底去除虚假假底板
   * 1. 根据光源方位角 (Azimuth)、俯仰角 (Altitude) 动态定位主定向光源与辅助光
   * 2. 支持跟随相机视角旋转联动 (Headlight Mode)
   * 3. 动态计算结构三维包围体，精准紧密贴合 Shadow Frustum，确保 2048x2048 阴影分辨率极致清晰
   * 4. 阴影为光打在原子上产生的三维投射阴影（原子互遮、化学键遮蔽）
   */
  public updateLightingAndShadows() {
    this.invalidate();
    this.clearGroup(this.shadowGroup); // 彻底消除虚假的地面接触阴影平面

    if (!this.dirLight) return;

    const showShadows = !!this.visualSettings.showShadows && this.renderMode !== 'wireframe';
    this.dirLight.castShadow = showShadows;

    const azimuthDeg = this.visualSettings.lightAzimuth ?? 45;
    const altitudeDeg = this.visualSettings.lightAltitude ?? 50;
    const mainIntensity = this.visualSettings.lightIntensity ?? 2.5;
    const ambientIntensity = this.visualSettings.ambientIntensity ?? 0.85;
    const isHeadlight = !!this.visualSettings.headlightMode;

    // Structure bounding center and radius
    let center = new THREE.Vector3(0, 0, 0);
    let radius = 10;

    const atoms = this.getDisplayedAtoms();
    if (atoms.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      for (const a of atoms) {
        if (this.hiddenAtomIds.has(a.originalId ?? a.id)) continue;
        const r = this.getEffectiveAtomRadius(a);
        minX = Math.min(minX, a.cartesian.x - r);
        maxX = Math.max(maxX, a.cartesian.x + r);
        minY = Math.min(minY, a.cartesian.y - r);
        maxY = Math.max(maxY, a.cartesian.y + r);
        minZ = Math.min(minZ, a.cartesian.z - r);
        maxZ = Math.max(maxZ, a.cartesian.z + r);
      }

      if (isFinite(minX) && isFinite(maxX)) {
        center.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
        const sx = maxX - minX;
        const sy = maxY - minY;
        const sz = maxZ - minZ;
        radius = Math.max(sx, sy, sz, 8) * 0.65;
      }
    }

    const theta = (azimuthDeg * Math.PI) / 180;
    const phi = (altitudeDeg * Math.PI) / 180;
    const lightDist = Math.max(radius * 2.8, 25);

    // Direction vector from origin towards light
    const localDir = new THREE.Vector3(
      Math.cos(phi) * Math.sin(theta),
      Math.sin(phi),
      Math.cos(phi) * Math.cos(theta)
    ).normalize();

    let finalDir = localDir;
    if (isHeadlight && this.activeCamera) {
      finalDir = localDir.clone().applyQuaternion(this.activeCamera.quaternion).normalize();
    }

    // Aim main directional light
    this.dirLight.position.copy(center).addScaledVector(finalDir, lightDist);
    this.dirLight.target.position.copy(center);
    this.dirLight.target.updateMatrixWorld();

    // Light intensities
    this.dirLight.intensity = mainIntensity;
    if (this.hemiLight) this.hemiLight.intensity = ambientIntensity * 0.90;

    if (this.fillLight) {
      const fillDir = new THREE.Vector3(-finalDir.x * 0.8, Math.max(0.2, finalDir.y * 0.35), -finalDir.z * 0.8).normalize();
      this.fillLight.position.copy(center).addScaledVector(fillDir, lightDist * 0.8);
      this.fillLight.target.position.copy(center);
      this.fillLight.target.updateMatrixWorld();
      this.fillLight.intensity = ambientIntensity * 0.55;
    }

    if (this.rimLight) {
      this.rimLight.intensity = ambientIntensity * 0.45;
    }

    // Shadow Frustum tightly wrapping the crystal structure
    if (showShadows) {
      const frustumHalf = Math.max(radius * 1.35, 8);
      this.dirLight.shadow.camera.left = -frustumHalf;
      this.dirLight.shadow.camera.right = frustumHalf;
      this.dirLight.shadow.camera.top = frustumHalf;
      this.dirLight.shadow.camera.bottom = -frustumHalf;
      this.dirLight.shadow.camera.near = 1.0;
      this.dirLight.shadow.camera.far = lightDist + radius * 3.0;
      this.dirLight.shadow.camera.updateProjectionMatrix();
    }

    // Sync custom shader uniforms
    updateGlobalLightDir(finalDir);
  }

  // Real-time toggle of shadow casting & receiving across all meshes without full scene rebuild
  public updateShadowCastReceive(enabled: boolean) {
    this.atomGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = enabled;
        child.receiveShadow = enabled;
      }
    });
    this.bondGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = enabled;
        child.receiveShadow = enabled;
      }
    });
    this.polyhedraGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = enabled;
        child.receiveShadow = enabled;
      }
    });
  }

  // Hydrogen bonds & Weak coordination dashes (氢键与长程弱相互作用虚线渲染)
  private renderHBonds() {
    if (!this.currentStructure || !this.visualSettings.showHBonds) return;

    const atoms = this.getDisplayedAtoms().filter(atom => !this.hiddenAtomIds.has(atom.originalId ?? atom.id));
    const hAtoms = atoms.filter(a => a.element === 'H' && !this.hiddenAtomIds.has(a.originalId ?? a.id));
    const electronegative = atoms.filter(a => ['O', 'N', 'F', 'Cl', 'S', 'Br', 'P'].includes(a.element) && !this.hiddenAtomIds.has(a.originalId ?? a.id));
    const metalElements = ['Mo', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zr', 'Nb', 'Ru', 'Pt', 'Au', 'W', 'Zn'];
    const metals = atoms.filter(a => metalElements.includes(a.element) && !this.hiddenAtomIds.has(a.originalId ?? a.id));
    const maxRadius = Math.max(...atoms.map(atom => getElement(atom.element).radius), 0.1);
    const interactionRadius = Math.max(2 * maxRadius * this.visualSettings.bondTolerance * 1.35, 3.35);
    const acceptorIndex = new SpatialIndex(electronegative, 3.1);
    const interactionIndex = new SpatialIndex(atoms, interactionRadius);
    const assertInteractionBudget = () => assertRenderBudget(this.hbondGroup.children.length + 1, MAX_WEAK_INTERACTIONS, '氢键或弱相互作用过于密集。请关闭弱相互作用显示或减小结构后重试。');

    // 1. Classical Hydrogen Bonds (D-H ... A, 1.5 ~ 3.1 Å)
    if (hAtoms.length > 0 && electronegative.length > 0) {
      hAtoms.forEach(h => {
        const pH = new THREE.Vector3(h.cartesian.x, h.cartesian.y, h.cartesian.z);
        acceptorIndex.query(h.cartesian, 3.1).forEach(acc => {
          if (acc.id === h.id || acc.originalId === h.id || h.originalId === acc.id) return;
          const pAcc = new THREE.Vector3(acc.cartesian.x, acc.cartesian.y, acc.cartesian.z);
          const d = pH.distanceTo(pAcc);
          if (d >= 1.5 && d <= 3.1) {
            assertInteractionBudget();
            const lineGeo = new THREE.BufferGeometry().setFromPoints([pH, pAcc]);
            const lineMat = new THREE.LineDashedMaterial({
              color: 0x2563eb,
              dashSize: 0.12,
              gapSize: 0.08,
              linewidth: 2
            });
            const line = new THREE.Line(lineGeo, lineMat);
            line.computeLineDistances();
            this.hbondGroup.add(line);
          }
        });
      });
    }

    // 2. Secondary Coordination & Non-covalent Weak Interactions
    // (在无氢原子的金属配合物/催化剂中自动渲染长程配位虚线，例如金属中心周边弱配位)
    if (metals.length > 0) {
      metals.forEach(m => {
        const pM = new THREE.Vector3(m.cartesian.x, m.cartesian.y, m.cartesian.z);
        const rM = getElement(m.element).radius;
        interactionIndex.query(m.cartesian, interactionRadius).forEach(other => {
          if (other.id === m.id || other.originalId === m.id) return;
          const rOther = getElement(other.element).radius;
          const pO = new THREE.Vector3(other.cartesian.x, other.cartesian.y, other.cartesian.z);
          const d = pM.distanceTo(pO);
          const primaryCutoff = (rM + rOther) * this.visualSettings.bondTolerance;
          // 弱相互作用区间: 超过主共价键上限，且在 3.35 Å 以内
          if (d > primaryCutoff && d <= Math.max(primaryCutoff * 1.35, 3.35)) {
            assertInteractionBudget();
            const lineGeo = new THREE.BufferGeometry().setFromPoints([pM, pO]);
            const lineMat = new THREE.LineDashedMaterial({
              color: 0x0284c7, // 天青蓝出版虚线
              dashSize: 0.14,
              gapSize: 0.09,
              linewidth: 2
            });
            const line = new THREE.Line(lineGeo, lineMat);
            line.computeLineDistances();
            this.hbondGroup.add(line);
          }
        });
      });
    }
  }

  // Atom Labels (原子标签看板)
  private renderLabels() {
    if (!this.currentStructure || this.visualSettings.showLabels === 'none') return;

    const mode = this.visualSettings.showLabels;
    this.getDisplayedAtoms().filter(a => !a.isBoundary).forEach(atom => {
      if (this.hiddenAtomIds.has(atom.id)) return;

      let text = atom.element;
      if (mode === 'id') text = `#${atom.id}`;
      else if (mode === 'element+id') text = `${atom.element}${atom.id}`;

      const sprite = this.createTextSprite(text, '#0f172a', 'rgba(255, 255, 255, 0.92)');
      const r = this.getEffectiveAtomRadius(atom);
      sprite.position.set(atom.cartesian.x, atom.cartesian.y + r + 0.22, atom.cartesian.z + (this.visualSettings.labelOffsetZ ?? 0));
      this.labelGroup.add(sprite);
    });
  }

  // Measurements Rendering (测距与测角标注)
  private renderMeasurements() {
    this.invalidate();
    this.clearGroup(this.measurementGroup);
    this.measurements.forEach(m => {
      const p1 = new THREE.Vector3(m.p1.x, m.p1.y, m.p1.z);
      const p2 = new THREE.Vector3(m.p2.x, m.p2.y, m.p2.z);

      if (m.type === 'distance') {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0x0284c7,
          dashSize: 0.15,
          gapSize: 0.1,
          linewidth: 2
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        this.measurementGroup.add(line);

        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const badge = this.createTextSprite(`${m.value.toFixed(3)} Å`, '#0369a1', 'rgba(240, 249, 255, 0.95)');
        badge.position.copy(mid);
        this.measurementGroup.add(badge);
      } else if (m.type === 'angle' && m.p3) {
        const p3 = new THREE.Vector3(m.p3.x, m.p3.y, m.p3.z);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2, p3]);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0x16a34a,
          dashSize: 0.15,
          gapSize: 0.1,
          linewidth: 2
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        this.measurementGroup.add(line);

        const badge = this.createTextSprite(`${m.value.toFixed(1)}°`, '#15803d', 'rgba(240, 253, 244, 0.95)');
        badge.position.set(p2.x, p2.y + 0.35, p2.z);
        this.measurementGroup.add(badge);
      }
    });
  }

  // 2D Billboard Canvas Sprite Generator
  private createTextSprite(text: string, color = '#0f172a', bgColor = 'rgba(255, 255, 255, 0.92)'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法创建标签画布，请关闭原子标签或释放内存后重试。');

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(10, 10, 140, 52, 12);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 80, 36);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 0.42, 1);
    return sprite;
  }

  public setBackgroundColor(color: 'dark' | 'white') {
    this.invalidate();
    this.bgColor = color;
    const background=materialBackground(this.materialType,color==='white'?'#ffffff':'#0a0e17');
    this.scene.background = new THREE.Color(background);
    this.renderer.toneMappingExposure = color === 'white' ? 1.05 : 1.25;
    if (this.visualSettings.showFog) {
      this.scene.fog = new THREE.Fog(background, 12, 45);
    }
    this.rebuildLattice();
  }

  private rebuildLattice() {
    this.invalidate();
    this.clearGroup(this.latticeGroup);
    if (this.renderError) return;
    if (!this.currentStructure || !this.currentStructure.lattice) return;

    const [va, vb, vc] = this.currentStructure.lattice.matrix;
    const O = new THREE.Vector3(0, 0, 0);
    const A = new THREE.Vector3(va.x, va.y, va.z);
    const B = new THREE.Vector3(vb.x, vb.y, vb.z);
    const C = new THREE.Vector3(vc.x, vc.y, vc.z);

    const AB = new THREE.Vector3().addVectors(A, B);
    const AC = new THREE.Vector3().addVectors(A, C);
    const BC = new THREE.Vector3().addVectors(B, C);
    const ABC = new THREE.Vector3().addVectors(AB, C);

    const points = [
      O, A,  A, AB,  AB, B,  B, O,
      C, AC, AC, ABC, ABC, BC, BC, C,
      O, C,  A, AC,  AB, ABC, B, BC
    ];

    const isLightBg = !['cyber','lidar'].includes(this.materialType)&&this.bgColor==='white';
    const lineColor = isLightBg 
      ? 0x0f172a 
      : (this.materialType === 'toon' ? 0x94a3b8 : 0x38bdf8);

    const lineMat = new THREE.LineBasicMaterial({
      color: lineColor,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    this.latticeGroup.add(lineSegments);

    if (this.showAxes) {
      const origin = new THREE.Vector3(0, 0, 0);
      const aDir = A.clone().normalize();
      const bDir = B.clone().normalize();
      const cDir = C.clone().normalize();

      const arrowA = new THREE.ArrowHelper(aDir, origin, 1.8, 0xef4444, 0.4, 0.2);
      const arrowB = new THREE.ArrowHelper(bDir, origin, 1.8, 0x10b981, 0.4, 0.2);
      const arrowC = new THREE.ArrowHelper(cDir, origin, 1.8, 0x3b82f6, 0.4, 0.2);

      this.latticeGroup.add(arrowA);
      this.latticeGroup.add(arrowB);
      this.latticeGroup.add(arrowC);
    }
  }

  public fitCameraToStructure() {
    if (!this.currentStructure || this.currentStructure.atoms.length === 0) return;

    const box = new THREE.Box3();
    this.currentStructure.atoms.forEach(atom => {
      if (!this.hiddenAtomIds.has(atom.id)) {
        box.expandByPoint(new THREE.Vector3(atom.cartesian.x, atom.cartesian.y, atom.cartesian.z));
      }
    });

    if (this.currentStructure.lattice) {
      const [va, vb, vc] = this.currentStructure.lattice.matrix;
      const vA = new THREE.Vector3(va.x, va.y, va.z);
      const vB = new THREE.Vector3(vb.x, vb.y, vb.z);
      const vC = new THREE.Vector3(vc.x, vc.y, vc.z);
      box.expandByPoint(new THREE.Vector3(0, 0, 0));
      box.expandByPoint(vA);
      box.expandByPoint(vB);
      box.expandByPoint(vC);
      box.expandByPoint(vA.clone().add(vB));
      box.expandByPoint(vA.clone().add(vC));
      box.expandByPoint(vB.clone().add(vC));
      box.expandByPoint(vA.clone().add(vB).add(vC));
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 5);

    const fov = this.perspCamera.fov * (Math.PI / 180);
    // In portrait view the horizontal field of view is the limiting dimension.
    const aspectScale = 1 / Math.min(1, this.perspCamera.aspect);
    const cameraDist = (maxDim / 2) / Math.tan(fov / 2) * 1.35 * aspectScale;
    // Imported coordinates may be much larger than the initial 1000 Å frustum.
    // Fit both projection modes, otherwise switching to orthographic can clip.
    const near = Math.max(0.01, cameraDist / 100000);
    const far = Math.max(1000, cameraDist * 8 + maxDim * 4);
    this.perspCamera.near = this.orthoCamera.near = near;
    this.perspCamera.far = this.orthoCamera.far = far;
    const halfHeight = maxDim * 0.75 * aspectScale;
    this.orthoCamera.top = halfHeight;
    this.orthoCamera.bottom = -halfHeight;
    this.orthoCamera.left = -halfHeight * this.perspCamera.aspect;
    this.orthoCamera.right = halfHeight * this.perspCamera.aspect;
    this.orthoCamera.zoom = 1;
    this.perspCamera.updateProjectionMatrix();
    this.orthoCamera.updateProjectionMatrix();

    // Check if 2D sheet or slab (vacuum layer on c)
    const isSlab = this.currentStructure?.lattice 
      ? this.currentStructure.lattice.c > 1.3 * Math.max(this.currentStructure.lattice.a, this.currentStructure.lattice.b)
      : false;

    if (isSlab && this.currentStructure?.lattice) {
      // Default VESTA view for slabs: look along c* axis directly onto XY plane
      this.activeCamera.position.set(center.x, center.y, center.z + cameraDist * 1.15);
      this.activeCamera.up.set(0, 1, 0);
      this.activeCamera.lookAt(center);
      this.controls.target.copy(center);
      this.controls.update();
      return;
    }

    this.activeCamera.position.set(center.x + cameraDist * 0.45, center.y + cameraDist * 0.45, center.z + cameraDist * 0.9);
    this.activeCamera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  public viewAlong(axis: 'a' | 'b' | 'c' | 'a*' | 'b*' | 'c*' | 'reset') {
    if (axis === 'reset') {
      this.fitCameraToStructure();
      return;
    }

    if (!this.currentStructure?.lattice) return;
    const [va, vb, vc] = this.currentStructure.lattice.matrix;
    const center = this.controls.target;
    const distFromTarget = Math.max(this.activeCamera.position.distanceTo(center), 10);

    const vA = new THREE.Vector3(va.x, va.y, va.z);
    const vB = new THREE.Vector3(vb.x, vb.y, vb.z);
    const vC = new THREE.Vector3(vc.x, vc.y, vc.z);

    const dir = new THREE.Vector3();
    const upVec = new THREE.Vector3(0, 1, 0);

    if (axis === 'a') {
      dir.copy(vA).normalize();
      upVec.crossVectors(vC, vA).normalize();
    } else if (axis === 'b') {
      dir.copy(vB).normalize();
      upVec.crossVectors(vA, vB).normalize();
    } else if (axis === 'c') {
      dir.copy(vC).normalize();
      upVec.copy(vB).normalize();
    } else if (axis === 'a*') {
      dir.crossVectors(vB, vC).normalize();
      upVec.copy(vB).normalize();
    } else if (axis === 'b*') {
      dir.crossVectors(vC, vA).normalize();
      upVec.copy(vC).normalize();
    } else if (axis === 'c*') {
      dir.crossVectors(vA, vB).normalize();
      upVec.copy(vB).normalize();
    }

    this.activeCamera.position.copy(center).addScaledVector(dir, distFromTarget);
    this.activeCamera.up.copy(upVec);
    this.activeCamera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  public rotateBy(degX: number, degY: number) {
    const radX = (degX * Math.PI) / 180;
    const radY = (degY * Math.PI) / 180;
    const offset = new THREE.Vector3().subVectors(this.activeCamera.position, this.controls.target);
    const quatY = new THREE.Quaternion().setFromAxisAngle(this.activeCamera.up, radX);
    offset.applyQuaternion(quatY);
    const right = new THREE.Vector3().crossVectors(offset, this.activeCamera.up).normalize();
    const quatX = new THREE.Quaternion().setFromAxisAngle(right, radY);
    offset.applyQuaternion(quatX);
    this.activeCamera.position.copy(this.controls.target).add(offset);
    this.activeCamera.lookAt(this.controls.target);
    this.controls.update();
  }

  public panBy(deltaX: number, deltaY: number) {
    const factor = 0.015 * this.activeCamera.position.distanceTo(this.controls.target);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.activeCamera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.activeCamera.quaternion);
    const move = right.multiplyScalar(deltaX * factor).add(up.multiplyScalar(-deltaY * factor));
    this.activeCamera.position.add(move);
    this.controls.target.add(move);
    this.controls.update();
  }

  public zoomBy(percent: number) {
    const factor = 1 - percent / 100;
    const offset = new THREE.Vector3().subVectors(this.activeCamera.position, this.controls.target);
    offset.multiplyScalar(factor);
    this.activeCamera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  public getStructure(): CrystalStructure | null {
    return this.currentStructure;
  }

  private onPointerDown = (event: MouseEvent) => {
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: MouseEvent) => {
    const moveDist = Math.hypot(
      event.clientX - this.pointerDownPos.x,
      event.clientY - this.pointerDownPos.y
    );
    if (moveDist > 6) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.activeCamera);
    const intersects = this.raycaster.intersectObjects(this.atomGroup.children);

    if (intersects.length > 0) {
      const atomId = instanceAtomId(intersects[0]);
      if (atomId !== undefined) {
        // Check if currently in measurement mode
        if (this.measureMode === 'distance') {
          this.handleDistanceMeasureClick(atomId);
        } else if (this.measureMode === 'angle') {
          this.handleAngleMeasureClick(atomId);
        } else {
          const isMulti = event.ctrlKey || event.metaKey;
          if (isMulti) {
            this.toggleSelectAtom(atomId);
          } else {
            this.selectAtom(atomId);
          }
        }
      }
    } else {
      if (this.measureMode === 'none') {
        const isMulti = event.ctrlKey || event.metaKey;
        if (!isMulti) {
          this.selectAtom(null);
        }
      }
    }
  };

  private handleDistanceMeasureClick(atomId: number) {
    if (!this.currentStructure) return;
    this.measureQueue.push(atomId);

    if (this.onMeasurementProgress) {
      this.onMeasurementProgress(this.measureQueue.length, 2, [...this.measureQueue]);
    }

    if (this.measureQueue.length === 2) {
      const id1 = this.measureQueue[0];
      const id2 = this.measureQueue[1];
      const a1 = this.currentStructure.atoms.find(a => a.id === id1);
      const a2 = this.currentStructure.atoms.find(a => a.id === id2);

      if (a1 && a2) {
        const d = dist(a1.cartesian, a2.cartesian);
        const item: MeasurementItem = {
          id: `dist-${id1}-${id2}-${Date.now()}`,
          type: 'distance',
          atomIds: [id1, id2],
          value: d,
          p1: a1.cartesian,
          p2: a2.cartesian
        };
        this.measurements.push(item);
        this.renderMeasurements();
        if (this.onMeasurementComplete) this.onMeasurementComplete(item);
      }
      this.measureQueue = [];
      this.measureMode = 'none';
      if (this.onMeasurementModeChange) {
        this.onMeasurementModeChange('none');
      }
    }
  }

  private handleAngleMeasureClick(atomId: number) {
    if (!this.currentStructure) return;
    this.measureQueue.push(atomId);

    if (this.onMeasurementProgress) {
      this.onMeasurementProgress(this.measureQueue.length, 3, [...this.measureQueue]);
    }

    if (this.measureQueue.length === 3) {
      const [id1, id2, id3] = this.measureQueue;
      const a1 = this.currentStructure.atoms.find(a => a.id === id1);
      const a2 = this.currentStructure.atoms.find(a => a.id === id2); // vertex
      const a3 = this.currentStructure.atoms.find(a => a.id === id3);

      if (a1 && a2 && a3) {
        const v1 = new THREE.Vector3(a1.cartesian.x - a2.cartesian.x, a1.cartesian.y - a2.cartesian.y, a1.cartesian.z - a2.cartesian.z).normalize();
        const v2 = new THREE.Vector3(a3.cartesian.x - a2.cartesian.x, a3.cartesian.y - a2.cartesian.y, a3.cartesian.z - a2.cartesian.z).normalize();
        const angleDeg = v1.angleTo(v2) * (180 / Math.PI);

        const item: MeasurementItem = {
          id: `angle-${id1}-${id2}-${id3}-${Date.now()}`,
          type: 'angle',
          atomIds: [id1, id2, id3],
          value: angleDeg,
          p1: a1.cartesian,
          p2: a2.cartesian,
          p3: a3.cartesian
        };
        this.measurements.push(item);
        this.renderMeasurements();
        if (this.onMeasurementComplete) this.onMeasurementComplete(item);
      }
      this.measureQueue = [];
      this.measureMode = 'none';
      if (this.onMeasurementModeChange) {
        this.onMeasurementModeChange('none');
      }
    }
  }

  private clearGroup(group: THREE.Group) {
    disposeObjectTree(group, new Set([this.unitSphereGeo, this.unitCylinderGeo]), new Set(this.materialCache.values()));
    group.clear();
  }

  private pruneMaterialCache() {
    const used = new Set<THREE.Material>();
    this.structureGroup.traverse(object => {
      const material = (object as THREE.Mesh).material;
      if (material) (Array.isArray(material) ? material : [material]).forEach(value => used.add(value));
    });
    for (const [key, material] of this.materialCache) {
      if (!used.has(material)) {
        disposeMaterial(material);
        this.materialCache.delete(key);
      }
    }
  }

  private resize() {
    this.invalidate();
    if (this.disposed || this.exporting || this.contextLost) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    // Keep the current direction, target and user zoom while adapting the
    // limiting dimension, including sidebar changes and device rotation.
    const aspect = w / h;
    const fitScale = Math.min(1, this.perspCamera.aspect) / Math.min(1, aspect);
    for (const camera of [this.perspCamera, this.orthoCamera]) {
      camera.position.sub(this.controls.target).multiplyScalar(fitScale).add(this.controls.target);
      camera.near *= fitScale;
      camera.far *= fitScale;
    }
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();
    const halfHeight = (this.orthoCamera.top - this.orthoCamera.bottom) / 2 * fitScale;
    const centerY = (this.orthoCamera.top + this.orthoCamera.bottom) / 2;
    const centerX = (this.orthoCamera.left + this.orthoCamera.right) / 2;
    this.orthoCamera.top = centerY + halfHeight;
    this.orthoCamera.bottom = centerY - halfHeight;
    this.orthoCamera.left = centerX - halfHeight * w / h;
    this.orthoCamera.right = centerX + halfHeight * w / h;
    this.orthoCamera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
  }

  private stopLoop() {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = null;
  }

  private onVisibilityChange = () => {
    if (document.hidden) this.stopLoop();
    else { this.resize(); this.startLoop(); }
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.stopLoop();
    this.onStatusChange?.(this.getStatusMessage());
  };

  private onContextRestored = () => {
    if (this.disposed) return;
    this.contextLost = false;
    this.setupEnvironment();
    this.resize();
    this.onStatusChange?.(this.getStatusMessage());
    this.startLoop();
  }

  private startLoop() {
    if (this.disposed || this.contextLost || this.exporting || document.hidden || this.animFrameId !== null) return;
    const loop = () => {
      this.animFrameId = null;
      if (this.disposed || this.contextLost || this.exporting || document.hidden) return;
      this.controls.update();
      if (this.needsRender && this.visualSettings.headlightMode) {
        this.updateLightingAndShadows();
      }
      if (this.needsRender) {
        this.renderer.render(this.scene, this.activeCamera);
        this.needsRender = false;
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public getDisplayedCounts(): { atomsCount: number; bondsCount: number; polyhedraCount: number; hbondsCount: number } {
    return {
      atomsCount: renderedInstanceCount(this.atomGroup),
      bondsCount: this.renderedBondCount,
      polyhedraCount: this.polyhedraCenters.size,
      hbondsCount: this.hbondGroup.children.length
    };
  }

  /**
   * High-Resolution & Transparent Offline Renderer (渲染图像功能)
   * 支持 1080p, 2K, 4K, 5K, 8K, 透明/不透明背景, Normal/High/Ultra 质量
   */
  public async renderHighResImage(options: ImageExportOptions): Promise<string> {
    if (options.format !== undefined && !['png', 'tiff'].includes(options.format)) throw new Error('不支持的图像格式。');
    const dpi = options.dpi ?? DEFAULT_IMAGE_DPI; assertImageDpi(dpi);
    if(this.volumeLayer?.pending)await this.volumeLayer.pending;
    if(this.volumeLayer?.error)throw new Error(this.volumeLayer.error);
    if (this.disposed || this.contextLost) throw new Error('当前图形上下文不可用，请恢复画面后重试。');
    if (this.renderError) throw new Error(`当前结构尚未成功渲染，无法导出。${this.renderError}`);
    if (!this.currentStructure?.atoms.length) throw new Error('请先载入含原子的结构再导出图像。');
    if (this.exporting) throw new Error('已有图像正在导出，请等待完成。');
    const currentW = this.container.clientWidth || window.innerWidth;
    const currentH = this.container.clientHeight || window.innerHeight;
    let aspect = currentW / currentH;
    if (options.aspectRatio === '16:9') aspect = 16 / 9;
    else if (options.aspectRatio === '4:3') aspect = 4 / 3;
    else if (options.aspectRatio === '1:1') aspect = 1;

    const gl = this.renderer.getContext();
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const maxDimension = Math.min(this.renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), viewport[0], viewport[1]);
    const memoryHint = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const plan = planImageExport(options.width, aspect, options.quality, maxDimension, exportPixelBudget(memoryHint));
    const legendEntries = options.includeAtomLegend ? collectAtomLegend(this.currentStructure, atom => this.getEffectiveAtomColor(atom)) : [];
    const legendLayout = planAtomLegend(plan.width, plan.height, legendEntries.length);

    // Save previous renderer state
    const prevPixelRatio = this.renderer.getPixelRatio();
    const prevSize = new THREE.Vector2();
    this.renderer.getSize(prevSize);
    const prevBg = this.scene.background;
    const prevClearColor = new THREE.Color();
    this.renderer.getClearColor(prevClearColor);
    const prevClearAlpha = this.renderer.getClearAlpha();
    const prevShadowMapSize = this.dirLight.shadow.mapSize.clone();
    const camera = this.activeCamera;
    const prevAspect = this.perspCamera.aspect;
    const prevOrtho = { left: this.orthoCamera.left, right: this.orthoCamera.right };
    const prevControlsEnabled = this.controls.enabled;
    let outputCanvas: HTMLCanvasElement | null = null;
    this.exporting = true;
    this.controls.enabled = false;
    this.stopLoop();
    try {
      const shadowSize = Math.min(options.quality === 'ultra' ? 4096 : 2048, maxDimension);
      this.dirLight.shadow.mapSize.set(shadowSize, shadowSize);
      this.dirLight.shadow.map?.dispose();
      this.dirLight.shadow.map = null;
      this.scene.background = options.transparent ? null : (prevBg instanceof THREE.Color?prevBg.clone():new THREE.Color(0xffffff));
      this.renderer.setClearColor(0xffffff, options.transparent ? 0 : 1);
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(plan.renderWidth, plan.renderHeight, false);
      if (gl.drawingBufferWidth !== plan.renderWidth || gl.drawingBufferHeight !== plan.renderHeight) {
        throw new Error('当前设备未能分配完整图像缓冲区，请降低分辨率后重试。');
      }
      if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect;
      else if (camera instanceof THREE.OrthographicCamera) {
        const halfHeight = (camera.top - camera.bottom) / 2;
        const centerX = (camera.left + camera.right) / 2;
        camera.left = centerX - halfHeight * aspect;
        camera.right = centerX + halfHeight * aspect;
      }
      if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) camera.updateProjectionMatrix();
      this.renderer.render(this.scene, camera);
      if (gl.isContextLost()) throw new Error('高分辨率渲染超出当前设备资源，请降低分辨率后重试。');
      let captureCanvas = this.renderer.domElement;
      if (plan.sampleScale > 1 || legendEntries.length || NEW_MATERIALS.includes(this.materialType) || options.format === 'tiff') {
        outputCanvas = document.createElement('canvas');
        outputCanvas.width = plan.width;
        outputCanvas.height = plan.height;
        const ctx = outputCanvas.getContext('2d');
        if (!ctx) throw new Error('浏览器无法创建图像输出画布，请降低分辨率。');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (!options.transparent) { ctx.fillStyle = prevBg instanceof THREE.Color ? `#${prevBg.getHexString()}` : '#ffffff'; ctx.fillRect(0, 0, plan.width, plan.height); }
        const availableHeight = plan.height - legendLayout.footerHeight;
        const scale = Math.min(plan.width / plan.renderWidth, availableHeight / plan.renderHeight);
        const w = plan.renderWidth * scale, h = plan.renderHeight * scale;
        ctx.drawImage(captureCanvas, (plan.width - w) / 2, (availableHeight - h) / 2, w, h);
        if (legendEntries.length && !options.transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, availableHeight, plan.width, legendLayout.footerHeight); }
        captureCanvas = outputCanvas;
      }
      if(NEW_MATERIALS.includes(this.materialType)){
        if(!outputCanvas){outputCanvas=document.createElement('canvas');outputCanvas.width=plan.width;outputCanvas.height=plan.height;const ctx=outputCanvas.getContext('2d');if(!ctx)throw new Error('无法创建材质标注画布。');ctx.drawImage(captureCanvas,0,0,plan.width,plan.height);}
        const ctx=outputCanvas.getContext('2d');if(!ctx)throw new Error('无法创建材质标注画布。');
        drawMaterialCaption(ctx,plan.width,plan.height-legendLayout.footerHeight,this.materialType,this.currentStructure,this.visualSettings);captureCanvas=outputCanvas;
      }
      if (legendEntries.length && outputCanvas) {
        const ctx = outputCanvas.getContext('2d')!;
        this.drawExportAtomLegend(ctx, plan.width, plan.height, legendEntries, legendLayout, options.transparent);
      }
      const blob = options.format === 'tiff' ? await (async () => {
        const { encodeTiff } = await import('./tiff');
        const ctx = captureCanvas.getContext('2d');
        if (!ctx) throw new Error('无法读取 TIFF 图像像素。');
        return new Blob([encodeTiff(plan.width, plan.height, ctx.getImageData(0, 0, plan.width, plan.height).data, options.transparent, dpi)], { type: 'image/tiff' });
      })() : await new Promise<Blob>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('图像编码超时，请降低分辨率后重试。')), 30000);
        try {
          captureCanvas.toBlob(value => {
            window.clearTimeout(timeout);
            if (value) resolve(value);
            else reject(new Error('浏览器未能编码图像，请降低分辨率后重试。'));
          }, 'image/png');
        } catch (error) {
          window.clearTimeout(timeout);
          reject(error);
        }
      });
      if (this.disposed || this.contextLost) throw new Error('导出期间图形上下文已中断，请恢复后重试。');
      const file = options.format === 'tiff' ? blob : new Blob([setPngDpi(await blob.arrayBuffer(), dpi)], { type: 'image/png' });
      return URL.createObjectURL(file);
    } finally {
      if (outputCanvas) { outputCanvas.width = 0; outputCanvas.height = 0; }
      this.exporting = false;
      if (!this.disposed) {
        this.scene.background = prevBg;
        this.renderer.setClearColor(prevClearColor, prevClearAlpha);
        this.renderer.setPixelRatio(prevPixelRatio);
        this.renderer.setSize(prevSize.x, prevSize.y, true);
        this.dirLight.shadow.mapSize.copy(prevShadowMapSize);
        this.dirLight.shadow.map?.dispose();
        this.dirLight.shadow.map = null;
        this.perspCamera.aspect = prevAspect;
        this.orthoCamera.left = prevOrtho.left;
        this.orthoCamera.right = prevOrtho.right;
        this.perspCamera.updateProjectionMatrix();
        this.orthoCamera.updateProjectionMatrix();
        this.controls.enabled = prevControlsEnabled;
        this.resize();
        this.startLoop();
      }
    }
  }

  /** Render each reference ball with the same materials, lighting and color pipeline.
   * Selection glow is transient UI state and is intentionally absent from the palette.
   */
  private drawExportAtomLegend(ctx: CanvasRenderingContext2D, width: number, height: number, entries: AtomLegendEntry[], layout: ReturnType<typeof planAtomLegend>, transparent: boolean) {
    const scene = new THREE.Scene(); scene.environment = this.scene.environment;
    scene.background = transparent ? null : new THREE.Color('#ffffff');
    const center = this.controls.target;
    for (const source of this.scene.children) if (source instanceof THREE.Light) {
      const light = source.clone(); light.position.sub(center); light.castShadow = false;
      if (light instanceof THREE.DirectionalLight && source instanceof THREE.DirectionalLight) {
        light.target = source.target.clone(); light.target.position.sub(center); scene.add(light.target);
      }
      scene.add(light);
    }
    const camera = new THREE.OrthographicCamera(-1.18, 1.18, 1.18, -1.18, .1, 20);
    camera.position.copy(this.activeCamera.position).sub(center).normalize().multiplyScalar(5);
    camera.up.copy(this.activeCamera.up); camera.lookAt(0, 0, 0);
    const geometry = new THREE.SphereGeometry(1, 40, 28);
    const mesh = new THREE.Mesh(geometry, this.atomMaterial(entries[0].atom, false)); scene.add(mesh);
    const outline = new THREE.Mesh(geometry, getOutlineMaterial(this.materialType, this.materialCache));
    outline.scale.setScalar(1 + .0325 * (this.visualSettings.outlineWidth ?? 2) / 2);
    outline.visible = this.visualSettings.showOutline && this.renderMode !== 'wireframe' && !['xray','glow','cyber','lidar'].includes(this.materialType);
    scene.add(outline);
    try {
      const size = Math.ceil(layout.sphereSize * 2);
      this.renderer.setSize(size, size, false);
      drawAtomLegend(ctx, width, height, entries, layout, entry => {
        mesh.material = this.atomMaterial(entry.atom, false);
        this.renderer.render(scene, camera);
        if (this.renderer.getContext().isContextLost()) throw new Error('原子图例渲染失败，请降低分辨率。');
        return this.renderer.domElement;
      });
    } finally { geometry.dispose(); scene.clear(); }
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.controls.dispose();
    this.controls.removeEventListener('change', this.onControlsChange);
    this.volumeLayer?.dispose();
    this.clearGroup(this.structureGroup);
    this.materialCache.forEach(material => disposeMaterial(material));
    this.materialCache.clear();
    this.displayedAtomsCache = null;
    this.currentStructure = null;
    this.environmentTarget?.dispose();
    this.scene.environment = null;
    this.dirLight.shadow.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.unitSphereGeo.dispose();
    this.unitCylinderGeo.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
