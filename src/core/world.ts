/**
 * Bundled Natural Earth data (via world-atlas) – loaded lazily so the first
 * paint is not blocked. Works fully offline.
 */
import { feature, mesh } from 'topojson-client';
import { ringAreaKm2, type LonLat } from './geo';

export interface CountryInfo {
  id: string;
  name: string;
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  labelPoint: LonLat;
  bbox: [number, number, number, number];
  area: number;
  /** Spherical area in km². */
  areaKm2: number;
}

export interface WorldData {
  countries: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  land: GeoJSON.FeatureCollection;
  borders: GeoJSON.Feature; // internal boundaries as MultiLineString
  coastline: GeoJSON.Feature;
  list: CountryInfo[];
  byId: Map<string, CountryInfo>;
}

let promise: Promise<WorldData> | null = null;

export function loadWorld(detail: '50m' | '110m' = '50m'): Promise<WorldData> {
  if (promise) return promise;
  promise = (async () => {
    const topo: any = detail === '50m'
      ? (await import('world-atlas/countries-50m.json')).default
      : (await import('world-atlas/countries-110m.json')).default;
    const countries = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    const landRaw = feature(topo, topo.objects.land) as any;
    const landFeatures: GeoJSON.Feature[] = landRaw.type === 'FeatureCollection' ? landRaw.features : [landRaw];
    const borders = mesh(topo, topo.objects.countries, (a: any, b: any) => a !== b) as unknown as GeoJSON.MultiLineString;
    const coast = mesh(topo, topo.objects.countries, (a: any, b: any) => a === b) as unknown as GeoJSON.MultiLineString;
    // clamp pole-closing vertices (Antarctica) so Web Mercator tiling doesn't produce artefacts
    clampPolar(countries.features);
    clampPolar(landFeatures);
    const list: CountryInfo[] = [];
    countries.features.forEach((f, i) => {
      const id = String(f.id ?? `c${i}`);
      f.id = id;
      const name = (f.properties as any)?.name ?? id;
      f.properties = { ...(f.properties ?? {}), id, name };
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      let best: number[][] | null = null;
      let bestA = -1;
      let total = 0;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const poly of polys) {
        const ring = poly[0];
        const a = Math.abs(planarArea(ring));
        total += a;
        if (a > bestA) { bestA = a; best = ring; }
        for (const p of ring) {
          if (p[0] < minX) minX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] > maxY) maxY = p[1];
        }
      }
      const labelPoint = best ? polylabelish(best) : ([0, 0] as LonLat);
      let areaKm2 = 0;
      for (const poly of polys) {
        areaKm2 += ringAreaKm2(poly[0] as LonLat[]);
        for (const hole of poly.slice(1)) areaKm2 -= ringAreaKm2(hole as LonLat[]);
      }
      list.push({ id, name, feature: f, labelPoint, bbox: [minX, minY, maxX, maxY], area: total, areaKm2: Math.max(0, areaKm2) });
    });
    return {
      countries,
      land: { type: 'FeatureCollection', features: landFeatures },
      borders: { type: 'Feature', properties: {}, geometry: stripCuts(borders) },
      coastline: { type: 'Feature', properties: {}, geometry: stripCuts(coast) },
      list,
      byId: new Map(list.map((c) => [c.id, c])),
    };
  })();
  return promise;
}

/**
 * Make rings continuous across the antimeridian (longitudes may exceed ±180,
 * which tilers handle by wrapping), close pole-enclosing rings via the pole
 * latitude, and clamp to Web Mercator limits.
 */
export function clampPolar(features: GeoJSON.Feature[]): void {
  for (const f of features) {
    const g: any = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      for (let r = 0; r < poly.length; r++) {
        const ring: number[][] = poly[r];
        let crossed = false;
        for (let i = 1; i < ring.length; i++) {
          let lon = ring[i][0];
          const prev = ring[i - 1][0];
          while (lon - prev > 180) { lon -= 360; crossed = true; }
          while (lon - prev < -180) { lon += 360; crossed = true; }
          ring[i] = [lon, ring[i][1]];
        }
        for (const c of ring) c[1] = Math.max(-85, Math.min(85, c[1]));
        if (!crossed) continue;
        const first = ring[0], last = ring[ring.length - 1];
        if (Math.abs(last[0] - first[0]) > 180) {
          // ring winds around a pole: close it along the pole latitude
          const meanLat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;
          const pole = meanLat < 0 ? -85 : 85;
          ring.push([last[0], pole], [first[0], pole], [first[0], first[1]]);
        } else {
          // shift so most of the ring lies within [-180, 180]
          const mean = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
          if (mean > 180) for (const c of ring) c[0] -= 360;
          else if (mean < -180) for (const c of ring) c[0] += 360;
        }
      }
    }
  }
}

/** Remove artificial edges along the antimeridian / south pole introduced by the dataset's cuts. */
export function stripCuts(g: GeoJSON.MultiLineString): GeoJSON.MultiLineString {
  const out: number[][][] = [];
  const isCut = (a: number[], b: number[]) =>
    (Math.abs(a[0]) > 179.9 && Math.abs(b[0]) > 179.9 && Math.sign(a[0]) === Math.sign(b[0])) ||
    (a[1] < -84.5 && b[1] < -84.5) ||
    Math.abs(a[0] - b[0]) > 180;
  for (const line of g.coordinates) {
    let cur: number[][] = [line[0]];
    for (let i = 1; i < line.length; i++) {
      if (isCut(line[i - 1], line[i])) {
        if (cur.length > 1) out.push(cur);
        cur = [line[i]];
      } else cur.push(line[i]);
    }
    if (cur.length > 1) out.push(cur);
  }
  return { type: 'MultiLineString', coordinates: out };
}

function planarArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return a / 2;
}

/** Cheap "visual centre": centroid, nudged to the interior via a coarse grid search if needed. */
function polylabelish(ring: number[][]): LonLat {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
    a += f * 3;
  }
  const c: LonLat = a !== 0 ? [cx / a, cy / a] : [ring[0][0], ring[0][1]];
  if (inside(c, ring)) return c;
  // grid search for the interior point farthest from the edge
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }
  let best = c, bestD = -1;
  const N = 12;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const p: LonLat = [minX + ((maxX - minX) * i) / N, minY + ((maxY - minY) * j) / N];
      if (!inside(p, ring)) continue;
      const d = edgeDist(p, ring);
      if (d > bestD) { bestD = d; best = p; }
    }
  return best;
}

function inside(p: LonLat, ring: number[][]): boolean {
  let r = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

function edgeDist(p: LonLat, ring: number[][]): number {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
    const dx = bx - ax, dy = by - ay;
    const l = dx * dx + dy * dy;
    let t = l ? ((p[0] - ax) * dx + (p[1] - ay) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    const ex = ax + t * dx - p[0], ey = ay + t * dy - p[1];
    min = Math.min(min, ex * ex + ey * ey);
  }
  return Math.sqrt(min);
}

/**
 * Read one channel of a canvas in horizontal strips into a compact Uint8Array
 * (avoids a full-size RGBA copy – 4× less peak memory), then free the canvas.
 */
export function readChannel(canvas: HTMLCanvasElement, channel: 0 | 1 | 2 | 3, strip = 256): Uint8Array {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width: W, height: H } = canvas;
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y += strip) {
    const h = Math.min(strip, H - y);
    const d = ctx.getImageData(0, y, W, h).data;
    for (let i = 0, o = y * W; i < W * h; i++, o++) out[o] = d[i * 4 + channel];
  }
  canvas.width = canvas.height = 0;
  return out;
}
