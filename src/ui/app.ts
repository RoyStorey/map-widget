import '../styles/app.css';
import { MapWidget, type MapWidgetOptions } from '../widget/MapWidget';
import type { Tool } from '../tools/tool';
import { ALL_TOOLS, setToolOptions, toolEvents, toolOptions } from '../tools/tools';
import { h, icon, menu, modal, toast, pickFile, confirmDialog, esc, download, type ICONS } from './dom';
import { Timeline } from './timeline';
import { Palette, type Command } from './palette';
import { Minimap } from './minimap';
import { cameraPanel, dataPanel, factionsPanel, inspectPanel, layersPanel, scenarioPanel, settingsPanel, viewCorners } from './panels';
import { importFile, importJSON } from '../io/import';
import { Recorder } from '../io/record';
import { exportScenarioFile, parseHash, screenshotPNG, shareLink, viewHash } from '../io/export';
import { listSaves, loadScenario as loadSaved, saveScenario, deleteSave } from '../io/storage';
import { formatTime, parseTime, precisionForSpan } from '../core/time';
import { paletteColor } from '../core/color';
import { formatArea, formatAreaCompact } from '../core/geo';
import { cellAreaKm2 } from '../layers/build';
import { emptyScenario, uid, type Scenario } from '../core/scenario';
import { describePick } from '../widget/MapWidget';

