import test from 'node:test';
import assert from 'node:assert/strict';
import type { Atom, BondRule, CrystalStructure, VisualSettings } from '../src/types/crystal';
import { assertBondSettings, atomSiteLabel, defaultBondRules, expandBondRuleAtoms, hasAutomaticBond, matchesBondRule } from '../src/utils/bonding';
import { calculateLatticeFromMatrix as createLattice, fractionalToCartesian } from '../src/utils/math';

const atom = (id: number, element: string, x: number): Atom => ({ id, element, cartesian: { x, y: 0, z: 0 }, fractional: { x: x / 10, y: 0, z: 0 } });
const rule = (patch: Partial<BondRule> = {}): BondRule => ({ id: 'test', atom1: 'C', atom2: 'N', searchMode: 'pair', boundaryMode: 2, searchByLabel: false, minLength: 0, maxLength: 1.6, showPolyhedra: true, ...patch });
const settings = (rules: BondRule[]): VisualSettings => ({ bondTolerance: 1.15, showBoundaryAtoms: true, bondSettings: { enabled: true, rules } } as VisualSettings);

test('rules match unordered element pairs, inclusive distance intervals, labels and wildcard modes', () => {
  const c = atom(1, 'C', 0), n = atom(2, 'N', 1.4), o = atom(3, 'O', 1.4);
  assert.ok(matchesBondRule(rule(), c, n)); assert.ok(matchesBondRule(rule(), n, c));
  assert.equal(matchesBondRule(rule(), c, o), false);
  assert.equal(matchesBondRule(rule({ minLength: 1.5 }), c, n), false);
  assert.ok(matchesBondRule(rule({ minLength: 1.4, maxLength: 1.4 }), c, n));
  assert.ok(matchesBondRule(rule({ searchMode: 'all' }), c, o));
  assert.equal(matchesBondRule(rule({ searchMode: 'all' }), n, o), false);
  assert.ok(matchesBondRule(rule({ searchMode: 'molecule' }), n, o, 1));
  c.name = 'site-C'; n.name = 'site-N';
  assert.ok(matchesBondRule(rule({ searchByLabel: true, atom1: 'site-C', atom2: 'site-N' }), n, c));
  assert.equal(matchesBondRule(rule({ searchByLabel: true }), n, c), false);
  assert.equal(atomSiteLabel({ ...c, name: undefined, originalId: 12, id: 300 }), 'C12');
  assert.ok(hasAutomaticBond(c, n, settings([rule({ maxLength: 1 }), rule()])));
  assert.equal(hasAutomaticBond(c, n, settings([])), false);
  assert.ok(hasAutomaticBond(c, n, { ...settings([]), bondSettings: undefined }));
  assert.ok(matchesBondRule(rule(), c, n, .2)); // Explicit rule supports close split sites.
  assert.equal(matchesBondRule(rule(), c, n, 0), false);
});

test('Boundary 1/2/3 differ in direction, finite recursive completion and ghost bonds', () => {
  const structure: CrystalStructure = { title: 'split CN', atoms: [atom(1, 'C', 9.5), atom(2, 'N', .5)], isPeriodic: true,
    lattice: createLattice([{ x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 10 }]) };
  for (const [mode, count] of [[1, 2], [2, 3], [3, 4]] as const) {
    const r = rule({ boundaryMode: mode, maxLength: 1.1 });
    const result = expandBondRuleAtoms(structure, settings([r]));
    assert.equal(result.length, count);
    assert.equal(new Set(result.map(a => a.id)).size, count);
    for (const a of result.filter(a => a.isBoundary)) { assert.ok(a.originalId); assert.ok(a.imageOffset); }
  }
  const outsideC = { ...atom(3, 'C', -.5), isBoundary: true };
  assert.equal(matchesBondRule(rule(), outsideC, structure.atoms[1]), false);
  assert.ok(matchesBondRule(rule({ boundaryMode: 3 }), outsideC, structure.atoms[1]));
  assert.equal(expandBondRuleAtoms(structure, { ...settings([rule()]), showBoundaryAtoms: false }).length, 2);
  assert.deepEqual(structure.atoms.map(a => a.isBoundary), [undefined, undefined]);
});

test('triclinic periodic searches include images outside the former 0.08 boundary margin', () => {
  const lattice = createLattice([{ x: 10, y: 0, z: 0 }, { x: 4, y: 8, z: 0 }, { x: 0, y: 0, z: 30 }]);
  const atoms = [atom(1, 'C', 8), atom(2, 'N', 1)];
  atoms.forEach(a => { a.fractional.y = .4; a.fractional.z = .5; a.cartesian = fractionalToCartesian(a.fractional, lattice.matrix); });
  const structure = { title: 'skew', atoms, lattice, isPeriodic: true };
  const result = expandBondRuleAtoms(structure, settings([rule({ maxLength: 3.1 })]));
  assert.ok(result.some(a => a.element === 'N' && Math.abs(a.fractional.x - 1.1) < 1e-8));
});

test('infinite periodic networks reject the view with a recoverable budget error', () => {
  const structure: CrystalStructure = { title: 'infinite chain', atoms: [atom(1, 'C', 0)], isPeriodic: true,
    lattice: createLattice([{ x: 1, y: 0, z: 0 }, { x: 0, y: 20, z: 0 }, { x: 0, y: 0, z: 20 }]) };
  assert.throws(() => expandBondRuleAtoms(structure, settings([rule({ atom2: 'C', boundaryMode: 3, maxLength: 1.1 })])), /周期网络|预算/);
  assert.equal(expandBondRuleAtoms(structure, settings([rule({ atom2: 'C', boundaryMode: 1, maxLength: 1.1 })])).length, 1);
});

test('bond settings validate every nested field and seed defaults from existing radii', () => {
  const valid = { enabled: true, rules: [rule()] };
  assert.doesNotThrow(() => assertBondSettings(valid));
  for (const patch of [{ maxLength: NaN }, { minLength: -1 }, { maxLength: 0 }, { maxLength: 101 }, { minLength: 2 },
    { boundaryMode: 0 }, { searchMode: 'unknown' }, { searchByLabel: 'true' }, { atom1: '' }, { showPolyhedra: null }]) {
    assert.throws(() => assertBondSettings({ enabled: true, rules: [{ ...rule(), ...patch }] }));
  }
  assert.throws(() => assertBondSettings({ enabled: true, rules: [rule(), rule()] }));
  const rules = defaultBondRules({ title: 'seed', isPeriodic: false, atoms: [atom(1, 'O', 0), atom(2, 'Ti', 2)] }, 1.15);
  assert.equal(rules.length, 3); assert.ok(rules.some(r => r.atom1 === 'Ti' && r.atom2 === 'O' && r.showPolyhedra));
});
