import type { Layer } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, SolidPolygonLayer } from '@deck.gl/layers';
import { cellToBoundary, cellToLatLng, getHexagonEdgeLengthAvg, gridDisk, latLngToCell, UNITS } from 'h3-js';
import type { MapMouseEvent } from 'maplibre-gl';

import type { MapWidget } from '../widget/MapWidget';
import type { Tool } from './tool';
import { Emitter } from '../core/emitter';
import { densifyGreatCircle, formatArea, formatDistance, haversineKm, pathLengthKm, pointInRing, ringAreaKm2, timestampPath, type LonLat } from '../core/geo';
import { hexToRgb, paletteColor } from '../core/color';
import { isLand, landMaskReady, loadLandMask } from '../core/landmask';
import { polygonCells, waveEvents } from '../core/conquest';
import { polyfillAsync, seaRouteVia } from '../core/h3client';
import { formatTime, parseTime, precisionForSpan } from '../core/time';
import { uid, type MapEvent, type Unit } from '../core/scenario';
import { modal, toast, type Field } from '../ui/dom';

// ------------------------------------------------------------------ shared tool options

export interface ToolOptions {
  faction: string | null;
  brush: number;
  landOnly: boolean;
  /** For the country tool: paint H3 cells instead of whole-country ownership. */
  countryAsCells: boolean;
}

export const toolOptions: ToolOptions = { faction: null, brush: 2, landOnly: true, countryAsCells: false };
export const toolEvents = new Emitter<{ options: ToolOptions; measure: string | null }>();

export function setToolOptions(patch: Partial<ToolOptions>): void {
  Object.assign(toolOptions, patch);
  toolEvents.emit('options', toolOptions);
}

function currentFaction(w: MapWidget): string | null {
  if (toolOptions.faction && w.factionIndex.has(toolOptions.faction)) return toolOptions.faction;
  return w.scenario.factions[0]?.id ?? null;
}

// ------------------------------------------------------------------ form helpers

export function timeField(w: MapWidget, key: string, label: string, t?: number): Field {
  return { key, label, type: 'time', value: t === undefined ? '' : formatTimeInput(w, t), hint: 'e.g. 1241, 500 BCE, 2024-03-15, Mar 1241' };
}

export function formatTimeInput(w: MapWidget, t: number): string {
  const p = precisionForSpan(w.span);
  if (p === 'year') return Number.isInteger(t) ? String(t) : t.toFixed(2);
  const d = formatTime(t, p);
  return d;
}

export function factionField(w: MapWidget, key = 'faction', value?: string | null, allowNone = true): Field {
  return {
    key,
    label: 'Faction',
    type: 'select',
    value: value ?? currentFaction(w) ?? '',
    options: [...(allowNone ? [{ value: '', label: '— none —' }] : []), ...w.scenario.factions.map((f) => ({ value: f.id, label: f.name }))],
  };
}

function parseT(v: string, fallback: number): number {
  const t = parseTime(v);
  return t === null ? fallback : t;
}

// ------------------------------------------------------------------ base classes

abstract class BaseTool implements Tool {
  abstract id: string;
  abstract name: string;
  abstract icon: string;
  shortcut?: string;
  hint?: string;
  cursor = 'crosshair';
  animating = false;
  suppressHover = true;
  protected w!: MapWidget;
  private offs: (() => void)[] = [];

  activate(w: MapWidget): void {
    this.w = w;
    const m = w.map;
    const on = (type: any, fn: (e: any) => void) => {
      m.on(type, fn);
      this.offs.push(() => m.off(type, fn));
    };
    on('mousedown', (e: MapMouseEvent) => this.onDown?.(e));
    on('mousemove', (e: MapMouseEvent) => {
      this.onMove?.(e);
      w.requestRender();
    });
    on('mouseup', (e: MapMouseEvent) => this.onUp?.(e));
    on('click', (e: MapMouseEvent) => this.onClick?.(e));
    on('dblclick', (e: MapMouseEvent) => {
      if (this.onDblClick) {
        e.preventDefault();
        this.onDblClick(e);
      }
    });
    on('contextmenu', (e: MapMouseEvent) => this.onContext?.(e));
    m.getCanvas().style.cursor = this.cursor;
    this.onActivate?.();
  }

