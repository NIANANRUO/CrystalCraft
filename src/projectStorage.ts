const DB_NAME = 'crystal-craft-projects';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recovery');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('浏览器存储被其他页面阻塞。'));
  });
}
export async function readRecovery(): Promise<string | null> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('recovery').objectStore('recovery').get('latest');
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function writeRecovery(text: string | null): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recovery', 'readwrite');
    const store = tx.objectStore('recovery');
    if (text === null) store.delete('latest'); else store.put(text, 'latest');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
