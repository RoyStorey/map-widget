export interface Settings {
  basemap: string;
  projection: 'mercator' | 'globe';
  modernBorders: boolean;
  terrain: boolean;
  terrainExaggeration: number;
  hillshade: boolean;

  graticule: boolean;
  terminator: boolean;
  countryLabels: boolean;
  factionLabels: boolean;
  capitals: boolean;

  showTerritory: boolean;
  showCountries: boolean;
  showRegions: boolean;
  showUnits: boolean;
  showRoutes: boolean;
  showVessels: boolean;
  showFlows: boolean;
  showEvents: boolean;
  showAnnotations: boolean;
  showData: boolean;

  territoryOpacity: number;
  territoryBorders: boolean;
  borderWidth: number;
  conquestGlow: boolean;
  /** Glow duration as a fraction of the scenario span. */
  glowFraction: number;
  /** Extrude territory cells by time held (3D "age" effect). */
  territoryExtrude: boolean;
  /** Show the H3 cell grid (always shown while painting when zoomed in enough). */
  cellGrid: boolean;

  unitTrail: 'fade' | 'full';
  unitTrailFraction: number;
  unitLabels: boolean;
  unitScale: number;
  plannedPaths: boolean;

  vesselScale: number;
  vesselSpeed: number;
  ambientAnimation: boolean;

  eventToasts: boolean;
  eventLabels: boolean;

  director: boolean;
  followUnit: string | null;

  perfHud: boolean;
  minimap: boolean;
  distanceUnit: 'km' | 'mi' | 'nm';
  loop: boolean;
  hashState: boolean;
  autosave: boolean;
  theme: 'dark' | 'light';
  /** Max device pixel ratio (performance). */
  maxPixelRatio: number;
}

export const DEFAULT_SETTINGS: Settings = {
  basemap: 'dark-atlas',
  projection: 'globe',
  modernBorders: true,
  terrain: false,
  terrainExaggeration: 1.5,
  hillshade: false,

  graticule: false,
  terminator: false,
  countryLabels: false,
  factionLabels: true,
  capitals: true,

  showTerritory: true,
  showCountries: true,
  showRegions: true,
  showUnits: true,
  showRoutes: true,
  showVessels: true,
  showFlows: true,
  showEvents: true,
  showAnnotations: true,
  showData: true,

  territoryOpacity: 0.62,
  territoryBorders: true,
  borderWidth: 1.6,
  conquestGlow: true,
  glowFraction: 0.02,
  territoryExtrude: false,
  cellGrid: false,

  unitTrail: 'fade',
  unitTrailFraction: 0.06,
  unitLabels: true,
  unitScale: 1,
  plannedPaths: false,

  vesselScale: 1,
  vesselSpeed: 1,
  ambientAnimation: true,

  eventToasts: true,
  eventLabels: true,

  director: false,
  followUnit: null,

  perfHud: false,
  minimap: true,
  distanceUnit: 'km',
  loop: true,
  hashState: true,
  autosave: true,
  theme: 'dark',
  maxPixelRatio: 2,
};

const KEY = 'mapwidget.settings.v1';

export function loadSettings(overrides: Partial<Settings> = {}): Settings {
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS, ...stored, ...overrides, followUnit: null };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