  deactivate(): void {
    this.offs.forEach((f) => f());
    this.offs = [];
    this.onDeactivate?.();
  }

  onActivate?(): void;
  onDeactivate?(): void;
  onDown?(e: MapMouseEvent): void;
  onMove?(e: MapMouseEvent): void;
  onUp?(e: MapMouseEvent): void;
  onClick?(e: MapMouseEvent): void;
  onDblClick?(e: MapMouseEvent): void;
  onContext?(e: MapMouseEvent): void;
  onKey?(e: KeyboardEvent): boolean;
  layers?(): Layer[];
}

/** Click to add vertices, double-click / Enter to finish, Backspace to undo a vertex, Esc to cancel. */
abstract class PolyTool extends BaseTool {
  protected pts: LonLat[] = [];
  protected cursorPt: LonLat | null = null;
  protected closed = false;
  protected minPoints = 2;
  protected maxPoints = Infinity;

  onActivate() {
    this.w.map.doubleClickZoom.disable();
    this.pts = [];
  }
  onDeactivate() {
    this.w.map.doubleClickZoom.enable();
    this.pts = [];
    toolEvents.emit('measure', null);
  }
  onMove(e: MapMouseEvent) {
    this.cursorPt = [e.lngLat.lng, e.lngLat.lat];
    this.updateReadout();
  }
  onClick(e: MapMouseEvent) {
    const p: LonLat = [e.lngLat.lng, e.lngLat.lat];
    const last = this.pts[this.pts.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 1e-9 && Math.abs(last[1] - p[1]) < 1e-9) return;
    this.pts.push(p);
    if (this.pts.length >= this.maxPoints) this.finish();
    this.updateReadout();
    this.w.requestRender();
  }
  onDblClick() {
    this.finish();
  }
  onContext(e: MapMouseEvent) {
    e.preventDefault();
    this.finish();
  }
  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Enter') {
      this.finish();
      return true;
    }
    if (e.key === 'Backspace') {
      this.pts.pop();
      this.w.requestRender();
      this.updateReadout();
      return true;
    }
    if (e.key === 'Escape' && this.pts.length) {
      this.pts = [];
      this.w.requestRender();
      this.updateReadout();
      return true;
    }
    return false;
  }
  protected updateReadout(): void {}

  private async finish() {
    // double-click also fires two clicks; collapse near-duplicate trailing vertices
    while (this.pts.length >= 2) {
      const a = this.pts[this.pts.length - 1], b = this.pts[this.pts.length - 2];
      if (haversineKm(a, b) < 1e-3 * Math.max(1, 2 ** (6 - this.w.map.getZoom()))) this.pts.pop();
      else break;
    }
    if (this.pts.length < this.minPoints) {
      toast(`Add at least ${this.minPoints} point${this.minPoints > 1 ? 's' : ''}`, 'warn');
      return;
    }
    const pts = this.pts;
    this.pts = [];
    this.w.requestRender();
    await this.complete(pts);
    this.updateReadout();
    this.w.requestRender();
  }

  protected abstract complete(pts: LonLat[]): Promise<void> | void;

  protected previewColor(): [number, number, number] {
    return [255, 214, 10];
  }

  layers(): Layer[] {
    const pts = this.cursorPt ? [...this.pts, this.cursorPt] : this.pts;
    if (!pts.length) return [];
    const c = this.previewColor();
    const out: Layer[] = [];
    if (this.closed && pts.length >= 3) {
      out.push(new SolidPolygonLayer({ id: 'tool-poly', data: [pts], getPolygon: (d: LonLat[]) => d, getFillColor: [...c, 50], parameters: { depthCompare: 'always' } } as any));
    }
    const line = this.closed && pts.length >= 3 ? [...pts, pts[0]] : pts;
    out.push(
      new PathLayer({
        id: 'tool-path',
        data: [densifyGreatCircle(line, 50)],
        getPath: (d: LonLat[]) => d,
        getColor: [...c, 230],
        getWidth: 2.5,
        widthUnits: 'pixels',
        parameters: { depthCompare: 'always' },
      } as any),
      new ScatterplotLayer({
        id: 'tool-verts',
        data: this.pts,
        getPosition: (d: LonLat) => d,
        getRadius: 5,
        radiusUnits: 'pixels',
        getFillColor: [255, 255, 255, 255],
        stroked: true,
        getLineColor: [...c, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        parameters: { depthCompare: 'always' },
      } as any),
    );
    return out;
  }
}

