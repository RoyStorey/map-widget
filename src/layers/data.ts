import type { Layer, PickingInfo } from '@deck.gl/core';
import { ArcLayer, GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { LabelItem } from './labels';
import { TripsLayer } from '@deck.gl/geo-layers';
import { GridLayer, HeatmapLayer, HexagonLayer, ScreenGridLayer } from '@deck.gl/aggregation-layers';
import { DataFilterExtension } from '@deck.gl/extensions';

import type { MapWidget } from '../widget/MapWidget';
import type { DataLayer } from '../core/scenario';
import { hexToRgb, paletteColor, rampColors, type RGB } from '../core/color';
import { parseTime } from '../core/time';

const filter1 = new DataFilterExtension({ filterSize: 1 });
const BIG = 1e7;

/** Columnar, render-ready version of a data layer's GeoJSON. */
export interface Prepared {
  n: number;
  positions: Float32Array;
  times: Float64Array | null;
  weights: Float32Array | null;
  featureIndex: Int32Array;
  catColors: Uint8Array | null;
  categories: Map<string, RGB>;
  lines: GeoJSON.Feature[];
  others: GeoJSON.Feature[];
  timeExtent: [number, number] | null;
  weightMax: number;
  key: string;
  relTimes?: { origin: number; arr: Float32Array };
  filterCache?: { bucket: string; idx: Uint32Array };
}

const prepCache = new WeakMap<DataLayer['data'], Prepared>();

export function prepare(layer: DataLayer): Prepared {
  const st = layer.style;
  const key = `${st.timeField}|${st.weightField}|${st.colorField}`;
  let p = prepCache.get(layer.data);
  if (p && p.key === key) return p;
  const feats = layer.data.features;
  let n = 0;
  for (const f of feats) {
    if (f.geometry?.type === 'Point') n++;
    else if (f.geometry?.type === 'MultiPoint') n += f.geometry.coordinates.length;
  }
  const positions = new Float32Array(n * 2);
  const times = st.timeField ? new Float64Array(n) : null;
  const weights = st.weightField ? new Float32Array(n) : null;
  const featureIndex = new Int32Array(n);
  const catColors = st.colorField ? new Uint8Array(n * 4) : null;
  const categories = new Map<string, RGB>();
  const lines: GeoJSON.Feature[] = [];
  const others: GeoJSON.Feature[] = [];
  let k = 0;
  let tMin = Infinity, tMax = -Infinity, wMax = 0;
  const catColor = (v: unknown): RGB => {
    const key = String(v);
    let c = categories.get(key);
    if (!c) categories.set(key, (c = hexToRgb(paletteColor(categories.size))));
    return c;
  };
  feats.forEach((f, fi) => {
    const g = f.geometry;
    if (!g) return;
    const props = (f.properties ?? {}) as Record<string, any>;
    const pts = g.type === 'Point' ? [g.coordinates] : g.type === 'MultiPoint' ? g.coordinates : null;
    if (!pts) {
      if (g.type === 'LineString' || g.type === 'MultiLineString') lines.push(f);
      others.push(f);
      if (st.timeField) {
        const tv = parseTime(props[st.timeField]);
        if (tv !== null) { tMin = Math.min(tMin, tv); tMax = Math.max(tMax, tv); }
      }
      return;
    }
    const tv = st.timeField ? parseTime(props[st.timeField]) : null;
    const wv = st.weightField ? Number(props[st.weightField]) || 0 : 1;
    const cc = st.colorField ? catColor(props[st.colorField]) : null;
    for (const c of pts) {
      positions[k * 2] = c[0];
      positions[k * 2 + 1] = c[1];
      featureIndex[k] = fi;
      if (times) {
        times[k] = tv ?? NaN;
        if (tv !== null) { tMin = Math.min(tMin, tv); tMax = Math.max(tMax, tv); }
      }
      if (weights) { weights[k] = wv; wMax = Math.max(wMax, wv); }
      if (catColors && cc) {
        catColors[k * 4] = cc[0]; catColors[k * 4 + 1] = cc[1]; catColors[k * 4 + 2] = cc[2]; catColors[k * 4 + 3] = 255;
      }
      k++;
    }
  });
  p = {
    n: k, positions, times, weights, featureIndex, catColors, categories, lines, others,
    timeExtent: Number.isFinite(tMin) ? [tMin, tMax] : null,
    weightMax: wMax || 1, key,
  };
  prepCache.set(layer.data, p);
  return p;
}

function relTimes(p: Prepared, origin: number): Float32Array | null {
  if (!p.times) return null;
  if (p.relTimes?.origin === origin) return p.relTimes.arr;
  const arr = new Float32Array(p.n);
  for (let i = 0; i < p.n; i++) arr[i] = Number.isNaN(p.times[i]) ? -BIG : p.times[i] - origin;
  p.relTimes = { origin, arr };
  return arr;
}

/** CPU time filtering for aggregation layers, bucketed so it only recomputes ~100x over the timeline. */
function filteredIndices(p: Prepared, layer: DataLayer, w: MapWidget): Uint32Array | null {
  if (!p.times) return null;
  const span = w.span;
  const step = span / 150;
  const bt = Math.floor(w.time / step) * step;
  const bucket = `${bt}|${layer.style.timeWindow}`;
  if (p.filterCache?.bucket === bucket) return p.filterCache.idx;
  const lo = layer.style.timeWindow > 0 ? bt - layer.style.timeWindow : -Infinity;
  const out = new Uint32Array(p.n);
  let m = 0;
  for (let i = 0; i < p.n; i++) {
    const tv = p.times[i];
    if (tv <= bt && tv >= lo) out[m++] = i;
  }
  const idx = out.slice(0, m);
  p.filterCache = { bucket, idx };
  return idx;
}

export function buildDataLayers(w: MapWidget, beforeId: string | undefined, labels: LabelItem[]): Layer[] {
  const out: Layer[] = [];
  const origin = w.scenario.meta.start;
  const rt = w.time - origin;
  for (const dl of w.scenario.layers) {
    if (!dl.visible) continue;
    const st = dl.style;
    const p = prepare(dl);
    const color = hexToRgb(st.color);
    const alpha = Math.round(st.opacity * 255);
    const ramp = rampColors(st.ramp);
    const timeRange = [st.timeWindow > 0 ? rt - st.timeWindow : -BIG * 2, rt];
    let render = st.render === 'auto' ? (p.n > 0 ? 'scatter' : p.lines.length && p.lines.every((f) => hasTimes(f)) ? 'trips' : 'geojson') : st.render;
    // screen-space aggregations aren't supported by deck.gl's GlobeView: fall back to glowing points
    const globeFallback = w.settings.projection === 'globe' && (render === 'heatmap' || render === 'screengrid');
    if (globeFallback) render = 'scatter';
    const id = `data-${dl.id}`;
    const rel = relTimes(p, origin);

    if (render === 'scatter' && p.n) {
      const attributes: Record<string, any> = { getPosition: { value: p.positions, size: 2 } };
      if (p.catColors) attributes.getFillColor = { value: p.catColors, size: 4, normalized: true };
      if (rel) attributes.getFilterValue = { value: rel, size: 1 };
      if (p.weights) {
        const radii = radiusCache(p, st.radius);
        attributes.getRadius = { value: radii, size: 1 };
      }
      out.push(
        new ScatterplotLayer({
          id,
          data: { length: p.n, attributes },
          getFillColor: p.catColors ? undefined : [...color, 255],
          getRadius: p.weights ? undefined : globeFallback ? Math.max(3, st.radius * 2) : st.radius,
          radiusUnits: 'pixels',
          opacity: globeFallback ? st.opacity * 0.35 : st.opacity,
          parameters: globeFallback ? { blend: true, blendColorSrcFactor: 'src-alpha', blendColorDstFactor: 'one', blendAlphaSrcFactor: 'one', blendAlphaDstFactor: 'one', depthWriteEnabled: false } : undefined,
          stroked: false,
          pickable: true,
          autoHighlight: true,
          extensions: rel ? [filter1] : [],
          filterRange: timeRange,
          filterSoftRange: st.timeWindow > 0 ? [rt - st.timeWindow * 0.5, rt] : undefined,
          updateTriggers: { getFillColor: st.color },
          beforeId,
        } as any),
      );
      if (st.labelField) dataLabels(dl, p, w, labels);
      if (p.others.length) out.push(geojsonLayer(`${id}-geo`, dl, { features: p.others.filter((f) => f.geometry.type !== 'Point') }, w, beforeId));
      continue;
    }
    if ((render === 'heatmap' || render === 'hexbin' || render === 'grid' || render === 'screengrid') && p.n) {
      const idx = filteredIndices(p, dl, w);
      const len = idx ? idx.length : p.n;
      const pos = p.positions;
      const tmp: [number, number] = [0, 0];
      const getPosition = idx
        ? (_: any, { index }: any) => { const i = idx[index]; tmp[0] = pos[i * 2]; tmp[1] = pos[i * 2 + 1]; return tmp; }
        : (_: any, { index }: any) => { tmp[0] = pos[index * 2]; tmp[1] = pos[index * 2 + 1]; return tmp; };
      const wts = p.weights;
      const getWeight = wts ? (idx ? (_: any, { index }: any) => wts[idx[index]] : (_: any, { index }: any) => wts[index]) : 1;
      const data = { length: len };
      const common = { id, data, getPosition, opacity: st.opacity, updateTriggers: { getPosition: idx, getWeight: idx }, pickable: render !== 'heatmap' && render !== 'screengrid' };
      if (render === 'heatmap') {
        out.push(new HeatmapLayer({ ...common, getWeight, radiusPixels: Math.max(5, st.radius * 6), colorRange: ramp, intensity: 1, threshold: 0.03, aggregation: 'SUM' } as any));
      } else if (render === 'hexbin') {
        out.push(new HexagonLayer({ ...common, getElevationWeight: getWeight, getColorWeight: getWeight, elevationAggregation: 'SUM', colorAggregation: 'SUM', radius: st.radius * 10000, colorRange: ramp, extruded: !!st.extruded, elevationScale: 120, coverage: 0.9, gpuAggregation: false } as any));
      } else if (render === 'grid') {
        out.push(new GridLayer({ ...common, getElevationWeight: getWeight, getColorWeight: getWeight, elevationAggregation: 'SUM', colorAggregation: 'SUM', cellSize: st.radius * 10000, colorRange: ramp, extruded: !!st.extruded, elevationScale: 120, coverage: 0.92 } as any));
      } else {
        out.push(new ScreenGridLayer({ ...common, getWeight, cellSizePixels: Math.max(4, st.radius * 5), colorRange: ramp, aggregation: 'SUM' } as any));
      }
      continue;
    }
    if (render === 'arcs' && p.lines.length) {
      out.push(
        new ArcLayer({
          id,
          data: p.lines,
          getSourcePosition: (f: any) => firstCoord(f),
          getTargetPosition: (f: any) => lastCoord(f),
          getSourceColor: [...color, alpha],
          getTargetColor: [...ramp[ramp.length - 1], alpha],
          getWidth: (f: any) => (st.weightField ? 1 + (Number(f.properties?.[st.weightField]) / p.weightMax) * st.radius * 3 : st.radius / 2),
          widthUnits: 'pixels',
          greatCircle: true,
          pickable: true,
          autoHighlight: true,
          ...(st.timeField ? timeFilterProps(st.timeField, origin, timeRange) : {}),
          updateTriggers: { getSourceColor: st.color, getWidth: [st.radius, st.weightField] },
        } as any),
      );
      continue;
    }
    if (render === 'trips' && p.lines.length) {
      out.push(
        new TripsLayer({
          id,
          data: p.lines.filter(hasTimes),
          getPath: (f: any) => f.geometry.coordinates.map((c: number[]) => [c[0], c[1]]),
          getTimestamps: (f: any) => featureTimes(f).map((x) => x - origin),
          getColor: p.catColors ? (f: any) => [...catOf(p, f, st.colorField), 255] : [...color, 255],
          getWidth: st.radius,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          capRounded: true,
          jointRounded: true,
          trailLength: st.timeWindow > 0 ? st.timeWindow : w.span * 0.05,
          currentTime: rt,
          fadeTrail: true,
          opacity: st.opacity,
          pickable: true,
          updateTriggers: { getTimestamps: origin, getColor: st.color },
        } as any),
      );
      continue;
    }
    out.push(geojsonLayer(id, dl, dl.data, w, beforeId));
    if (st.labelField && p.n) dataLabels(dl, p, w, labels);
  }
  return out;
}

function geojsonLayer(id: string, dl: DataLayer, data: any, w: MapWidget, beforeId?: string): Layer {
  const st = dl.style;
  const color = hexToRgb(st.color);
  const alpha = Math.round(st.opacity * 255);
  const p = prepare(dl);
  const origin = w.scenario.meta.start;
  const rt = w.time - origin;
  const getColor = st.colorField ? (f: any) => [...catOf(p, f, st.colorField), alpha] : [...color, alpha];
  const getLine = st.colorField ? (f: any) => [...catOf(p, f, st.colorField), 255] : [...color, 255];
  return new GeoJsonLayer({
    id,
    data,
    filled: true,
    stroked: true,
    getFillColor: getColor,
    getLineColor: getLine,
    getLineWidth: Math.max(1, st.radius / 2),
    lineWidthUnits: 'pixels',
    getPointRadius: st.radius,
    pointRadiusUnits: 'pixels',
    extruded: !!st.extruded,
    getElevation: (f: any) => (st.weightField ? (Number(f.properties?.[st.weightField]) || 0) * 10 : 0),
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 80],
    ...(st.timeField ? timeFilterProps(st.timeField, origin, [st.timeWindow > 0 ? rt - st.timeWindow : -BIG * 2, rt]) : {}),
    updateTriggers: { getFillColor: [st.color, st.opacity, st.colorField], getLineColor: [st.color, st.colorField], getElevation: st.weightField },
    beforeId,
  } as any);
}

