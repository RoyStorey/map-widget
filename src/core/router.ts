/**
 * Path finding over an equirectangular land mask, for ships (over water) and for armies
 * (over land). Pure code with no DOM: the routing worker runs it in the browser, and
 * the map checks (map-widget/spec) run it in Node.
 *
 * A route is a weighted A* search on a coarse grid, followed by line-of-sight smoothing
 * on the fine mask, so routes come out as a handful of clean waypoints.
 * - Sea: canals and narrow straits are carved as water.
 * - Land: narrow straits that armies crossed by ferry or bridge (the Bosporus, the
 *   Dardanelles, Messina, Kerch) are filled as land. Anything wider is a sea crossing,
 *   which a map has to say explicitly.
 */
export type LonLat = [number, number];
export type RouteMode = 'sea' | 'land';

/** Canals and straits narrower than the grid, carved as water for ships. */
const SEA_PASSAGES: LonLat[][] = [
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
  // Strait of Magellan, along its centreline: First and Second Narrows, Punta Arenas, Cape Froward, Paso Largo, Cape Pillar
  [[-68.35, -52.35], [-69.55, -52.52], [-69.9, -52.6], [-70.3, -52.75], [-70.6, -52.95], [-70.75, -53.15], [-70.9, -53.5], [-71.28, -53.9], [-71.8, -53.85], [-72.3, -53.6], [-72.9, -53.3], [-73.6, -53.0], [-74.6, -52.7]],
  [[22.9, 37.94], [23.0, 37.9]], // Corinth
];

/** Straits a few kilometres wide that land armies crossed routinely: bridged as land. */
const LAND_FERRIES: LonLat[][] = [
  [[28.95, 41.03], [29.03, 41.02]], // Bosporus (Constantinople – Chalcedon)
  [[26.38, 40.2], [26.42, 40.12]], // Dardanelles (Abydos – Sestos)
  [[15.6, 38.22], [15.66, 38.24]], // Strait of Messina
  [[36.48, 45.33], [36.56, 45.27]], // Kerch Strait
];