// ------------------------------------------------------------------ territory paint / erase

export class PaintTool extends BaseTool {
  id = 'paint';
  name = 'Paint territory';
  icon = 'brush';
  shortcut = 'B';
  hint = 'Drag to paint the selected faction at the current time. Shift-drag erases. Alt-click picks a faction. [ / ] change brush size.';
  private painting = false;
  private erase = false;
  private pending = new Set<string>();
  private hover: LonLat | null = null;
  constructor(private eraseOnly = false) {
    super();
    if (eraseOnly) {
      this.id = 'erase';
      this.name = 'Erase territory';
      this.icon = 'eraser';
      this.shortcut = 'E';
      this.hint = 'Drag to clear territory from the current time onwards.';
    }
  }
  onActivate() {
    loadLandMask();
  }
  private get res() {
    return this.w.scenario.meta.h3Resolution;
  }
  onDown(e: MapMouseEvent) {
    const oe = e.originalEvent as MouseEvent;
    if (oe.button !== 0) return;
    if (oe.altKey) {
      const cell = latLngToCell(e.lngLat.lat, e.lngLat.lng, this.res);
      const k = this.w.territory.timeline.keyIndex.get(cell);
      const o = k === undefined ? -1 : this.w.territory.timeline.owner[k];
      if (o >= 0) {
        setToolOptions({ faction: this.w.scenario.factions[o].id });
        toast(`Picked ${this.w.scenario.factions[o].name}`, 'info', 1200);
      }
      return;
    }
    this.painting = true;
    this.erase = this.eraseOnly || oe.shiftKey;
    this.pending.clear();
    this.w.map.dragPan.disable();
    this.addAt([e.lngLat.lng, e.lngLat.lat]);
  }
  onMove(e: MapMouseEvent) {
    this.hover = [e.lngLat.lng, e.lngLat.lat];
    if (this.painting) this.addAt(this.hover);
  }
  onUp() {
    if (!this.painting) return;
    this.painting = false;
    this.w.map.dragPan.enable();
    const cells = [...this.pending];
    this.pending.clear();
    if (!cells.length) return;
    if (this.erase) this.w.paintCells(cells, null);
    else {
      const f = currentFaction(this.w);
      if (!f) return toast('Create a faction first', 'warn');
      this.w.paintCells(cells, f);
    }
  }
  onDeactivate() {
    this.w.map.dragPan.enable();
  }
  private lastCell = '';
  private addAt(p: LonLat) {
    const center = latLngToCell(p[1], p[0], this.res);
    if (center === this.lastCell) return;
    this.lastCell = center;
    for (const c of gridDisk(center, toolOptions.brush)) {
      if (this.pending.has(c)) continue;
      if (toolOptions.landOnly && !this.erase && landMaskReady()) {
        const [lat, lon] = cellToLatLng(c);
        if (!isLand(lon, lat)) continue;
      }
      this.pending.add(c);
    }
    this.w.requestRender();
  }
  onKey(e: KeyboardEvent) {
    if (e.key === '[') {
      setToolOptions({ brush: Math.max(0, toolOptions.brush - 1) });
      return true;
    }
    if (e.key === ']') {
      setToolOptions({ brush: Math.min(25, toolOptions.brush + 1) });
      return true;
    }
    return false;
  }
  layers(): Layer[] {
    const out: Layer[] = [];
    const f = currentFaction(this.w);
    const fi = f ? this.w.factionIndex.get(f) : undefined;
    const c = this.erase ? [255, 255, 255] : fi !== undefined ? this.w.factionRgb[fi] : [255, 255, 255];
    if (this.pending.size) {
      out.push(
        new SolidPolygonLayer({
          id: 'tool-paint',
          data: [...this.pending],
          getPolygon: (cell: string) => cellToBoundary(cell, true),
          getFillColor: [...c, this.erase ? 90 : 170],
          parameters: { depthCompare: 'always' },
          updateTriggers: { getFillColor: c.join() },
        } as any),
      );
    }
    if (this.hover) {
      const r = getHexagonEdgeLengthAvg(this.res, UNITS.m) * (toolOptions.brush * 1.5 + 1);
      out.push(
        new ScatterplotLayer({
          id: 'tool-brush',
          data: [this.hover],
          getPosition: (d: LonLat) => d,
          getRadius: r,
          radiusUnits: 'meters',
          filled: false,
          stroked: true,
          getLineColor: this.eraseOnly ? [255, 255, 255, 200] : [...c, 230],
          lineWidthUnits: 'pixels',
          getLineWidth: 2,
          parameters: { depthCompare: 'always' },
        } as any),
      );
    }
    return out;
  }
}