type TabId = 'inspect' | 'layers' | 'factions' | 'scenario' | 'camera' | 'data' | 'settings';
const TABS: { id: TabId; label: string; icon: keyof typeof ICONS }[] = [
  { id: 'inspect', label: 'Inspect', icon: 'target' },
  { id: 'layers', label: 'Layers', icon: 'layers' },
  { id: 'factions', label: 'Factions', icon: 'users' },
  { id: 'scenario', label: 'Scenario', icon: 'list' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
  { id: 'data', label: 'Data', icon: 'database' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export interface DemoEntry {
  id: string;
  label: string;
  description: string;
  load: () => Promise<Scenario>;
}

export interface AppOptions extends Omit<MapWidgetOptions, 'container'> {
  demos?: DemoEntry[];
}

/**
 * Full editor UI around a MapWidget. Everything here is optional — the widget
 * works headless (see README) — but this is the "ultimate" interactive shell.
 */
export class App {
  readonly root: HTMLElement;
  readonly widget: MapWidget;
  readonly palette: Palette;
  readonly recorder: Recorder;
  readonly tools: Tool[];
  objectFilter = '';
  private tab: TabId = 'layers';
  private sidebarOpen = window.innerWidth > 900;
  private panelEl: HTMLElement;
  private tabsEl: HTMLElement;
  private toolbar: HTMLElement;
  private paintbar: HTMLElement;
  private toolhint: HTMLElement;
  private tooltip: HTMLElement;
  private hud: HTMLElement;
  private legend: HTMLElement;
  private eventCard: HTMLElement;
  private measure: HTMLElement;
  private recBadge: HTMLElement;
  private titleEl: HTMLElement;
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  private globeBtn!: HTMLButtonElement;
  private panelDirty = false;
  private saveTimer = 0;
  private hashTimer = 0;
  private fpsHistory: number[] = [];
  private eventCardTimer = 0;
  private demos: DemoEntry[];

  constructor(host: HTMLElement, opts: AppOptions = {}) {
    this.demos = opts.demos ?? [];
    this.root = h('div', { class: 'mw-root' });
    host.append(this.root);
    const mapEl = h('div', { class: 'mw-map' });
    this.root.append(mapEl);
    const w = (this.widget = new MapWidget({ ...opts, container: mapEl }));
    this.tools = ALL_TOOLS();
    this.recorder = new Recorder(w);
    this.palette = new Palette(() => this.commands());
    document.documentElement.dataset.theme = w.settings.theme;

    // ---------------- top bar
    this.titleEl = h('div', { class: 'title', title: 'Click to rename', onclick: () => this.renameScenario() });
    const search = this.buildSearch();
    const btn = (ic: keyof typeof ICONS, title: string, onclick: (e: MouseEvent) => void) => h('button', { class: 'icon-btn', title, onclick }, icon(ic, 17));
    this.undoBtn = btn('undo', 'Undo (Ctrl+Z)', () => w.undo());
    this.redoBtn = btn('redo', 'Redo (Ctrl+Shift+Z)', () => w.redo());
    this.globeBtn = btn('globe', 'Toggle globe / flat (G)', () => w.updateSettings({ projection: w.settings.projection === 'globe' ? 'mercator' : 'globe' }));
    const topbar = h(
      'div',
      { class: 'mw-topbar' },
      h('div', { class: 'mw-brand glass' }, h('span', { class: 'logo' }, 'ATLAS'), this.titleEl),
      search,
      h('div', { class: 'mw-spacer' }),
      h('div', { class: 'mw-btngroup glass' },
        this.undoBtn,
        this.redoBtn,
        btn('sparkle', 'Scenarios & demos', (e) => this.scenarioMenu(e.currentTarget as HTMLElement)),
        this.globeBtn,
        btn('map', 'Basemap', (e) => this.basemapMenu(e.currentTarget as HTMLElement)),
        btn('image', 'Screenshot (P)', () => screenshotPNG(w)),
        btn('video', 'Record video', () => this.recordDialog()),
        btn('share', 'Copy share link', () => this.copyLink()),
        btn('command', 'Command palette (Ctrl+K)', () => this.palette.open()),
        btn('help', 'Help & shortcuts (?)', () => this.showHelp()),
        btn('maximize', 'Presentation mode (F)', () => this.togglePresentation()),
        btn('sidebar', 'Toggle sidebar (\\)', () => this.toggleSidebar()),
      ),
    );

    // ---------------- toolbar
    this.toolbar = h('div', { class: 'mw-toolbar glass' });
    this.paintbar = h('div', { class: 'mw-paintbar glass' });
    this.toolhint = h('div', { class: 'mw-toolhint glass' });
    this.measure = h('div', { class: 'mw-measure glass' });
    this.tooltip = h('div', { class: 'mw-tooltip glass' });
    this.hud = h('div', { class: 'mw-hud glass' });
    this.legend = h('div', { class: 'mw-legend glass' });
    this.eventCard = h('div', { class: 'mw-eventcard glass' });
    this.recBadge = h('div', { class: 'mw-rec', onclick: () => this.recorder.stop(), title: 'Click to stop' }, h('span', { class: 'dot' }), 'REC — click to stop');
    const drop = h('div', { class: 'mw-drop' }, 'Drop GeoJSON, CSV, KML, GPX, TopoJSON, scenario or image files');

    // ---------------- sidebar
    this.tabsEl = h('div', { class: 'mw-tabs' });
    this.panelEl = h('div', { class: 'mw-panel' });
    const sidebar = h('div', { class: 'mw-sidebar glass' }, this.tabsEl, this.panelEl);

    // ---------------- timeline + minimap
    const timeline = new Timeline(w, () => this.recordDialog());
    const minimap = new Minimap(w);

    this.root.append(topbar, this.toolbar, this.paintbar, this.toolhint, this.measure, this.tooltip, this.hud, this.legend, this.eventCard, this.recBadge, sidebar, timeline.el, minimap.el, drop);
    this.root.classList.toggle('sidebar-open', this.sidebarOpen);

    this.buildToolbar();
    this.renderTabs();
    this.renderPanel();
    this.renderPaintbar();
    this.updateTopbar();

    // ---------------- events
    w.on('scenario', () => { this.invalidatePanel(); this.updateTopbar(); this.renderPaintbar(); this.scheduleSave(); this.renderLegend(); });
    w.on('settings', (s) => {
      document.documentElement.dataset.theme = s.theme;
      this.invalidatePanel();
      this.updateTopbar();
      this.scheduleHash();
    });
    w.on('history', () => this.updateTopbar());
    w.on('select', (sel) => { if (sel) this.openTab('inspect'); else this.invalidatePanel(); });
    w.on('tool', () => { this.buildToolbar(); this.renderPaintbar(); });
    w.on('toast', (t) => toast(t.message, t.kind, t.timeout));
    w.on('hover', (hv) => this.showTooltip(hv));
    w.on('time', () => { this.scheduleHash(); this.renderLegendThrottled(); if (this.tab === 'factions' || this.tab === 'inspect') this.invalidatePanelThrottled(); });
    w.on('frame', (st) => this.updateHud(st));
    w.on('eventsPassed', (evs) => this.showEventCard(evs[evs.length - 1]));
    w.on('basemap', () => this.invalidatePanel());
    w.on('world', () => this.invalidatePanel());
    w.map.on('moveend', () => this.scheduleHash());
    toolEvents.on('options', () => { this.renderPaintbar(); if (this.tab === 'factions') this.invalidatePanel(); });
    toolEvents.on('measure', (txt) => { this.measure.textContent = txt ?? ''; this.measure.classList.toggle('show', !!txt); });
    this.recorder.onstop = (blob, mime) => {
      this.recBadge.classList.remove('show');
      download(blob, `${w.scenario.meta.title.replace(/\W+/g, '-').toLowerCase()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`, mime);
      toast(`Video saved (${(blob.size / 1e6).toFixed(1)} MB)`, 'success');
    };

    this.bindKeyboard();
    this.bindDrop(drop);
    this.renderLegend();
  }

  // ------------------------------------------------------------------ top bar

  private updateTopbar() {
    const w = this.widget;
    this.titleEl.textContent = w.scenario.meta.title;
    this.undoBtn.disabled = !w.history.canUndo;
    this.redoBtn.disabled = !w.history.canRedo;
    this.undoBtn.title = w.history.canUndo ? `Undo ${w.history.nextUndoLabel} (Ctrl+Z)` : 'Nothing to undo';
    this.redoBtn.title = w.history.canRedo ? `Redo ${w.history.nextRedoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo';
    this.globeBtn.classList.toggle('on', w.settings.projection === 'globe');
    this.hud.classList.toggle('show', w.settings.perfHud);
  }

  private async renameScenario() {
    const w = this.widget;
    const r = await modal({ title: 'Scenario title', fields: [{ key: 'title', label: 'Title', type: 'text', value: w.scenario.meta.title }] });
    if (r?.title) w.commit('Rename scenario', ['meta'], (s) => (s.meta.title = r.title));
  }

  private basemapMenu(anchor: HTMLElement) {
    const w = this.widget;
    const items: Parameters<typeof menu>[1] = [];
    let group = '';
    for (const b of w.basemaps) {
      if (b.group !== group) {
        group = b.group;
        items.push({ header: group === 'Offline' ? 'Offline' : group === 'Vector' ? 'Vector (online)' : 'Raster (online)' });
      }
      items.push({ label: b.name, active: w.settings.basemap === b.id, onClick: () => w.updateSettings({ basemap: b.id }) });
    }
    menu(anchor, items);
  }

  scenarioMenu(anchor: HTMLElement) {
    const items: Parameters<typeof menu>[1] = [{ header: 'Demos' }];
    for (const d of this.demos) items.push({ label: d.label, hint: d.description, onClick: () => this.loadDemo(d) });
    items.push('sep', { header: 'File' });
    items.push({ label: 'New blank scenario…', onClick: () => this.newScenario() });
    items.push({ label: 'Open file…', hint: 'Ctrl+O', onClick: () => this.importFiles() });
    items.push({ label: 'Save to file', hint: 'Ctrl+S', onClick: () => exportScenarioFile(this.widget) });
    items.push({ label: 'Save in browser as…', onClick: () => this.saveAs() });
    items.push({ label: 'Open saved in browser…', onClick: () => this.openSavedMenu(anchor) });
    menu(anchor, items);
  }

  async loadDemo(d: DemoEntry) {
    toast(`Loading ${d.label}…`, 'info', 1500);
    try {
      const s = await d.load();
      this.widget.loadScenario(s);
      toast(`${d.label} loaded — press Space to play`, 'success');
    } catch (err) {
      console.error(err);
      toast(`Failed to load demo: ${(err as Error).message}`, 'error');
    }
  }

  private async newScenario() {
    const r = await modal({
      title: 'New scenario',
      fields: [
        { key: 'title', label: 'Title', type: 'text', value: 'My scenario' },
        { key: 'start', label: 'Start', type: 'time', value: '1900' },
        { key: 'end', label: 'End', type: 'time', value: '2000' },
        { key: 'res', label: 'Territory cell size', type: 'select', value: '3', options: [2, 3, 4, 5].map((x) => ({ value: String(x), label: `H3 res ${x} (~${formatArea(cellAreaKm2(x))})` })) },
        { key: 'factions', label: 'Number of factions', type: 'number', value: 3, min: 0, max: 40, step: 1 },
      ],
      submitLabel: 'Create',
    });
    if (!r) return;
    const start = parseTime(r.start) ?? 1900, end = parseTime(r.end) ?? 2000;
    const s = emptyScenario({ title: r.title, start, end: Math.max(end, start + 1e-3), h3Resolution: parseInt(r.res, 10), speed: (end - start) / 60, eventDuration: (end - start) * 0.03 });
    s.factions = Array.from({ length: r.factions ?? 3 }, (_, i) => ({ id: uid('f'), name: `Faction ${i + 1}`, color: paletteColor(i) }));
    this.widget.loadScenario(s, { keepView: true });
    setToolOptions({ faction: s.factions[0]?.id ?? null });
  }

  async saveAs() {
    const w = this.widget;
    const r = await modal({ title: 'Save in this browser', fields: [{ key: 'name', label: 'Name', type: 'text', value: w.scenario.meta.title }] });
    if (!r?.name) return;
    await saveScenario(`save:${r.name}`, w.exportScenario());
    toast('Saved', 'success');
  }

  async openSavedMenu(anchor: HTMLElement) {
    const saves = (await listSaves()).filter((s) => s.key.startsWith('save:'));
    if (!saves.length) return toast('No saved scenarios yet', 'info');
    const items: Parameters<typeof menu>[1] = saves.map((s) => ({ label: s.key.slice(5), hint: new Date(s.savedAt).toLocaleString(), onClick: async () => { const x = await loadSaved(s.key); if (x) this.widget.loadScenario(x.scenario); } }));
    menu(anchor, items.concat([{ label: 'Delete a save…', onClick: async () => {
      const r = await modal({ title: 'Delete save', fields: [{ key: 'k', label: 'Save', type: 'select', options: saves.map((s) => ({ value: s.key, label: s.key.slice(5) })) }] });
      if (r?.k) { await deleteSave(r.k); toast('Deleted', 'info'); }
    } }]));
  }

  private async copyLink() {
    const w = this.widget;
    const embed = await modal({
      title: 'Share',
      description: 'Copy a link to this view and moment. Optionally embed the whole scenario (compressed) so the link works anywhere without a file.',
      fields: [{ key: 'embed', label: 'Embed scenario in link', type: 'checkbox', value: w.scenario.layers.length === 0 }],
      submitLabel: 'Copy link',
    });
    if (!embed) return;
    try {
      const url = await shareLink(w, embed.embed);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast(`Link copied (${(url.length / 1024).toFixed(0)} KB)`, 'success');
    } catch (err) {
      toast((err as Error).message, 'error', 4000);
    }
  }

  // ------------------------------------------------------------------ search

  private buildSearch(): HTMLElement {
    const w = this.widget;
    const input = h('input', { type: 'text', placeholder: 'Search places, countries, events, units…  (/)' });
    const results = h('div', { class: 'results glass' });
    let items: { label: string; meta: string; go: () => void }[] = [];
    let sel = 0;
    const render = () => {
      results.replaceChildren(...items.map((it, i) => h('div', { class: `res ${i === sel ? 'sel' : ''}`, onmousedown: (e: MouseEvent) => { e.preventDefault(); it.go(); results.classList.remove('open'); input.blur(); } }, h('span', null, it.label), h('small', null, it.meta))));
      results.classList.toggle('open', items.length > 0);
    };
    const local = (q: string) => {
      const ql = q.toLowerCase();
      const out: typeof items = [];
      const prec = precisionForSpan(w.span);
      if (!ql) return out;
      for (const c of w.world?.list ?? []) if (c.name.toLowerCase().includes(ql)) out.push({ label: c.name, meta: 'country', go: () => w.fitBounds(c.bbox, 40) });
      for (const e of w.scenario.events) if (e.title.toLowerCase().includes(ql)) out.push({ label: e.title, meta: `event · ${formatTime(e.t, prec)}`, go: () => { w.setTime(e.t); w.flyTo({ center: e.position, zoom: e.zoom ?? 5 }); } });
      for (const u of w.scenario.units) if (u.name.toLowerCase().includes(ql)) out.push({ label: u.name, meta: 'unit', go: () => { w.setTime(u.path[0][2]); w.flyTo({ center: [u.path[0][0], u.path[0][1]], zoom: 4 }); } });
      for (const f of w.scenario.factions) if (f.name.toLowerCase().includes(ql)) out.push({ label: f.name, meta: 'faction', go: () => { setToolOptions({ faction: f.id }); if (f.capital) w.flyTo({ center: f.capital, zoom: 4 }); } });
      for (const b of w.scenario.bookmarks) if (b.name.toLowerCase().includes(ql)) out.push({ label: b.name, meta: 'bookmark', go: () => { if (b.t !== undefined) w.setTime(b.t); w.flyTo(b); } });
      for (const r of w.scenario.routes) if (r.name.toLowerCase().includes(ql)) out.push({ label: r.name, meta: 'route', go: () => w.flyTo({ center: r.waypoints[Math.floor(r.waypoints.length / 2)], zoom: 3 }) });
      const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (m) out.unshift({ label: `${m[1]}, ${m[2]}`, meta: 'lat, lon', go: () => w.flyTo({ center: [parseFloat(m[2]), parseFloat(m[1])], zoom: 8 }) });
      return out.slice(0, 12);
    };
    const geocode = async (q: string) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        const geo = data.map((d: any) => ({
          label: d.display_name.split(',').slice(0, 2).join(','),
          meta: d.type,
          go: () => (d.boundingbox ? w.fitBounds([+d.boundingbox[2], +d.boundingbox[0], +d.boundingbox[3], +d.boundingbox[1]], 40) : w.flyTo({ center: [+d.lon, +d.lat], zoom: 10 })),
        }));
        items = [...local(q), ...geo];
        if (!items.length) items = [{ label: 'No results', meta: '', go: () => {} }];
        render();
      } catch {
        toast('Online place search unavailable (offline?)', 'warn');
      }
    };
    input.addEventListener('input', () => { sel = 0; items = local(input.value); if (input.value.trim()) items.push({ label: `Search the world for “${input.value.trim()}”`, meta: 'Enter', go: () => geocode(input.value.trim()) }); render(); });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        const it = items[sel];
        if (it && !it.meta.startsWith('Enter')) { it.go(); results.classList.remove('open'); input.blur(); }
        else if (input.value.trim()) geocode(input.value.trim());
      } else if (e.key === 'Escape') { results.classList.remove('open'); input.blur(); }
    });
    input.addEventListener('blur', () => setTimeout(() => results.classList.remove('open'), 150));
    input.addEventListener('focus', () => items.length && results.classList.add('open'));
    return h('div', { class: 'mw-search' }, icon('search', 15), input, results);
  }

  // ------------------------------------------------------------------ toolbar & paint bar

  private buildToolbar() {
    const w = this.widget;
    const select = h('button', { class: `icon-btn ${!w.tool ? 'active' : ''}`, title: 'Select / inspect (Esc, S)', onclick: () => w.setTool(null) }, icon('pointer', 18), h('span', { class: 'kbd' }, 'S'));
    const groups: string[][] = [['paint', 'erase', 'wave', 'country', 'region'], ['unit', 'route', 'flow'], ['event', 'label', 'measure']];
    const children: HTMLElement[] = [select];
    for (const g of groups) {
      children.push(h('div', { class: 'sep' }));
      for (const id of g) {
        const t = this.tools.find((x) => x.id === id)!;
        children.push(h('button', { class: `icon-btn ${w.tool === t ? 'active' : ''}`, title: `${t.name}${t.shortcut ? ` (${t.shortcut})` : ''}`, onclick: () => w.setTool(w.tool === t ? null : t) }, icon(t.icon as any, 18), t.shortcut ? h('span', { class: 'kbd' }, t.shortcut) : null));
      }
    }
    this.toolbar.replaceChildren(...children);
    const t = w.tool;
    this.toolhint.innerHTML = t ? `<b>${esc(t.name)}</b> — ${esc(t.hint ?? '')} <span class="muted">Esc to exit.</span>` : '';
    this.toolhint.classList.toggle('show', !!t);
  }

  private renderPaintbar() {
    const w = this.widget;
    const t = w.tool;
    const show = !!t && ['paint', 'erase', 'wave', 'country', 'unit', 'region', 'event'].includes(t.id);
    this.paintbar.classList.toggle('show', show);
    if (!show) return;
    const cur = toolOptions.faction && w.factionIndex.has(toolOptions.faction) ? toolOptions.faction : w.scenario.factions[0]?.id;
    const chips = w.scenario.factions.map((f, i) =>
      h('button', { class: `chip ${f.id === cur ? 'sel' : ''}`, title: i < 9 ? `Shift+${i + 1}` : '', onclick: () => setToolOptions({ faction: f.id }) }, h('span', { class: 'swatch', style: `background:${f.color}` }), f.name),
    );
    const extras: HTMLElement[] = [];
    if (t!.id === 'paint' || t!.id === 'erase') {
      const out = h('small', { class: 'muted' }, `brush ${toolOptions.brush}`);
      const r = h('input', { type: 'range', min: 0, max: 25, step: 1, value: String(toolOptions.brush), style: 'width:90px' });
      r.addEventListener('input', () => { toolOptions.brush = +r.value; out.textContent = `brush ${r.value}`; });
      r.addEventListener('change', () => setToolOptions({ brush: +r.value }));
      extras.push(h('span', { style: 'display:inline-flex;align-items:center;gap:6px;margin-left:6px' }, out, r));
      extras.push(h('label', { class: 'chip', title: 'Only paint cells on land' }, h('input', { type: 'checkbox', checked: toolOptions.landOnly, onchange: (e: Event) => setToolOptions({ landOnly: (e.target as HTMLInputElement).checked }) }), 'land only'));
    }
    if (t!.id === 'country') {
      extras.push(h('label', { class: 'chip', title: 'Fill countries with territory cells instead of whole-country ownership' }, h('input', { type: 'checkbox', checked: toolOptions.countryAsCells, onchange: (e: Event) => setToolOptions({ countryAsCells: (e.target as HTMLInputElement).checked }) }), 'as cells'));
    }
    this.paintbar.replaceChildren(...chips, h('button', { class: 'chip', title: 'Add faction', onclick: () => {
      const i = w.scenario.factions.length;
      const id = uid('f');
      w.commit('Add faction', ['factions'], (s) => s.factions.push({ id, name: `Faction ${i + 1}`, color: paletteColor(i) }));
      setToolOptions({ faction: id });
    } }, '+'), ...extras);
  }

  // ------------------------------------------------------------------ sidebar

  private renderTabs() {
    this.tabsEl.replaceChildren(...TABS.map((t) => h('button', { class: `tab ${this.tab === t.id ? 'active' : ''}`, onclick: () => this.openTab(t.id) }, icon(t.icon, 16), t.label)));
  }

  openTab(id: TabId) {
    if (!this.sidebarOpen) this.toggleSidebar(true);
    this.tab = id;
    this.renderTabs();
    this.renderPanel();
  }

  toggleSidebar(force?: boolean) {
    this.sidebarOpen = force ?? !this.sidebarOpen;
    this.root.classList.toggle('sidebar-open', this.sidebarOpen);
    setTimeout(() => this.widget.map.resize(), 220);
    if (this.sidebarOpen) this.renderPanel();
  }

  private invalidatePanel() {
    if (this.panelDirty) return;
    this.panelDirty = true;
    requestAnimationFrame(() => {
      this.panelDirty = false;
      // don't yank inputs from under the user's cursor
      const active = document.activeElement;
      if (active && this.panelEl.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && (active as HTMLInputElement).type !== 'range' && (active as HTMLInputElement).type !== 'checkbox') return;
      this.renderPanel();
    });
  }

  private lastThrottle = 0;
  private invalidatePanelThrottled() {
    const now = performance.now();
    if (now - this.lastThrottle < 400) return;
    this.lastThrottle = now;
    this.invalidatePanel();
  }

  private renderPanel() {
    if (!this.sidebarOpen) return;
    const w = this.widget;
    const scroll = this.panelEl.scrollTop;
    let el: HTMLElement;
    switch (this.tab) {
      case 'inspect': el = inspectPanel(w, this); break;
      case 'layers': el = layersPanel(w); break;
      case 'factions': el = factionsPanel(w); break;
      case 'scenario': el = scenarioPanel(w, this); break;
      case 'camera': el = cameraPanel(w); break;
      case 'data': el = dataPanel(w, this); break;
      case 'settings': el = settingsPanel(w, this); break;
    }
    this.panelEl.replaceChildren(el);
    this.panelEl.scrollTop = scroll;
  }

  // ------------------------------------------------------------------ floating UI

  private showTooltip(hv: { x: number; y: number; html: string } | null) {
    if (!hv) {
      this.tooltip.style.display = 'none';
      return;
    }
    this.tooltip.innerHTML = hv.html;
    this.tooltip.style.display = 'block';
    const mapRect = this.widget.container.getBoundingClientRect();
    const tw = this.tooltip.offsetWidth, th = this.tooltip.offsetHeight;
    let x = mapRect.left + hv.x + 14, y = mapRect.top + hv.y + 14;
    if (x + tw > window.innerWidth - 8) x = mapRect.left + hv.x - tw - 14;
    if (y + th > window.innerHeight - 8) y = mapRect.top + hv.y - th - 14;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  private hudFrame = 0;
  private updateHud(st: { fps: number; frameMs: number; layerMs: number; layers: number; cells: number; ownedCells: number; vessels: number }) {
    if (!this.widget.settings.perfHud) return;
    this.fpsHistory.push(st.fps);
    if (this.fpsHistory.length > 120) this.fpsHistory.shift();
    if (++this.hudFrame % 6) return;
    const w = this.widget;
    const mem = (performance as any).memory?.usedJSHeapSize;
    const cls = st.fps >= 50 ? 'good' : st.fps < 25 ? 'bad' : '';
    this.hud.innerHTML = `<div><b class="${cls}">${st.fps} fps</b> · build ${st.layerMs.toFixed(1)} ms</div>
      <div>deck layers ${st.layers} · labels ${w.labels.drawn}</div>
      <div>cells ${st.cells.toLocaleString()} (owned ${st.ownedCells.toLocaleString()})</div>
      <div>vessels ${st.vessels.toLocaleString()}${w.stress ? ` · stress ${w.stress.n.toLocaleString()}` : ''}</div>
      ${mem ? `<div>heap ${(mem / 1e6).toFixed(0)} MB</div>` : ''}`;
    const c = h('canvas');
    this.hud.append(c);
    c.width = 340; c.height = 68;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.fpsHistory.forEach((f, i) => {
      const x = (i / 119) * c.width, y = c.height - (Math.min(f, 120) / 120) * c.height;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }

  private legendTimer = 0;
  private renderLegendThrottled() {
    if (this.legendTimer) return;
    this.legendTimer = window.setTimeout(() => { this.legendTimer = 0; this.renderLegend(); }, 150);
  }

  private renderLegend() {
    const w = this.widget;
    const tl = w.territory.timeline;
    const area = cellAreaKm2(w.scenario.meta.h3Resolution);
    const rows = w.scenario.factions
      .map((f, i) => ({ f, cells: tl.counts[i] ?? 0, countries: w.countryTimeline.counts[i] ?? 0 }))
      .filter((r) => r.cells > 0 || r.countries > 0)
      .sort((a, b) => b.cells - a.cells || b.countries - a.countries);
    const show = rows.length > 0 && !w.tool;
    this.legend.style.display = show ? '' : 'none';
    if (!show) return;
    this.legend.replaceChildren(
      h('div', { class: 'lg-title' }, formatTime(w.time, precisionForSpan(w.span))),
      ...rows.slice(0, 10).map((r) => h('div', { class: 'lg-row', style: 'cursor:pointer', onclick: () => setToolOptions({ faction: r.f.id }) },
        h('span', { class: 'swatch', style: `background:${r.f.color}` }),
        h('span', null, r.f.name),
        h('span', { class: 'v' }, r.cells ? formatAreaCompact(r.cells * area) : `${r.countries} ${r.countries === 1 ? 'country' : 'countries'}`),
      )),
      ...(rows.length > 10 ? [h('small', { class: 'muted' }, `+${rows.length - 10} more`)] : []),
    );
  }

  private showEventCard(e: { title: string; t: number; description?: string; kind: string } | undefined) {
    if (!e || !this.widget.settings.eventToasts) return;
    const prec = precisionForSpan(this.widget.span);
    this.eventCard.innerHTML = `<div class="when">${esc(formatTime(e.t, prec))} · ${esc(e.kind.toUpperCase())}</div><div class="what">${esc(e.title)}</div>${e.description ? `<div class="muted">${esc(e.description)}</div>` : ''}`;
    this.eventCard.classList.add('show');
    clearTimeout(this.eventCardTimer);
    this.eventCardTimer = window.setTimeout(() => this.eventCard.classList.remove('show'), 4200);
  }

  // ------------------------------------------------------------------ modes

  togglePresentation() {
    this.root.classList.toggle('presentation');
    setTimeout(() => this.widget.map.resize(), 50);
    if (this.root.classList.contains('presentation')) toast('Presentation mode — press F or Esc to exit', 'info');
  }

  async recordDialog() {
    const w = this.widget;
    if (this.recorder.recording) return this.recorder.stop();
    if (!Recorder.supported()) return toast('Video recording is not supported in this browser', 'error');
    const r = await modal({
      title: 'Record video',
      description: 'Records the map with labels, a burned-in title, date and legend. Tip: enable Director mode for cinematic camera moves.',
      fields: [
        { key: 'mode', label: 'What to record', type: 'select', value: 'full', options: [{ value: 'full', label: 'Full timeline playthrough (auto-stops)' }, { value: 'manual', label: 'Manual (stop with the REC badge)' }] },
        { key: 'duration', label: 'Playthrough length (seconds)', type: 'number', value: Math.round(w.span / w.speed), min: 3 },
        { key: 'fps', label: 'Frame rate', type: 'select', value: '30', options: [{ value: '30', label: '30 fps' }, { value: '60', label: '60 fps' }] },
        { key: 'burnIn', label: 'Burn in title, date & legend', type: 'checkbox', value: true },
        { key: 'presentation', label: 'Hide UI while recording', type: 'checkbox', value: true },
      ],
      submitLabel: 'Start recording',
    });
    if (!r) return;
    if (r.presentation && !this.root.classList.contains('presentation')) {
      this.togglePresentation();
      const off = w.on('play', (p) => { if (!p && r.mode === 'full') { off(); setTimeout(() => this.root.classList.contains('presentation') && this.togglePresentation(), 800); } });
    }
    this.recBadge.classList.add('show');
    this.recorder.start({ fullRun: r.mode === 'full', duration: r.duration, fps: parseInt(r.fps, 10), burnIn: r.burnIn });
  }

  showHelp() {
    const keys: [string, string][] = [
      ['Space', 'Play / pause'], [', / .', 'Previous / next change'], ['← / →', 'Step time (Shift: ×10)'], ['Home / End', 'Start / end'],
      ['[ / ]', 'Brush size (paint) or speed'], ['D', 'Director mode'], ['K', 'Add camera keyframe'], ['G', 'Globe / flat'],
      ['S / Esc', 'Select tool'], ['B / E', 'Paint / erase'], ['W', 'Conquest wave'], ['C', 'Assign country'], ['U', 'Army / unit path'],
      ['R', 'Shipping route'], ['F', 'Presentation mode'], ['V', 'Event marker'], ['T', 'Label'], ['M', 'Measure'],
      ['Shift+1…9', 'Select faction'], ['Alt+1…9', 'Go to bookmark'], ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'], ['Ctrl+K', 'Command palette'],
      ['Ctrl+S / Ctrl+O', 'Save / open file'], ['P', 'Screenshot'], ['\\', 'Toggle sidebar'], ['H', 'Toggle timeline'], ['/', 'Search'], ['?', 'This help'],
    ];
    const body = h('div', null,
      h('p', { class: 'muted' }, 'Paint territory with H3 hex cells, sweep conquests across regions with the wave tool, draw armies and fleets with timed paths, add shipping lanes with animated vessels, and direct the camera with keyframes. Everything is undoable and saved automatically.'),
      h('div', { class: 'help-grid' }, ...keys.map(([k, v]) => h('div', null, h('span', null, v), h('kbd', null, k)))),
      h('p', { class: 'muted', style: 'margin-top:12px' }, 'Mouse: drag to pan, right-drag / Ctrl-drag to rotate & tilt, scroll to zoom. On the timeline: drag to scrub, wheel to zoom, Shift-drag to pan, Alt-drag snaps to events, double-click resets.'),
    );
    modal({ title: 'Atlas — help', wide: true, body, cancelLabel: null, submitLabel: 'Got it' });
  }

  // ------------------------------------------------------------------ commands

  private commands(): Command[] {
    const w = this.widget;
    const cmds: Command[] = [];
    cmds.push({ id: 'play', group: 'Time', label: w.playing ? 'Pause' : 'Play', hint: 'Space', run: () => w.togglePlay() });
    cmds.push({ id: 'start', group: 'Time', label: 'Go to start', run: () => w.setTime(w.scenario.meta.start) });
    cmds.push({ id: 'end', group: 'Time', label: 'Go to end', run: () => w.setTime(w.scenario.meta.end) });
    cmds.push({ id: 'director', group: 'Camera', label: `${w.settings.director ? 'Disable' : 'Enable'} director mode`, hint: 'D', run: () => w.updateSettings({ director: !w.settings.director }) });
    cmds.push({ id: 'key', group: 'Camera', label: 'Add camera keyframe', hint: 'K', run: () => w.addCameraKey() });
    cmds.push({ id: 'bm', group: 'Camera', label: 'Bookmark this view', run: () => w.addBookmark() });
    for (const b of w.scenario.bookmarks) cmds.push({ id: `bm-${b.id}`, group: 'Go to', label: b.name, run: () => { if (b.t !== undefined) w.setTime(b.t); w.flyTo(b); } });
    for (const t of this.tools) cmds.push({ id: `tool-${t.id}`, group: 'Tool', label: t.name, hint: t.shortcut, run: () => w.setTool(t) });
    for (const b of w.basemaps) cmds.push({ id: `bm-${b.id}`, group: 'Basemap', label: b.name, run: () => w.updateSettings({ basemap: b.id }) });
    cmds.push({ id: 'proj', group: 'View', label: 'Toggle globe / flat map', hint: 'G', run: () => w.updateSettings({ projection: w.settings.projection === 'globe' ? 'mercator' : 'globe' }) });
    cmds.push({ id: 'pres', group: 'View', label: 'Presentation mode', hint: 'F', run: () => this.togglePresentation() });
    cmds.push({ id: 'fs', group: 'View', label: 'Fullscreen', run: () => document.documentElement.requestFullscreen?.() });
    const toggles: [keyof typeof w.settings, string][] = [
      ['graticule', 'graticule'], ['terminator', 'day/night terminator'], ['countryLabels', 'country labels'], ['terrain', '3D terrain'], ['hillshade', 'hillshade'],
      ['territoryBorders', 'territory borders'], ['conquestGlow', 'conquest glow'], ['territoryExtrude', '3D territory extrusion'], ['factionLabels', 'faction labels'],
      ['perfHud', 'performance HUD'], ['minimap', 'minimap'], ['plannedPaths', 'planned unit paths'], ['modernBorders', 'modern borders'], ['ambientAnimation', 'ambient animation'],
    ];
    for (const [k, label] of toggles) cmds.push({ id: `t-${k}`, group: 'Toggle', label: `${w.settings[k] ? 'Hide' : 'Show'} ${label}`, run: () => w.updateSettings({ [k]: !w.settings[k] } as any) });
    cmds.push({ id: 'theme', group: 'View', label: 'Toggle light / dark UI', run: () => w.updateSettings({ theme: w.settings.theme === 'dark' ? 'light' : 'dark' }) });
    for (const d of this.demos) cmds.push({ id: `demo-${d.id}`, group: 'Demo', label: d.label, run: () => this.loadDemo(d) });
    cmds.push({ id: 'new', group: 'File', label: 'New scenario…', run: () => this.newScenario() });
    cmds.push({ id: 'open', group: 'File', label: 'Open / import file…', hint: 'Ctrl+O', run: () => this.importFiles() });
    cmds.push({ id: 'save', group: 'File', label: 'Save scenario file', hint: 'Ctrl+S', run: () => exportScenarioFile(w) });
    cmds.push({ id: 'shot', group: 'Export', label: 'Screenshot', hint: 'P', run: () => screenshotPNG(w) });
    cmds.push({ id: 'rec', group: 'Export', label: 'Record video…', run: () => this.recordDialog() });
    cmds.push({ id: 'share', group: 'Export', label: 'Copy share link…', run: () => this.copyLink() });
    cmds.push({ id: 'stress1', group: 'Performance', label: 'Stress test: 1M points', run: () => { w.setStress(1e6); w.updateSettings({ perfHud: true }); } });
    cmds.push({ id: 'stress5', group: 'Performance', label: 'Stress test: 5M points', run: () => { w.setStress(5e6); w.updateSettings({ perfHud: true }); } });
    cmds.push({ id: 'stress0', group: 'Performance', label: 'Clear stress test', run: () => w.setStress(0) });
    for (const t of TABS) cmds.push({ id: `tab-${t.id}`, group: 'Panel', label: t.label, run: () => this.openTab(t.id) });
    cmds.push({ id: 'help', group: 'Help', label: 'Keyboard shortcuts', hint: '?', run: () => this.showHelp() });
    return cmds;
  }

  // ------------------------------------------------------------------ keyboard

  private bindKeyboard() {
    const w = this.widget;
    window.addEventListener('keydown', (e) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable)) return;
      if (document.querySelector('.mw-overlay') || this.palette.isOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      if (w.tool?.onKey?.(e)) { e.preventDefault(); return; }
      const k = e.key;
      if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? w.redo() : w.undo(); return; }
      if (mod && k.toLowerCase() === 'y') { e.preventDefault(); w.redo(); return; }
      if (mod && k.toLowerCase() === 'k') { e.preventDefault(); this.palette.open(); return; }
      if (mod && k.toLowerCase() === 's') { e.preventDefault(); exportScenarioFile(w); return; }
      if (mod && k.toLowerCase() === 'o') { e.preventDefault(); this.importFiles(); return; }
      if (mod) return;
      if (e.altKey && /^[1-9]$/.test(k)) {
        const b = w.scenario.bookmarks[+k - 1];
        if (b) { if (b.t !== undefined) w.setTime(b.t); w.flyTo(b); }
        e.preventDefault();
        return;
      }
      if (e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
        const f = w.scenario.factions[+e.code.slice(5) - 1];
        if (f) { setToolOptions({ faction: f.id }); toast(f.name, 'info', 900); }
        return;
      }
      const step = w.span / 200 * (e.shiftKey ? 10 : 1);
      switch (k) {
        case ' ': e.preventDefault(); w.togglePlay(); return;
        case 'ArrowRight': e.preventDefault(); w.setTime(w.time + step); return;
        case 'ArrowLeft': e.preventDefault(); w.setTime(w.time - step); return;
        case ',': w.stepEvent(-1); return;
        case '.': w.stepEvent(1); return;
        case 'Home': w.setTime(w.scenario.meta.start); return;
        case 'End': w.setTime(w.scenario.meta.end); return;
        case '[': w.setSpeed(w.speed / 1.5); toast(`Speed ${(1 / 1.5).toFixed(2)}×`, 'info', 700); return;
        case ']': w.setSpeed(w.speed * 1.5); toast('Speed 1.5×', 'info', 700); return;
        case 'Escape':
          if (this.root.classList.contains('presentation')) this.togglePresentation();
          else if (w.tool) w.setTool(null);
          else w.select(null);
          return;
        case '?': this.showHelp(); return;
        case '/': e.preventDefault(); (this.root.querySelector('.mw-search input') as HTMLInputElement)?.focus(); return;
        case '\\': this.toggleSidebar(); return;
      }
      switch (k.toLowerCase()) {
        case 'd': w.updateSettings({ director: !w.settings.director }); toast(`Director ${w.settings.director ? 'on' : 'off'}`, 'info', 900); return;
        case 'k': w.addCameraKey(); toast('Camera keyframe added', 'success', 900); return;
        case 'g': w.updateSettings({ projection: w.settings.projection === 'globe' ? 'mercator' : 'globe' }); return;
        case 'f': this.togglePresentation(); return;
        case 'p': screenshotPNG(w); return;
        case 'h': this.root.classList.toggle('timeline-hidden'); setTimeout(() => w.map.resize(), 50); return;
        case 's': w.setTool(null); return;
      }
      const t = this.tools.find((x) => x.shortcut?.toLowerCase() === k.toLowerCase());
      if (t) w.setTool(w.tool === t ? null : t);
    });
  }

  // ------------------------------------------------------------------ import / drag & drop

  async importFiles(files?: File[]) {
    files ??= await pickFile('.json,.geojson,.topojson,.csv,.tsv,.txt,.kml,.gpx,image/*', true);
    const w = this.widget;
    for (const f of files) {
      try {
        const r = await importFile(f);
        if (r.kind === 'scenario') {
          if (w.scenario.cells.length + w.scenario.units.length > 0 && !(await confirmDialog('Replace current scenario?', `Load “${r.scenario.meta?.title ?? f.name}”? Your current work stays in autosave until something new is saved.`, 'Load'))) continue;
          w.loadScenario(r.scenario);
          toast(`Loaded ${r.scenario.meta.title}`, 'success');
        } else if (r.kind === 'layer') {
          w.commit('Import data', ['layers'], (s) => s.layers.push(r.layer));
          toast(`Imported ${r.layer.data.features.length.toLocaleString()} features from ${f.name}`, 'success');
          this.openTab('data');
          (r.layer as any)._open = true;
        } else {
          w.commit('Add image overlay', ['images'], (s) => s.images.push({ id: uid('img'), name: r.name, url: r.url, corners: viewCorners(w), opacity: 0.75, visible: true }));
          toast('Image pinned to the current view — adjust in Data panel', 'success', 3500);
        }
      } catch (err) {
        console.error(err);
        toast(`${f.name}: ${(err as Error).message}`, 'error', 5000);
      }
    }
  }

  private bindDrop(overlay: HTMLElement) {
    let depth = 0;
    window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { depth++; overlay.classList.add('show'); } });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) overlay.classList.remove('show'); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      overlay.classList.remove('show');
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) this.importFiles(files);
      else {
        const text = e.dataTransfer?.getData('text');
        if (text) try {
          const r = importJSON(JSON.parse(text));
          if (r.kind === 'layer') this.widget.commit('Import data', ['layers'], (s) => s.layers.push(r.layer));
        } catch { /* ignore */ }
      }
    });
    window.addEventListener('paste', (e) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
      const text = e.clipboardData?.getData('text');
      if (!text || text.length < 10) return;
      try {
        const r = importJSON(JSON.parse(text), 'Pasted');
        if (r.kind === 'layer') { this.widget.commit('Paste data', ['layers'], (s) => s.layers.push(r.layer)); toast('Pasted GeoJSON as a data layer', 'success'); }
        else if (r.kind === 'scenario') this.widget.loadScenario(r.scenario);
      } catch { /* not JSON */ }
    });
  }

  // ------------------------------------------------------------------ persistence

  private scheduleSave() {
    if (!this.widget.settings.autosave) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      saveScenario('autosave', this.widget.exportScenario()).catch((err) => console.warn('autosave failed', err));
    }, 1200);
  }

  private scheduleHash() {
    if (!this.widget.settings.hashState) return;
    clearTimeout(this.hashTimer);
    this.hashTimer = window.setTimeout(() => {
      const cur = parseHash(location.hash);
      // keep an embedded scenario out of the URL once loaded (it's in autosave)
      const hsh = viewHash(this.widget) + (cur.demo ? `&demo=${cur.demo}` : '');
      history.replaceState(null, '', `#${hsh}`);
    }, 400);
  }
}

export { describePick };
