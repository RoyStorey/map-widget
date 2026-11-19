import maplibregl, { type Map as MLMap, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';

import { Emitter } from '../core/emitter';
import { History } from '../core/history';
import { OwnershipTimeline, upperBound } from '../core/ownership';
import { TerritoryEngine } from '../core/territory';
import { loadWorld, type WorldData } from '../core/world';
import { BASEMAPS, getBasemap, TERRAIN_SOURCE } from '../core/basemaps';
import { cameraAt } from '../core/camera';
import { hexToRgb, type RGB } from '../core/color';
import { positionAtTime, type LonLat } from '../core/geo';
import {
  defaultDataStyle,
  emptyScenario,
  normalizeScenario,
  uid,
  type Annotation,
  type CameraKey,
  type CellEvent,
  type CountryEvent,
  type DataLayer,
  type Faction,
  type Flow,
  type MapEvent,
  type Region,
  type Route,
  type Scenario,
  type Unit,
} from '../core/scenario';
import { paletteColor } from '../core/color';
import { polygonCells, waveEvents } from '../core/conquest';
import { isLand, loadLandMask } from '../core/landmask';
import { seaRouteVia } from '../core/h3client';
import { cellToLatLng } from 'h3-js';
import { formatTime, precisionForSpan } from '../core/time';
import { loadSettings, saveSettings, type Settings } from './settings';
import { buildLayers, cellAreaKm2 } from '../layers/build';
import type { Tool } from '../tools/tool';
import { generateStress, type StressData } from '../layers/stress';
import { resolveDataPick } from '../layers/data';
import { LabelOverlay } from '../layers/labels';

export interface WidgetEvents {
  ready: void;
  time: number;
  play: boolean;
  speed: number;
  scenario: { keys: (keyof Scenario)[] };
  settings: Settings;
  tool: string | null;
  select: Selection | null;
  hover: HoverInfo | null;
  history: void;
  toast: { message: string; kind?: 'info' | 'success' | 'warn' | 'error'; timeout?: number };
  eventsPassed: MapEvent[];
  frame: FrameStats;
  basemap: string;
  world: WorldData;
}

export interface Selection {
  kind: 'unit' | 'route' | 'event' | 'annotation' | 'flow' | 'region' | 'cell' | 'country' | 'data' | 'vessel';
  id: string;
  object?: any;
  position?: LonLat;
  layerId?: string;
}

export interface HoverInfo {
  x: number;
  y: number;
  html: string;
}

export interface FrameStats {
  fps: number;
  frameMs: number;
  layerMs: number;
  layers: number;
  cells: number;
  ownedCells: number;
  vessels: number;
}

export interface MapWidgetOptions {
  container: HTMLElement;
  scenario?: Scenario;
  settings?: Partial<Settings>;
  /** Persist settings to localStorage (default true). */
  persistSettings?: boolean;
  /** Initial camera (overrides scenario view). */
  view?: { center: LonLat; zoom: number; bearing?: number; pitch?: number };
}

type ScenarioKey = keyof Scenario;
const SNAPSHOT_KEYS: ScenarioKey[] = ['meta', 'factions', 'countries', 'units', 'routes', 'events', 'annotations', 'flows', 'regions', 'camera', 'bookmarks', 'tileOverlays', 'images', 'eras'];

/**
 * The map widget: a MapLibre map with an interleaved deck.gl overlay, a
 * scenario model, a playback clock and an undoable editing API. UI is
 * optional and lives in /ui – everything here is usable headless.
 */
export class MapWidget extends Emitter<WidgetEvents> {
  readonly container: HTMLElement;
  readonly map: MLMap;
  readonly overlay: MapboxOverlay;
  readonly territory = new TerritoryEngine();
  readonly countryTimeline = new OwnershipTimeline();
  readonly history: History;
  readonly labels: LabelOverlay;

  settings: Settings;
  scenario: Scenario;
  world: WorldData | null = null;

  time = 0;
  playing = false;
  speed = 1;
  /** Derived per-faction render colours. */
  factionRgb: RGB[] = [];
  factionIndex = new Map<string, number>();

  tool: Tool | null = null;
  /** Optional synthetic benchmark dataset (see layers/stress.ts). */
  stress: StressData | null = null;
  selection: Selection | null = null;
  /** Monotonic counter bumped on any scenario mutation (cache key for derived data). */
  revision = 0;
  /** Id of the first symbol layer in the basemap style so fills render beneath labels. */
  labelBeforeId: string | undefined;
  /** Ambient animation clock in seconds. */
  ambientClock = 0;
  readonly startedAt = performance.now();

  private raf = 0;
  private lastFrame = 0;
  private fpsSamples: number[] = [];
  private persistSettings: boolean;
  private styleReady = false;
  private sortedEvents: MapEvent[] = [];
  private sortedEventTimes = new Float64Array(0);
  private activeOverlayKey = '';
  private directorSuspended = false;
  private mouse: { x: number; y: number } | null = null;
  private userInteracting = false;
  private destroyed = false;
  lastStats: FrameStats = { fps: 0, frameMs: 0, layerMs: 0, layers: 0, cells: 0, ownedCells: 0, vessels: 0 };

  constructor(opts: MapWidgetOptions) {
    super();
    this.container = opts.container;
    this.persistSettings = opts.persistSettings ?? true;
    this.settings = this.persistSettings ? loadSettings(opts.settings) : loadSettings({ ...opts.settings });
    this.scenario = normalizeScenario(opts.scenario ?? emptyScenario());
    this.history = new History(150, () => this.emit('history', undefined));
    this.time = this.scenario.meta.start;
    this.speed = this.scenario.meta.speed ?? 1;

    const view = opts.view ?? this.scenario.meta.view ?? { center: [20, 25] as LonLat, zoom: 1.6 };
    const basemap = getBasemap(this.settings.basemap);
    this.map = new maplibregl.Map({
      container: this.container,
      style: basemap.build(null, { modernBorders: this.settings.modernBorders }) as StyleSpecification | string,
      center: view.center,
      zoom: view.zoom,
      bearing: view.bearing ?? 0,
      pitch: view.pitch ?? 0,
      maxPitch: 85,
      attributionControl: { compact: true },
      pixelRatio: Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio),
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: false },
      fadeDuration: 150,
      maxTileCacheZoomLevels: 6,
    } as any);
    this.map.dragRotate.enable();
    this.map.touchZoomRotate.enableRotation();
    this.map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: this.settings.distanceUnit === 'mi' ? 'imperial' : this.settings.distanceUnit === 'nm' ? 'nautical' : 'metric' }), 'bottom-left');

    this.overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
      pickingRadius: 4,
      useDevicePixels: Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio),
      onHover: (info: PickingInfo) => this.handleHover(info),
      getCursor: ({ isDragging, isHovering }: any) => this.tool?.cursor ?? (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
    } as any);
    this.map.addControl(this.overlay as any);
    this.labels = new LabelOverlay(this.map, this.settings.maxPixelRatio);

    this.map.on('style.load', () => this.onStyleLoad());
    this.map.on('click', (e) => this.handleClick(e));
    this.map.on('mousemove', (e) => {
      this.mouse = { x: e.point.x, y: e.point.y };
    });
    this.map.on('movestart', (e: any) => {
      if (e.originalEvent && this.settings.director && this.playing) {
        this.directorSuspended = true;
        this.emit('toast', { message: 'Director paused while you move the camera – press "D" to resume', kind: 'info' });
      }
    });
    this.map.on('move', () => this.requestRender());
    this.map.on('mousedown', () => (this.userInteracting = true));
    this.map.on('touchstart', () => (this.userInteracting = true));
    window.addEventListener('mouseup', () => (this.userInteracting = false));
    window.addEventListener('touchend', () => (this.userInteracting = false));

    this.rebuildDerived(['factions', 'cells', 'countries', 'events']);
    this.territory.timeline.seek(this.time);
    this.countryTimeline.seek(this.time);

    loadWorld('50m').then((world) => {
      if (this.destroyed) return;
      this.world = world;
      this.applyWorldToStyle();
      this.rebuildDerived(['countries']);
      this.emit('world', world);
      this.requestRender();
    });

    this.map.once('load', () => {
      this.emit('ready', undefined);
      this.requestRender();
    });
  }

  // ---------------------------------------------------------------- clock

  get span(): number {
    return this.scenario.meta.end - this.scenario.meta.start;
  }

  setTime(t: number, opts: { fromPlayback?: boolean } = {}): void {
    const { start, end } = this.scenario.meta;
    const nt = Math.max(start, Math.min(end, t));
    const prev = this.time;
    this.time = nt;
    this.territory.timeline.seek(nt);
    this.countryTimeline.seek(nt);
    if (opts.fromPlayback && nt > prev) this.detectPassedEvents(prev, nt);
    if (!opts.fromPlayback) this.directorSuspended = false;
    this.emit('time', nt);
    this.requestRender();
  }

  play(): void {
    if (this.playing) return;
    if (this.time >= this.scenario.meta.end) this.setTime(this.scenario.meta.start);
    this.playing = true;
    this.directorSuspended = false;
    this.lastFrame = performance.now();
    this.emit('play', true);
    this.requestRender();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.emit('play', false);
  }

  togglePlay(): void {
    this.playing ? this.pause() : this.play();
  }

  setSpeed(yearsPerSecond: number): void {
    this.speed = yearsPerSecond;
    this.emit('speed', yearsPerSecond);
  }

  /** Step to the next/previous moment where something happens. */
  stepEvent(dir: 1 | -1): void {
    const t = this.time;
    const candidates: number[] = [];
    const tl = this.territory.timeline;
    const eps = 1e-9;
    if (dir > 0) {
      const a = tl.nextEventTime(t + eps);
      if (a !== null) candidates.push(a);
      const b = this.countryTimeline.nextEventTime(t + eps);
      if (b !== null) candidates.push(b);
      const i = upperBound(this.sortedEventTimes, t + eps);
      if (i < this.sortedEventTimes.length) candidates.push(this.sortedEventTimes[i]);
      for (const k of this.scenario.camera) if (k.t > t + eps) { candidates.push(k.t); break; }
      if (candidates.length) this.setTime(Math.min(...candidates));
    } else {
      const a = tl.prevEventTime(t - eps);
      if (a !== null) candidates.push(a);
      const b = this.countryTimeline.prevEventTime(t - eps);
      if (b !== null) candidates.push(b);
      const i = upperBound(this.sortedEventTimes, t - eps) - 1;
      if (i >= 0 && this.sortedEventTimes[i] < t - eps) candidates.push(this.sortedEventTimes[i]);
      for (let k = this.scenario.camera.length - 1; k >= 0; k--) if (this.scenario.camera[k].t < t - eps) { candidates.push(this.scenario.camera[k].t); break; }
      if (candidates.length) this.setTime(Math.max(...candidates));
    }
  }

  private detectPassedEvents(t0: number, t1: number): void {
    const i0 = upperBound(this.sortedEventTimes, t0);
    const i1 = upperBound(this.sortedEventTimes, t1);
    if (i1 > i0) this.emit('eventsPassed', this.sortedEvents.slice(i0, i1));
  }

  // ---------------------------------------------------------------- render loop

  requestRender(): void {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(0.25, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    this.fpsSamples.push(now);
    while (this.fpsSamples.length && this.fpsSamples[0] < now - 1000) this.fpsSamples.shift();
    if (this.settings.ambientAnimation) this.ambientClock += dt * this.settings.vesselSpeed;

    if (this.playing) {
      let t = this.time + dt * this.speed;
      if (t >= this.scenario.meta.end) {
        if (this.settings.loop) {
          this.setTime(this.scenario.meta.start);
          t = this.scenario.meta.start;
        } else {
          this.setTime(this.scenario.meta.end, { fromPlayback: true });
          this.pause();
        }
      } else this.setTime(t, { fromPlayback: true });
    }

    this.applyCamera();
    if (this.settings.autoRotate && !this.map.isMoving() && !this.userInteracting) {
      const c = this.map.getCenter();
      this.map.jumpTo({ center: [c.lng + dt * 3, c.lat] });
    }
    this.syncTimedOverlays();

    const l0 = performance.now();
    const { layers, labels } = buildLayers(this);
    this.overlay.setProps({ layers });
    this.labels.setItems(labels);
    const layerMs = performance.now() - l0;

    this.lastStats = {
      fps: this.fpsSamples.length,
      frameMs: dt * 1000,
      layerMs,
      layers: layers.length,
      cells: this.territory.timeline.keys.length,
      ownedCells: this.territory.timeline.counts.reduce((a, b) => a + b, 0),
      vessels: this.lastStats.vessels,
    };
    this.emit('frame', this.lastStats);

    if (this.needsAnimation()) this.requestRender();
  };

  /** Whether something on screen animates without user input. */
  needsAnimation(): boolean {
    if (this.playing) return true;
    if (this.tool?.animating) return true;
    if (this.settings.autoRotate) return true;
    // set by the layer builder when something on screen moves by itself (vessels, pulses, packets)
    return this.settings.ambientAnimation && this.ambientActive;
  }

  /** True when the last frame contained ambient animation (vessels, pulsing events, flow packets). */
  ambientActive = false;

  private applyCamera(): void {
    const s = this.settings;
    if (s.followUnit) {
      const u = this.scenario.units.find((x) => x.id === s.followUnit);
      const p = u && positionAtTime(u.path, this.time, true);
      if (p) this.map.jumpTo({ center: p.pos });
      return;
    }
    if (!s.director || this.directorSuspended || !this.scenario.camera.length) return;
    const cam = cameraAt(this.scenario.camera, this.time);
    if (cam) this.map.jumpTo({ center: cam.center, zoom: cam.zoom, bearing: cam.bearing, pitch: cam.pitch });
  }

  // ---------------------------------------------------------------- settings / basemap

  updateSettings(patch: Partial<Settings>): void {
    const prev = this.settings;
    this.settings = { ...prev, ...patch };
    if (this.persistSettings) saveSettings(this.settings);
    if (patch.basemap && patch.basemap !== prev.basemap) this.setBasemap(patch.basemap);
    if (patch.projection && patch.projection !== prev.projection) this.applyProjection();
    if (patch.terrain !== undefined || patch.terrainExaggeration !== undefined || patch.hillshade !== undefined) this.applyTerrain();
    if (patch.modernBorders !== undefined && this.map.getLayer('modern-borders')) {
      this.map.setLayoutProperty('modern-borders', 'visibility', this.settings.modernBorders ? 'visible' : 'none');
    }
    if (patch.director) this.directorSuspended = false;
    this.emit('settings', this.settings);
    this.requestRender();
  }

  private setBasemap(id: string): void {
    const bm = getBasemap(id);
    this.styleReady = false;
    const style = bm.build(this.world, { modernBorders: this.settings.modernBorders });
    this.map.setStyle(style as any, { diff: false });
    this.emit('basemap', bm.id);
  }

  get basemap() {
    return getBasemap(this.settings.basemap);
  }

  get basemaps() {
    return BASEMAPS;
  }

  private onStyleLoad(): void {
    this.styleReady = true;
    this.container.style.background = this.basemap.space ?? (this.basemap.dark ? '#03050a' : '#d9e2ea');
    const layers = this.map.getStyle().layers ?? [];
    this.labelBeforeId = layers.find((l) => l.type === 'symbol')?.id;
    this.applyWorldToStyle();
    this.applyProjection();
    this.applyTerrain();
    this.activeOverlayKey = '';
    this.syncTimedOverlays();
    this.requestRender();
  }

  private applyWorldToStyle(): void {
    if (!this.world || !this.styleReady) return;
    const set = (id: string, data: any) => (this.map.getSource(id) as any)?.setData?.(data);
    set('land', this.world.land);
    set('countries', this.world.countries);
    set('borders', this.world.borders);
    set('coast', this.world.coastline);
  }

  private applyProjection(): void {
    if (!this.styleReady) return;
    try {
      (this.map as any).setProjection({ type: this.settings.projection });
    } catch (err) {
      console.warn('projection change failed', err);
    }
  }

  private applyTerrain(): void {
    if (!this.styleReady) return;
    const map = this.map;
    const s = this.settings;
    try {
      if ((s.terrain || s.hillshade) && !map.getSource('terrain-dem')) map.addSource('terrain-dem', TERRAIN_SOURCE as any);
      if (s.hillshade && !map.getSource('hillshade-dem')) map.addSource('hillshade-dem', TERRAIN_SOURCE as any);
      if (s.hillshade && !map.getLayer('hillshade')) {
        map.addLayer(
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'hillshade-dem',
            paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#1a1a1a', 'hillshade-highlight-color': '#ffffff' },
          },
          this.labelBeforeId,
        );
      } else if (!s.hillshade && map.getLayer('hillshade')) map.removeLayer('hillshade');
      map.setTerrain(s.terrain ? { source: 'terrain-dem', exaggeration: s.terrainExaggeration } : null);
    } catch (err) {
      console.warn('terrain failed', err);
    }
  }

  /** Raster tile and image overlays live in the MapLibre style (best perf + globe support). */
  private syncTimedOverlays(): void {
    if (!this.styleReady) return;
    const t = this.time;
    const active = (x: { visible: boolean; start?: number; end?: number }) =>
      x.visible && (x.start === undefined || t >= x.start) && (x.end === undefined || t <= x.end);
    const tiles = this.scenario.tileOverlays.filter(active);
    const imgs = this.scenario.images.filter(active);
    const key = tiles.map((x) => `${x.id}:${x.url}:${x.opacity}`).join('|') + '#' + imgs.map((x) => `${x.id}:${x.opacity}:${x.corners.flat().join(',')}`).join('|');
    if (key === this.activeOverlayKey) return;
    this.activeOverlayKey = key;
    const map = this.map;
    const style = map.getStyle();
    for (const l of style.layers ?? []) if (l.id.startsWith('ovl-')) map.removeLayer(l.id);
    for (const id of Object.keys(style.sources ?? {})) if (id.startsWith('ovl-')) map.removeSource(id);
    for (const o of tiles) {
      map.addSource(`ovl-${o.id}`, { type: 'raster', tiles: [o.url], tileSize: 256 });
      map.addLayer({ id: `ovl-${o.id}`, type: 'raster', source: `ovl-${o.id}`, paint: { 'raster-opacity': o.opacity } }, this.labelBeforeId);
    }
    for (const o of imgs) {
      map.addSource(`ovl-${o.id}`, { type: 'image', url: o.url, coordinates: o.corners as any });
      map.addLayer({ id: `ovl-${o.id}`, type: 'raster', source: `ovl-${o.id}`, paint: { 'raster-opacity': o.opacity, 'raster-fade-duration': 0 } }, this.labelBeforeId);
    }
  }

  // ---------------------------------------------------------------- scenario

  loadScenario(input: Scenario | unknown, opts: { keepView?: boolean } = {}): void {
    const s = normalizeScenario(input);
    this.pause();
    this.scenario = s;
    this.territory.reset();
    this.history.clear();
    this.selection = null;
    this.speed = s.meta.speed ?? Math.max(s.meta.end - s.meta.start, 1) / 60;
    this.time = s.meta.start;
    this.rebuildDerived(SNAPSHOT_KEYS.concat(['cells', 'layers']));
    this.setTime(s.meta.start);
    if (s.meta.basemap && s.meta.basemap !== this.settings.basemap) this.updateSettings({ basemap: s.meta.basemap });
    if (!opts.keepView && s.meta.view) {
      this.map.flyTo({ center: s.meta.view.center, zoom: s.meta.view.zoom, bearing: s.meta.view.bearing ?? 0, pitch: s.meta.view.pitch ?? 0, duration: 1800, essential: true });
    }
    this.emit('speed', this.speed);
    this.emit('select', null);
    this.emit('scenario', { keys: SNAPSHOT_KEYS.concat(['cells', 'layers']) });
  }

  /** Deep copy of the scenario suitable for saving. */
  exportScenario(): Scenario {
    return structuredClone(this.scenario);
  }

  /** Recompute derived structures after a mutation of the given keys. */
  rebuildDerived(keys: ScenarioKey[]): void {
    this.revision++;
    const has = (k: ScenarioKey) => keys.includes(k);
    if (has('factions')) {
      this.factionIndex = new Map(this.scenario.factions.map((f, i) => [f.id, i]));
      this.factionRgb = this.scenario.factions.map((f) => hexToRgb(f.color));
    }
    if (has('factions') || has('cells')) this.territory.rebuild(this.scenario.cells, this.scenario.factions);
    if (has('factions') || has('countries')) {
      this.countryTimeline.build(
        this.scenario.countries.map((e) => ({ key: e.country, t: e.t, owner: e.faction ? this.factionIndex.get(e.faction) ?? -1 : -1 })),
        this.scenario.factions.length,
        this.world?.list.map((c) => c.id) ?? [],
      );
    }
    if (has('events')) {
      this.sortedEvents = [...this.scenario.events].sort((a, b) => a.t - b.t);
      this.sortedEventTimes = Float64Array.from(this.sortedEvents.map((e) => e.t));
    }
    if (has('tileOverlays') || has('images')) this.activeOverlayKey = '';
    this.territory.timeline.seek(this.time);
    this.countryTimeline.seek(this.time);
    this.requestRender();
  }

  /**
   * Run an undoable mutation. `keys` are the scenario collections that the
   * mutator touches; they are snapshotted before/after (cheap for everything
   * except cells and data layers which have their own delta-based APIs).
   */
  commit(label: string, keys: ScenarioKey[], mutator: (s: Scenario) => void): void {
    const snap = (): Partial<Scenario> => {
      const out: any = {};
      for (const k of keys) {
        if (k === 'layers') out.layers = this.scenario.layers.map((l) => ({ ...l, style: { ...l.style } }));
        else out[k] = structuredClone(this.scenario[k]);
      }
      return out;
    };
    const before = snap();
    mutator(this.scenario);
    if (keys.includes('camera')) this.scenario.camera.sort((a, b) => a.t - b.t);
    const after = snap();
    const apply = (state: Partial<Scenario>) => {
      for (const k of keys) {
        (this.scenario as any)[k] = k === 'layers' ? (state as any).layers.map((l: any) => ({ ...l, style: { ...l.style } })) : structuredClone((state as any)[k]);
      }
      this.changed(keys);
    };
    this.history.push({ label, undo: () => apply(before), redo: () => apply(after) });
    this.changed(keys);
  }

  /** Notify that scenario collections changed (non-undoable path). */
  changed(keys: ScenarioKey[]): void {
    this.rebuildDerived(keys);
    this.emit('scenario', { keys });
  }

  // ---------------------------------------------------------------- territory editing (delta undo)

  addCellEvents(events: CellEvent[], label = 'Paint territory'): void {
    if (!events.length) return;
    const added = new Set(events);
    const apply = () => {
      this.scenario.cells.push(...events);
      this.changed(['cells']);
    };
    const revert = () => {
      this.scenario.cells = this.scenario.cells.filter((e) => !added.has(e));
      this.changed(['cells']);
    };
    apply();
    this.history.push({ label, undo: revert, redo: apply });
  }

  /** Set cells to a faction (or null to clear) at time t. */
  paintCells(cells: Iterable<string>, faction: string | null, t = this.time, label?: string): void {
    const evs: CellEvent[] = [];
    const tl = this.territory.timeline;
    const fi = faction ? this.factionIndex.get(faction) ?? -1 : -1;
    for (const cell of cells) {
      const k = tl.keyIndex.get(cell);
      // skip no-op changes at the current time
      if (t === this.time && k !== undefined && tl.owner[k] === fi) continue;
      if (t === this.time && k === undefined && fi === -1) continue;
      evs.push({ cell, t, faction });
    }
    this.addCellEvents(evs, label ?? (faction ? 'Paint territory' : 'Erase territory'));
  }

  setCountryOwner(country: string, faction: string | null, t = this.time): void {
    this.commit(faction ? 'Assign country' : 'Release country', ['countries'], (s) => {
      s.countries.push({ country, t, faction } as CountryEvent);
    });
  }

  clearTerritoryAfter(t: number): void {
    const before = this.scenario.cells;
    const after = before.filter((e) => e.t <= t);
    const apply = (v: CellEvent[]) => () => {
      this.scenario.cells = v;
      this.changed(['cells']);
    };
    apply(after)();
    this.history.push({ label: 'Clear future territory', undo: apply(before), redo: apply(after) });
  }

  clearAllTerritory(): void {
    const before = this.scenario.cells;
    const apply = (v: CellEvent[]) => () => {
      this.scenario.cells = v;
      this.changed(['cells']);
    };
    apply([])();
    this.history.push({ label: 'Clear territory', undo: apply(before), redo: apply([]) });
  }

  undo(): void {
    const l = this.history.undo();
    this.emit('toast', { message: l ? `Undo: ${l}` : 'Nothing to undo', kind: 'info', timeout: 1200 });
  }

  redo(): void {
    const l = this.history.redo();
    this.emit('toast', { message: l ? `Redo: ${l}` : 'Nothing to redo', kind: 'info', timeout: 1200 });
  }

  /** Territory area (km²) per faction at the current time: H3 cells + whole countries. */
  factionAreas(): Float64Array {
    const n = this.scenario.factions.length;
    const out = new Float64Array(n);
    const cellA = cellAreaKm2(this.scenario.meta.h3Resolution);
    const tc = this.territory.timeline.counts;
    for (let i = 0; i < n; i++) out[i] = (tc[i] ?? 0) * cellA;
    if (this.world && this.scenario.countries.length) {
      const ct = this.countryTimeline;
      for (let k = 0; k < ct.owner.length; k++) {
        const o = ct.owner[k];
        if (o >= 0 && o < n) out[o] += this.world.byId.get(ct.keys[k])?.areaKm2 ?? 0;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- convenience API (all undoable)

  addFaction(f: Partial<Faction> & { name: string }): string {
    const id = f.id ?? uid('f');
    this.commit('Add faction', ['factions'], (s) => s.factions.push({ color: paletteColor(s.factions.length), ...f, id }));
    return id;
  }

  addUnit(u: Omit<Unit, 'id'> & { id?: string }): string {
    const id = u.id ?? uid('u');
    this.commit('Add unit', ['units'], (s) => s.units.push({ ...u, id, path: [...u.path].sort((a, b) => a[2] - b[2]) }));
    return id;
  }

  addRoute(r: Omit<Route, 'id' | 'color' | 'vessels' | 'speedKnots' | 'volume'> & Partial<Route>): string {
    const id = r.id ?? uid('rt');
    this.commit('Add route', ['routes'], (s) => s.routes.push({ color: '#4dabf7', vessels: 30, speedKnots: 16, volume: 4, ...r, id }));
    return id;
  }

  addEvent(e: Omit<MapEvent, 'id' | 'kind'> & Partial<MapEvent>): string {
    const id = e.id ?? uid('e');
    this.commit('Add event', ['events'], (s) => s.events.push({ kind: 'note', ...e, id }));
    return id;
  }

  addLabel(a: Omit<Annotation, 'id'> & { id?: string }): string {
    const id = a.id ?? uid('a');
    this.commit('Add label', ['annotations'], (s) => s.annotations.push({ ...a, id }));
    return id;
  }

  addFlow(f: Omit<Flow, 'id'> & { id?: string }): string {
    const id = f.id ?? uid('fl');
    this.commit('Add flow', ['flows'], (s) => s.flows.push({ ...f, id }));
    return id;
  }

  addRegion(r: Omit<Region, 'id'> & { id?: string }): string {
    const id = r.id ?? uid('r');
    this.commit('Add region', ['regions'], (s) => s.regions.push({ ...r, id }));
    return id;
  }

  addDataLayer(name: string, data: GeoJSON.FeatureCollection, style: Partial<DataLayer['style']> = {}): string {
    const id = uid('dl');
    this.commit('Add data layer', ['layers'], (s) => s.layers.push({ id, name, visible: true, data, style: defaultDataStyle(style) }));
    return id;
  }

  remove(kind: 'units' | 'routes' | 'events' | 'annotations' | 'flows' | 'regions' | 'layers' | 'bookmarks', id: string): void {
    this.commit(`Remove ${kind}`, [kind], (s) => ((s as any)[kind] = (s as any)[kind].filter((x: { id: string }) => x.id !== id)));
  }

  /**
   * Conquer a polygon progressively: cells flip to `faction` between start and
   * end, spreading from `origin` (default: first vertex).
   */
  async conquer(rings: LonLat[][], faction: string | null, start: number, end: number, opts: { origin?: LonLat; jitter?: number; landOnly?: boolean } = {}): Promise<number> {
    const res = this.scenario.meta.h3Resolution;
    let cells = polygonCells(rings, res);
    if (opts.landOnly !== false) {
      await loadLandMask();
      cells = cells.filter((c) => {
        const [lat, lon] = cellToLatLng(c);
        return isLand(lon, lat);
      });
    }
    const evs = waveEvents(cells, opts.origin ?? rings[0][0], start, end, faction, { jitter: opts.jitter ?? 0.25, seed: Math.floor(Math.random() * 1e6) });
    this.addCellEvents(evs, 'Conquer region');
    return evs.length;
  }

  /** Assign whole countries (ISO numeric id or name) to a faction from time t. */
  setCountries(countries: string[], faction: string | null, t = this.time): void {
    const ids = countries.map((c) => this.world?.list.find((x) => x.id === c || x.name.toLowerCase() === c.toLowerCase())?.id ?? c);
    this.commit('Assign countries', ['countries'], (s) => {
      for (const country of ids) s.countries.push({ country, t, faction });
    });
  }

  /**
   * Apply a "who controlled what, when" table. Factions are matched by id or
   * name and created if missing; countries by Natural Earth id or name.
   */
  applyTerritoryTable(table: { countries: { country: string; t: number; faction: string }[]; cells: { cell: string; t: number; faction: string }[] }): { factions: number; countries: number; cells: number; unknown: string[] } {
    const byName = new Map(this.scenario.factions.flatMap((f) => [[f.id.toLowerCase(), f.id], [f.name.toLowerCase(), f.id]] as [string, string][]));
    const created: Faction[] = [];
    const resolve = (name: string): string | null => {
      if (!name || /^(none|null|-|unclaimed|free|independent)$/i.test(name)) return null;
      const k = name.toLowerCase();
      let id = byName.get(k);
      if (!id) {
        id = uid('f');
        created.push({ id, name, color: paletteColor(this.scenario.factions.length + created.length) });
        byName.set(k, id);
      }
      return id;
    };
    const unknown = new Set<string>();
    const countryEvents: CountryEvent[] = [];
    for (const r of table.countries) {
      const c = this.world?.list.find((x) => x.id === r.country || x.id === r.country.padStart(3, '0') || x.name.toLowerCase() === r.country.toLowerCase());
      if (!c) { unknown.add(r.country); continue; }
      countryEvents.push({ country: c.id, t: r.t, faction: resolve(r.faction) });
    }
    const cellEvents: CellEvent[] = table.cells.map((r) => ({ cell: r.cell, t: r.t, faction: resolve(r.faction) }));
    this.commit('Import territory table', ['factions', 'countries'], (s) => {
      s.factions.push(...created);
      s.countries.push(...countryEvents);
    });
    if (cellEvents.length) this.addCellEvents(cellEvents, 'Import territory cells');
    return { factions: created.length, countries: countryEvents.length, cells: cellEvents.length, unknown: [...unknown] };
  }

  /** Sea route between points (avoids land; uses major canals & straits). */
  seaRoute(points: LonLat[], opts: { polar?: boolean } = {}): Promise<LonLat[]> {
    return seaRouteVia(points, opts);
  }

  // ---------------------------------------------------------------- camera

  currentCamera(): Omit<CameraKey, 't'> {
    const c = this.map.getCenter();
    return { center: [c.lng, c.lat], zoom: this.map.getZoom(), bearing: this.map.getBearing(), pitch: this.map.getPitch() };
  }

  addCameraKey(t = this.time): void {
    const cam = this.currentCamera();
    this.commit('Add camera keyframe', ['camera'], (s) => {
      s.camera = s.camera.filter((k) => Math.abs(k.t - t) > this.span * 1e-4);
      s.camera.push({ t, ...cam });
    });
  }

  addBookmark(name?: string): void {
    const cam = this.currentCamera();
    this.commit('Add bookmark', ['bookmarks'], (s) => {
      s.bookmarks.push({ id: uid('bm'), name: name ?? `View ${s.bookmarks.length + 1}`, ...cam, t: this.time });
    });
  }

  flyTo(view: { center: LonLat; zoom?: number; bearing?: number; pitch?: number; duration?: number }): void {
    this.directorSuspended = true;
    this.map.flyTo({ center: view.center, zoom: view.zoom ?? this.map.getZoom(), bearing: view.bearing ?? this.map.getBearing(), pitch: view.pitch ?? this.map.getPitch(), duration: view.duration ?? 1600, essential: true });
  }

  fitBounds(b: [number, number, number, number], padding = 60): void {
    this.directorSuspended = true;
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding, duration: 1400, maxZoom: 9 });
  }

  // ---------------------------------------------------------------- tools & picking

  setTool(tool: Tool | null): void {
    if (this.tool === tool) return;
    this.tool?.deactivate();
    this.tool = tool;
    tool?.activate(this);
    this.map.getCanvas().style.cursor = tool?.cursor ?? '';
    this.emit('tool', tool?.id ?? null);
    this.requestRender();
  }

  pick(x: number, y: number, layerIds?: string[], radius = 4): PickingInfo | null {
    try {
      return this.overlay.pickObject({ x, y, radius, layerIds }) as PickingInfo | null;
    } catch {
      return null;
    }
  }

  select(sel: Selection | null): void {
    this.selection = sel;
    this.emit('select', sel);
    this.requestRender();
  }

  private handleHover(info: PickingInfo): void {
    if (this.tool?.suppressHover) return;
    const html = info.picked ? describePick(this, info, true) : null;
    this.emit('hover', html ? { x: info.x, y: info.y, html } : null);
  }

  private handleClick(e: maplibregl.MapMouseEvent): void {
    if (this.tool) return; // tools handle their own clicks
    const info = this.pick(e.point.x, e.point.y);
    const sel = info?.picked ? selectionFromPick(this, info) : null;
    if (sel) {
      this.select(sel);
      return;
    }
    // fall back: territory / country under cursor
    this.select(null);
  }

  getMouse() {
    return this.mouse;
  }

  /** Load N synthetic points for benchmarking (0 clears). */
  setStress(n: number, mode: StressData['mode'] = 'points'): void {
    this.stress = n > 0 ? { ...generateStress(n, this.span), mode } : null;
    this.emit('toast', { message: n > 0 ? `Stress test: ${n.toLocaleString()} points (${mode})` : 'Stress test cleared', kind: 'info' });
    this.requestRender();
  }

  // ---------------------------------------------------------------- export helpers

  /** Capture the current frame as a PNG data URL (optionally at a higher pixel ratio). */
  async screenshot(scale = 1): Promise<string> {
    const prev = this.map.getPixelRatio();
    if (scale !== 1) {
      this.map.setPixelRatio(prev * scale);
      await new Promise((r) => setTimeout(r, 400)); // let tiles at the new resolution settle
    }
    const url = await new Promise<string>((resolve) => {
      this.map.once('render', () => resolve(this.map.getCanvas().toDataURL('image/png')));
      this.map.triggerRepaint();
    });
    if (scale !== 1) this.map.setPixelRatio(prev);
    return url;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.tool?.deactivate();
    this.map.remove();
  }

  /** Layers contributed by the active tool (previews, cursors). */
  toolLayers(): Layer[] {
    return this.tool?.layers?.() ?? [];
  }
}