const D2R = Math.PI / 180;
export function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * D2R, dLon = (lon2 - lon1) * D2R;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pathKm(path: LonLat[]): number {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += haversine(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
  return km;
}

/** One passable surface (water for ships, or land for armies) at two resolutions. */
interface Surface {
  fine: Uint8Array; // 1 = passable, at FW x FH
  grid: Uint8Array; // 1 = passable, at GW x GH
  comp: Int32Array; // connected body id per grid cell (-1 = impassable)
  largest: number;
}

const F = 2; // grid cell = F x F fine pixels

export class Router {
  private readonly FW: number;
  private readonly FH: number;
  private readonly GW: number;
  private readonly GH: number;
  private surfaces = new Map<RouteMode, Surface>();

  /** `mask`: 1 = land, 0 = water, row-major from 90°N, `w` x `h` pixels over 360° x 180°. */
  constructor(private readonly mask: Uint8Array, w: number, h: number) {
    this.FW = w;
    this.FH = h;
    this.GW = Math.floor(w / F);
    this.GH = Math.floor(h / F);
  }

  /** True when the point is passable for the mode (on the fine mask). */
  passable(mode: RouteMode, lon: number, lat: number): boolean {
    const s = this.surface(mode);
    return s.fine[this.fy(lat) * this.FW + this.fx(lon)] === 1;
  }

  /**
   * Kilometres of a straight (lat/lon-linear) segment that are not passable for the mode:
   * water for 'land', land for 'sea'. Known straits count as passable (carved for ships,
   * bridged for armies).
   */
  blockedKm(mode: RouteMode, a: LonLat, b: LonLat): number {
    const fine = this.surface(mode).fine;
    const bl = unwrap(a[0], b[0]);
    const km = haversine(a[0], a[1], bl, b[1]);
    const n = Math.max(2, Math.ceil(km / 2));
    let blocked = 0;
    for (let i = 0; i <= n; i++) {
      const lon = a[0] + ((bl - a[0]) * i) / n, lat = a[1] + ((b[1] - a[1]) * i) / n;
      if (!fine[this.fy(lat) * this.FW + this.fx(lon)]) blocked++;
    }
    return (blocked / (n + 1)) * km;
  }

  /** Shortest-ish path between two points for the mode, or null if there is none. */
  route(mode: RouteMode, from: LonLat, to: LonLat, opts: { polar?: boolean; weight?: number } = {}): LonLat[] | null {
    const raw = this.astar(mode, from, to, opts.weight ?? 1.25, !!opts.polar);
    if (!raw) return null;
    const path = this.smooth(mode, raw);
    // keep the exact endpoints (ports and cities may sit on the coast)
    path[0] = from;
    path[path.length - 1] = to;
    for (let i = 1; i < path.length; i++) path[i] = [unwrap(path[i - 1][0], path[i][0]), path[i][1]];
    return path;
  }

  // ---------------------------------------------------------------- internals

  private fx(lon: number) {
    return ((Math.floor(((lon + 180) / 360) * this.FW) % this.FW) + this.FW) % this.FW;
  }
  private fy(lat: number) {
    return Math.max(0, Math.min(this.FH - 1, Math.floor(((90 - lat) / 180) * this.FH)));
  }
  private toGX(lon: number) {
    return ((Math.floor(((lon + 180) / 360) * this.GW) % this.GW) + this.GW) % this.GW;
  }
  private toGY(lat: number) {
    return Math.max(0, Math.min(this.GH - 1, Math.floor(((90 - lat) / 180) * this.GH)));
  }
  private gLon(gx: number) {
    return ((gx + 0.5) / this.GW) * 360 - 180;
  }
  private gLat(gy: number) {
    return 90 - ((gy + 0.5) / this.GH) * 180;
  }

  /** Built on first use: most maps need only one of the two. */
  private surface(mode: RouteMode): Surface {
    let s = this.surfaces.get(mode);
    if (s) return s;
    const { FW, FH, GW, GH } = this;
    const fine = new Uint8Array(this.mask.length);
    if (mode === 'land') fine.set(this.mask);
    else for (let i = 0; i < fine.length; i++) fine[i] = this.mask[i] ? 0 : 1;
    for (const p of mode === 'sea' ? SEA_PASSAGES : LAND_FERRIES) stamp(fine, FW, FH, p, 2, 1);
    const grid = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++)
      for (let gx = 0; gx < GW; gx++) {
        let n = 0;
        for (let dy = 0; dy < F; dy++) for (let dx = 0; dx < F; dx++) n += fine[(gy * F + dy) * FW + gx * F + dx];
        grid[gy * GW + gx] = n >= (F * F) / 2 ? 1 : 0;
      }
    // a strait must stay open on the coarse grid too
    for (const p of mode === 'sea' ? SEA_PASSAGES : LAND_FERRIES) stamp(grid, GW, GH, p, 1, 1);
    const { comp, largest } = components(grid, GW, GH);
    s = { fine, grid, comp, largest };
    this.surfaces.set(mode, s);
    return s;
  }

  private nearest(s: Surface, gx: number, gy: number, g: Uint8Array, body = -2): number {
    const { GW, GH } = this;
    const ok = (i: number) => g[i] === 1 && (body === -2 || s.comp[i] === body);
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

  private astar(mode: RouteMode, from: LonLat, to: LonLat, weight: number, polar: boolean): LonLat[] | null {
    const s = this.surface(mode);
    const { GW, GH } = this;
    let g = s.grid;
    if (mode === 'sea' && !polar) {
      // ships avoid the ice: block high latitudes unless an endpoint is up there
      const north = Math.max(70, from[1] + 2, to[1] + 2), south = Math.min(-60, from[1] - 2, to[1] - 2);
      g = g.slice();
      for (let gy = 0; gy < GH; gy++) {
        const lat = this.gLat(gy);
        if (lat > north || lat < south) g.fill(0, gy * GW, (gy + 1) * GW);
      }
    }
    let start: number, goal: number;
    if (mode === 'sea') {
      // both ends in the same water body: their shared one (e.g. the Caspian), else the world ocean
      const si = this.toGY(from[1]) * GW + this.toGX(from[0]), gi = this.toGY(to[1]) * GW + this.toGX(to[0]);
      const body = s.comp[si] >= 0 && s.comp[si] === s.comp[gi] ? s.comp[si] : s.largest;
      start = this.nearest(s, this.toGX(from[0]), this.toGY(from[1]), g, body);
      goal = this.nearest(s, this.toGX(to[0]), this.toGY(to[1]), g, body);
    } else {
      // armies can't change land mass: different bodies mean a sea crossing
      start = this.nearest(s, this.toGX(from[0]), this.toGY(from[1]), g);
      goal = this.nearest(s, this.toGX(to[0]), this.toGY(to[1]), g);
      if (start >= 0 && goal >= 0 && s.comp[start] !== s.comp[goal]) return null;
    }
    if (start < 0 || goal < 0) return null;

    const N = GW * GH;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
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
    const glon = this.gLon(goal % GW), glat = this.gLat(Math.floor(goal / GW));
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
      const kx = Math.cos(this.gLat(cy) * D2R) * (360 / GW) * 111.195;
      const ky = (180 / GH) * 111.195;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= GH) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = (cx + dx + GW) % GW;
          const nid = ny * GW + nx;
          if (!g[nid] || closed[nid]) continue;
          // no cutting corners across the other surface
          if (dx && dy && (!g[cy * GW + nx] || !g[ny * GW + cx])) continue;
          const ng = gScore[cur] + Math.hypot(dx * kx, dy * ky);
          if (ng < gScore[nid]) {
            gScore[nid] = ng;
            came[nid] = cur;
            push(nid, ng + weight * haversine(this.gLon(nx), this.gLat(ny), glon, glat));
          }
        }
      }
    }
    if (came[goal] < 0 && goal !== start) return null;
    const path: LonLat[] = [];
    for (let c = goal; c >= 0; c = came[c]) {
      path.push([this.gLon(c % GW), this.gLat((c / GW) | 0)]);
      if (c === start) break;
    }
    path.reverse();
    return path;
  }

  /** True when the straight segment stays on the mode's passable surface (fine mask). */
  private clear(s: Surface, a: LonLat, b: LonLat): boolean {
    const bl = unwrap(a[0], b[0]);
    const n = Math.ceil(Math.hypot(bl - a[0], b[1] - a[1]) / 0.04) + 1;
    for (let i = 1; i < n; i++) {
      const lon = a[0] + ((bl - a[0]) * i) / n, lat = a[1] + ((b[1] - a[1]) * i) / n;
      if (!s.fine[this.fy(lat) * this.FW + this.fx(lon)]) return false;
    }
    return true;
  }

  private smooth(mode: RouteMode, path: LonLat[]): LonLat[] {
    if (path.length < 3) return path;
    const s = this.surface(mode);
    const out: LonLat[] = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = Math.min(path.length - 1, i + 400);
      while (j > i + 1 && !this.clear(s, path[i], path[j])) j = Math.max(i + 1, j - Math.max(1, Math.floor((j - i) / 8)));
      while (j + 1 < path.length && j < i + 400 && this.clear(s, path[i], path[j + 1])) j++;
      out.push(path[j]);
      i = j;
    }
    return out;
  }
}

