/**
 * Atlas map format (`"format": "atlas-map@1"`).
 *
 * A plain-JSON (or TypeScript object) description of a historical map: sides,
 * territories that change hands, moving armies and fleets, dated events and a
 * short story told in chapters. It is designed to be easy for people and AI
 * agents to write: places can be given by name (see the built-in gazetteer)
 * or as [longitude, latitude]; times can be years ("1066", "500 BCE") or dates
 * ("1944-06-06T06:30").
 *
 * The compiler (compile.ts) turns a map into a full Scenario; the validator
 * (validate.ts) explains every problem with a JSON path. Teaching material such
 * as questions belongs to the host application, not to the map.
 */

/** A place name from the gazetteer ("Hastings", "Rome") or [longitude, latitude]. */
export type Place = string | [number, number];

/** A year (1066, -499 = 500 BCE), "500 BCE", "Oct 1066", "1066-10-14" or "1944-06-06T06:30". */
export type When = string | number;

export type Detail = 'world' | 'continent' | 'region' | 'city' | 'battlefield';

export interface SpecSide {
  /** Short id used to refer to this side elsewhere, e.g. "normans". */
  id: string;
  name: string;
  /** CSS hex colour, e.g. "#c92a2a". Picked automatically if omitted. */
  color?: string;
  capital?: Place;
  description?: string;
}

/** A change of control over a territory, spreading as a wave from `from`. */
export interface SpecChange {
  /** Side id taking control, or null for "nobody / independent". */
  side: string | null;
  start: When;
  /** When the takeover is complete (defaults to shortly after start). */
  end?: When;
  /** Where the takeover starts spreading from (defaults to the point nearest the side's capital). */
  from?: Place;
}

export interface SpecTerritory {
  name?: string;
  /** Polygon outline: at least 3 places, in order around the area. */
  area?: Place[];
  /** Or a circle. */
  around?: Place;
  radiusKm?: number;
  /** Side controlling the area when the lesson starts. */
  owner?: string | null;
  changes?: SpecChange[];
  /** Include sea inside the area (default false: land only). */
  includeSea?: boolean;
}

export interface SpecCountries {
  /** Modern country names, e.g. ["France", "Belgium"]. Good for 19th–21st century wars. */
  countries: string[];
  side: string | null;
  at: When;
}

export interface SpecWaypoint {
  at: Place;
  time: When;
}

export interface SpecMove {
  name: string;
  side: string;
  kind?: 'army' | 'armor' | 'fleet' | 'ship' | 'aircraft' | 'caravan' | 'explorer' | 'other';
  strength?: number;
  /** At least 2 waypoints with non-decreasing times. */
  path: SpecWaypoint[];
  /** Route between waypoints by sea, avoiding land (voyages, fleets). */
  bySea?: boolean;
}

export interface SpecRoute {
  name: string;
  /** Ports / waypoints in order (at least 2). */
  stops: Place[];
  color?: string;
  /** Number of animated ships (default 30). */
  ships?: number;
  /** Route between stops by sea (default true). */
  bySea?: boolean;
  twoWay?: boolean;
  start?: When;
  end?: When;
  description?: string;
}

export interface SpecEvent {
  title: string;
  time: When;
  at: Place;
  kind?: 'battle' | 'siege' | 'founding' | 'treaty' | 'disaster' | 'discovery' | 'note';
  text?: string;
  side?: string;
  /** Keep the marker visible until this time. */
  until?: When;
  zoom?: number;
}

export interface SpecEra {
  name: string;
  start: When;
  end: When;
  color?: string;
}

export interface SpecLabel {
  text: string;
  at: Place;
  size?: 'small' | 'medium' | 'large';
  start?: When;
  end?: When;
  color?: string;
}

export interface SpecArrow {
  from: Place;
  to: Place;
  label?: string;
  /** Relative thickness (default 10). */
  value?: number;
  color?: string;
  start?: When;
  end?: When;
}

export interface SpecView {
  center: Place;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface SpecChapter {
  title: string;
  /** One to three sentences. **bold** and *italic* are supported. */
  text: string;
  time: When;
  /** The step plays from `time` to `until` (defaults to the next step's time). */
  until?: When;
  /** Camera for this step; omitted = frame the step's events automatically. */
  view?: SpecView;
  image?: string;
  imageCaption?: string;
}

export interface MapSpec {
  format: 'atlas-map@1';
  title: string;
  summary?: string;
  start: When;
  end: When;
  /** Map scale – sets territory cell size and coastline detail. Default "continent". */
  detail?: Detail;
  basemap?: string;
  /** Opening camera. Default: fit everything. */
  view?: SpecView;
  /** Length of a full playthrough in seconds (default 90). */
  playSeconds?: number;
  /** "full" keeps the whole route travelled visible (good for voyages); "fade" shows a fading trail. Default: full if any move goes by sea. */
  trails?: 'full' | 'fade';
  sides: SpecSide[];
  territories?: SpecTerritory[];
  countries?: SpecCountries[];
  moves?: SpecMove[];
  routes?: SpecRoute[];
  events?: SpecEvent[];
  eras?: SpecEra[];
  labels?: SpecLabel[];
  arrows?: SpecArrow[];
  story?: SpecChapter[];
  sources?: string[];
}

export const DETAIL_RES: Record<Detail, number> = { world: 3, continent: 4, region: 5, city: 8, battlefield: 9 };

/** True for an atlas-map@1 object (the older name "atlas-lesson@1" is accepted too). */
export function isMapSpec(x: unknown): x is MapSpec {
  const f = x && typeof x === 'object' ? (x as any).format : undefined;
  return typeof f === 'string' && (f.startsWith('atlas-map') || f.startsWith('atlas-lesson'));
}