// ---------------------------------------------------------------- picking descriptions

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function selectionFromPick(w: MapWidget, info: PickingInfo): Selection | null {
  const id = info.layer?.id ?? '';
  const o: any = info.object;
  const pos = info.coordinate ? ([info.coordinate[0], info.coordinate[1]] as LonLat) : undefined;
  if (id.startsWith('units') && o) return { kind: 'unit', id: o.id ?? o.unit?.id, object: o.unit ?? o, position: pos, layerId: id };
  if (id === 'routes' && o) return { kind: 'route', id: o.id, object: o, position: pos, layerId: id };
  if (id === 'vessels') return { kind: 'vessel', id: String(info.index), position: pos, layerId: id };
  if (id.startsWith('events') && o) return { kind: 'event', id: o.id, object: o, position: pos, layerId: id };
  if (id === 'annotations' && o) return { kind: 'annotation', id: o.id, object: o, position: pos, layerId: id };
  if (id === 'flows' && o) return { kind: 'flow', id: o.id, object: o, position: pos, layerId: id };
  if (id === 'regions' && o) return { kind: 'region', id: o.id, object: o, position: pos, layerId: id };
  if (id === 'territory') return { kind: 'cell', id: w.territory.timeline.keys[info.index], position: pos, layerId: id };
  if (id === 'countries' && o) return { kind: 'country', id: String(o.id ?? o.properties?.id), object: o, position: pos, layerId: id };
  if (id.startsWith('data-')) {
    const f = resolveDataPick(w, info);
    return { kind: 'data', id: `${id}:${info.index}`, object: f ?? o, position: pos, layerId: id };
  }
  return null;
}

