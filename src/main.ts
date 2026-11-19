import { MapWidget } from './widget/MapWidget';
import { buildMongolDemo } from './demos/mongol';

const app = document.getElementById('app')!;
app.style.cssText = 'position:fixed;inset:0';
const w = new MapWidget({ container: app });
(window as any).widget = w;
buildMongolDemo().then((s) => w.loadScenario(s));
