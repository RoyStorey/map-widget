import {
  cellToBoundary,
  cellToLatLng,
  originToDirectedEdges,
  getDirectedEdgeDestination,
  directedEdgeToBoundary,
  isValidCell,
} from 'h3-js';
import { OwnershipTimeline } from './ownership';
import type { CellEvent, Faction } from './scenario';
import type { LonLat } from './geo';

const D2R = Math.PI / 180;

/**
 * H3-cell based territory model. Owns the ownership timeline for cells plus
 * cached geometry (polygons, neighbour edges) so per-frame work is limited to
 * recolouring and recomputing borders when ownership actually changes.
 */
export class TerritoryEngine {
  readonly timeline = new OwnershipTimeline();
  /** Number of cells with geometry. */
  count = 0;
  /** Flat closed hex rings: [lon, lat, …] for every cell, cell i spans vertices ringStart[i]..ringStart[i+1]. */
  ringPositions = new Float32Array(0);
  /** Vertex start index of each cell's ring (length count + 1). */
  ringStart = new Uint32Array(1);
  centers = new Float64Array(0);
  /** Unit vectors of cell centres (x, y, z) – for cheap spherical centroids. */
  unit = new Float64Array(0);
  geometryVersion = 0;
  factionIndex = new Map<string, number>();

  private edgeNeighbor = new Int32Array(0);
  private edgeCoords = new Float32Array(0);
  private edgeDest: string[] = [];
  private edgesComputed = 0;
  private bordersCache: { version: number; data: BorderData } | null = null;
  private labelsCache: { version: number; data: FactionLabel[] } | null = null;

  /** Drop all cached geometry (new scenario / resolution change). */
  reset(): void {
    this.timeline.keys = [];
    this.timeline.keyIndex = new Map();
    this.count = 0;
    this.ringPositions = new Float32Array(0);
    this.ringStart = new Uint32Array(1);
    this.centers = new Float64Array(0);
    this.unit = new Float64Array(0);
    this.edgeNeighbor = new Int32Array(0);
    this.edgeCoords = new Float32Array(0);
    this.edgeDest = [];
    this.edgesComputed = 0;
    this.bordersCache = null;
    this.labelsCache = null;
  }

  rebuild(events: CellEvent[], factions: Faction[]): void {
    this.factionIndex = new Map(factions.map((f, i) => [f.id, i]));
    const valid = events.filter((e) => isValidCell(e.cell));
    const prevKeys = this.timeline.keys;
    this.timeline.build(
      valid.map((e) => ({ key: e.cell, t: e.t, owner: e.faction ? this.factionIndex.get(e.faction) ?? -1 : -1 })),
      factions.length,
      prevKeys, // keep key order stable so cached geometry stays valid
    );
    this.ensureGeometry();
    this.bordersCache = null;
    this.labelsCache = null;
  }

  /** Closed ring of cell i as [lon, lat] pairs (for exports / tools). */
  ring(i: number): LonLat[] {
    const out: LonLat[] = [];
    for (let v = this.ringStart[i]; v < this.ringStart[i + 1]; v++) out.push([this.ringPositions[v * 2], this.ringPositions[v * 2 + 1]]);
    return out;
  }

