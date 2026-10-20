// Budgets apply to derived geometry as well as imported atom counts. They do not
// truncate scientific data: a rejected view stays empty until settings recover.
export const MAX_DISPLAYED_ATOMS = 6000;
export const MAX_BOND_SEGMENTS = 24000;
export const MAX_WEAK_INTERACTIONS = 12000;
export const MAX_POLYHEDRON_LIGANDS = 512;
export const MAX_POLYHEDRA_POINTS = 65536;

export function assertRenderBudget(count: number, limit: number, message: string): void {
  if (!Number.isSafeInteger(count) || count < 0 || count > limit) throw new Error(message);
}
