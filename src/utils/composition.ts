import type { Atom } from '../types/crystal';

/** Weighted contents of the cell, not an assumed reduced molecular formula. */
export function cellComposition(atoms: readonly Atom[]): string {
  const counts = new Map<string, number>();
  for (const atom of atoms) counts.set(atom.element, (counts.get(atom.element) ?? 0) + (atom.occupancy ?? 1));
  return [...counts].filter(([, count]) => count > 1e-8).map(([element, count]) => {
    const rounded = Math.round(count * 1e6) / 1e6;
    return `${element}${rounded === 1 ? '' : rounded}`;
  }).join('');
}
