import type { LonLat } from './geo';
import { paletteColor } from './color';

export type ID = string;

export interface Faction {
  id: ID;
  name: string;
  color: string; // hex
  description?: string;
  /** Optional capital location shown as a star marker. */
  capital?: LonLat;
}

/** A change of ownership of an H3 cell at time t. faction=null means "unclaimed". */
export interface CellEvent {
  cell: string;
  t: number;
  faction: ID | null;
}

/** A change of ownership of a whole country (Natural Earth / ISO numeric id). */
export interface CountryEvent {
  country: string;
  t: number;
  faction: ID | null;
}

/** An army, fleet, caravan, ship… moving along a timed path. */
export interface Unit {
  id: ID;
  name: string;
  faction?: ID;
  color?: string;
  /** [lon, lat, t] waypoints with strictly non-decreasing time. */
  path: [number, number, number][];
  /** Visual trail length in years. */
  trail?: number;
  width?: number;
  kind?: 'army' | 'armor' | 'fleet' | 'ship' | 'aircraft' | 'caravan' | 'explorer' | 'other';
  strength?: number;
}

/** A shipping lane / trade route with procedurally animated vessels. */
export interface Route {
  id: ID;
  name: string;
  color: string;
  waypoints: LonLat[];
  /** Number of vessels animated along this lane. */
  vessels: number;
  /** Vessel speed in km per hour of *ambient* animation (scaled), or km/day in timed mode. */
  speedKnots: number;
  /** Relative traffic volume → line width. */
  volume: number;
  /** Optional active window. */
  start?: number;
  end?: number;
  bidirectional?: boolean;
  description?: string;
}

/** Point-in-time occurrence: battle, founding, treaty… */
export interface MapEvent {
  id: ID;
  t: number;
  /** Optional end time; otherwise visible for the scenario's eventDuration. */
  end?: number;
  position: LonLat;
  title: string;
  description?: string;
  kind: 'battle' | 'siege' | 'founding' | 'treaty' | 'disaster' | 'discovery' | 'note';
  faction?: ID;
  /** Camera zoom to use when jumping to the event. */
  zoom?: number;
  /** Id of a detailed battle scenario you can dive into from this event. */
  battle?: string;
}

/** Free text label anchored to the map with a time window. */
export interface Annotation {
  id: ID;
  text: string;
  position: LonLat;
  start?: number;
  end?: number;
  size?: number;
  color?: string;
  /** Size in pixels (default) or metres so the label scales with the map. */
  units?: 'pixels' | 'meters';
}

/** Trade / migration / supply flow arc between two points. */
export interface Flow {
  id: ID;
  from: LonLat;
  to: LonLat;
  value: number;
  color?: string;
  start?: number;
  end?: number;
  label?: string;
}

/** Arbitrary polygon region with a lifespan (custom borders, provinces…). */
export interface Region {
  id: ID;
  name: string;
  faction?: ID;
  color?: string;
  rings: LonLat[][];
  start?: number;
  end?: number;
}

