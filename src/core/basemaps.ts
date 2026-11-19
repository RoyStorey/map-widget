import type { StyleSpecification } from 'maplibre-gl';
import type { WorldData } from './world';

export interface Basemap {
  id: string;
  name: string;
  group: 'Offline' | 'Vector' | 'Raster';
  /** Theme hint for UI contrast / label colours. */
  dark: boolean;
  /** Colour behind the globe. */
  space?: string;
  build: (world: WorldData | null, opts: BasemapOptions) => StyleSpecification | string;
}

export interface BasemapOptions {
  modernBorders: boolean;
}

interface OfflineTheme {
  ocean: string;
  land: string;
  coast: string;
  border: string;
  graticule?: string;
  space: string;
  horizon: string;
  coastWidth?: number;
  landPattern?: boolean;
}

/** Zoom at which offline styles switch to 1:10m coastlines. */
export const HI_ZOOM = 5;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function sky(theme: { space: string; horizon: string }) {
  return {
    'sky-color': theme.space,
    'horizon-color': theme.horizon,
    'fog-color': theme.horizon,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.9,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  } as any;
}

function offlineStyle(theme: OfflineTheme) {
  return (world: WorldData | null, opts: BasemapOptions): StyleSpecification => ({
    version: 8,
    name: 'offline',
    sources: {
      land: { type: 'geojson', data: world?.land ?? EMPTY_FC, tolerance: 0.25 },
      borders: { type: 'geojson', data: world?.borders ?? EMPTY_FC, tolerance: 0.25 },
      coast: { type: 'geojson', data: world?.coastline ?? EMPTY_FC, tolerance: 0.25 },
      // 1:10m detail, filled in lazily once the user zooms in
      'land-hi': { type: 'geojson', data: EMPTY_FC, tolerance: 0.3, maxzoom: 14 },
      'coast-hi': { type: 'geojson', data: EMPTY_FC, tolerance: 0.3, maxzoom: 14 },
    },
    sky: sky(theme),
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': theme.ocean } },
      { id: 'land', type: 'fill', source: 'land', maxzoom: HI_ZOOM, paint: { 'fill-color': theme.land, 'fill-antialias': true } },
      { id: 'land-hi', type: 'fill', source: 'land-hi', minzoom: HI_ZOOM, paint: { 'fill-color': theme.land, 'fill-antialias': true } },
      // ↓ territory is inserted here, masked to land on the GPU (see MapWidget.installCoastMask)
      {
        id: 'coast-glow',
        type: 'line',
        source: 'coast',
        paint: { 'line-color': theme.coast, 'line-opacity': 0.25, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 2, 6, 6], 'line-blur': 3 },
      },
      {
        id: 'coast-hi',
        type: 'line',
        source: 'coast-hi',
        minzoom: HI_ZOOM,
        paint: { 'line-color': theme.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, (theme.coastWidth ?? 0.6) * 1.5, 12, (theme.coastWidth ?? 0.6) * 3] },
      },
      {
        id: 'coast',
        type: 'line',
        source: 'coast',
        maxzoom: HI_ZOOM,
        paint: { 'line-color': theme.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, (theme.coastWidth ?? 0.6), 8, (theme.coastWidth ?? 0.6) * 3] },
      },
      {
        id: 'modern-borders',
        type: 'line',
        source: 'borders',
        layout: { visibility: opts.modernBorders ? 'visible' : 'none' },
        paint: { 'line-color': theme.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 8, 1.6], 'line-dasharray': [3, 2] },
      },
    ],
  });
}

function rasterStyle(tiles: string[], attribution: string, opts: { maxzoom?: number; tileSize?: number; theme: { space: string; horizon: string } }) {
  return (): StyleSpecification => ({
    version: 8,
    sources: {
      raster: { type: 'raster', tiles, tileSize: opts.tileSize ?? 256, attribution, maxzoom: opts.maxzoom ?? 19 },
    },
    sky: sky(opts.theme),
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#000' } },
      { id: 'raster', type: 'raster', source: 'raster', paint: { 'raster-fade-duration': 150 } },
    ],
  });
}

const DARK_SKY = { space: '#05070d', horizon: '#1c2a44' };
const LIGHT_SKY = { space: '#cfe0f0', horizon: '#ffffff' };

