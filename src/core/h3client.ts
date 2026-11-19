import { getLandMask, loadLandMask } from './landmask';
import type { LonLat } from './geo';

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

// ------------------------------------------------------------------ sea routing


let routeWorker: Worker | null = null;
let routeSeq = 0;
const routePending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

async function getRouteWorker(): Promise<Worker> {
  if (routeWorker) return routeWorker;
  await loadLandMask();
  const m = getLandMask()!;
  routeWorker = new Worker(new URL('../workers/route.worker.ts', import.meta.url), { type: 'module' });
  routeWorker.onmessage = (ev) => {
    const { id, ok, error, ...rest } = ev.data;
    const p = routePending.get(id);
    if (!p) return;
    routePending.delete(id);
    ok ? p.resolve(rest) : p.reject(new Error(error));
  };
  routeWorker.postMessage({ type: 'init', mask: m.mask.slice(), w: m.w, h: m.h });
  return routeWorker;
}

/** Shortest-ish sea path between two points, avoiding land (canals & straits included). */
export async function seaRoute(from: LonLat, to: LonLat, opts: { polar?: boolean } = {}): Promise<LonLat[]> {
  const w = await getRouteWorker();
  const id = ++routeSeq;
  const r = await new Promise<{ path: LonLat[] }>((resolve, reject) => {
    routePending.set(id, { resolve, reject });
    w.postMessage({ type: 'route', id, from, to, polar: opts.polar });
  });
  return r.path;
}

/** Route through a sequence of waypoints, concatenating sea legs. */
export async function seaRouteVia(points: LonLat[], opts: { polar?: boolean } = {}): Promise<LonLat[]> {
  const out: LonLat[] = [];
  for (let i = 1; i < points.length; i++) {
    const leg = await seaRoute(points[i - 1], points[i], opts);
    if (out.length) {
      // continue longitudes from the previous leg
      const last = out[out.length - 1][0];
      let shift = 0;
      while (leg[0][0] + shift - last > 180) shift -= 360;
      while (leg[0][0] + shift - last < -180) shift += 360;
      out.push(...leg.slice(1).map((p) => [p[0] + shift, p[1]] as LonLat));
    } else out.push(...leg);
  }
  return out;
}