  private ensureGeometry(): void {
    const keys = this.timeline.keys;
    const n = keys.length;
    if (this.count === n) return;
    // keys only ever grow (previous keys are passed as extraKeys), so extend the typed buffers
    const start = this.count > n ? 0 : this.count;
    const rings: number[][] = [];
    let extra = 0;
    for (let i = start; i < n; i++) {
      const ring = cellToBoundary(keys[i], true) as number[][];
      // unwrap across the antimeridian relative to the first vertex
      const ref = ring[0][0];
      for (const p of ring) {
        if (p[0] - ref > 180) p[0] -= 360;
        else if (p[0] - ref < -180) p[0] += 360;
      }
      // deck.gl's convention for outer rings (positive shoelace sum), then close the ring
      let area = 0;
      for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) area += (ring[k][0] - ring[j][0]) * (ring[k][1] + ring[j][1]);
      if (area < 0) ring.reverse();
      ring.push(ring[0]);
      rings.push(ring.flat());
      extra += ring.length;
    }
    const prevVerts = this.ringStart[start];
    const positions = new Float32Array((prevVerts + extra) * 2);
    positions.set(this.ringPositions.subarray(0, prevVerts * 2));
    const ringStart = new Uint32Array(n + 1);
    ringStart.set(this.ringStart.subarray(0, start + 1));
    const centers = new Float64Array(n * 2);
    centers.set(this.centers.subarray(0, start * 2));
    const unit = new Float64Array(n * 3);
    unit.set(this.unit.subarray(0, start * 3));
    let v = prevVerts;
    for (let i = start; i < n; i++) {
      const flat = rings[i - start];
      positions.set(flat, v * 2);
      v += flat.length / 2;
      ringStart[i + 1] = v;
      const [lat, lng] = cellToLatLng(keys[i]);
      centers[i * 2] = lng;
      centers[i * 2 + 1] = lat;
      const cl = Math.cos(lat * D2R);
      unit[i * 3] = cl * Math.cos(lng * D2R);
      unit[i * 3 + 1] = cl * Math.sin(lng * D2R);
      unit[i * 3 + 2] = Math.sin(lat * D2R);
    }
    this.ringPositions = positions;
    this.ringStart = ringStart;
    this.centers = centers;
    this.unit = unit;
    this.count = n;
    // grow edge caches lazily
    const en = new Int32Array(n * 6).fill(-2); // -2 = not computed
    en.set(this.edgeNeighbor.subarray(0, Math.min(this.edgeNeighbor.length, start * 6)));
    const ec = new Float32Array(n * 24);
    ec.set(this.edgeCoords.subarray(0, Math.min(this.edgeCoords.length, start * 24)));
    this.edgeNeighbor = en;
    this.edgeCoords = ec;
    this.edgeDest.length = n * 6;
    this.edgesComputed = Math.min(this.edgesComputed, start);
    this.geometryVersion++;
  }

  private ensureEdges(): void {
    const keys = this.timeline.keys;
    const idx = this.timeline.keyIndex;
    const n = keys.length;
    if (this.edgesComputed >= n) return;
    for (let i = this.edgesComputed; i < n; i++) {
      const edges = originToDirectedEdges(keys[i]);
      const ref = this.ringPositions[this.ringStart[i] * 2];
      for (let e = 0; e < 6; e++) {
        const slot = i * 6 + e;
        if (e >= edges.length) {
          this.edgeNeighbor[slot] = -4; // pentagon: no such edge
          continue;
        }
        this.edgeDest[slot] = getDirectedEdgeDestination(edges[e]);
        this.edgeNeighbor[slot] = -1;
        const b = directedEdgeToBoundary(edges[e]);
        const a0 = b[0], a1 = b[b.length - 1];
        let lon0 = a0[1], lon1 = a1[1];
        if (lon0 - ref > 180) lon0 -= 360; else if (lon0 - ref < -180) lon0 += 360;
        if (lon1 - ref > 180) lon1 -= 360; else if (lon1 - ref < -180) lon1 += 360;
        const o = slot * 4;
        this.edgeCoords[o] = lon0;
        this.edgeCoords[o + 1] = a0[0];
        this.edgeCoords[o + 2] = lon1;
        this.edgeCoords[o + 3] = a1[0];
      }
    }
    // (re)resolve neighbour links – new keys may complete old cells' edges
    for (let x = 0; x < n * 6; x++) {
      if (this.edgeNeighbor[x] === -1) {
        const j = idx.get(this.edgeDest[x]);
        if (j !== undefined) this.edgeNeighbor[x] = j;
      }
    }
    this.edgesComputed = n;
  }

  /** Border segments between differently-owned cells at the current time. */
  borders(): BorderData {
    const tl = this.timeline;
    if (this.bordersCache && this.bordersCache.version === tl.version + this.geometryVersion * 1e6) return this.bordersCache.data;
    this.ensureEdges();
    const owner = tl.owner;
    const n = tl.keys.length;
    let count = 0;
    const nb = this.edgeNeighbor;
    for (let i = 0; i < n; i++) {
      const o = owner[i];
      if (o < 0) continue;
      for (let e = 0; e < 6; e++) {
        const j = nb[i * 6 + e];
        if (j === -4) continue;
        if (j < 0 || owner[j] !== o) count++;
      }
    }
    const positions = new Float32Array(count * 4);
    const owners = new Int16Array(count);
    const fronts = new Uint8Array(count);
    let frontCount = 0;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const o = owner[i];
      if (o < 0) continue;
      for (let e = 0; e < 6; e++) {
        const j = nb[i * 6 + e];
        if (j === -4) continue;
        if (j < 0 || owner[j] !== o) {
          const src = (i * 6 + e) * 4;
          positions[k * 4] = this.edgeCoords[src];
          positions[k * 4 + 1] = this.edgeCoords[src + 1];
          positions[k * 4 + 2] = this.edgeCoords[src + 2];
          positions[k * 4 + 3] = this.edgeCoords[src + 3];
          owners[k] = o;
          // a "front" is a border with another faction (not with unclaimed land); count each edge once
          if (j >= 0 && owner[j] >= 0 && o < owner[j]) {
            fronts[k] = 1;
            frontCount++;
          }
          k++;
        }
      }
    }
    const data = { length: count, positions, owners, fronts, frontCount };
    this.bordersCache = { version: tl.version + this.geometryVersion * 1e6, data };
    return data;
  }

  /** One label anchor per faction: the owned cell closest to the territory's spherical centroid. */
  factionLabels(): FactionLabel[] {
    const tl = this.timeline;
    if (this.labelsCache && this.labelsCache.version === tl.version) return this.labelsCache.data;
    const m = tl.ownerCount;
    const sx = new Float64Array(m), sy = new Float64Array(m), sz = new Float64Array(m), cnt = new Int32Array(m);
    const u = this.unit;
    const owner = tl.owner;
    const n = Math.min(owner.length, this.count);
    for (let i = 0; i < n; i++) {
      const o = owner[i];
      if (o < 0) continue;
      sx[o] += u[i * 3];
      sy[o] += u[i * 3 + 1];
      sz[o] += u[i * 3 + 2];
      cnt[o]++;
    }
    const best = new Int32Array(m).fill(-1);
    const bestDot = new Float64Array(m).fill(-Infinity);
    for (let i = 0; i < n; i++) {
      const o = owner[i];
      if (o < 0) continue;
      const d = sx[o] * u[i * 3] + sy[o] * u[i * 3 + 1] + sz[o] * u[i * 3 + 2];
      if (d > bestDot[o]) {
        bestDot[o] = d;
        best[o] = i;
      }
    }
    const c = this.centers;
    const out: FactionLabel[] = [];
    for (let o = 0; o < m; o++) {
      if (cnt[o] === 0 || best[o] < 0) continue;
      out.push({ owner: o, position: [c[best[o] * 2], c[best[o] * 2 + 1]], count: cnt[o] });
    }
    this.labelsCache = { version: tl.version, data: out };
    return out;
  }

  /** Approximate area per cell at the given resolution (km²) for stats. */
  static cellAreaKm2(res: number): number {
    const table = [4357449, 609788, 86802, 12393, 1770, 252.9, 36.13, 5.16, 0.737, 0.105, 0.015, 0.00214, 0.000307, 0.0000438, 0.00000626, 0.000000895];
    return table[res] ?? 0;
  }
}

export interface BorderData {
  length: number;
  positions: Float32Array; // [lon0, lat0, lon1, lat1] * length
  owners: Int16Array;
  /** 1 where the segment separates two different factions. */
  fronts: Uint8Array;
  frontCount: number;
}

export interface FactionLabel {
  owner: number;
  position: LonLat;
  count: number;
}
