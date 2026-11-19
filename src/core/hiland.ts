/**
 * High-resolution (1:10m Natural Earth) land, loaded lazily (~3 MB). Used for
 * crisp offline coastlines when zoomed in, and for precise land tests in
 * zoomed-in battle scenarios where the global 9 km land mask is too coarse.
 */
import { feature, mesh } from 'topojson-client';
import { clampPolar, readChannel, stripCuts } from './world';

export interface HiLand {
  land: GeoJSON.FeatureCollection;
  coast: GeoJSON.Feature;
}

let promise: Promise<HiLand> | null = null;

export function loadHiLand(): Promise<HiLand> {
  promise ??= import('world-atlas/land-10m.json').then((m) => {
    const topo: any = m.default;
    const raw: any = feature(topo, topo.objects.land);
    const features: GeoJSON.Feature[] = raw.type === 'FeatureCollection' ? raw.features : [raw];
    const coast = stripCuts(mesh(topo, topo.objects.land, (a: any, b: any) => a === b) as any);
    clampPolar(features);
    const land: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    return { land, coast: { type: 'Feature', properties: {}, geometry: coast } };
  });
  return promise;
}

/**
 * Rasterise hi-res land inside a bbox and return a fast point test.
 * ~100 m precision for a 2° box; drawing clips huge polygons for free.
 */
export async function localLandTest(bbox: [number, number, number, number], maxPx = 3072): Promise<(lon: number, lat: number) => boolean> {
  const { land } = await loadHiLand();
  const [w0, s0, e0, n0] = bbox;
  const midLat = ((s0 + n0) / 2) * (Math.PI / 180);
  const aspect = ((e0 - w0) * Math.cos(midLat)) / (n0 - s0);
  const W = aspect >= 1 ? maxPx : Math.max(64, Math.round(maxPx * aspect));
  const H = aspect >= 1 ? Math.max(64, Math.round(maxPx / aspect)) : maxPx;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const px = (lon: number) => ((lon - w0) / (e0 - w0)) * W;
  const py = (lat: number) => ((n0 - lat) / (n0 - s0)) * H;
  ctx.fillStyle = '#fff';
  for (const f of land.features) {
    const g: any = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      // cheap reject using the outer ring's bbox
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of poly[0]) {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
      }
      if (maxX < w0 || minX > e0 || maxY < s0 || minY > n0) continue;
      ctx.beginPath();
      for (const ring of poly) ring.forEach((c: number[], i: number) => (i ? ctx.lineTo(px(c[0]), py(c[1])) : ctx.moveTo(px(c[0]), py(c[1]))));
      ctx.fill('evenodd');
    }
  }
  const alpha = readChannel(canvas, 3);
  return (lon: number, lat: number) => {
    const x = Math.floor(px(lon)), y = Math.floor(py(lat));
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return alpha[y * W + x] > 127;
  };
}