export interface CameraKey {
  t: number;
  center: LonLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface Bookmark {
  id: ID;
  name: string;
  center: LonLat;
  zoom: number;
  bearing: number;
  pitch: number;
  t?: number;
}

export type DataRender = 'auto' | 'scatter' | 'heatmap' | 'hexbin' | 'grid' | 'screengrid' | 'geojson' | 'arcs' | 'trips';

export interface DataLayerStyle {
  render: DataRender;
  color: string;
  radius: number;
  opacity: number;
  ramp: string;
  /** Property that holds a time (decimal year or date string) for time filtering. */
  timeField?: string;
  /** Visible window behind the current time, in years (0 → cumulative). */
  timeWindow: number;
  /** Property used for size / weight. */
  weightField?: string;
  /** Property used for categorical colouring. */
  colorField?: string;
  extruded?: boolean;
  labelField?: string;
}

export interface DataLayer {
  id: ID;
  name: string;
  visible: boolean;
  /** GeoJSON FeatureCollection (points, lines, polygons). */
  data: GeoJSON.FeatureCollection;
  style: DataLayerStyle;
}

/** XYZ raster tile overlay, e.g. a georeferenced historical map. */
export interface TileOverlay {
  id: ID;
  name: string;
  url: string; // https://…/{z}/{x}/{y}.png
  opacity: number;
  visible: boolean;
  start?: number;
  end?: number;
}

/** A single image pinned to four corners (top-left, top-right, bottom-right, bottom-left). */
export interface ImageOverlay {
  id: ID;
  name: string;
  url: string; // data: URL or https URL
  corners: [LonLat, LonLat, LonLat, LonLat];
  opacity: number;
  visible: boolean;
  start?: number;
  end?: number;
}

/** Named period shown as a band on the timeline (campaign, dynasty, war…). */
export interface Era {
  id: ID;
  name: string;
  start: number;
  end: number;
  color: string;
}

/** Multiple-choice check for understanding attached to a story step. */
export interface StoryQuestion {
  prompt: string;
  choices: string[];
  /** Index of the correct choice. */
  answer: number;
  /** Shown after answering. */
  explain?: string;
  /** "Find it on the map" question: the student clicks the map; correct within radiusKm of this point. */
  locate?: LonLat;
  radiusKm?: number;
}

/** One chapter of a guided lesson: a moment in time, a camera view and some text. */
export interface StoryStep {
  id: ID;
  title: string;
  /** Short paragraph(s). Supports **bold**, *italic* and blank-line paragraphs. */
  text: string;
  t: number;
  /** Optional end of the step's time window (the guided player plays from t to end). */
  end?: number;
  view?: { center: LonLat; zoom: number; bearing?: number; pitch?: number };
  question?: StoryQuestion;
  /** Optional image URL (illustration, primary source). */
  image?: string;
  imageCaption?: string;
}

export interface ScenarioMeta {
  title: string;
  description?: string;
  author?: string;
  start: number;
  end: number;
  /** Default playback speed in years per second. */
  speed?: number;
  /** Event marker lifetime in years. */
  eventDuration?: number;
  /** H3 resolution used for territory cells. */
  h3Resolution: number;
  /** Preferred basemap id. */
  basemap?: string;
  /** Initial view. */
  view?: { center: LonLat; zoom: number; bearing?: number; pitch?: number };
  /** Hours ahead of UTC that scenario times are expressed in (day/night shading). */
  utcOffsetHours?: number;
  /** Display settings applied when the scenario loads (e.g. night shading for a battle). */
  settings?: Record<string, unknown>;
  /** Sources / further reading shown to students. */
  sources?: string[];
  /** Intended audience, e.g. "Grade 9 World History". */
  audience?: string;
}

export interface Scenario {
  version: 1;
  meta: ScenarioMeta;
  factions: Faction[];
  cells: CellEvent[];
  countries: CountryEvent[];
  units: Unit[];
  routes: Route[];
  events: MapEvent[];
  annotations: Annotation[];
  flows: Flow[];
  regions: Region[];
  camera: CameraKey[];
  bookmarks: Bookmark[];
  layers: DataLayer[];
  tileOverlays: TileOverlay[];
  images: ImageOverlay[];
  eras: Era[];
  story: StoryStep[];
}

let idCounter = 0;
export function uid(prefix = 'id'): ID {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyScenario(partial: Partial<ScenarioMeta> = {}): Scenario {
  return {
    version: 1,
    meta: {
      title: 'Untitled scenario',
      start: 1900,
      end: 2000,
      speed: 2,
      eventDuration: 2,
      h3Resolution: 3,
      ...partial,
    },
    factions: [
      { id: 'f_red', name: 'Red', color: paletteColor(0) },
      { id: 'f_blue', name: 'Blue', color: paletteColor(3) },
    ],
    cells: [],
    countries: [],
    units: [],
    routes: [],
    events: [],
    annotations: [],
    flows: [],
    regions: [],
    camera: [],
    bookmarks: [],
    layers: [],
    tileOverlays: [],
    images: [],
    eras: [],
    story: [],
  };
}

export function defaultDataStyle(partial: Partial<DataLayerStyle> = {}): DataLayerStyle {
  return { render: 'auto', color: '#ffb300', radius: 4, opacity: 0.85, ramp: 'inferno', timeWindow: 0, ...partial };
}

/** Fill in missing fields so older / hand-written files load safely. */
export function normalizeScenario(input: any): Scenario {
  if (!input || typeof input !== 'object') throw new Error('Scenario must be an object');
  const base = emptyScenario();
  const s: Scenario = {
    ...base,
    ...input,
    version: 1,
    meta: { ...base.meta, ...(input.meta ?? {}) },
  };
  for (const k of ['factions', 'cells', 'countries', 'units', 'routes', 'events', 'annotations', 'flows', 'regions', 'camera', 'bookmarks', 'layers', 'tileOverlays', 'images', 'eras', 'story'] as const) {
    if (!Array.isArray((s as any)[k])) (s as any)[k] = [];
  }
  if (input.factions === undefined) s.factions = base.factions;
  s.factions.forEach((f, i) => {
    f.id ??= uid('f');
    f.color ??= paletteColor(i);
    f.name ??= `Faction ${i + 1}`;
  });
  for (const arr of [s.units, s.routes, s.events, s.annotations, s.flows, s.regions, s.bookmarks, s.layers, s.tileOverlays, s.images, s.eras, s.story] as { id?: string }[][]) {
    for (const x of arr) x.id ??= uid();
  }
  s.units.forEach((u) => u.path.sort((a, b) => a[2] - b[2]));
  s.layers.forEach((l) => (l.style = defaultDataStyle(l.style)));
  s.camera.sort((a, b) => a.t - b.t);
  s.story.sort((a, b) => a.t - b.t);
  if (!(s.meta.end > s.meta.start)) s.meta.end = s.meta.start + 1;
  return s;
}
