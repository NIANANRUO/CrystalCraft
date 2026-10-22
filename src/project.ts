import type { CrystalStructure, VisualSettings, PresetMaterialType, RenderMode } from './types/crystal';
import { assertBondSettings } from './utils/bonding';
import { assertStructureValid, MAX_FILE_BYTES } from './utils/validation';
import { MATERIALS } from './config';
import {retiredMaterialFallback,materialMigrationNotice} from './materialCatalog';
import { displacementAxes } from './utils/displacement';
import { calculateLatticeFromMatrix, fractionalToCartesian } from './utils/math';
import { assertVolumeSettings } from './volume/data';
import { assertProjectShape, assertJsonDepth } from './projectSchema';

export interface ProjectState {
  migrationNotice?: string;
  structure: CrystalStructure;
  visualSettings: VisualSettings;
  materialType: PresetMaterialType;
  renderMode: RenderMode;
  showLattice: boolean;
  showAxes: boolean;
}
export const PROJECT_VERSION = 2;
export const MAX_PROJECT_BYTES = 24 * 1024 * 1024;
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
/** Reject unexpected shapes instead of allowing project JSON to enter renderer state. */
export function validateProjectState(value: unknown): asserts value is ProjectState {
  assertProjectShape(value);
  if (!object(value) || !object(value.structure) || typeof value.structure.title !== 'string' || value.structure.title.length > 10000 || !Array.isArray(value.structure.atoms)) throw new Error('项目缺少有效结构。');
  assertStructureValid(value.structure as CrystalStructure);
  const structure = value.structure;
  if (structure.lattice) {
    const calculated = calculateLatticeFromMatrix(structure.lattice.matrix);
    for (const key of ['a', 'b', 'c', 'alpha', 'beta', 'gamma', 'volume'] as const) if (!Number.isFinite(structure.lattice[key]) || Math.abs(structure.lattice[key] - calculated[key]) > 1e-6 * Math.max(1, Math.abs(calculated[key]))) throw new Error('项目晶格参数与矩阵不一致。');
  }
  if (typeof structure.isPeriodic !== 'boolean') throw new Error('项目周期标记无效。');
  for (const atom of structure.atoms) {
    if (structure.lattice) {
      const expected = fractionalToCartesian(atom.fractional, structure.lattice.matrix);
      if (['x', 'y', 'z'].some(axis => Math.abs(expected[axis as keyof typeof expected] - atom.cartesian[axis]) > 1e-5)) throw new Error('项目分数坐标与笛卡尔坐标不一致。');
    }
    if (atom.displacement !== undefined) displacementAxes(atom.displacement);
    if (atom.colorOverride !== undefined && !/^#[a-f\d]{6}$/i.test(atom.colorOverride)) throw new Error('项目原子颜色无效。');
    if (atom.radiusOverride !== undefined && (!Number.isFinite(atom.radiusOverride) || atom.radiusOverride <= 0 || atom.radiusOverride > 5)) throw new Error('项目原子半径无效。');
  }
  if (structure.sourceCif !== undefined && (!object(structure.sourceCif) || typeof structure.sourceCif.text !== 'string' || new TextEncoder().encode(structure.sourceCif.text).length > MAX_FILE_BYTES || typeof structure.sourceCif.originalGeometry !== 'string' || structure.sourceCif.originalGeometry.length > MAX_FILE_BYTES)) throw new Error('项目原始 CIF 记录无效。');
  if (!MATERIALS.includes(value.materialType) || !['ball-and-stick', 'space-filling', 'stick', 'wireframe'].includes(value.renderMode) || typeof value.showLattice !== 'boolean' || typeof value.showAxes !== 'boolean') throw new Error('项目视图配置无效。');
  const s = value.visualSettings;
  if (!object(s)) throw new Error('项目缺少显示设置。');
  if (s.bondSettings !== undefined) assertBondSettings(s.bondSettings);
  if(s.volumeSettings!==undefined)assertVolumeSettings(s.volumeSettings,structure.volumeData);
  if(s.ionicRadii!==undefined){
    if(!object(s.ionicRadii)||Object.keys(s.ionicRadii).length>2000)throw new Error('项目离子半径设置无效。');
    for(const [element,v]of Object.entries(s.ionicRadii) as [string,any][]){if(!/^[A-Za-z][A-Za-z0-9_+\-]{0,31}$/.test(element)||!object(v)||!Number.isInteger(v.charge)||v.charge===0||Math.abs(v.charge)>8||!Number.isInteger(v.coordination)||v.coordination<1||v.coordination>16||!Number.isFinite(v.radius)||v.radius<=0||v.radius>5)throw new Error('项目离子半径参数无效。');}
  }
  const range = (key: string, min: number, max: number, required = false, integer = false) => {
    if (s[key] === undefined && !required) return;
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max || (integer && !Number.isInteger(s[key]))) throw new Error(`项目参数 ${key} 超出有效范围。`);
  };
  for (const [key, min, max] of [['atomScale', .2, 2], ['bondRadius', .02, .2], ['bondTolerance', .8, 1.6], ['doubleBondGap', .06, .5], ['autoRotateSpeed', -20, 20]] as const) range(key, min, max, true);
  for (const [key, min, max] of [['atomShininess', 0, 100], ['labelOffsetZ', 0, 5], ['outlineWidth', 0, 5], ['aromaticGapRatio', .1, .4], ['taperRootRadius', .03, .2], ['taperTipRadius', .008, .08], ['lightAzimuth', 0, 360], ['lightAltitude', 10, 85], ['lightIntensity', .5, 5], ['ambientIntensity', .1, 2.5]] as const) range(key, min, max);
  range('atomStacks', 8, 64, false, true); range('atomSlices', 8, 64, false, true);
  range('textureStrength',0,1);range('textureScale',4,24,false,true);
  for (const key of ['showPolyhedra', 'showHBonds', 'showOutline', 'showShadows', 'showFog', 'isOrthographic', 'autoRotate', 'showBoundaryAtoms']) if (typeof s[key] !== 'boolean') throw new Error(`项目开关 ${key} 无效。`);
  for (const key of ['hideNonbonding', 'showStructure', 'headlightMode']) if (s[key] !== undefined && typeof s[key] !== 'boolean') throw new Error(`项目开关 ${key} 无效。`);
  for (const [key, options] of Object.entries({ bondStyle: ['auto', 'aromatic', 'tapered', 'parallel', 'double', 'single'], bondColorMode: ['uniform', 'dark', 'split'], showLabels: ['none', 'element', 'id', 'element+id'] })) if (!options.includes(s[key])) throw new Error(`项目选项 ${key} 无效。`);
  if (s.atomStyle !== undefined && !['balls', 'ellipsoids'].includes(s.atomStyle)) throw new Error('项目原子样式无效。');
  if (s.radiiType !== undefined && !['atomic', 'covalent', 'vdw', 'ionic'].includes(s.radiiType)) throw new Error('项目半径类型无效。');
  if (s.taperMode !== undefined && !['directional', 'hourglass'].includes(s.taperMode)) throw new Error('项目锥形模式无效。');
  if (s.ligandViewRadius !== null && (!Number.isFinite(s.ligandViewRadius) || s.ligandViewRadius <= 0 || s.ligandViewRadius > 1000)) throw new Error('项目配体范围无效。');
  for (const key of ['elementColors', 'elementRadii']) {
    if (!object(s[key]) || Object.keys(s[key]).length > 2000) throw new Error('项目元素设置无效。');
    for (const v of Object.values(s[key])) if (key === 'elementColors' ? typeof v !== 'string' || !/^#[a-f\d]{6}$/i.test(v) : !Number.isFinite(v) || (v as number) <= 0 || (v as number) > 5) throw new Error('项目元素设置超出范围。');
  }
  const rgb = (v: any) => object(v) && ['r', 'g', 'b'].every(k => Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 255);
  if (s.atomSpecular !== undefined && !rgb(s.atomSpecular)) throw new Error('项目高光颜色无效。');
  if (s.customBondColor !== undefined && !/^#[a-f\d]{6}$/i.test(s.customBondColor)) throw new Error('项目键颜色无效。');
  if (s.polyhedraSettings !== undefined) {
    const p = s.polyhedraSettings;
    if (!object(p) || !Number.isInteger(p.style) || p.style < 1 || p.style > 6 || !Array.isArray(p.centralElements) || p.centralElements.some((e: unknown) => typeof e !== 'string' || !/^[A-Za-z][A-Za-z0-9_+\-]{0,31}$/.test(e)) || !object(p.material) || !rgb(p.material.specular) || !Number.isFinite(p.material.shininess) || p.material.shininess < 0 || p.material.shininess > 100 || !Number.isFinite(p.material.opacity) || p.material.opacity < 0 || p.material.opacity > 255 || !object(p.edges) || typeof p.edges.show !== 'boolean' || !rgb(p.edges.color) || !Number.isFinite(p.edges.lineWidth) || p.edges.lineWidth < 0 || p.edges.lineWidth > 10 || !object(p.elementColors)) throw new Error('项目多面体设置无效。');
    if (p.centerMode !== undefined && !['all', 'custom'].includes(p.centerMode) || p.customAtomIds !== undefined && (!Array.isArray(p.customAtomIds) || p.customAtomIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) < 1))) throw new Error('项目多面体位点无效。');
    if (Object.keys(p.elementColors).length > 2000 || Object.values(p.elementColors).some((v: any) => !rgb(v) || !Number.isFinite(v.a) || v.a < 0 || v.a > 255)) throw new Error('项目多面体颜色无效。');
  }
}
export function encodeProject(state: ProjectState): string {
  validateProjectState(state);
  const {migrationNotice:_,...savedState}=state;
  const text = JSON.stringify({ kind: 'CrystalCraftProject', version: PROJECT_VERSION, savedAt: new Date().toISOString(), state:savedState });
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('项目超过 24 MiB，请缩小结构或原始数据。');
  return text;
}
export function parseProject(text: string): ProjectState {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('项目超过 24 MiB。');
  assertJsonDepth(text);
  const value = JSON.parse(text, (key, value) => { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('项目含非法字段。'); return value; });
  if (!object(value) || Object.keys(value).some(key => !['kind','version','savedAt','state'].includes(key)) || (value.savedAt !== undefined && (typeof value.savedAt !== 'string' || value.savedAt.length > 64))) throw new Error('项目文件结构无效。');
  if (value?.kind !== 'CrystalCraftProject' || ![1,PROJECT_VERSION].includes(value.version)) throw new Error('不支持的项目格式或版本。');
  if(object(value.state)&&typeof value.state.materialType==='string'){
    const fallback=retiredMaterialFallback(value.state.materialType);
    if(fallback){value.state.migrationNotice=materialMigrationNotice(value.state.materialType);value.state.materialType=fallback;}
    else delete value.state.migrationNotice;
  }
  validateProjectState(value.state);
  return value.state;
}
export { ProjectHistory } from './projectHistory';
