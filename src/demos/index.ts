/** Built-in scenarios (lazy-loaded). Shared by the editor and the lesson player. */
import type { Scenario } from '../core/scenario';

export interface DemoEntry {
  id: string;
  /** 'battle' entries are zoomed-in scenarios that wars can link to. */
  group?: 'war' | 'battle' | 'lesson';
  label: string;
  description: string;
  load: () => Promise<Scenario>;
}

/** Load a lesson JSON shipped in public/lessons. */
function lesson(file: string): () => Promise<Scenario> {
  return async () => {
    const [{ compileLesson }, spec] = await Promise.all([import('../lesson/compile'), fetch(new URL(`lessons/${file}`, document.baseURI)).then((r) => r.json())]);
    return compileLesson(spec);
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
  { id: 'lesson-1066', group: 'lesson', label: '1066: The Norman Conquest', description: 'guided lesson with quiz (lesson format example)', load: lesson('norman-conquest-1066.json') },
  { id: 'lesson-magellan', group: 'lesson', label: 'Around the World: Magellan & Elcano', description: 'sea-voyage lesson with quiz', load: lesson('magellan-circumnavigation.json') },
  { id: 'lesson-1453', group: 'lesson', label: 'The Fall of Constantinople, 1453', description: 'city-siege lesson with quiz', load: lesson('fall-of-constantinople-1453.json') },
  { id: 'blank', label: 'Blank world', description: 'start from scratch', load: () => import('./blank').then((m) => m.buildBlankDemo()) },
];
