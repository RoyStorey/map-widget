/// <reference lib="webworker" />
/**
 * Sea routing: weighted A* over an equirectangular water grid derived from the
 * land mask, with hand-carved canals and narrow straits, followed by
 * line-of-sight smoothing so routes become a handful of clean waypoints.
 */
type LonLat = [number, number];

let fine: Uint8Array | null = null; // 1 = land, at FW x FH
let FW = 0, FH = 0;
let grid: Uint8Array | null = null; // 1 = water (passable) at GW x GH
let comp: Int32Array | null = null; // connected water body id per grid cell (-1 = land)
let oceanComp = -1;
let GW = 0, GH = 0;
const F = 2; // grid cell = F x F fine pixels

/** Canals & straits narrower than the grid: carved as water. */
const PASSAGES: LonLat[][] = [
  [[32.56, 29.9], [32.55, 30.3], [32.35, 30.6], [32.31, 31.0], [32.3, 31.35]], // Suez
  [[-79.95, 9.4], [-79.85, 9.2], [-79.67, 9.08], [-79.6, 8.95], [-79.5, 8.8]], // Panama
  [[29.12, 41.3], [29.03, 41.1], [28.98, 40.95]], // Bosporus
  [[26.75, 40.5], [26.4, 40.2], [26.15, 40.0]], // Dardanelles
  [[9.1, 53.88], [9.6, 54.05], [10.17, 54.38]], // Kiel
  [[-5.9, 35.95], [-5.6, 35.97], [-5.3, 36.0]], // Gibraltar
  [[103.6, 1.2], [104.0, 1.2], [104.4, 1.35]], // Singapore Strait
  [[43.2, 12.7], [43.45, 12.55]], // Bab-el-Mandeb
  [[15.6, 38.3], [15.65, 38.12]], // Messina
  [[12.65, 56.1], [12.75, 55.6]], // Øresund
  [[1.4, 51.1], [1.7, 50.9]], // Dover
  [[56.0, 26.6], [56.5, 26.3]], // Hormuz
  [[-74.5, 45.5], [-71.2, 46.8], [-66, 49.5]], // St Lawrence
  [[-70.5, -52.7], [-71.5, -53.6], [-73.5, -52.8]], // Magellan
  [[22.9, 37.94], [23.0, 37.9]], // Corinth
];

function carve(mask: Uint8Array, w: number, h: number, path: LonLat[], radiusPx: number) {
  const px = (lon: number) => ((lon + 180) / 360) * w;
  const py = (lat: number) => ((90 - lat) / 180) * h;
  for (let i = 1; i < path.length; i++) {
    const x0 = px(path[i - 1][0]), y0 = py(path[i - 1][1]), x1 = px(path[i][0]), y1 = py(path[i][1]);
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      for (let dy = -radiusPx; dy <= radiusPx; dy++)
        for (let dx = -radiusPx; dx <= radiusPx; dx++) {
          if (dx * dx + dy * dy > radiusPx * radiusPx) continue;
          const xx = ((Math.round(x + dx) % w) + w) % w, yy = Math.round(y + dy);
          if (yy >= 0 && yy < h) mask[yy * w + xx] = 0;
        }
    }
  }
}

function init(mask: Uint8Array, w: number, h: number) {
  fine = mask;
  FW = w;
  FH = h;
  for (const p of PASSAGES) carve(fine, FW, FH, p, 2);
  GW = Math.floor(FW / F);
  GH = Math.floor(FH / F);
  grid = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      let water = 0;
      for (let dy = 0; dy < F; dy++) for (let dx = 0; dx < F; dx++) if (!fine[(gy * F + dy) * FW + gx * F + dx]) water++;
      grid[gy * GW + gx] = water >= (F * F) / 2 ? 1 : 0;
    }
  labelComponents();
}