// ------------------------------------------------------------------ conquest wave

export class WaveTool extends PolyTool {
  id = 'wave';
  name = 'Conquest wave';
  icon = 'wave';
  shortcut = 'W';
  hint = 'Outline a region (first click = where the conquest starts). It will be conquered progressively over a time span.';
  closed = true;
  minPoints = 3;
  protected async complete(pts: LonLat[]) {
    const w = this.w;
    const span = w.span;
    const r = await modal({
      title: 'Conquest wave',
      description: 'Cells inside the outline flip to the faction over time, spreading outward from the origin with an organic front.',
      fields: [
        factionField(w, 'faction', undefined, false),
        timeField(w, 'start', 'Start', w.time),
        timeField(w, 'end', 'End', Math.min(w.scenario.meta.end, w.time + span * 0.08)),
        { key: 'origin', label: 'Spreads from', type: 'select', value: 'first', options: [{ value: 'first', label: 'First vertex' }, { value: 'centroid', label: 'Centre' }, { value: 'last', label: 'Last vertex' }] },
        { key: 'jitter', label: 'Front irregularity', type: 'range', value: 0.3, min: 0, max: 0.9, step: 0.05 },
        { key: 'landOnly', label: 'Land only', type: 'checkbox', value: true },
      ],
      submitLabel: 'Create wave',
    });
    if (!r) return;
    await loadLandMask();
    const res = w.scenario.meta.h3Resolution;
    let cells = polygonCells([pts], res);
    if (r.landOnly) cells = cells.filter((c) => {
      const [lat, lon] = cellToLatLng(c);
      return isLand(lon, lat);
    });
    const origin: LonLat = r.origin === 'centroid' ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] : r.origin === 'last' ? pts[pts.length - 1] : pts[0];
    const start = parseT(r.start, w.time), end = parseT(r.end, w.time + span * 0.08);
    const evs = waveEvents(cells, origin, start, Math.max(start, end), r.faction || null, { jitter: r.jitter, seed: Math.floor(Math.random() * 1e6) });
    w.addCellEvents(evs, 'Conquest wave');
    toast(`Conquest wave: ${evs.length.toLocaleString()} cells`, 'success');
  }
}

// ------------------------------------------------------------------ region polygon

export class RegionTool extends PolyTool {
  id = 'region';
  name = 'Draw region';
  icon = 'hexagon';
  shortcut = 'G';
  hint = 'Outline a polygon region (province, custom border, zone) with an optional lifespan.';
  closed = true;
  minPoints = 3;
  protected async complete(pts: LonLat[]) {
    const w = this.w;
    const r = await modal({
      title: 'New region',
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: `Region ${w.scenario.regions.length + 1}` },
        factionField(w),
        { key: 'color', label: 'Colour (if no faction)', type: 'color', value: paletteColor(w.scenario.regions.length + 4) },
        timeField(w, 'start', 'Appears', w.time),
        timeField(w, 'end', 'Disappears (optional)'),
        { key: 'asCells', label: 'Convert to territory cells instead', type: 'checkbox', value: false },
      ],
    });
    if (!r) return;
    if (r.asCells) {
      const cells = polygonCells([pts], w.scenario.meta.h3Resolution);
      w.paintCells(cells, r.faction || null, parseT(r.start, w.time), 'Region → territory');
      return;
    }
    w.commit('Add region', ['regions'], (s) => {
      s.regions.push({ id: uid('r'), name: r.name, faction: r.faction || undefined, color: r.color, rings: [pts], start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined });
    });
  }
}

// ------------------------------------------------------------------ units

