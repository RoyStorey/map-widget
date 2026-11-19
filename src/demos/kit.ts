/**
 * Conquest kit: turns compact, mostly-declarative war definitions into full
 * scenarios. Regions are polygons whose H3 cells change hands in "phases"
 * (each phase is a spreading wave from an origin); countries, units, events,
 * eras, labels and camera tracks are passed straight through.
 *
 * All demo data is approximate and illustrative.
 */
import { cellToLatLng } from 'h3-js';
import { timestampPath, type LonLat } from '../core/geo';
import { polygonCells, waveEvents } from '../core/conquest';
import { isLand, loadLandMask } from '../core/landmask';
import { localLandTest } from '../core/hiland';
import { loadWorld } from '../core/world';
import { countryCells } from '../core/countrycells';
import { parseTime } from '../core/time';
import {
  emptyScenario,
  type Annotation,
  type Bookmark,
  type CameraKey,
  type CellEvent,
  type CountryEvent,
  type Era,
  type Faction,
  type Flow,
  type MapEvent,
  type Route,
  type Scenario,
  type Unit,
} from '../core/scenario';

/** Parse a date-ish string ('1944-06-06T06:30', '-335', '1241.3') to decimal years. */
export function T(x: string | number): number {
  const t = parseTime(x);
  if (t === null) throw new Error(`Bad time: ${x}`);
  return t;
}

/** [faction | null, start, end, origin?, jitter?] — a wave of conquest over a region. */
export type Phase = [string | null, number | string, number | string, LonLat?, number?];

export interface KitRegion {
  name?: string;
  ring: LonLat[];
  /** Owner at the scenario start (null / undefined = unclaimed). */
  native?: string | null;
  phases?: Phase[];
  /** Override land filtering for this region (default: on). */
  landOnly?: boolean;
}

export interface KitDef {
  title: string;
  description: string;
  start: number | string;
  end: number | string;
  res: number;
  basemap?: string;
  view?: { center: LonLat; zoom: number; bearing?: number; pitch?: number };
  /** Full playthrough length in seconds (default 120). */
  runSeconds?: number;
  /** Event marker lifetime as a fraction of the span (default 0.03). */
  eventFraction?: number;
  factions: Faction[];
  regions?: KitRegion[];
  /** [country name or Natural Earth id(s), time, faction | null] */
  countries?: [string | string[], number | string, string | null][];
  units?: Unit[];
  events?: MapEvent[];
  eras?: Omit<Era, 'id'>[];
  annotations?: Omit<Annotation, 'id'>[];
  flows?: Omit<Flow, 'id'>[];
  routes?: Route[];
  bookmarks?: Omit<Bookmark, 'id'>[];
  /** Explicit camera track, or 'auto' to derive one from region phases. */
  camera?: CameraKey[] | 'auto';
  /**
   * Render country ownership as H3 cells (default) so countries and fronts
   * share one layer; cells inside regions are left to the regions.
   */
  countriesAsCells?: boolean;
  /** Use rasterised 1:10m coastlines for land tests (zoomed-in battles). */
  hiResLand?: [number, number, number, number];
}

/** A unit marching through timed legs ([position, time]) along great circles. */
export function march(id: string, name: string, faction: string, legs: [LonLat, number | string][], kind: Unit['kind'] = 'army', strength?: number, extra: Partial<Unit> = {}): Unit {
  const path: [number, number, number][] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    const seg = timestampPath([legs[i][0], legs[i + 1][0]], T(legs[i][1]), T(legs[i + 1][1]));
    if (i) seg.shift();
    path.push(...seg);
  }
  if (legs.length === 1) path.push([legs[0][0][0], legs[0][0][1], T(legs[0][1])]);
  return { id, name, faction, path, kind, strength, width: kind === 'aircraft' ? 2.5 : 4, ...extra };
}

let evSeq = 0;
/** Event helper. */
export function ev(t: number | string, position: LonLat, title: string, kind: MapEvent['kind'], description = '', extra: Partial<MapEvent> = {}): MapEvent {
  return { id: `ev${++evSeq}_${title.replace(/\W+/g, '').slice(0, 12)}`, t: T(t), position, title, kind, description, ...extra };
}

/** Camera key helper. */
export function cam(t: number | string, center: LonLat, zoom: number, pitch = 0, bearing = 0): CameraKey {
  return { t: T(t), center, zoom, pitch, bearing };
}

