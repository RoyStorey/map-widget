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
  /** Highlight borders between rival factions. */
  frontLines: boolean;
  /** Slowly spin the globe when idle. */
  autoRotate: boolean;

  unitTrail: 'fade' | 'full';
  unitTrailFraction: number;
  unitLabels: boolean;
  unitScale: number;
  plannedPaths: boolean;

  vesselScale: number;
  vesselSpeed: number;
  ambientAnimation: boolean;

  eventToasts: boolean;
  /** What to do when playback reaches an event that links to a detailed battle. */
  battleDive: 'ask' | 'auto' | 'off';
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
  /** Max device pixel ratio (upper bound on top of the performance mode). */
  maxPixelRatio: number;
  /** Auto picks Lite on low-end / mobile devices and Balanced elsewhere. */
  performanceMode: 'auto' | 'quality' | 'balanced' | 'lite';
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
  frontLines: true,
  autoRotate: false,

  unitTrail: 'fade',
  unitTrailFraction: 0.06,
  unitLabels: true,
  unitScale: 1,
  plannedPaths: false,

  vesselScale: 1,
  vesselSpeed: 1,
  ambientAnimation: true,

  eventToasts: true,
  battleDive: 'ask',
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
  performanceMode: 'auto',
};

const KEY = 'mapwidget.settings.v1';

export interface PerfProfile {
  mode: 'quality' | 'balanced' | 'lite';
  /** Canvas resolution multiplier. */
  pixelRatio: number;
  /** Frame cap while playing or interacting. */
  maxFps: number;
  /** Frame cap for idle ambient animation (ships, pulsing markers). */
  ambientFps: number;
  /** How often drawn territory may update during playback. */
  territoryHz: number;
  glow: boolean;
  minimap: boolean;
  minimapHz: number;
}

/** Heuristic for weaker hardware: low memory, few cores, or a touch-first device. */
export function isLowEndDevice(): boolean {
  const nav = navigator as any;
  return (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) || (navigator.hardwareConcurrency || 8) <= 4 || matchMedia?.('(pointer: coarse)').matches;
}

export function perfProfile(s: Settings): PerfProfile {
  const mode = s.performanceMode === 'auto' ? (isLowEndDevice() ? 'lite' : 'balanced') : s.performanceMode;
  const dpr = window.devicePixelRatio || 1;
  const cap = (x: number) => Math.min(dpr, x, s.maxPixelRatio);
  if (mode === 'quality') return { mode, pixelRatio: cap(2), maxFps: 60, ambientFps: 60, territoryHz: 30, glow: true, minimap: true, minimapHz: 6 };
  if (mode === 'lite') return { mode, pixelRatio: cap(1), maxFps: 30, ambientFps: 15, territoryHz: 6, glow: false, minimap: false, minimapHz: 1 };
  return { mode: 'balanced', pixelRatio: cap(1.5), maxFps: 60, ambientFps: 30, territoryHz: 12, glow: true, minimap: true, minimapHz: 3 };
}

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
