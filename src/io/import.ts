import { feature } from 'topojson-client';
import { isMapSpec, type MapSpec } from '../spec/spec';
import { defaultDataStyle, uid, type DataLayer, type Scenario } from '../core/scenario';
import { parseTime } from '../core/time';

export interface TerritoryTable {
  /** Rows of ownership changes; `faction` is a name (created if missing) or empty for release. */
  countries: { country: string; t: number; faction: string }[];
  cells: { cell: string; t: number; faction: string }[];
}

export type ImportResult =
  | { kind: 'scenario'; scenario: Scenario }
  | { kind: 'territory'; name: string; table: TerritoryTable }
  | { kind: 'map'; spec: MapSpec }
  | { kind: 'layer'; layer: DataLayer }
  | { kind: 'image'; name: string; url: string };

/** Detect a file's type and turn it into a scenario, data layer or image overlay. */
export async function importFile(file: File): Promise<ImportResult> {
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return { kind: 'image', name, url: await readAsDataURL(file) };
  }
  const text = await file.text();
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    const rows = parseCSV(text, ext === 'tsv' ? '\t' : undefined);
    const table = rowsToTerritory(rows);
    if (table) return { kind: 'territory', name, table };
    return { kind: 'layer', layer: rowsToLayer(rows, name) };
  }
  if (ext === 'kml') return { kind: 'layer', layer: makeLayer(name, kmlToGeoJSON(text)) };
  if (ext === 'gpx') return { kind: 'layer', layer: makeLayer(name, gpxToGeoJSON(text)) };
  return importJSON(JSON.parse(text), name);
}

export function importJSON(json: any, name = 'Imported'): ImportResult {
  if (isMapSpec(json)) return { kind: 'map', spec: json };
  if (json?.version === 1 && json.meta && Array.isArray(json.factions)) return { kind: 'scenario', scenario: json };
  if (json?.type === 'Topology') {
    const objs = Object.values(json.objects ?? {});
    const features: GeoJSON.Feature[] = [];
    for (const o of objs) {
      const fc: any = feature(json, o as any);
      if (fc.type === 'FeatureCollection') features.push(...fc.features);
      else features.push(fc);
    }
    return { kind: 'layer', layer: makeLayer(name, { type: 'FeatureCollection', features }) };
  }
  if (json?.type === 'FeatureCollection') return { kind: 'layer', layer: makeLayer(name, json) };
  if (json?.type === 'Feature') return { kind: 'layer', layer: makeLayer(name, { type: 'FeatureCollection', features: [json] }) };
  if (json?.type && json.coordinates) return { kind: 'layer', layer: makeLayer(name, { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: json }] }) };
  if (Array.isArray(json) && json.length && typeof json[0] === 'object') {
    // array of records → territory table or point rows
    const table = rowsToTerritory(json);
    if (table) return { kind: 'territory', name, table };
    return { kind: 'layer', layer: rowsToLayer(json, name) };
  }
  throw new Error('Unrecognised JSON: expected a scenario, GeoJSON or TopoJSON');
}

export function makeLayer(name: string, data: GeoJSON.FeatureCollection): DataLayer {
  const style = defaultDataStyle({ color: randomColor() });
  // guess a time field
  const props = data.features.find((f) => f.properties)?.properties ?? {};
  const timeKey = Object.keys(props).find((k) => /^(time|date|year|timestamp|t|when|start|datetime)$/i.test(k));
  if (timeKey) style.timeField = timeKey;
  const nameKey = Object.keys(props).find((k) => /^(name|title|label)$/i.test(k));
  if (nameKey && data.features.length <= 2000) style.labelField = nameKey;
  const n = data.features.length;
  if (n > 50000) style.radius = 1.5;
  return { id: uid('dl'), name, visible: true, data, style };
}

function randomColor(): string {
  const colors = ['#ffb000', '#4dabf7', '#ff6b6b', '#51cf66', '#cc5de8', '#22b8cf', '#ff922b', '#f06595'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ------------------------------------------------------------------ CSV

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCSV(text: string, delim?: string): Record<string, string>[] {
  const first = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length);
  const d = delim ?? ([',', ';', '\t', '|'].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0]);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift()?.map((h) => h.trim()) ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]?.trim() ?? ''])));
}

export function csvToLayer(text: string, name: string, delim?: string): DataLayer {
  return rowsToLayer(parseCSV(text, delim), name);
}