export function describePick(w: MapWidget, info: PickingInfo, short = false): string | null {
  const sel = selectionFromPick(w, info);
  if (!sel) return null;
  const prec = precisionForSpan(w.span);
  const fname = (fid?: string | null) => {
    const f = fid ? w.scenario.factions.find((x) => x.id === fid) : undefined;
    return f ? `<span class="swatch" style="background:${f.color}"></span>${esc(f.name)}` : '<i>unclaimed</i>';
  };
  const o: any = sel.object;
  switch (sel.kind) {
    case 'unit':
      return `<b>${esc(o.name)}</b><br>${fname(o.faction)}${o.strength ? ` · ${o.strength.toLocaleString()} strong` : ''}<br><small>${formatTime(o.path[0][2], prec)} → ${formatTime(o.path[o.path.length - 1][2], prec)}</small>`;
    case 'route':
      return `<b>${esc(o.name)}</b><br><small>${o.vessels} vessels · volume ${o.volume}</small>${o.description && !short ? `<br>${esc(o.description)}` : ''}`;
    case 'vessel':
      return `<b>Vessel #${esc(sel.id)}</b>`;
    case 'event':
      return `<b>${esc(o.title)}</b><br><small>${esc(o.kind)} · ${formatTime(o.t, prec)}</small>${o.description ? `<br>${esc(short ? String(o.description).slice(0, 140) : o.description)}` : ''}`;
    case 'annotation':
      return `<b>${esc(o.text)}</b>`;
    case 'flow':
      return `<b>${esc(o.label ?? 'Flow')}</b><br><small>value ${o.value}</small>`;
    case 'region':
      return `<b>${esc(o.name)}</b><br>${fname(o.faction)}`;
    case 'cell': {
      const k = w.territory.timeline.keyIndex.get(sel.id);
      const owner = k !== undefined ? w.territory.timeline.owner[k] : -1;
      const f = owner >= 0 ? w.scenario.factions[owner] : undefined;
      if (owner < 0) return null;
      const since = k !== undefined ? w.territory.timeline.changedAt[k] : -Infinity;
      return `${fname(f?.id)}${Number.isFinite(since) ? `<br><small>since ${formatTime(since, prec)}</small>` : ''}<br><small class="muted">cell ${esc(sel.id)}</small>`;
    }
    case 'country': {
      const k = w.countryTimeline.keyIndex.get(sel.id);
      const owner = k !== undefined ? w.countryTimeline.owner[k] : -1;
      const f = owner >= 0 ? w.scenario.factions[owner] : undefined;
      return `<b>${esc(o.properties?.name)}</b><br>${fname(f?.id)}`;
    }
    case 'data': {
      const props = o?.properties ?? o ?? {};
      const entries = Object.entries(props).filter(([, v]) => typeof v !== 'object').slice(0, short ? 6 : 40);
      if (!entries.length) return null;
      return entries.map(([k, v]) => `<small class="muted">${esc(k)}</small> ${esc(v)}`).join('<br>');
    }
  }
  return null;
}