export const BASEMAPS: Basemap[] = [
  {
    id: 'parchment', space: '#1a140c', name: 'Parchment (historical)', group: 'Offline', dark: false,
    build: offlineStyle({ ocean: '#a7bfc1', land: '#efe3c6', coast: '#6b5a3c', border: '#b29b74', space: '#1a140c', horizon: '#c9b791', coastWidth: 0.8 }),
  },
  {
    id: 'dark-atlas', space: '#020308', name: 'Dark atlas', group: 'Offline', dark: true,
    build: offlineStyle({ ocean: '#0a1020', land: '#1a2233', coast: '#3d5a80', border: '#46506a', space: '#020308', horizon: '#14223d' }),
  },
  {
    id: 'light-atlas', space: '#dde7f0', name: 'Light atlas', group: 'Offline', dark: false,
    build: offlineStyle({ ocean: '#d4e2ec', land: '#fbfbf8', coast: '#9fb3c4', border: '#c4c9cf', space: '#dde7f0', horizon: '#ffffff' }),
  },
  {
    id: 'blueprint', space: '#04122a', name: 'Blueprint', group: 'Offline', dark: true,
    build: offlineStyle({ ocean: '#0d3b7a', land: '#14509e', coast: '#cfe3ff', border: '#7fa9e0', space: '#04122a', horizon: '#2a5ea8', coastWidth: 1 }),
  },
  {
    id: 'ink', space: '#e8e4da', name: 'Ink & paper', group: 'Offline', dark: false,
    build: offlineStyle({ ocean: '#f4f1ea', land: '#ffffff', coast: '#222222', border: '#888888', space: '#e8e4da', horizon: '#ffffff', coastWidth: 0.9 }),
  },
  {
    id: 'war-room', space: '#000000', name: 'War room', group: 'Offline', dark: true,
    build: offlineStyle({ ocean: '#06110b', land: '#0f2417', coast: '#39ff88', border: '#1f6b3d', space: '#000000', horizon: '#0b3a1e', coastWidth: 0.7 }),
  },
  { id: 'ofm-liberty', name: 'OpenFreeMap Liberty', group: 'Vector', dark: false, build: () => 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'ofm-positron', name: 'OpenFreeMap Positron', group: 'Vector', dark: false, build: () => 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'ofm-bright', name: 'OpenFreeMap Bright', group: 'Vector', dark: false, build: () => 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'ofm-dark', name: 'OpenFreeMap Dark', group: 'Vector', dark: true, build: () => 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'ofm-fiord', name: 'OpenFreeMap Fiord', group: 'Vector', dark: true, build: () => 'https://tiles.openfreemap.org/styles/fiord' },
  {
    id: 'esri-imagery', name: 'Satellite (Esri)', group: 'Raster', dark: true,
    build: rasterStyle(['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], '© Esri, Maxar, Earthstar Geographics', { theme: DARK_SKY }),
  },
  {
    id: 'esri-ocean', name: 'Ocean (Esri)', group: 'Raster', dark: false,
    build: rasterStyle(['https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}'], '© Esri, GEBCO, NOAA', { maxzoom: 13, theme: LIGHT_SKY }),
  },
  {
    id: 'esri-natgeo', name: 'NatGeo (Esri)', group: 'Raster', dark: false,
    build: rasterStyle(['https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}'], '© Esri, National Geographic', { maxzoom: 16, theme: LIGHT_SKY }),
  },
  {
    id: 'carto-dark', name: 'Carto Dark Matter', group: 'Raster', dark: true,
    build: rasterStyle(['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`), '© OpenStreetMap contributors © CARTO', { tileSize: 256, theme: DARK_SKY }),
  },
  {
    id: 'carto-voyager', name: 'Carto Voyager', group: 'Raster', dark: false,
    build: rasterStyle(['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`), '© OpenStreetMap contributors © CARTO', { tileSize: 256, theme: LIGHT_SKY }),
  },
  {
    id: 'opentopo', name: 'OpenTopoMap', group: 'Raster', dark: false,
    build: rasterStyle(['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`), '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)', { maxzoom: 17, theme: LIGHT_SKY }),
  },
  {
    id: 'osm', name: 'OpenStreetMap', group: 'Raster', dark: false,
    build: rasterStyle(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], '© OpenStreetMap contributors', { theme: LIGHT_SKY }),
  },
  {
    id: 'night-lights', name: 'Night lights (NASA)', group: 'Raster', dark: true,
    build: rasterStyle(
      ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png'],
      'NASA Earth Observatory / GIBS', { maxzoom: 8, theme: DARK_SKY },
    ),
  },
];

export function getBasemap(id: string | undefined): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[1];
}

export const TERRAIN_SOURCE = {
  type: 'raster-dem' as const,
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 14,
  attribution: 'Terrain: Mapzen / AWS Open Data',
};
