import type { Atom, BondRule, BondSettings, CrystalStructure, VisualSettings } from '../types/crystal';
import { DEFAULT_POLYHEDRA_SETTINGS } from '../types/crystal';
import { getElement } from '../constants/elements';
import { SpatialIndex } from '../renderer/spatialIndex';
import { MAX_DISPLAYED_ATOMS, assertRenderBudget } from '../renderer/limits';
import { dist, fractionalToCartesian, invertMatrix, norm } from './math';

export const MAX_BOND_RULES = 2000;
export const MAX_BOND_LENGTH = 100;
export const atomSiteLabel = (atom: Atom) => atom.name || `${atom.element}${atom.originalId ?? atom.id}`;

export function assertBondSettings(value: unknown): asserts value is BondSettings {
  const s = value as BondSettings;
  if (!s || typeof s.enabled !== 'boolean' || !Array.isArray(s.rules) || s.rules.length > MAX_BOND_RULES) throw new Error('化学键规则设置无效。');
  const ids = new Set<string>();
  for (const r of s.rules) {
    if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 100 || ids.has(r.id) ||
      !['pair', 'all', 'molecule'].includes(r.searchMode) || ![1, 2, 3].includes(r.boundaryMode) ||
      typeof r.searchByLabel !== 'boolean' || typeof r.showPolyhedra !== 'boolean' ||
      [r.atom1, r.atom2].some(v => typeof v !== 'string' || !v.trim() || v.length > 128) ||
      !Number.isFinite(r.minLength) || !Number.isFinite(r.maxLength) || r.minLength < 0 || r.maxLength <= 0 ||
      r.minLength > r.maxLength || r.maxLength > MAX_BOND_LENGTH) throw new Error('化学键规则无效：键长须满足 0 ≤ Min. ≤ Max. ≤ 100 Å，且 Max. > 0。');
    ids.add(r.id);
  }
}

/** Direction matters for A1-centered expansion and coordination, not for drawing a bond. */
export function ruleMatchesDirection(rule: BondRule, a1: Atom, a2: Atom): boolean {
  if (rule.searchMode === 'molecule') return true;
  const label = rule.searchByLabel ? atomSiteLabel : (atom: Atom) => atom.element;
  return label(a1) === rule.atom1 && (rule.searchMode === 'all' || label(a2) === rule.atom2);
}

export function ruleMatchesDistance(rule: BondRule, distance: number): boolean {
  return distance > 1e-8 && distance >= rule.minLength - 1e-8 && distance <= rule.maxLength + 1e-8;
}

export function matchesBondRule(rule: BondRule, a: Atom, b: Atom, distance = dist(a.cartesian, b.cartesian)): boolean {
  if (!ruleMatchesDistance(rule, distance)) return false;
  if (rule.boundaryMode === 1 && (a.isBoundary || b.isBoundary)) return false;
  return (ruleMatchesDirection(rule, a, b) && (rule.boundaryMode !== 2 || !a.isBoundary)) ||
    (ruleMatchesDirection(rule, b, a) && (rule.boundaryMode !== 2 || !b.isBoundary));
}

export function hasAutomaticBond(a: Atom, b: Atom, settings: VisualSettings, distance = dist(a.cartesian, b.cartesian)): boolean {
  if (settings.bondSettings?.enabled) return settings.bondSettings.rules.some(r => matchesBondRule(r, a, b, distance));
  return distance > .4 && distance <= (getElement(a.element).radius + getElement(b.element).radius) * settings.bondTolerance;
}

/** One budget per scene pass, including unsuccessful rules (which create no geometry). */
export function createBondMatcher(settings: VisualSettings) {
  let evaluations = 0;
  return (a: Atom, b: Atom, distance = dist(a.cartesian, b.cartesian)): boolean => {
    if (!settings.bondSettings?.enabled) return hasAutomaticBond(a, b, settings, distance);
    return settings.bondSettings.rules.some(r => {
      assertRenderBudget(++evaluations, 4_000_000, '化学键规则搜索过于复杂，请减少规则数量或缩小最大键长后重试。');
      return matchesBondRule(r, a, b, distance);
    });
  };
}

export function bondSearchRadius(atoms: Atom[], settings: VisualSettings): number {
  return settings.bondSettings?.enabled
    ? Math.max(.1, ...settings.bondSettings.rules.map(r => r.maxLength))
    : Math.max(.1, ...atoms.map(a => getElement(a.element).radius * 2 * settings.bondTolerance));
}

