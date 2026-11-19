/**
 * Atlas map widget — public library entry.
 *
 *   import { MapWidget, createAtlas } from 'map-widget';
 *   const atlas = createAtlas(document.getElementById('map')!);   // full editor UI
 *   const w = new MapWidget({ container });                       // headless widget
 */
export { MapWidget } from './widget/MapWidget';
export type { MapWidgetOptions, WidgetEvents, Selection, FrameStats } from './widget/MapWidget';
export { DEFAULT_SETTINGS, type Settings } from './widget/settings';
export { App, type AppOptions, type DemoEntry } from './ui/app';
export * from './core/scenario';
export { parseTime, formatTime, decimalYearToDate, dateToDecimalYear, nowDecimalYear } from './core/time';
export { waveEvents, polygonCells, brushCells } from './core/conquest';
export { seaRoute, seaRouteVia } from './core/h3client';
export { haversineKm, densifyGreatCircle, timestampPath, positionAtTime, type LonLat } from './core/geo';
export { BASEMAPS } from './core/basemaps';
export { importFile, importJSON, parseCSV } from './io/import';
export { installBridge } from './io/bridge';

import { App, type AppOptions } from './ui/app';

/** Mount the full editor UI into a host element. */
export function createAtlas(host: HTMLElement, opts: AppOptions = {}): App {
  return new App(host, opts);
}
