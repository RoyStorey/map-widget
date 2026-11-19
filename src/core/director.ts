/**
 * Auto-director: generate camera keyframes that follow the action — either
 * where territory is changing hands, or the scenario's events — so playback
 * automatically zooms into each front as it happens.
 */
import { cellToLatLng } from 'h3-js';
import type { MapWidget } from '../widget/MapWidget';
import type { CameraKey } from './scenario';

export interface DirectorOptions {
  mode: 'conquests' | 'events' | 'both';
  /** Number of time windows for conquest tracking. */
  windows?: number;
  minZoom?: number;
  maxZoom?: number;
  pitch?: number;
  /** Insert a wide establishing shot at the start and end. */
  bookends?: boolean;
}

export function autoDirect(w: MapWidget, opts: DirectorOptions): CameraKey[] {
  const { start, end } = w.scenario.meta;
  const span = end - start;
  const minZoom = opts.minZoom ?? 2;
  const maxZoom = opts.maxZoom ?? 6;
  const pitch = opts.pitch ?? 25;
  const keys: CameraKey[] = [];
  const fit = (b: [number, number, number, number]) => {
    const pad = 0.15;
    const dx = Math.max(0.5, b[2] - b[0]), dy = Math.max(0.5, b[3] - b[1]);
    const cam = w.map.cameraForBounds([[b[0] - dx * pad, b[1] - dy * pad], [b[2] + dx * pad, b[3] + dy * pad]], { padding: 40 });
    if (!cam) return null;
    const c = cam.center as any;
    const center: [number, number] = Array.isArray(c) ? [c[0], c[1]] : [c.lng, c.lat];
    return { center, zoom: Math.max(minZoom, Math.min(maxZoom, (cam.zoom ?? 3) - 0.2)) };
  };

  if (opts.mode !== 'events') {
    const n = opts.windows ?? 30;
    const cells = [...w.scenario.cells].sort((a, b) => a.t - b.t);
    const buckets: { t0: number; t1: number; pts: [number, number][] }[] = Array.from({ length: n }, (_, i) => ({ t0: start + (span * i) / n, t1: start + (span * (i + 1)) / n, pts: [] }));
    for (const e of cells) {
      if (e.t <= start + span * 1e-6) continue; // initial state isn't "action"
      const bi = Math.min(n - 1, Math.max(0, Math.floor(((e.t - start) / span) * n)));
      const [lat, lon] = cellToLatLng(e.cell);
      buckets[bi].pts.push([lon, lat]);
    }
    for (const b of buckets) {
      if (b.pts.length < 5) continue;
      // trim outliers: use 10th–90th percentile extents so one stray cell doesn't zoom us out
      const xs = b.pts.map((p) => p[0]).sort((a, c) => a - c), ys = b.pts.map((p) => p[1]).sort((a, c) => a - c);
      const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * f))];
      const box: [number, number, number, number] = [q(xs, 0.1), q(ys, 0.1), q(xs, 0.9), q(ys, 0.9)];
      const cam = fit(box);
      if (cam) keys.push({ t: (b.t0 + b.t1) / 2, ...cam, bearing: 0, pitch });
    }
  }
  if (opts.mode !== 'conquests') {
    const evs = [...w.scenario.events].sort((a, b) => a.t - b.t);
    for (const e of evs) keys.push({ t: e.t, center: e.position, zoom: Math.min(maxZoom, e.zoom ?? 5), bearing: 0, pitch: pitch + 10 });
  }
  keys.sort((a, b) => a.t - b.t);
  // merge keys that are too close in time (keep the later, more specific one)
  const merged: CameraKey[] = [];
  for (const k of keys) {
    const last = merged[merged.length - 1];
    if (last && k.t - last.t < span / 120) merged[merged.length - 1] = k;
    else merged.push(k);
  }
  if (opts.bookends !== false && merged.length) {
    const overview = fit(boundsOf(merged.map((k) => k.center)));
    if (overview) {
      merged.unshift({ t: start, ...overview, zoom: Math.max(minZoom, overview.zoom - 0.3), bearing: 0, pitch: 0 });
      merged.push({ t: end, ...overview, zoom: Math.max(minZoom, overview.zoom - 0.3), bearing: 0, pitch: 0 });
    }
  }
  return merged;
}

function boundsOf(pts: [number, number][]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of pts) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }
  return [a, b, c, d];
}
