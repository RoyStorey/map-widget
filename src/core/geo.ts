/** Geodesy helpers (spherical earth). Coordinates are [lon, lat] degrees. */
export type LonLat = [number, number];

export const EARTH_RADIUS_KM = 6371.0088;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function haversineKm(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * D2R;
  const dLon = (b[0] - a[0]) * D2R;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * D2R) * Math.cos(b[1] * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pathLengthKm(path: LonLat[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineKm(path[i - 1], path[i]);
  return d;
}

/** Intermediate point on the great circle between a and b at fraction f. */
export function greatCirclePoint(a: LonLat, b: LonLat, f: number): LonLat {
  const φ1 = a[1] * D2R, λ1 = a[0] * D2R, φ2 = b[1] * D2R, λ2 = b[0] * D2R;
  const δ = haversineKm(a, b) / EARTH_RADIUS_KM;
  if (δ < 1e-9) return [a[0], a[1]];
  const A = Math.sin((1 - f) * δ) / Math.sin(δ);
  const B = Math.sin(f * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return [Math.atan2(y, x) * R2D, Math.atan2(z, Math.sqrt(x * x + y * y)) * R2D];
}

/**
 * Densify a path along great circles so it renders as a geodesic, and unwrap
 * longitudes so the path never jumps across the antimeridian.
 */
export function densifyGreatCircle(path: LonLat[], maxSegKm = 100): LonLat[] {
  if (path.length < 2) return path.slice();
  const out: LonLat[] = [path[0].slice() as LonLat];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const n = Math.max(1, Math.ceil(haversineKm(a, b) / maxSegKm));
    for (let k = 1; k <= n; k++) out.push(greatCirclePoint(a, b, k / n));
  }
  return unwrapLongitudes(out);
}

export function unwrapLongitudes(path: LonLat[]): LonLat[] {
  for (let i = 1; i < path.length; i++) {
    let lon = path[i][0];
    const prev = path[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    path[i] = [lon, path[i][1]];
  }
  return path;
}

export function bearingDeg(a: LonLat, b: LonLat): number {
  const φ1 = a[1] * D2R, φ2 = b[1] * D2R, Δλ = (b[0] - a[0]) * D2R;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}

/** Spherical polygon area in km² (ring of [lon,lat], open or closed). */
export function ringAreaKm2(ring: LonLat[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i], p2 = ring[(i + 1) % n];
    total += (p2[0] - p1[0]) * D2R * (2 + Math.sin(p1[1] * D2R) + Math.sin(p2[1] * D2R));
  }
  return Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

export function formatDistance(km: number, unit: 'km' | 'mi' | 'nm' = 'km'): string {
  const v = unit === 'km' ? km : unit === 'mi' ? km * 0.621371 : km * 0.539957;
  if (unit === 'km' && v < 1) return `${(v * 1000).toFixed(0)} m`;
  return `${v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString()} ${unit}`;
}

export function formatAreaCompact(km2: number): string {
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(km2 >= 1e7 ? 1 : 2)}M km²`;
  if (km2 >= 1e3) return `${Math.round(km2 / 1e3)}k km²`;
  return `${Math.round(km2)} km²`;
}

export function formatArea(km2: number): string {
  if (km2 < 1) return `${(km2 * 1e6).toFixed(0)} m²`;
  return `${km2 < 100 ? km2.toFixed(2) : Math.round(km2).toLocaleString()} km²`;
}

/**
 * Timed path: [lon, lat, t][]. Returns interpolated position + heading at
 * time t, or null if t is outside the path's time span.
 */
export function positionAtTime(
  path: [number, number, number][],
  t: number,
  clamp = false,
): { pos: LonLat; heading: number; segment: number } | null {
  const n = path.length;
  if (n === 0) return null;
  if (t < path[0][2]) return clamp ? { pos: [path[0][0], path[0][1]], heading: 0, segment: 0 } : null;
  if (t > path[n - 1][2]) return clamp ? { pos: [path[n - 1][0], path[n - 1][1]], heading: 0, segment: n - 1 } : null;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid][2] <= t) lo = mid;
    else hi = mid;
  }
  const a = path[lo], b = path[Math.min(hi, n - 1)];
  const span = b[2] - a[2];
  const f = span > 0 ? (t - a[2]) / span : 0;
  return {
    pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
    heading: bearingDeg([a[0], a[1]], [b[0], b[1]]),
    segment: lo,
  };
}

/** Assign timestamps along a path proportionally to distance. */
export function timestampPath(path: LonLat[], start: number, end: number): [number, number, number][] {
  const total = pathLengthKm(path) || 1;
  let acc = 0;
  return path.map((p, i) => {
    if (i > 0) acc += haversineKm(path[i - 1], p);
    return [p[0], p[1], start + (end - start) * (acc / total)];
  });
}

/** Graticule lines every `step` degrees, as arrays of paths. */
export function graticule(step = 15): LonLat[][] {
  const lines: LonLat[][] = [];
  for (let lon = -180; lon <= 180; lon += step) {
    const l: LonLat[] = [];
    for (let lat = -85; lat <= 85; lat += 2.5) l.push([lon, lat]);
    lines.push(l);
  }
  for (let lat = -75; lat <= 75; lat += step) {
    const l: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += 2.5) l.push([lon, lat]);
    lines.push(l);
  }
  return lines;
}

/** Sub-solar point for a JS date (approximate, good to ~0.5°). */
export function subSolarPoint(date: Date): LonLat {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * D2R;
  const λ = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const ε = (23.439 - 0.0000004 * n) * D2R;
  const decl = Math.asin(Math.sin(ε) * Math.sin(λ)) * R2D;
  const ra = Math.atan2(Math.cos(ε) * Math.sin(λ), Math.cos(λ)) * R2D;
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  let lon = ra - gmst;
  lon = ((lon + 540) % 360) - 180;
  return [lon, decl];
}

/** Night-side polygon (as a ring) for a given date. */
export function nightPolygon(date: Date): LonLat[] {
  const [sLon, sLat] = subSolarPoint(date);
  const ring: LonLat[] = [];
  const tanDecl = Math.tan((Math.abs(sLat) < 1e-4 ? 1e-4 : sLat) * D2R);
  for (let lon = -180; lon <= 180; lon += 2) {
    const ha = (lon - sLon) * D2R;
    // terminator latitude where solar elevation = 0
    const lat = Math.atan(-Math.cos(ha) / tanDecl) * R2D;
    ring.push([lon, lat]);
  }
  const pole = sLat > 0 ? -90 : 90;
  ring.push([180, pole], [-180, pole]);
  return ring;
}

export function bboxOfPoints(pts: Iterable<LonLat>): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

export function pointInRing(p: LonLat, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
