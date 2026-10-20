import { PolyhedraSettings } from '../types/crystal';

export const POLYHEDRA_STORAGE_KEY = 'vesta_polyhedra_settings';

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isRgb = (value: unknown): value is { r: number; g: number; b: number } => {
  if (!value || typeof value !== 'object') return false;
  const rgb = value as Record<string, unknown>;
  return ['r', 'g', 'b'].every(channel => inRange(rgb[channel], 0, 255));
};

/** Browser storage is optional and untrusted (old versions, manual edits, blocked storage). */
export function loadSavedPolyhedraSettings(): PolyhedraSettings | null {
  try {
    const raw = localStorage.getItem(POLYHEDRA_STORAGE_KEY);
    if (!raw || raw.length > 100_000) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' ||
      !Number.isInteger(value.style) || !inRange(value.style, 1, 6) ||
      !['all', 'custom', undefined].includes(value.centerMode) ||
      !Array.isArray(value.centralElements) || value.centralElements.length > 118 ||
      !value.centralElements.every((symbol: unknown) => typeof symbol === 'string' && /^[A-Z][a-z]?$/.test(symbol)) ||
      (value.customAtomIds !== undefined && (!Array.isArray(value.customAtomIds) ||
        !value.customAtomIds.every((id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id >= 0))) ||
      !isRgb(value.material?.specular) || !inRange(value.material?.shininess, 0, 100) ||
      !inRange(value.material?.opacity, 0, 255) || !value.edges || typeof value.edges.show !== 'boolean' ||
      !inRange(value.edges.lineWidth, 0.1, 10) || !isRgb(value.edges.color) ||
      !value.elementColors || typeof value.elementColors !== 'object' || Array.isArray(value.elementColors)) return null;
    for (const [symbol, color] of Object.entries(value.elementColors)) {
      if (!/^[A-Z][a-z]?$/.test(symbol) || !isRgb(color) || !inRange((color as { a?: unknown }).a, 0, 255)) return null;
    }
    // Older versions saved selections alongside defaults. Those IDs describe a
    // different structure, so migrate legacy entries just as new saves do.
    if (value.centerMode === 'custom' || value.customAtomIds?.length) {
      return { ...value, centerMode: 'all', customAtomIds: [] } as PolyhedraSettings;
    }
    return value as PolyhedraSettings;
  } catch {
    return null;
  }
}

/** Defaults are portable: atom IDs must never carry over to another structure. */
export function savePolyhedraDefaults(settings: PolyhedraSettings): boolean {
  try {
    localStorage.setItem(POLYHEDRA_STORAGE_KEY, JSON.stringify({ ...settings, centerMode: 'all', customAtomIds: [] }));
    return true;
  } catch {
    return false;
  }
}
