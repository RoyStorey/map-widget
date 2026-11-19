/**
 * Map every H3 cell at a resolution to the Natural Earth country containing
 * its centre, via a colour-coded raster of country polygons (fast and exact
 * enough; far quicker than polygon fills of huge, detailed outlines).
 */
import { cellToBoundary, cellToChildren, cellToLatLng, getRes0Cells } from 'h3-js';
import { loadWorld } from './world';

const cache = new Map<number, Promise<Map<string, string[]>>>();
const W = 4320, H = 2160;
const check = (i: number) => ((i * 97) % 251) + 3; // blue channel checksum rejects anti-aliased edge blends

export function countryCells(res: number): Promise<Map<string, string[]>> {
  let p = cache.get(res);
  if (!p) {
    p = build(res);
    cache.set(res, p);
  }
  return p;
}

async function build(res: number): Promise<Map<string, string[]>> {
  const world = await loadWorld();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  world.list.forEach((c, i) => {
    const idx = i + 1;
    ctx.fillStyle = `rgb(${idx & 255},${idx >> 8},${check(idx)})`;
    const g: any = c.feature.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const shift of [0, -360, 360]) {
      for (const poly of polys) {
        ctx.beginPath();
        for (const ring of poly) ring.forEach((p: number[], k: number) => (k ? ctx.lineTo(px(p[0] + shift), py(p[1])) : ctx.moveTo(px(p[0] + shift), py(p[1]))));
        ctx.fill('evenodd');
      }
    }
  });
  const data = ctx.getImageData(0, 0, W, H).data;
  const out = new Map<string, string[]>();
  const at = (x: number, y: number) => {
    x = ((x % W) + W) % W;
    if (y < 0 || y >= H) return -1;
    const o = (y * W + x) * 4;
    if (data[o + 3] < 250) return -1;
    const idx = data[o] + (data[o + 1] << 8);
    return idx > 0 && idx <= world.list.length && data[o + 2] === check(idx) ? idx - 1 : -1;
  };
  // centre pixel first; on anti-aliased border pixels fall back to the nearest clean neighbour
  const OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  const lookup = (lon: number, lat: number) => {
    const x = Math.floor(px(((lon + 540) % 360) - 180)), y = Math.floor(py(lat));
    for (const [dx, dy] of OFFSETS) {
      const i = at(x + dx, y + dy);
      if (i >= 0) return i;
    }
    return -1;
  };
  for (const base of getRes0Cells()) {
    for (const cell of cellToChildren(base, res)) {
      const [lat, lon] = cellToLatLng(cell);
      let i = lookup(lon, lat);
      if (i < 0 && res <= 6) {
        // coastal cell whose centre is at sea: take the country under most of its vertices,
        // so territory reaches the coast (the basemap's water then crops the overflow)
        const votes = new Map<number, number>();
        for (const [la, lo] of cellToBoundary(cell)) {
          const v = lookup(lo, la);
          if (v >= 0) votes.set(v, (votes.get(v) ?? 0) + 1);
        }
        let best = -1, bestN = 0;
        for (const [v, n] of votes) if (n > bestN) { best = v; bestN = n; }
        i = best;
      }
      if (i < 0) continue;
      const id = world.list[i].id;
      let arr = out.get(id);
      if (!arr) out.set(id, (arr = []));
      arr.push(cell);
    }
  }
  return out;
}
