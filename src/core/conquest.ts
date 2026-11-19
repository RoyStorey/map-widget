import { cellToBoundary, cellToLatLng, polygonToCells, gridDisk, latLngToCell } from 'h3-js';
import { haversineKm, rng, type LonLat } from './geo';
import type { CellEvent } from './scenario';

/** Smooth pseudo-noise in [-1, 1] from a few random sinusoids. */
export function makeNoise(seed: number) {
  const r = rng(seed);
  const waves = Array.from({ length: 5 }, () => ({ fx: 0.05 + r() * 0.25, fy: 0.05 + r() * 0.25, p: r() * Math.PI * 2, a: 0.4 + r() * 0.6 }));
  const norm = waves.reduce((s, w) => s + w.a, 0);
  return (lon: number, lat: number) => waves.reduce((s, w) => s + w.a * Math.sin(lon * w.fx + lat * w.fy + w.p), 0) / norm;
}

export interface WaveOptions {
  /** Organic irregularity of the front, 0..1 (fraction of duration). */
  jitter?: number;
  seed?: number;
  /** Restrict to these cells (e.g. land cells). */
  mask?: Set<string>;
  /** Only convert cells currently owned by one of these factions (null = unclaimed). */
  easing?: 'linear' | 'ease-in' | 'ease-out';
}

/**
 * Turn a set of cells into a spreading conquest: each cell flips to `faction`
 * at a time proportional to its distance from `origin`, with smooth noise so
 * the front looks organic rather than a perfect circle.
 */
export function waveEvents(cells: Iterable<string>, origin: LonLat, start: number, end: number, faction: string | null, opts: WaveOptions = {}): CellEvent[] {
  const list: { cell: string; d: number; lon: number; lat: number }[] = [];
  let maxD = 0;
  for (const cell of cells) {
    if (opts.mask && !opts.mask.has(cell)) continue;
    const [lat, lon] = cellToLatLng(cell);
    const d = haversineKm(origin, [lon, lat]);
    if (d > maxD) maxD = d;
    list.push({ cell, d, lon, lat });
  }
  const jitter = opts.jitter ?? 0.15;
  const noise = makeNoise(opts.seed ?? 1);
  const dur = end - start;
  return list.map(({ cell, d, lon, lat }) => {
    let f = maxD > 0 ? d / maxD : 0;
    if (opts.easing === 'ease-in') f = f * f;
    else if (opts.easing === 'ease-out') f = Math.sqrt(f);
    f = Math.max(0, Math.min(1, f * (1 - jitter) + (noise(lon, lat) * 0.5 + 0.5) * jitter));
    return { cell, t: start + dur * f, faction };
  });
}

/** Cells covering a polygon (rings of [lon, lat]). */
export function polygonCells(rings: LonLat[][], res: number): string[] {
  const closed = rings.map((r) => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r));
  return polygonToCells(closed as number[][][], res, true);
}

/** Cells within k rings of a point. */
export function brushCells(p: LonLat, res: number, k: number): string[] {
  return gridDisk(latLngToCell(p[1], p[0], res), k);
}

/**
 * True if any part of the cell (centre or a vertex) is on land. Coastal cells
 * are kept so territory reaches the coastline; the basemap's water layer then
 * crops whatever spills into the sea.
 */
export function cellTouchesLand(cell: string, onLand: (lon: number, lat: number) => boolean): boolean {
  const [lat, lon] = cellToLatLng(cell);
  if (onLand(lon, lat)) return true;
  for (const [la, lo] of cellToBoundary(cell)) if (onLand(lo, la)) return true;
  return false;
}
