import type { ProjectState } from './project';
import { freezePayload, isImmutablePayload } from './projectSnapshot';

export const MAX_HISTORY_BYTES = 64 * 1024 * 1024;
interface SharedRecord { json: string; bytes: number; active: boolean }
interface Snapshot { json: string; volume?: SharedRecord; source?: SharedRecord }

/** Immutable volume/source records are shared between small independent edit snapshots.
 * The budget includes current, undo, redo and each unique shared payload exactly once.
 */
export class ProjectHistory {
  past: Snapshot[] = []; future: Snapshot[] = []; current: Snapshot | null = null;
  wasTrimmed = false;
  private byObject = new WeakMap<object, SharedRecord>();
  private records = new Map<string, SharedRecord>();
  constructor(private budget = MAX_HISTORY_BYTES) {}
  private share(value: object | undefined): SharedRecord | undefined {
    if (!value) return undefined;
    const cached = this.byObject.get(value);
    if (cached?.active && isImmutablePayload(value)) return cached;
    const json = JSON.stringify(value);
    let record = this.records.get(json);
    if (!record) { record = { json, bytes: json.length * 2, active: true }; this.records.set(json, record); }
    this.byObject.set(value, record);
    return record;
  }
  private capture(state: ProjectState): Snapshot {
    return { json: JSON.stringify({ ...state, structure: { ...state.structure, volumeData: undefined, sourceCif: undefined } }),
      volume: this.share(state.structure.volumeData), source: this.share(state.structure.sourceCif) };
  }
  private live() { return [...this.past, ...(this.current ? [this.current] : []), ...this.future]; }
  get retainedBytes() {
    const snapshots = this.live(), records = new Set(snapshots.flatMap(s => [s.volume, s.source]).filter((r): r is SharedRecord => !!r));
    return snapshots.reduce((sum, s) => sum + s.json.length * 2, 0) + [...records].reduce((sum, r) => sum + r.bytes, 0);
  }
  private prune() {
    while (this.past.length && (this.past.length + this.future.length > 30 || this.retainedBytes > this.budget)) { this.past.shift(); this.wasTrimmed = true; }
    while (this.future.length && (this.past.length + this.future.length > 30 || this.retainedBytes > this.budget)) { this.future.shift(); this.wasTrimmed = true; }
    const used = new Set(this.live().flatMap(s => [s.volume, s.source]));
    for (const [key, record] of this.records) if (!used.has(record)) { this.records.delete(key); record.active = false; record.json = ''; }
  }
  observe(state: ProjectState) {
    const next = this.capture(state);
    if (this.current && next.json === this.current.json && next.volume === this.current.volume && next.source === this.current.source) return;
    if (this.current) this.past.push(this.current);
    this.current = next; this.future = []; this.prune();
  }
  private restore(snapshot: Snapshot): ProjectState {
    const state = JSON.parse(snapshot.json) as ProjectState;
    for (const [key, record] of [['volumeData', snapshot.volume], ['sourceCif', snapshot.source]] as const) if (record) {
      const value = freezePayload(JSON.parse(record.json)); Object.assign(state.structure, { [key]: value }); this.byObject.set(value, record);
    }
    return state;
  }
  undo(): ProjectState | null {
    if (!this.past.length || !this.current) return null;
    this.future.push(this.current); this.current = this.past.pop()!; this.prune(); return this.restore(this.current);
  }
  redo(): ProjectState | null {
    if (!this.future.length || !this.current) return null;
    this.past.push(this.current); this.current = this.future.pop()!; this.prune(); return this.restore(this.current);
  }
}