export class UnitTool extends PolyTool {
  id = 'unit';
  name = 'Draw army / unit path';
  icon = 'army';
  shortcut = 'U';
  hint = 'Click waypoints for a march, voyage or migration. Timing is distributed by distance between start and end.';
  protected async complete(pts: LonLat[]) {
    const w = this.w;
    const km = pathLengthKm(pts);
    const r = await modal({
      title: 'New moving unit',
      description: `Path length ${formatDistance(km, w.settings.distanceUnit)}`,
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: `Army ${w.scenario.units.length + 1}` },
        factionField(w),
        { key: 'kind', label: 'Kind', type: 'select', value: 'army', options: ['army', 'fleet', 'ship', 'caravan', 'explorer', 'other'].map((v) => ({ value: v, label: v })) },
        timeField(w, 'start', 'Departs', w.time),
        timeField(w, 'end', 'Arrives', Math.min(w.scenario.meta.end, w.time + w.span * 0.05)),
        { key: 'strength', label: 'Strength (optional)', type: 'number', value: undefined, min: 0 },
        { key: 'color', label: 'Colour (if no faction)', type: 'color', value: '#ffd60a' },
      ],
    });
    if (!r) return;
    const start = parseT(r.start, w.time);
    const end = Math.max(start + 1e-6, parseT(r.end, start + w.span * 0.05));
    const unit: Unit = { id: uid('u'), name: r.name, faction: r.faction || undefined, color: r.color, kind: r.kind, path: timestampPath(pts, start, end), strength: r.strength, width: 4 };
    w.commit('Add unit', ['units'], (s) => s.units.push(unit));
  }
}

// ------------------------------------------------------------------ routes

export class RouteTool extends PolyTool {
  id = 'route';
  name = 'Draw shipping lane / route';
  icon = 'ship';
  shortcut = 'R';
  hint = 'Click ports / waypoints (Enter to finish). By default the route is auto-routed by sea between your clicks; vessels animate along it.';
  protected previewColor(): [number, number, number] {
    return [77, 171, 247];
  }
  protected async complete(pts: LonLat[]) {
    const w = this.w;
    const r = await modal({
      title: 'New route',
      description: `Length ${formatDistance(pathLengthKm(pts), w.settings.distanceUnit)}`,
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: `Route ${w.scenario.routes.length + 1}` },
        { key: 'color', label: 'Colour', type: 'color', value: '#4dabf7' },
        { key: 'vessels', label: 'Vessels', type: 'number', value: 30, min: 0, step: 1 },
        { key: 'speed', label: 'Speed (knots)', type: 'number', value: 16, min: 1 },
        { key: 'volume', label: 'Traffic volume (line width)', type: 'number', value: 4, min: 0 },
        { key: 'bidirectional', label: 'Two-way traffic', type: 'checkbox', value: true },
        { key: 'auto', label: 'Auto-route by sea between clicks (avoids land, uses canals)', type: 'checkbox', value: true },
        { key: 'polar', label: 'Allow Arctic / Antarctic waters', type: 'checkbox', value: false },
        timeField(w, 'start', 'Opens (optional)'),
        timeField(w, 'end', 'Closes (optional)'),
      ],
    });
    if (!r) return;
    let waypoints = pts;
    if (r.auto) {
      toast('Finding a sea route…', 'info', 1500);
      try {
        waypoints = await seaRouteVia(pts, { polar: r.polar });
        toast(`Sea route: ${formatDistance(pathLengthKm(waypoints), w.settings.distanceUnit)}`, 'success');
      } catch (err) {
        toast(`Auto-routing failed (${(err as Error).message}) – using straight legs`, 'warn', 4000);
      }
    }
    w.commit('Add route', ['routes'], (s) =>
      s.routes.push({ id: uid('rt'), name: r.name, color: r.color, waypoints, vessels: r.vessels ?? 30, speedKnots: r.speed ?? 16, volume: r.volume ?? 4, bidirectional: r.bidirectional, start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined }),
    );
  }
}

// ------------------------------------------------------------------ flows