export function defaultBondRules(structure: CrystalStructure | null, tolerance: number, centralElements = DEFAULT_POLYHEDRA_SETTINGS.centralElements): BondRule[] {
  const elements = [...new Set(structure?.atoms.map(a => a.element) ?? [])];
  if (elements.length * (elements.length + 1) / 2 > MAX_BOND_RULES) return [];
  const rules: BondRule[] = [];
  for (let i = 0; i < elements.length; i++) for (let j = i; j < elements.length; j++) {
    // Orient metal/ligand pairs with the coordinating element as A1.
    const [atom1, atom2] = centralElements.includes(elements[j]) && !centralElements.includes(elements[i])
      ? [elements[j], elements[i]] : [elements[i], elements[j]];
    rules.push({ id: `default-${i}-${j}`, searchMode: 'pair', boundaryMode: 2, searchByLabel: false, atom1, atom2,
      minLength: 0, maxLength: Number(((getElement(atom1).radius + getElement(atom2).radius) * tolerance).toFixed(5)),
      showPolyhedra: centralElements.includes(atom1) });
  }
  return rules;
}

/** Finite BFS over periodic images. Reciprocal-vector bounds also cover skew cells
 * and bond cutoffs larger than one cell. Budgets reject unbounded networks rather
 * than silently truncating them into an apparently complete molecule. */
export function expandBondRuleAtoms(structure: CrystalStructure, settings: VisualSettings): Atom[] {
  const base = structure.atoms.map(a => ({ ...a, isBoundary: false }));
  if (!settings.showBoundaryAtoms || !structure.isPeriodic || !structure.lattice || !base.length) return base;
  const rules = settings.bondSettings!.rules.filter(r => r.boundaryMode !== 1);
  if (!rules.length) return base;
  const matrix = structure.lattice.matrix;
  const radius = Math.max(...rules.map(r => r.maxLength));
  const fractionalReach = invertMatrix(matrix).map(row => norm(row) * radius);
  const axes = ['x', 'y', 'z'] as const;
  const bounds = axes.map(k => [Math.min(...base.map(a => a.fractional[k])), Math.max(...base.map(a => a.fractional[k]))]);
  const index = new SpatialIndex(base, radius);
  const key = (a: Atom) => `${a.element}:${axes.map(k => Math.round(a.fractional[k] * 1e8)).join(',')}`;
  const seen = new Set(base.map(key));
  const result: Atom[] = [...base];
  let nextId = Math.max(...base.map(a => a.id)) + 1;
  let queries = 0, comparisons = 0, ruleChecks = 0;
  const budgetMessage = '周期键搜索超过显示预算，可能形成无限周期网络。请使用 Boundary 1/2、缩小键长范围或关闭边界补全。';
  for (let cursor = 0; cursor < result.length; cursor++) {
    const center = result[cursor];
    const active = rules.filter(r => r.boundaryMode === 3 || (!center.isBoundary && (r.searchMode === 'molecule' || (r.searchByLabel ? atomSiteLabel(center) : center.element) === r.atom1)));
    if (!active.length) continue;
    const ranges = axes.map((k, i) => [Math.ceil(center.fractional[k] - bounds[i][1] - fractionalReach[i] - 1e-8), Math.floor(center.fractional[k] - bounds[i][0] + fractionalReach[i] + 1e-8)]);
    const tiles = ranges.reduce((n, [lo, hi]) => n * (hi - lo + 1), 1);
    assertRenderBudget(queries + tiles, 200_000, budgetMessage);
    for (let x = ranges[0][0]; x <= ranges[0][1]; x++) for (let y = ranges[1][0]; y <= ranges[1][1]; y++) for (let z = ranges[2][0]; z <= ranges[2][1]; z++) {
      queries++;
      const offset = fractionalToCartesian({ x, y, z }, matrix);
      const probe = { x: center.cartesian.x - offset.x, y: center.cartesian.y - offset.y, z: center.cartesian.z - offset.z };
      for (const source of index.query(probe, radius)) {
        assertRenderBudget(++comparisons, 2_000_000, budgetMessage);
        const candidate: Atom = { ...source, fractional: { x: source.fractional.x + x, y: source.fractional.y + y, z: source.fractional.z + z },
          cartesian: { x: source.cartesian.x + offset.x, y: source.cartesian.y + offset.y, z: source.cartesian.z + offset.z },
          originalId: source.id, imageOffset: [x, y, z], isBoundary: true };
        if (seen.has(key(candidate))) continue;
        const d = dist(center.cartesian, candidate.cartesian);
        if (!active.some(r => {
          assertRenderBudget(++ruleChecks, 4_000_000, budgetMessage);
          return ruleMatchesDistance(r, d) && (ruleMatchesDirection(r, center, candidate) || (r.boundaryMode === 3 && ruleMatchesDirection(r, candidate, center)));
        })) continue;
        assertRenderBudget(result.length + 1, MAX_DISPLAYED_ATOMS, budgetMessage);
        if (!Number.isSafeInteger(nextId)) throw new Error('原子 ID 过大，无法生成周期原子编号。');
        candidate.id = nextId++;
        seen.add(key(candidate)); result.push(candidate);
      }
    }
  }
  return result;
}