function dataLabels(dl: DataLayer, p: Prepared, w: MapWidget, labels: LabelItem[]): void {
  const st = dl.style;
  const feats = dl.data.features;
  const dark = w.basemap.dark;
  const t = w.time;
  const lo = st.timeWindow > 0 ? t - st.timeWindow : -Infinity;
  // only consider points inside the current view for big datasets
  const b = w.map.getBounds();
  let count = 0;
  for (let i = 0; i < p.n && count < 3000; i++) {
    if (p.times) {
      const tv = p.times[i];
      if (!(tv <= t && tv >= lo)) continue;
    }
    const lon = p.positions[i * 2], lat = p.positions[i * 2 + 1];
    if (!b.contains([lon, lat])) continue;
    const text = feats[p.featureIndex[i]]?.properties?.[st.labelField!];
    if (text === undefined || text === null || text === '') continue;
    labels.push({ pos: [lon, lat], text: String(text), size: 11, weight: 500, color: dark ? '#fff' : '#111', halo: dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)', haloWidth: 2, offset: [0, -st.radius - 8], priority: p.weights ? p.weights[i] : 0 });
    count++;
  }
}

function timeFilterProps(field: string, origin: number, range: number[]) {
  return {
    extensions: [filter1],
    getFilterValue: (f: any) => {
      const v = parseTime(f.properties?.[field]);
      return v === null ? -BIG : v - origin;
    },
    filterRange: range,
    updateTriggers: { getFilterValue: [field, origin] },
  };
}

const radiusCacheMap = new WeakMap<Prepared, { r: number; arr: Float32Array }>();
function radiusCache(p: Prepared, r: number): Float32Array {
  const c = radiusCacheMap.get(p);
  if (c && c.r === r) return c.arr;
  const arr = new Float32Array(p.n);
  for (let i = 0; i < p.n; i++) arr[i] = 1 + Math.sqrt(Math.max(0, p.weights![i]) / p.weightMax) * r * 3;
  radiusCacheMap.set(p, { r, arr });
  return arr;
}

function catOf(p: Prepared, f: any, field?: string): RGB {
  const v = String(f.properties?.[field ?? ''] ?? '');
  let c = p.categories.get(v);
  if (!c) p.categories.set(v, (c = hexToRgb(paletteColor(p.categories.size))));
  return c;
}

function firstCoord(f: any): number[] {
  const g = f.geometry;
  return g.type === 'LineString' ? g.coordinates[0] : g.coordinates[0][0];
}
function lastCoord(f: any): number[] {
  const g = f.geometry;
  const c = g.type === 'LineString' ? g.coordinates : g.coordinates[g.coordinates.length - 1];
  return c[c.length - 1];
}

/** Per-vertex times from coordinate[2] or a `times`/`timestamps` property. */
export function featureTimes(f: any): number[] {
  const g = f.geometry;
  if (g?.type !== 'LineString') return [];
  const prop = f.properties?.times ?? f.properties?.timestamps;
  if (Array.isArray(prop) && prop.length === g.coordinates.length) return prop.map((x: any) => parseTime(x) ?? NaN);
  if (g.coordinates.every((c: number[]) => c.length >= 3)) return g.coordinates.map((c: number[]) => c[2]);
  return [];
}

function hasTimes(f: any): boolean {
  const t = featureTimes(f);
  return t.length > 1 && t.every((x) => Number.isFinite(x));
}

/** Map a pick on a binary data layer back to its source GeoJSON feature. */
export function resolveDataPick(w: MapWidget, info: PickingInfo): GeoJSON.Feature | null {
  const lid = info.layer?.id ?? '';
  if (!lid.startsWith('data-')) return null;
  if (info.object && (info.object as any).type === 'Feature') return info.object as any;
  const dl = w.scenario.layers.find((l) => lid === `data-${l.id}`);
  if (!dl || info.index < 0) return null;
  const p = prepare(dl);
  const fi = p.featureIndex[info.index];
  return dl.data.features[fi] ?? null;
}
