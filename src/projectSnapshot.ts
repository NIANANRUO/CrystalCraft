import type { CrystalStructure } from './types/crystal';

const immutablePayloads = new WeakSet<object>();
/** Imported scientific payloads are immutable; edits replace them as whole objects. */
export function freezePayload<T extends object>(value: T): T {
  if (immutablePayloads.has(value)) return value;
  // Number arrays contain no mutable children, avoiding a million recursive calls.
  if (!(Array.isArray(value) && (value.length === 0 || typeof value[0] === 'number'))) {
    for (const child of Object.values(value)) if (child && typeof child === 'object') freezePayload(child);
  }
  Object.freeze(value); immutablePayloads.add(value); return value;
}
export const isImmutablePayload = (value: object) => immutablePayloads.has(value);
export function freezeStructurePayloads(structure: CrystalStructure) {
  if (structure.volumeData) freezePayload(structure.volumeData);
  if (structure.sourceCif) freezePayload(structure.sourceCif);
  return structure;
}
export function cloneEditableStructure(structure: CrystalStructure): CrystalStructure {
  const frozen = freezeStructurePayloads(structure);
  const { volumeData, sourceCif, ...editable } = frozen;
  return { ...structuredClone(editable), ...(volumeData ? { volumeData } : {}), ...(sourceCif ? { sourceCif } : {}) };
}
