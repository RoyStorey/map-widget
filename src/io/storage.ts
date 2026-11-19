/** IndexedDB persistence for scenarios (autosave + named saves). */
import type { Scenario } from '../core/scenario';

const DB = 'mapwidget';
const STORE = 'scenarios';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function saveScenario(key: string, s: Scenario): Promise<unknown> {
  return tx('readwrite', (st) => st.put({ savedAt: Date.now(), scenario: s }, key));
}

export async function loadScenario(key: string): Promise<{ savedAt: number; scenario: Scenario } | null> {
  try {
    return (await tx('readonly', (st) => st.get(key))) ?? null;
  } catch {
    return null;
  }
}

export async function listSaves(): Promise<{ key: string; savedAt: number; title: string }[]> {
  const db = await open();
  return new Promise((resolve) => {
    const out: { key: string; savedAt: number; title: string }[] = [];
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out.sort((a, b) => b.savedAt - a.savedAt));
      out.push({ key: String(c.key), savedAt: c.value.savedAt, title: c.value.scenario?.meta?.title ?? String(c.key) });
      c.continue();
    };
    req.onerror = () => resolve(out);
  });
}

export function deleteSave(key: string): Promise<unknown> {
  return tx('readwrite', (st) => st.delete(key));
}

// ------------------------------------------------------------------ compressed share strings

export async function compress(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decompress(b64: string): Promise<string> {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const buf = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}