const LAT = /^(lat|latitude|y|lat_dd|decimallatitude)$/i;
const LON = /^(lon|lng|long|longitude|x|lon_dd|decimallongitude)$/i;
const FROM_LAT = /^(from_?lat|origin_?lat|src_?lat|start_?lat|lat_?1|o_?lat)$/i;
const FROM_LON = /^(from_?lo?ng?|origin_?lo?ng?|src_?lo?ng?|start_?lo?ng?|lo?ng?_?1|o_?lo?ng?)$/i;
const TO_LAT = /^(to_?lat|dest_?lat|dst_?lat|end_?lat|lat_?2|d_?lat)$/i;
const TO_LON = /^(to_?lo?ng?|dest_?lo?ng?|dst_?lo?ng?|end_?lo?ng?|lo?ng?_?2|d_?lo?ng?)$/i;
const TRACK = /^(id|track|track_?id|vessel|mmsi|name|unit|trip_?id)$/i;
const TIME = /^(time|date|year|timestamp|t|when|datetime|base_?date_?time)$/i;

/** Tables of "who controlled what, when" → ownership events. */
export function rowsToTerritory(rows: Record<string, any>[]): TerritoryTable | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  const find = (re: RegExp) => keys.find((k) => re.test(k));
  const country = find(/^(country|iso|iso_?n3|iso_?num|country_?id|nation|state|territory|country_?name)$/i);
  const cell = find(/^(h3|cell|hex|h3_?index|h3_?cell)$/i);
  const faction = find(/^(faction|owner|empire|controller|ruler|side|polity|controlled_?by)$/i);
  const time = find(TIME);
  if (!(country || cell) || !faction || !time) return null;
  const out: TerritoryTable = { countries: [], cells: [] };
  for (const r of rows) {
    const t = parseTime(r[time]);
    if (t === null) continue;
    if (cell && r[cell]) out.cells.push({ cell: String(r[cell]).trim(), t, faction: String(r[faction] ?? '').trim() });
    else if (country && r[country]) out.countries.push({ country: String(r[country]).trim(), t, faction: String(r[faction] ?? '').trim() });
  }
  return out.cells.length + out.countries.length ? out : null;
}

function rowsToLayer(rows: Record<string, any>[], name: string): DataLayer {
  if (!rows.length) throw new Error('No rows found');
  const keys = Object.keys(rows[0]);
  const find = (re: RegExp) => keys.find((k) => re.test(k));
  const fLat = find(FROM_LAT), fLon = find(FROM_LON), tLat = find(TO_LAT), tLon = find(TO_LON);
  if (fLat && fLon && tLat && tLon) {
    const features: GeoJSON.Feature[] = rows
      .map((r) => {
        const a = [+r[fLon], +r[fLat]], b = [+r[tLon], +r[tLat]];
        if (![...a, ...b].every(Number.isFinite)) return null;
        return { type: 'Feature', properties: r, geometry: { type: 'LineString', coordinates: [a, b] } } as GeoJSON.Feature;
      })
      .filter(Boolean) as GeoJSON.Feature[];
    const layer = makeLayer(name, { type: 'FeatureCollection', features });
    layer.style.render = 'arcs';
    const w = keys.find((k) => /^(value|count|volume|weight|flow|amount)$/i.test(k));
    if (w) layer.style.weightField = w;
    return layer;
  }
  const lat = find(LAT), lon = find(LON);
  if (!lat || !lon) {
    const wkt = keys.find((k) => /^(wkt|geometry|geom|the_geom)$/i.test(k));
    if (wkt) return makeLayer(name, { type: 'FeatureCollection', features: rows.map((r) => ({ type: 'Feature', properties: r, geometry: parseWKT(r[wkt]) })).filter((f) => f.geometry) as any });
    throw new Error(`Could not find latitude/longitude columns in: ${keys.join(', ')}`);
  }
  const track = find(TRACK), time = find(TIME);
  // many rows per id + a time column → build trips
  if (track && time) {
    const groups = new Map<string, Record<string, any>[]>();
    for (const r of rows) {
      const k = String(r[track]);
      let g = groups.get(k);
      if (!g) groups.set(k, (g = []));
      g.push(r);
    }
    if (groups.size < rows.length / 3) {
      const features: GeoJSON.Feature[] = [];
      for (const [id, g] of groups) {
        const pts = g
          .map((r) => [+r[lon], +r[lat], parseTime(r[time]) ?? NaN])
          .filter((p) => p.every(Number.isFinite))
          .sort((a, b) => a[2] - b[2]);
        if (pts.length >= 2) features.push({ type: 'Feature', properties: { ...g[0], [track]: id, points: pts.length }, geometry: { type: 'LineString', coordinates: pts } });
      }
      const layer = makeLayer(name, { type: 'FeatureCollection', features });
      layer.style.render = 'trips';
      layer.style.timeField = undefined;
      layer.style.colorField = track;
      layer.style.radius = 3;
      return layer;
    }
  }
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    const x = parseFloat(r[lon]), y = parseFloat(r[lat]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const props: Record<string, any> = {};
    for (const k of keys) {
      const v = r[k];
      props[k] = v !== '' && typeof v === 'string' && !isNaN(+v) && k !== time ? +v : v;
    }
    features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [x, y] } });
  }
  const layer = makeLayer(name, { type: 'FeatureCollection', features });
  if (time) layer.style.timeField = time;
  const weight = keys.find((k) => /^(value|count|weight|magnitude|mag|population|pop|size|amount)$/i.test(k));
  if (weight) layer.style.weightField = weight;
  if (features.length > 100000) layer.style.render = 'scatter';
  return layer;
}