export class FlowTool extends PolyTool {
  id = 'flow';
  name = 'Draw flow arc';
  icon = 'arc';
  shortcut = 'F';
  hint = 'Click origin then destination to add a trade / migration flow arc.';
  maxPoints = 2;
  protected previewColor(): [number, number, number] {
    return [255, 146, 43];
  }
  protected async complete(pts: LonLat[]) {
    const w = this.w;
    const r = await modal({
      title: 'New flow',
      fields: [
        { key: 'label', label: 'Label', type: 'text', value: '' },
        { key: 'value', label: 'Value', type: 'number', value: 10, min: 0 },
        { key: 'color', label: 'Colour', type: 'color', value: '#ff922b' },
        timeField(w, 'start', 'From (optional)'),
        timeField(w, 'end', 'Until (optional)'),
      ],
    });
    if (!r) return;
    w.commit('Add flow', ['flows'], (s) =>
      s.flows.push({ id: uid('fl'), from: pts[0], to: pts[1], value: r.value ?? 10, color: r.color, label: r.label || undefined, start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined }),
    );
  }
}

// ------------------------------------------------------------------ measure

export class MeasureTool extends PolyTool {
  id = 'measure';
  name = 'Measure distance & area';
  icon = 'ruler';
  shortcut = 'M';
  hint = 'Click to measure great-circle distance. Close the shape (click near the first point) for area. Esc clears.';
  minPoints = 99999; // never "completes"
  protected complete() {}
  onClick(e: MapMouseEvent) {
    const p: LonLat = [e.lngLat.lng, e.lngLat.lat];
    if (this.pts.length >= 3) {
      const first = this.w.map.project(this.pts[0] as any);
      if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 10) {
        this.closed = true;
        this.updateReadout();
        return;
      }
    }
    if (this.closed) {
      this.pts = [];
      this.closed = false;
    }
    this.pts.push(p);
    this.updateReadout();
    this.w.requestRender();
  }
  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.pts.length) {
      this.pts = [];
      this.closed = false;
      this.updateReadout();
      this.w.requestRender();
      return true;
    }
    if (e.key === 'Backspace') {
      this.pts.pop();
      this.closed = false;
      this.updateReadout();
      this.w.requestRender();
      return true;
    }
    return false;
  }
  protected updateReadout() {
    const pts = this.closed ? this.pts : this.cursorPt && this.pts.length ? [...this.pts, this.cursorPt] : this.pts;
    if (pts.length < 2) return toolEvents.emit('measure', this.pts.length ? 'Click to add points' : null);
    const unit = this.w.settings.distanceUnit;
    const line = this.closed ? [...pts, pts[0]] : pts;
    let txt = `Distance: ${formatDistance(pathLengthKm(line), unit)}`;
    if (this.closed) txt += ` · Area: ${formatArea(ringAreaKm2(pts))}`;
    else if (pts.length >= 2) txt += ` · last leg ${formatDistance(haversineKm(pts[pts.length - 2], pts[pts.length - 1]), unit)}`;
    toolEvents.emit('measure', txt);
  }
  layers(): Layer[] {
    const saved = this.cursorPt;
    if (this.closed) this.cursorPt = null;
    const l = super.layers();
    this.cursorPt = saved;
    return l;
  }
}

// ------------------------------------------------------------------ point tools

export class EventTool extends BaseTool {
  id = 'event';
  name = 'Add event marker';
  icon = 'zap';
  shortcut = 'V';
  hint = 'Click to place a battle, siege, founding, treaty or note at the current time.';
  async onClick(e: MapMouseEvent) {
    const w = this.w;
    const pos: LonLat = [e.lngLat.lng, e.lngLat.lat];
    const r = await modal({
      title: 'New event',
      fields: [
        { key: 'title', label: 'Title', type: 'text', value: '' },
        { key: 'kind', label: 'Kind', type: 'select', value: 'battle', options: ['battle', 'siege', 'founding', 'treaty', 'disaster', 'discovery', 'note'].map((v) => ({ value: v, label: v })) },
        timeField(w, 't', 'When', w.time),
        timeField(w, 'end', 'Visible until (optional)'),
        factionField(w),
        { key: 'description', label: 'Description', type: 'textarea', value: '' },
      ],
    });
    if (!r) return;
    const ev: MapEvent = { id: uid('e'), t: parseT(r.t, w.time), end: parseTime(r.end) ?? undefined, position: pos, title: r.title || 'Untitled event', kind: r.kind, faction: r.faction || undefined, description: r.description, zoom: w.map.getZoom() };
    w.commit('Add event', ['events'], (s) => s.events.push(ev));
  }
}

