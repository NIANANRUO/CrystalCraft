import { MAX_PROJECT_BYTES } from './project';

const DB_NAME = 'crystal-craft-projects';
export const MAX_RECOVERY_RECORDS = 12;
export interface RecoveryEntry { id: string; title: string; updatedAt: number }
export interface RecoveryWorkspace { id: string; previousId?: string }
let workspace: RecoveryWorkspace | undefined;
/** Each document writes a unique slot. Reload and duplicated tabs can read an old
 * snapshot, but can never write into each other's recovery record. */
export function recoveryWorkspace(): RecoveryWorkspace {
  if (workspace) return workspace;
  let previousId: string | undefined;
  try { const stored = sessionStorage.getItem('crystal-craft-recovery'); if (stored && /^[a-zA-Z0-9-]{1,80}$/.test(stored)) previousId = stored; } catch { /* Recovery list still works without sessionStorage. */ }
  workspace = { id: crypto.randomUUID(), previousId };
  // A live page owns its slot. Cleanup may deduplicate a closed predecessor,
  // but must never remove a snapshot still owned by another open/duplicated tab.
  if (navigator.locks) void navigator.locks.request(`crystal-recovery:${workspace.id}`, () => new Promise<void>(() => {})).catch(() => {});
  return workspace;
}
function key(id?: string) { if (id !== undefined && id !== 'legacy' && !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('恢复记录编号无效。'); return !id || id === 'legacy' ? 'latest' : `workspace:${id}`; }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, 2);
    const timer = setTimeout(() => fail(new Error('本机存储响应超时，请保存项目文件。')), 5000);
    function fail(error: unknown) { if (!settled) { settled = true; clearTimeout(timer); reject(error); } }
    request.onupgradeneeded = () => {
      for (const name of ['recovery', 'recoveryMeta']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => { if (settled) { request.result.close(); return; } settled = true; clearTimeout(timer); resolve(request.result); };
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error('浏览器存储被其他页面阻塞。'));
  });
}
export async function readRecovery(id?: string): Promise<string | null> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('recovery'), request = tx.objectStore('recovery').get(key(id));
    let value: string | null = null;
    request.onsuccess = () => { value = typeof request.result === 'string' ? request.result : null; };
    tx.oncomplete = () => resolve(value); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('读取恢复记录已中止。'));
  }); } finally { db.close(); }
}
export async function listRecovery(): Promise<RecoveryEntry[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('recoveryMeta'), request = tx.objectStore('recoveryMeta').getAll();
    tx.oncomplete = () => resolve((request.result as RecoveryEntry[]).filter(v => v && typeof v.id === 'string' && typeof v.title === 'string' && Number.isFinite(v.updatedAt)).sort((a,b) => b.updatedAt-a.updatedAt));
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('读取恢复列表已中止。'));
  }); } finally { db.close(); }
}
export async function writeRecovery(text: string | null, id = recoveryWorkspace().id, title = '未命名项目', previousId?: string): Promise<string | undefined> {
  key(id); if (previousId) key(previousId);
  if (text !== null && previousId && previousId !== 'legacy' && previousId !== id && navigator.locks) {
    return navigator.locks.request(`crystal-recovery:${previousId}`, { ifAvailable: true }, lock => commitRecovery(text,id,title,lock ? previousId : undefined));
  }
  return commitRecovery(text,id,title);
}
async function commitRecovery(text: string | null, id: string, title: string, previousId?: string): Promise<string | undefined> {
  if (text !== null && new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('恢复记录超过 24 MiB，请保存项目文件。');
  const db = await database();
  let replacedId: string | undefined;
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['recovery','recoveryMeta'], 'readwrite');
    let reason: Error | undefined;
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(reason ?? tx.error); tx.onabort = () => reject(reason ?? tx.error ?? new Error('自动保存事务已中止。'));
    const store = tx.objectStore('recovery'), meta = tx.objectStore('recoveryMeta');
    if (text === null) { store.delete(key(id)); meta.delete(id); return; }
    const write = () => { const keys = meta.getAllKeys(); keys.onsuccess = () => {
      if (!keys.result.includes(id) && keys.result.length >= MAX_RECOVERY_RECORDS) { reason = new Error('本机恢复记录已满，请在恢复列表中清除不需要的旧记录，或下载项目文件。'); tx.abort(); return; }
      try { store.put(text, key(id)); meta.put({ id, title: title.slice(0, 10000), updatedAt: Date.now() } satisfies RecoveryEntry, id); }
      catch (error) { reason = error instanceof Error ? error : new Error('自动保存失败。'); tx.abort(); }
    }; };
    if (previousId && previousId !== id) {
      const previous = store.get(key(previousId));
      previous.onsuccess = () => {
        // A reload may fork an identical snapshot. Deduplicate it only after exact
        // content comparison; differing old work is never evicted automatically.
        const withoutDate = (value: string) => value.replace(/("savedAt"\s*:\s*)"(?:\\.|[^"\\])*"/, '$1""');
        if (typeof previous.result === 'string' && withoutDate(previous.result) === withoutDate(text)) {
          store.delete(key(previousId)); meta.delete(previousId); replacedId = previousId;
        }
        write();
      };
    } else write();
  });
  if (text !== null && id === recoveryWorkspace().id) { try { sessionStorage.setItem('crystal-craft-recovery', id); } catch { /* Listed records remain recoverable. */ } }
  return replacedId;
  } finally { db.close(); }
}