export async function buildKit(def: KitDef): Promise<Scenario> {
  const start = T(def.start), end = T(def.end);
  const span = end - start;
  const s = emptyScenario({
    title: def.title,
    start,
    end,
    h3Resolution: def.res,
    speed: span / (def.runSeconds ?? 120),
    eventDuration: span * (def.eventFraction ?? 0.03),
    basemap: def.basemap,
    view: def.view,
  });
  s.meta.description = def.description;
  s.factions = def.factions.map((f) => ({ ...f }));

  // ---- land test: global mask, or rasterised hi-res coast for small areas
  let onLand: (lon: number, lat: number) => boolean;
  if (def.hiResLand) onLand = await localLandTest(def.hiResLand);
  else {
    await loadLandMask();
    onLand = isLand;
  }

  // ---- regions → cell events (first region to claim a cell owns it)
  const cells: CellEvent[] = [];
  const claimed = new Set<string>();
  (def.regions ?? []).forEach((r, ri) => {
    const all = polygonCells([r.ring], def.res).filter((c) => {
      if (claimed.has(c)) return false;
      if (r.landOnly === false) return true;
      const [lat, lon] = cellToLatLng(c);
      return onLand(lon, lat);
    });
    for (const c of all) claimed.add(c);
    if (!all.length) return;
    if (r.native) for (const c of all) cells.push({ cell: c, t: start, faction: r.native });
    (r.phases ?? []).forEach(([faction, a, b, origin, jitter], pi) => {
      const ta = T(a), tb = Math.max(T(a), T(b));
      cells.push(...waveEvents(all, origin ?? r.ring[0], ta, tb, faction, { jitter: jitter ?? 0.3, seed: ri * 31 + pi * 7 + 1 }));
    });
  });
  s.cells = cells;

  // ---- whole countries by name or id
  if (def.countries?.length) {
    const world = await loadWorld();
    const find = (q: string) => world.list.find((c) => c.id === q || c.name.toLowerCase() === q.toLowerCase());
    const out: CountryEvent[] = [];
    for (const [names, t, faction] of def.countries) {
      for (const n of Array.isArray(names) ? names : [names]) {
        const c = find(n);
        if (!c) {
          console.warn(`[kit] unknown country "${n}" in ${def.title}`);
          continue;
        }
        out.push({ country: c.id, t: T(t), faction });
      }
    }
    if (def.countriesAsCells !== false) {
      const byCountry = await countryCells(def.res);
      for (const e of out) for (const cell of byCountry.get(e.country) ?? []) if (!claimed.has(cell)) cells.push({ cell, t: e.t, faction: e.faction });
    } else s.countries = out;
  }

  s.units = def.units ?? [];
  s.events = def.events ?? [];
  s.routes = def.routes ?? [];
  s.eras = (def.eras ?? []).map((e, i) => ({ ...e, id: `era${i}` }));
  s.annotations = (def.annotations ?? []).map((a, i) => ({ ...a, id: `lbl${i}` }));
  s.flows = (def.flows ?? []).map((f, i) => ({ ...f, id: `flow${i}` }));
  s.bookmarks = (def.bookmarks ?? []).map((b, i) => ({ ...b, id: `bm${i}` }));
  s.camera = def.camera === 'auto' ? autoCamera(def, start, end) : (def.camera ?? []).slice().sort((a, b) => a.t - b.t);
  return s;
}

/** Camera that visits each region as its phases play out, with wide shots at both ends. */
function autoCamera(def: KitDef, start: number, end: number): CameraKey[] {
  const span = end - start;
  const keys: CameraKey[] = [];
  const zoomFor = (ring: LonLat[]) => {
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const dx = Math.max(...xs) - Math.min(...xs), dy = Math.max(...ys) - Math.min(...ys);
    const z = Math.log2(492 / Math.max(0.5, dx, dy * 1.7));
    return { center: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2] as LonLat, zoom: Math.max(2, Math.min(8, z)) };
  };
  for (const r of def.regions ?? []) {
    for (const [, a, b] of r.phases ?? []) {
      const ta = T(a), tb = T(b);
      if (tb - ta < span * 0.004 && ta <= start) continue;
      const { center, zoom } = zoomFor(r.ring);
      keys.push({ t: ta + (tb - ta) * 0.25, center, zoom, bearing: 0, pitch: 25 });
    }
  }
  keys.sort((a, b) => a.t - b.t);
  const merged: CameraKey[] = [];
  for (const k of keys) {
    const last = merged[merged.length - 1];
    if (!last || k.t - last.t > span / 60) merged.push(k);
  }
  const overview = def.view ?? { center: [20, 35] as LonLat, zoom: 2.5 };
  merged.unshift({ t: start, center: overview.center, zoom: overview.zoom, bearing: 0, pitch: 0 });
  merged.push({ t: end, center: overview.center, zoom: overview.zoom, bearing: 0, pitch: 0 });
  return merged;
}

/** Shuttle between two points repeatedly (airlifts, ferries, convoys). */
export function shuttle(id: string, name: string, faction: string, a: LonLat, b: LonLat, from: number | string, to: number | string, trips: number, kind: Unit['kind'] = 'aircraft'): Unit {
  const t0 = T(from), t1 = T(to);
  const legs: [LonLat, number][] = [];
  for (let i = 0; i <= trips * 2; i++) legs.push([i % 2 ? b : a, t0 + ((t1 - t0) * i) / (trips * 2)]);
  return march(id, name, faction, legs, kind);
}
