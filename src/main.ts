import { App, type DemoEntry } from './ui/app';
import { parseHash, scenarioFromHash } from './io/export';
import { loadScenario as loadSaved } from './io/storage';
import { toast } from './ui/dom';
import { installBridge } from './io/bridge';

const DEMOS: DemoEntry[] = [
  { id: 'mongol', label: 'Mongol conquests 1200–1280', description: 'territory waves, campaigns, director camera', load: () => import('./demos/mongol').then((m) => m.buildMongolDemo()) },
  { id: 'shipping', label: 'Global shipping lanes', description: 'thousands of animated vessels', load: () => import('./demos/shipping').then((m) => m.buildShippingDemo()) },
  { id: 'europe', label: 'Countries tool: Napoleonic Europe', description: 'whole-country control over time', load: () => import('./demos/napoleon').then((m) => m.buildNapoleonDemo()) },
  { id: 'alexander', label: 'Alexander the Great 336–301 BCE', description: 'Persia, India and the Diadochi', load: () => import('./demos/alexander').then((m) => m.buildAlexanderDemo()) },
  { id: 'rome', label: 'Rise of Rome 264 BCE–117 CE', description: 'Punic Wars to Trajan', load: () => import('./demos/rome').then((m) => m.buildRomeDemo()) },
  { id: 'caliphate', label: 'Early Islamic conquests 622–763', description: 'Rashidun, Umayyad and Abbasid caliphates', load: () => import('./demos/caliphate').then((m) => m.buildCaliphateDemo()) },
  { id: 'ottoman', label: 'Rise of the Ottomans 1299–1683', description: 'Constantinople to the gates of Vienna', load: () => import('./demos/ottoman').then((m) => m.buildOttomanDemo()) },
  { id: 'ww2', label: 'World War II 1939–1945', description: 'fronts, campaigns, ~65 events, battle dives', load: () => import('./demos/ww2').then((m) => m.buildWW2Demo()) },
  { id: 'dday', group: 'battle', label: 'D-Day — 6 June 1944', description: 'the Normandy landings hour by hour', load: () => import('./demos/dday').then((m) => m.buildDDayDemo()) },
  { id: 'midway', group: 'battle', label: 'Midway — 4 June 1942', description: 'carriers and the six minutes that changed the Pacific War', load: () => import('./demos/midway').then((m) => m.buildMidwayDemo()) },
  { id: 'stalingrad', group: 'battle', label: 'Stalingrad — 1942–43', description: 'street fighting, Operation Uranus and the Kessel', load: () => import('./demos/stalingrad').then((m) => m.buildStalingradDemo()) },
  { id: 'waterloo', group: 'battle', label: 'Waterloo — 18 June 1815', description: 'Hougoumont, the Guard and the Prussians', load: () => import('./demos/waterloo').then((m) => m.buildWaterlooDemo()) },
  { id: 'blank', label: 'Blank world', description: 'start from scratch', load: () => import('./demos/blank').then((m) => m.buildBlankDemo()) },
];

const hash = parseHash(location.hash);
const params = new URLSearchParams(location.search);
const app = new App(document.getElementById('app')!, { demos: DEMOS });
const w = app.widget;
// Embedding: ?embed=1 enables the postMessage API; ?viewer=1 hides editing UI.
if (params.has('embed') || window.parent !== window) installBridge(w);
if (params.has('viewer')) app.root.classList.add('viewer');
(window as any).atlas = app;
(window as any).widget = w;

async function boot() {
  // 1) scenario embedded in the share link, 2) ?demo / #demo=, 3) autosave, 4) default demo
  const fromLink = await scenarioFromHash(hash);
  const demoId = params.get('demo') ?? hash.demo;
  if (fromLink) {
    w.loadScenario(fromLink, { keepView: !!hash.v });
    toast('Scenario loaded from link', 'success');
  } else if (demoId && DEMOS.find((d) => d.id === demoId)) {
    await app.loadDemo(DEMOS.find((d) => d.id === demoId)!);
  } else {
    const saved = w.settings.autosave ? await loadSaved('autosave') : null;
    const ref = (saved?.scenario as any)?.demoRef;
    if (ref && DEMOS.find((d) => d.id === ref)) await app.loadDemo(DEMOS.find((d) => d.id === ref)!);
    else if (saved?.scenario) {
      w.loadScenario(saved.scenario, { keepView: !!hash.v });
      toast(`Restored “${saved.scenario.meta.title}” from autosave`, 'info');
    } else await app.loadDemo(DEMOS[0]);
  }
  if (hash.v) {
    const [lng, lat, zoom, bearing, pitch] = hash.v.split(',').map(Number);
    w.map.jumpTo({ center: [lng, lat], zoom, bearing, pitch });
  }
  if (hash.t) w.setTime(parseFloat(hash.t));
  if (hash.b && hash.b !== w.settings.basemap) w.updateSettings({ basemap: hash.b });
  if (hash.p === 'globe' || hash.p === 'mercator') w.updateSettings({ projection: hash.p });
}
boot();
