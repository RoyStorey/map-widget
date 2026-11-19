/** Promise wrapper around the H3 worker. */
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/h3.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const { id, ok, error, ...rest } = ev.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      ok ? p.resolve(rest) : p.reject(new Error(error));
    };
  }
  return worker;
}

/** Fill polygons (GeoJSON Polygon coordinate arrays) with H3 cells off the main thread. */
export function polyfillAsync(polygons: number[][][][], res: number): Promise<string[]> {
  const id = ++seq;
  return new Promise<{ cells: string[] }>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'polyfill', id, res, polygons });
  }).then((r) => r.cells);
}