export class LabelTool extends BaseTool {
  id = 'label';
  name = 'Add map label';
  icon = 'type';
  shortcut = 'T';
  hint = 'Click to place a text label (seas, regions, notes) with an optional time window.';
  async onClick(e: MapMouseEvent) {
    const w = this.w;
    const r = await modal({
      title: 'New label',
      fields: [
        { key: 'text', label: 'Text', type: 'text', value: '' },
        { key: 'units', label: 'Sizing', type: 'select', value: 'meters', options: [{ value: 'meters', label: 'Scales with map' }, { value: 'pixels', label: 'Fixed pixel size' }] },
        { key: 'size', label: 'Size (km for map-scaled, px for fixed)', type: 'number', value: 60 },
        { key: 'color', label: 'Colour', type: 'color', value: w.basemap.dark ? '#ffffff' : '#3d3020' },
        timeField(w, 'start', 'From (optional)'),
        timeField(w, 'end', 'Until (optional)'),
      ],
    });
    if (!r || !r.text) return;
    w.commit('Add label', ['annotations'], (s) =>
      s.annotations.push({ id: uid('a'), text: r.text, position: [e.lngLat.lng, e.lngLat.lat], units: r.units, size: r.units === 'meters' ? (r.size ?? 60) * 1000 : r.size ?? 16, color: r.color, start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined }),
    );
  }
}

/** Click a country to assign it to the selected faction from the current time (Shift = release). */
export class CountryTool extends BaseTool {
  id = 'country';
  name = 'Assign country';
  icon = 'flag';
  shortcut = 'C';
  hint = 'Click a modern country to hand it to the selected faction from now on. Shift-click releases it. Toggle "as cells" in the faction bar to fill it with territory cells instead.';
  cursor = 'pointer';
  suppressHover = false;
  async onClick(e: MapMouseEvent) {
    const w = this.w;
    if (!w.world) return;
    const p: LonLat = [e.lngLat.lng, e.lngLat.lat];
    const c = findCountry(w, p);
    if (!c) return;
    const shift = (e.originalEvent as MouseEvent).shiftKey;
    const f = shift ? null : currentFaction(w);
    if (toolOptions.countryAsCells) {
      const g: any = c.feature.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      toast(`Filling ${c.name} with cells…`, 'info', 1200);
      let cells = await polyfillAsync(polys, w.scenario.meta.h3Resolution);
      if (!cells.length) {
        // tiny countries: fall back to the cell under the cursor
        cells = [latLngToCell(p[1], p[0], w.scenario.meta.h3Resolution)];
      }
      w.paintCells(cells, f, w.time, `${f ? 'Conquer' : 'Release'} ${c.name}`);
      toast(`${c.name}: ${cells.length.toLocaleString()} cells`, 'success', 1500);
    } else {
      w.setCountryOwner(c.id, f);
      const fname = f ? w.scenario.factions.find((x) => x.id === f)?.name : 'nobody';
      toast(`${c.name} → ${fname} from ${formatTime(w.time, precisionForSpan(w.span))}`, 'success', 1600);
    }
  }
}

export function findCountry(w: MapWidget, p: LonLat) {
  if (!w.world) return null;
  for (const c of w.world.list) {
    const [x0, y0, x1, y1] = c.bbox;
    for (const lon of [p[0], p[0] + 360, p[0] - 360]) {
      if (lon < x0 || lon > x1 || p[1] < y0 || p[1] > y1) continue;
      const g: any = c.feature.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const poly of polys) {
        if (pointInRing([lon, p[1]], poly[0]) && !poly.slice(1).some((h: LonLat[]) => pointInRing([lon, p[1]], h))) return c;
      }
    }
  }
  return null;
}

/** Inspect/select tool — the default (no special handling, widget click picking applies). */
export const ALL_TOOLS = (): Tool[] => [
  new PaintTool(),
  new PaintTool(true),
  new WaveTool(),
  new CountryTool(),
  new RegionTool(),
  new UnitTool(),
  new RouteTool(),
  new FlowTool(),
  new EventTool(),
  new LabelTool(),
  new MeasureTool(),
];

export { hexToRgb };
