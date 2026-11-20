/** Built-in scenarios (lazy-loaded). Shared by the editor and the widget preview page. */
import type { Scenario } from '../core/scenario';

export interface DemoEntry {
  id: string;
  /** 'battle' entries are zoomed-in scenarios that wars can link to. */
  group?: 'war' | 'battle' | 'map';
  label: string;
  description: string;
  load: () => Promise<Scenario>;
}

/** Load an atlas-map@1 file shipped in public/maps. */
function mapFile(file: string): () => Promise<Scenario> {
  return async () => {
    const [{ compileMap }, spec] = await Promise.all([import('../spec/compile'), fetch(new URL(`maps/${file}`, document.baseURI)).then((r) => r.json())]);
    return compileMap(spec);
  };
}

export const DEMOS: DemoEntry[] = [
  { id: 'mongol', label: 'Mongol conquests 1200–1280', description: 'territory waves, campaigns, director camera', load: () => import('./mongol').then((m) => m.buildMongolDemo()) },
  { id: 'shipping', label: 'Global shipping lanes', description: 'thousands of animated vessels', load: () => import('./shipping').then((m) => m.buildShippingDemo()) },
  { id: 'europe', label: 'Countries tool: Napoleonic Europe', description: 'whole-country control over time', load: () => import('./napoleon').then((m) => m.buildNapoleonDemo()) },
  { id: 'alexander', label: 'Alexander the Great 336–301 BCE', description: 'Persia, India and the Diadochi', load: () => import('./alexander').then((m) => m.buildAlexanderDemo()) },
  { id: 'rome', label: 'Rise of Rome 264 BCE–117 CE', description: 'Punic Wars to Trajan', load: () => import('./rome').then((m) => m.buildRomeDemo()) },
  { id: 'caliphate', label: 'Early Islamic conquests 622–763', description: 'Rashidun, Umayyad and Abbasid caliphates', load: () => import('./caliphate').then((m) => m.buildCaliphateDemo()) },
  { id: 'ottoman', label: 'Rise of the Ottomans 1299–1683', description: 'Constantinople to the gates of Vienna', load: () => import('./ottoman').then((m) => m.buildOttomanDemo()) },
  { id: 'ww2', label: 'World War II 1939–1945', description: 'fronts, campaigns, ~65 events, battle dives', load: () => import('./ww2').then((m) => m.buildWW2Demo()) },
  { id: 'dday', group: 'battle', label: 'D-Day — 6 June 1944', description: 'the Normandy landings hour by hour', load: () => import('./dday').then((m) => m.buildDDayDemo()) },
  { id: 'midway', group: 'battle', label: 'Midway — 4 June 1942', description: 'carriers and the six minutes that changed the Pacific War', load: () => import('./midway').then((m) => m.buildMidwayDemo()) },
  { id: 'stalingrad', group: 'battle', label: 'Stalingrad — 1942–43', description: 'street fighting, Operation Uranus and the Kessel', load: () => import('./stalingrad').then((m) => m.buildStalingradDemo()) },
  { id: 'waterloo', group: 'battle', label: 'Waterloo — 18 June 1815', description: 'Hougoumont, the Guard and the Prussians', load: () => import('./waterloo').then((m) => m.buildWaterlooDemo()) },
  { id: 'map-1066', group: 'map', label: '1066: The Norman Conquest', description: 'regional campaign with chapters', load: mapFile('norman-conquest-1066.json') },
  { id: 'map-magellan', group: 'map', label: 'Around the World: Magellan & Elcano', description: 'world voyage by sea', load: mapFile('magellan-circumnavigation.json') },
  { id: 'map-gettysburg', group: 'map', label: 'Gettysburg: Three Days in July 1863', description: 'battlefield, hour by hour', load: mapFile('gettysburg-1863.json') },
  { id: 'map-1453', group: 'map', label: 'The Fall of Constantinople, 1453', description: 'city siege', load: mapFile('fall-of-constantinople-1453.json') },
  { id: 'map-dday', group: 'map', label: 'D-Day: the Normandy landings', description: 'invasion hour by hour (map file version)', load: mapFile('d-day-1944.json') },
  { id: 'map-paul', group: 'map', label: 'The Journeys of Paul, c. 46–60 CE', description: 'journeys by land and sea', load: mapFile('journeys-of-paul.json') },
  { id: 'blank', label: 'Blank world', description: 'start from scratch', load: () => import('./blank').then((m) => m.buildBlankDemo()) },
];