function unwrap(ref: number, lon: number): number {
  while (lon - ref > 180) lon -= 360;
  while (lon - ref < -180) lon += 360;
  return lon;
}

/** Set `value` along a polyline, `radius` pixels wide. */
function stamp(mask: Uint8Array, w: number, h: number, path: LonLat[], radius: number, value: number) {
  const px = (lon: number) => ((lon + 180) / 360) * w;
  const py = (lat: number) => ((90 - lat) / 180) * h;
  for (let i = 1; i < path.length; i++) {
    const x0 = px(path[i - 1][0]), y0 = py(path[i - 1][1]), x1 = px(path[i][0]), y1 = py(path[i][1]);
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const xx = ((Math.round(x + dx) % w) + w) % w, yy = Math.round(y + dy);
          if (yy >= 0 && yy < h) mask[yy * w + xx] = value;
        }
    }
  }
}

/** 4-connected bodies of passable cells (matches A*'s no-corner-cutting rule). */
function components(g: Uint8Array, W: number, H: number): { comp: Int32Array; largest: number } {
  const comp = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  let best = -1, bestSize = 0, id = 0;
  for (let i = 0; i < W * H; i++) {
    if (!g[i] || comp[i] >= 0) continue;
    let sp = 0, size = 0;
    stack[sp++] = i;
    comp[i] = id;
    while (sp) {
      const c = stack[--sp];
      size++;
      const x = c % W, y = (c / W) | 0;
      const right = y * W + ((x + 1) % W), left = y * W + ((x - 1 + W) % W);
      if (g[right] && comp[right] < 0) { comp[right] = id; stack[sp++] = right; }
      if (g[left] && comp[left] < 0) { comp[left] = id; stack[sp++] = left; }
      if (y > 0 && g[c - W] && comp[c - W] < 0) { comp[c - W] = id; stack[sp++] = c - W; }
      if (y < H - 1 && g[c + W] && comp[c + W] < 0) { comp[c + W] = id; stack[sp++] = c + W; }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }
  return { comp, largest: best };
}