/** 4-connected water bodies (matches A*'s no-corner-cutting rule); the largest is the world ocean. */
function labelComponents() {
  const g = grid!;
  comp = new Int32Array(GW * GH).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) {
    if (!g[i] || comp[i] >= 0) continue;
    const id = sizes.length;
    let sp = 0, size = 0;
    stack[sp++] = i;
    comp[i] = id;
    while (sp) {
      const c = stack[--sp];
      size++;
      const x = c % GW, y = (c / GW) | 0;
      const nb = [y * GW + ((x + 1) % GW), y * GW + ((x - 1 + GW) % GW), y > 0 ? c - GW : -1, y < GH - 1 ? c + GW : -1];
      for (const n of nb) {
        if (n >= 0 && g[n] && comp[n] < 0) {
          comp[n] = id;
          stack[sp++] = n;
        }
      }
    }
    sizes.push(size);
  }
  oceanComp = sizes.indexOf(Math.max(...sizes));
}

const toGX = (lon: number) => ((Math.floor(((lon + 180) / 360) * GW) % GW) + GW) % GW;
const toGY = (lat: number) => Math.max(0, Math.min(GH - 1, Math.floor(((90 - lat) / 180) * GH)));
const gLon = (gx: number) => ((gx + 0.5) / GW) * 360 - 180;
const gLat = (gy: number) => 90 - ((gy + 0.5) / GH) * 180;

function nearestWater(gx: number, gy: number, g: Uint8Array = grid!, body = -2): number {
  const ok = (i: number) => g[i] && (body === -2 || comp![i] === body);
  if (ok(gy * GW + gx)) return gy * GW + gx;
  for (let r = 1; r < 120; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = (((gx + dx) % GW) + GW) % GW, y = gy + dy;
        if (y < 0 || y >= GH) continue;
        if (ok(y * GW + x)) return y * GW + x;
      }
  return -1;
}

const D2R = Math.PI / 180;
function hav(lon1: number, lat1: number, lon2: number, lat2: number) {
  const dLat = (lat2 - lat1) * D2R, dLon = (lon2 - lon1) * D2R;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function astar(from: LonLat, to: LonLat, weight = 1.25, polar = false): LonLat[] | null {
  let g = grid!;
  if (!polar) {
    // avoid ice: block high latitudes unless an endpoint is up there
    const north = Math.max(70, from[1] + 2, to[1] + 2), south = Math.min(-60, from[1] - 2, to[1] - 2);
    g = g.slice();
    for (let gy = 0; gy < GH; gy++) {
      const lat = gLat(gy);
      if (lat > north || lat < south) g.fill(0, gy * GW, (gy + 1) * GW);
    }
  }
  // Snap both ends into the same water body: their shared one (e.g. the Caspian), else the world ocean.
  const si = toGY(from[1]) * GW + toGX(from[0]), gi = toGY(to[1]) * GW + toGX(to[0]);
  const body = comp![si] >= 0 && comp![si] === comp![gi] ? comp![si] : oceanComp;
  const start = nearestWater(toGX(from[0]), toGY(from[1]), g, body);
  const goal = nearestWater(toGX(to[0]), toGY(to[1]), g, body);
  if (start < 0 || goal < 0) return null;
  const N = GW * GH;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  // binary heap of node ids keyed by f
  let heap = new Int32Array(1 << 16), keys = new Float32Array(1 << 16), size = 0;
  const push = (id: number, k: number) => {
    if (size === heap.length) {
      const nh = new Int32Array(size * 2); nh.set(heap); heap = nh;
      const nk = new Float32Array(size * 2); nk.set(keys); keys = nk;
    }
    let i = size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= k) break;
      heap[i] = heap[p]; keys[i] = keys[p]; i = p;
    }
    heap[i] = id; keys[i] = k;
  };
  const pop = () => {
    const top = heap[0];
    const lastId = heap[--size], lastK = keys[size];
    let i = 0;
    while (true) {
      let c = 2 * i + 1;
      if (c >= size) break;
      if (c + 1 < size && keys[c + 1] < keys[c]) c++;
      if (keys[c] >= lastK) break;
      heap[i] = heap[c]; keys[i] = keys[c]; i = c;
    }
    heap[i] = lastId; keys[i] = lastK;
    return top;
  };
  const glon = gLon(goal % GW), glat = gLat(Math.floor(goal / GW));
  gScore[start] = 0;
  push(start, 0);
  let expanded = 0;
  while (size) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++expanded > 3_000_000) return null;
    const cx = cur % GW, cy = (cur / GW) | 0;
    const clat = gLat(cy);
    const kx = Math.cos(clat * D2R) * (360 / GW) * 111.195;
    const ky = (180 / GH) * 111.195;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= GH) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = (cx + dx + GW) % GW;
        const nid = ny * GW + nx;
        if (!g[nid] || closed[nid]) continue;
        // forbid diagonal corner-cutting across land
        if (dx && dy && (!g[cy * GW + nx] || !g[ny * GW + cx])) continue;
        const cost = Math.hypot(dx * kx, dy * ky);
        const ng = gScore[cur] + cost;
        if (ng < gScore[nid]) {
          gScore[nid] = ng;
          came[nid] = cur;
          push(nid, ng + weight * hav(gLon(nx), gLat(ny), glon, glat));
        }
      }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const path: LonLat[] = [];
  for (let c = goal; c >= 0; c = came[c]) {
    path.push([gLon(c % GW), gLat((c / GW) | 0)]);
    if (c === start) break;
  }
  path.reverse();
  return path;
}

