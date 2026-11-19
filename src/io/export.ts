import type { MapWidget } from '../widget/MapWidget';
import { download } from '../ui/dom';
import { formatTime } from '../core/time';
import { compress, decompress } from './storage';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
}

export function exportScenarioFile(w: MapWidget): void {
  const s = w.exportScenario();
  download(JSON.stringify(s), `${slug(s.meta.title)}.mapwidget.json`);
}

/** Territory at the current time as GeoJSON polygons (one feature per cell). */
export function territoryGeoJSON(w: MapWidget): GeoJSON.FeatureCollection {
  const tl = w.territory.timeline;
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < tl.keys.length; i++) {
    const o = tl.owner[i];
    if (o < 0) continue;
    const f = w.scenario.factions[o];
    const ring = w.territory.ring(i);
    features.push({ type: 'Feature', properties: { cell: tl.keys[i], faction: f.id, factionName: f.name, color: f.color, since: tl.changedAt[i] }, geometry: { type: 'Polygon', coordinates: [ring] } });
  }
  return { type: 'FeatureCollection', features };
}

export function exportTerritory(w: MapWidget): void {
  download(JSON.stringify(territoryGeoJSON(w)), `territory-${slug(formatTime(w.time))}.geojson`, 'application/geo+json');
}

/** Units, routes, events, regions and labels as a single GeoJSON file. */
export function exportFeatures(w: MapWidget): void {
  const s = w.scenario;
  const features: GeoJSON.Feature[] = [
    ...s.units.map((u) => ({ type: 'Feature' as const, properties: { kind: 'unit', id: u.id, name: u.name, faction: u.faction, times: u.path.map((p) => p[2]) }, geometry: { type: 'LineString' as const, coordinates: u.path.map((p) => [p[0], p[1], p[2]]) } })),
    ...s.routes.map((r) => ({ type: 'Feature' as const, properties: { kind: 'route', id: r.id, name: r.name, color: r.color, volume: r.volume }, geometry: { type: 'LineString' as const, coordinates: r.waypoints } })),
    ...s.events.map((e) => ({ type: 'Feature' as const, properties: { kind: 'event', id: e.id, title: e.title, type: e.kind, time: e.t, description: e.description }, geometry: { type: 'Point' as const, coordinates: e.position } })),
    ...s.regions.map((r) => ({ type: 'Feature' as const, properties: { kind: 'region', id: r.id, name: r.name, faction: r.faction, start: r.start, end: r.end }, geometry: { type: 'Polygon' as const, coordinates: r.rings.map((ring) => [...ring, ring[0]]) } })),
    ...s.annotations.map((a) => ({ type: 'Feature' as const, properties: { kind: 'label', id: a.id, text: a.text, start: a.start, end: a.end }, geometry: { type: 'Point' as const, coordinates: a.position } })),
  ];
  download(JSON.stringify({ type: 'FeatureCollection', features }), `${slug(s.meta.title)}-features.geojson`, 'application/geo+json');
}

export function exportEventsCSV(w: MapWidget): void {
  const rows = [['time', 'date', 'title', 'kind', 'faction', 'lon', 'lat', 'description']];
  for (const e of [...w.scenario.events].sort((a, b) => a.t - b.t)) {
    rows.push([String(e.t), formatTime(e.t, 'day'), e.title, e.kind, e.faction ?? '', String(e.position[0]), String(e.position[1]), e.description ?? '']);
  }
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
  download(csv, `${slug(w.scenario.meta.title)}-events.csv`, 'text/csv');
}

export async function screenshotPNG(w: MapWidget, scale = 1): Promise<void> {
  const url = await w.screenshot(scale);
  // composite labels on top
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  ctx.drawImage(w.labels.canvas, 0, 0, c.width, c.height);
  c.toBlob((b) => b && download(b, `${slug(w.scenario.meta.title)}-${slug(formatTime(w.time))}.png`, 'image/png'), 'image/png');
}

// ------------------------------------------------------------------ URL state

export function viewHash(w: MapWidget): string {
  const c = w.map.getCenter();
  const parts = [
    `v=${c.lng.toFixed(4)},${c.lat.toFixed(4)},${w.map.getZoom().toFixed(2)},${w.map.getBearing().toFixed(1)},${w.map.getPitch().toFixed(1)}`,
    `t=${+w.time.toFixed(5)}`,
    `b=${w.settings.basemap}`,
    `p=${w.settings.projection}`,
  ];
  return parts.join('&');
}

export function parseHash(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of hash.replace(/^#/, '').split('&')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

/** Share link with the entire scenario compressed into the URL fragment (if small enough). */
export async function shareLink(w: MapWidget, embedScenario: boolean): Promise<string> {
  const base = location.href.split('#')[0];
  let hash = viewHash(w);
  if (embedScenario) {
    const s = w.exportScenario();
    // data layers can be huge: keep them only if the result stays reasonable
    const packed = await compress(JSON.stringify(s));
    if (packed.length > 1_500_000) throw new Error('Scenario too large to embed in a link – export the file instead.');
    hash += `&s=${packed}`;
  }
  return `${base}#${hash}`;
}

export async function scenarioFromHash(h: Record<string, string>): Promise<any | null> {
  if (!h.s) return null;
  try {
    return JSON.parse(await decompress(h.s));
  } catch {
    return null;
  }
}

/** Current map + labels as a (downscaled) JPEG data URL. */
export async function captureImage(w: MapWidget, maxWidth = 1000, quality = 0.85): Promise<string> {
  const url = await w.screenshot();
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(1, maxWidth / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.drawImage(w.labels.canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/** Resolve once the map has finished loading tiles and rendering (or after a timeout). */
export function mapIdle(w: MapWidget, timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeout);
    w.map.once('idle', done);
    w.map.triggerRepaint();
  });
}
