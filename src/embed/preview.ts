/**
 * widget.html: shows the embeddable map inside an article-like page.
 * ?map=maps/<file>.json picks a map file; ?wait=1 waits for the editor to send
 * one ({ type: 'atlas:load', map }) – used by the editor's "Preview as widget".
 */
import { mountMap, type AtlasMapHandle, type MapSource } from './index';

const params = new URLSearchParams(location.search);
const host = document.getElementById('map')!;
const pick = document.getElementById('pick') as HTMLSelectElement;
const themeBtn = document.getElementById('theme') as HTMLButtonElement;
let theme: 'light' | 'dark' = params.get('theme') === 'dark' ? 'dark' : 'light';
let handle: AtlasMapHandle | null = null;

function show(source: MapSource, title: string, caption = '') {
  handle?.destroy();
  document.getElementById('title')!.textContent = title;
  document.getElementById('caption')!.textContent = caption;
  handle = mountMap(host, source, { theme, chapter: Math.max(0, (parseInt(params.get('step') ?? '1', 10) || 1) - 1) });
  (window as any).atlasMap = handle;
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
  handle?.setTheme(theme);
}
themeBtn.onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme();
};
applyTheme();

async function boot() {
  const index = await fetch('maps/index.json').then((r) => r.json()).catch(() => ({ maps: [] }));
  const maps: { file: string; title: string; kind?: string }[] = index.maps ?? [];
  pick.replaceChildren(...maps.map((m) => new Option(m.title, m.file)));
  pick.onchange = () => {
    const m = maps.find((x) => x.file === pick.value)!;
    history.replaceState(null, '', `?map=maps/${m.file}`);
    show(`maps/${m.file}`, m.title, m.kind ? `Interactive map · ${m.kind}. Drag the timeline or step through the chapters.` : '');
  };
  if (params.has('wait')) {
    pick.disabled = true;
    window.addEventListener('message', (ev) => {
      if (ev.source !== window.opener || ev.data?.type !== 'atlas:load') return;
      const s = ev.data.map;
      show(s, s?.meta?.title ?? 'Preview', 'Preview from the editor.');
    });
    window.opener?.postMessage({ type: 'atlas:ready' }, '*');
    return;
  }
  const want = params.get('map') ?? (maps[0] ? `maps/${maps[0].file}` : null);
  if (!want) return;
  const entry = maps.find((m) => `maps/${m.file}` === want);
  if (entry) pick.value = entry.file;
  show(want, entry?.title ?? 'Map', entry?.kind ? `Interactive map · ${entry.kind}. Drag the timeline or step through the chapters.` : '');
}
boot();
