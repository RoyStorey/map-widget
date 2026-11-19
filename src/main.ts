import { App } from './ui/app';
import { parseHash, scenarioFromHash } from './io/export';
import { loadScenario as loadSaved } from './io/storage';
import { toast } from './ui/dom';
import { installBridge } from './io/bridge';

import { DEMOS } from './demos/index';

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
