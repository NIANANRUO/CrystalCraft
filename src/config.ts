import type { BondStyle, PresetMaterialType } from './types/crystal';
import { NEW_MATERIALS,retiredMaterialFallback,materialMigrationNotice } from './materialCatalog';

export const LEGACY_MATERIALS: readonly PresetMaterialType[] = ['candy', 'ceramic', 'frosted', 'glow', 'iridescent', 'xray', 'comic', 'popart', 'clay', 'bubble', 'mof', 'handdrawn', 'flat2d', 'toon', 'smooth', 'plastic', 'glossy', 'metallic', 'glass', 'flat'];
export const MATERIALS: readonly PresetMaterialType[] = [...LEGACY_MATERIALS,...NEW_MATERIALS];
const BOND_STYLES: readonly BondStyle[] = ['auto', 'aromatic', 'tapered', 'parallel', 'double', 'single'];

/** Query strings are untrusted input, including links shared by another user. */
export function readStartupOptions(search: string) {
  const params = new URLSearchParams(search);
  const numeric = (key: string, fallback: number, min: number, max: number) => {
    const text = params.get(key);
    if (text === null || text.trim() === '') return fallback;
    const value = Number(text);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  };
  const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = params.get(key) as T;
    return values.includes(value) ? value : fallback;
  };
  const oldMaterial=params.get('material')??'',fallback=retiredMaterialFallback(oldMaterial);
  const material = fallback??choice('material', MATERIALS, 'comic');
  return {
    migrationNotice:fallback?materialMigrationNotice(oldMaterial):undefined,
    material,
    bondStyle: choice('bondStyle', BOND_STYLES, material === 'popart' ? 'tapered' : 'aromatic'),
    atomScale: numeric('atomScale', 1, 0.2, 2),
    bondRadius: numeric('bondRadius', 0.055, 0.02, 0.2),
    zoom: numeric('zoom', 0, 0, 90),
    polyhedra: params.get('polyhedra') === 'true' || material === 'mof',
    taperRoot: numeric('taperRoot', 0.085, 0.03, 0.2),
    taperTip: numeric('taperTip', 0.02, 0.008, 0.08),
    showHBonds: params.get('showHBonds') === 'true',
    showOutline: params.has('showOutline')?params.get('showOutline')!=='false':!NEW_MATERIALS.includes(material),
    showShadows: params.get('showShadows') !== 'false',
    lightAzimuth: numeric('lightAzimuth', 45, 0, 360),
    lightAltitude: numeric('lightAltitude', 50, 10, 85),
    lightIntensity: numeric('lightIntensity', 2.5, 0.5, 5),
    ambientIntensity: numeric('ambientIntensity', 0.85, 0.1, 2.5),
    openProperties: params.get('openProperties') === 'true',
    propertiesTab: choice('propertiesTab', ['general', 'atoms', 'bonds', 'polyhedra', 'isosurfaces', 'sections'] as const, 'polyhedra'),
  };
}