/** Tiny WKT parser for POINT / LINESTRING / POLYGON. */
export function parseWKT(s: string): GeoJSON.Geometry | null {
  if (!s) return null;
  const m = s.trim().match(/^(POINT|LINESTRING|POLYGON)\s*\((.*)\)$/i);
  if (!m) return null;
  const nums = (t: string) => t.trim().split(',').map((p) => p.trim().split(/\s+/).map(Number));
  const type = m[1].toUpperCase();
  if (type === 'POINT') return { type: 'Point', coordinates: nums(m[2])[0] };
  if (type === 'LINESTRING') return { type: 'LineString', coordinates: nums(m[2]) };
  const rings = m[2].match(/\(([^()]*)\)/g)?.map((r) => nums(r.slice(1, -1))) ?? [];
  return { type: 'Polygon', coordinates: rings };
}

// ------------------------------------------------------------------ KML / GPX

function xmlCoords(text: string): number[][] {
  return text
    .trim()
    .split(/\s+/)
    .map((t) => t.split(',').map(Number))
    .filter((c) => c.length >= 2 && c.every(Number.isFinite))
    .map((c) => [c[0], c[1]]);
}

export function kmlToGeoJSON(xml: string): GeoJSON.FeatureCollection {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const features: GeoJSON.Feature[] = [];
  doc.querySelectorAll('Placemark').forEach((pm) => {
    const props: Record<string, any> = { name: pm.querySelector('name')?.textContent ?? '', description: pm.querySelector('description')?.textContent ?? '' };
    const when = pm.querySelector('TimeStamp when, TimeSpan begin')?.textContent;
    if (when) props.time = when;
    pm.querySelectorAll('ExtendedData Data').forEach((d) => (props[d.getAttribute('name') ?? 'field'] = d.querySelector('value')?.textContent));
    pm.querySelectorAll('Point coordinates').forEach((c) => features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: xmlCoords(c.textContent ?? '')[0] } }));
    pm.querySelectorAll('LineString coordinates').forEach((c) => features.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: xmlCoords(c.textContent ?? '') } }));
    pm.querySelectorAll('Polygon').forEach((p) => {
      const outer = xmlCoords(p.querySelector('outerBoundaryIs coordinates')?.textContent ?? '');
      const inner = [...p.querySelectorAll('innerBoundaryIs coordinates')].map((c) => xmlCoords(c.textContent ?? ''));
      if (outer.length) features.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [outer, ...inner] } });
    });
  });
  return { type: 'FeatureCollection', features: features.filter((f) => (f.geometry as any).coordinates) };
}

export function gpxToGeoJSON(xml: string): GeoJSON.FeatureCollection {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const features: GeoJSON.Feature[] = [];
  doc.querySelectorAll('trk, rte').forEach((trk) => {
    const pts = [...trk.querySelectorAll('trkpt, rtept')].map((p) => {
      const t = p.querySelector('time')?.textContent;
      const c = [+p.getAttribute('lon')!, +p.getAttribute('lat')!];
      const tv = t ? parseTime(t) : null;
      return tv !== null ? [...c, tv] : c;
    });
    if (pts.length >= 2) features.push({ type: 'Feature', properties: { name: trk.querySelector('name')?.textContent ?? 'track' }, geometry: { type: 'LineString', coordinates: pts } });
  });
  doc.querySelectorAll('wpt').forEach((p) => {
    features.push({ type: 'Feature', properties: { name: p.querySelector('name')?.textContent ?? '', time: p.querySelector('time')?.textContent ?? undefined }, geometry: { type: 'Point', coordinates: [+p.getAttribute('lon')!, +p.getAttribute('lat')!] } });
  });
  return { type: 'FeatureCollection', features };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