/** Fine-mask land test along a straight (lat/lon-linear) segment, unwrapped. */
function clear(a: LonLat, b: LonLat): boolean {
  let bl = b[0];
  while (bl - a[0] > 180) bl -= 360;
  while (bl - a[0] < -180) bl += 360;
  const n = Math.ceil(Math.hypot(bl - a[0], b[1] - a[1]) / 0.04) + 1;
  for (let i = 1; i < n; i++) {
    const lon = a[0] + ((bl - a[0]) * i) / n, lat = a[1] + ((b[1] - a[1]) * i) / n;
    const x = ((Math.floor(((lon + 180) / 360) * FW) % FW) + FW) % FW;
    const y = Math.max(0, Math.min(FH - 1, Math.floor(((90 - lat) / 180) * FH)));
    if (fine![y * FW + x]) return false;
  }
  return true;
}

function smooth(path: LonLat[]): LonLat[] {
  if (path.length < 3) return path;
  const out: LonLat[] = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    // farthest visible point (binary-ish scan backwards from a window)
    let j = Math.min(path.length - 1, i + 400);
    while (j > i + 1 && !clear(path[i], path[j])) j = Math.max(i + 1, j - Math.max(1, Math.floor((j - i) / 8)));
    // walk forward to the true farthest visible point
    while (j + 1 < path.length && j < i + 400 && clear(path[i], path[j + 1])) j++;
    out.push(path[j]);
    i = j;
  }
  return out;
}

self.onmessage = (ev: MessageEvent) => {
  const m = ev.data;
  if (m.type === 'init') {
    init(m.mask, m.w, m.h);
    return;
  }
  if (m.type === 'route') {
    try {
      const raw = astar(m.from, m.to, m.weight ?? 1.25, !!m.polar);
      if (!raw) return (self as any).postMessage({ id: m.id, ok: false, error: 'No sea route found' });
      const path = smooth(raw);
      // keep the exact endpoints (ports may be on the coast)
      path[0] = m.from;
      path[path.length - 1] = m.to;
      // unwrap longitudes for continuity
      for (let i = 1; i < path.length; i++) {
        let lon = path[i][0];
        while (lon - path[i - 1][0] > 180) lon -= 360;
        while (lon - path[i - 1][0] < -180) lon += 360;
        path[i] = [lon, path[i][1]];
      }
      (self as any).postMessage({ id: m.id, ok: true, path, raw: raw.length });
    } catch (err) {
      (self as any).postMessage({ id: m.id, ok: false, error: String(err) });
    }
  }
};
