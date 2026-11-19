import type { MapWidget, Selection } from '../widget/MapWidget';
import type { Settings } from '../widget/settings';
import { DEFAULT_SETTINGS } from '../widget/settings';
import { h, icon, modal, confirmDialog, toast, download, menu, type Field } from './dom';
import { formatTime, parseTime, precisionForSpan, formatDuration } from '../core/time';
import { formatArea, formatAreaCompact, formatDistance, pathLengthKm, bboxOfPoints, timestampPath, type LonLat } from '../core/geo';
import { seaRouteVia } from '../core/h3client';
import { paletteColor, RAMPS } from '../core/color';
import { uid, defaultDataStyle, type DataLayer, type DataRender, type Scenario } from '../core/scenario';
import { cellAreaKm2 } from '../layers/build';
import { prepare } from '../layers/data';
import { setToolOptions, toolOptions, toolEvents, formatTimeInput, timeField, factionField } from '../tools/tools';
import { cellToChildren, cellToParent, getResolution } from 'h3-js';
import { exportEventsCSV, exportFeatures, exportScenarioFile, exportTerritory, screenshotPNG, shareLink } from '../io/export';
import type { App } from './app';
import { autoDirect } from '../core/director';

// ------------------------------------------------------------------ small widgets

function toggle(label: string, value: boolean, onChange: (v: boolean) => void, hint?: string): HTMLElement {
  const input = h('input', { type: 'checkbox', checked: value, onchange: () => onChange(input.checked) });
  return h('label', { class: 'toggle', title: hint ?? '' }, h('span', null, label), input);
}

function slider(label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, fmt: (v: number) => string = (v) => String(v)): HTMLElement {
  const out = h('output', null, fmt(value));
  const input = h('input', { type: 'range', min, max, step, value: String(value) });
  input.addEventListener('input', () => {
    out.textContent = fmt(parseFloat(input.value));
    onChange(parseFloat(input.value));
  });
  return h('div', { class: 'slider' }, h('span', null, label), input, out);
}

function select(value: string, options: { value: string; label: string }[], onChange: (v: string) => void, attrs: Record<string, any> = {}): HTMLSelectElement {
  const s = h('select', { ...attrs, onchange: () => onChange(s.value) }, ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  return s;
}

function setting<K extends keyof Settings>(w: MapWidget, key: K) {
  return (v: Settings[K]) => w.updateSettings({ [key]: v } as Partial<Settings>);
}

function section(title: string, ...right: (HTMLElement | null)[]): HTMLElement {
  return h('h4', null, h('span', null, title), h('span', { style: 'display:flex;gap:4px' }, ...right));
}

function smallBtn(ic: Parameters<typeof icon>[0], title: string, onclick: (e: MouseEvent) => void): HTMLButtonElement {
  return h('button', { class: 'icon-btn', title, onclick: (e: MouseEvent) => { e.stopPropagation(); onclick(e); } }, icon(ic, 14));
}

function fmtT(w: MapWidget, t: number | undefined) {
  return t === undefined ? '—' : formatTime(t, precisionForSpan(w.span));
}

// ------------------------------------------------------------------ Layers & basemap

export function layersPanel(w: MapWidget): HTMLElement {
  const s = w.settings;
  const sc = w.scenario;
  const groups: Record<string, typeof w.basemaps> = {};
  for (const b of w.basemaps) (groups[b.group] ??= []).push(b);
  return h(
    'div',
    null,
    section('Basemap'),
    ...Object.entries(groups).map(([g, list]) =>
      h('div', null,
        h('small', { class: 'muted' }, g === 'Offline' ? 'Offline (bundled Natural Earth)' : g === 'Vector' ? 'Vector tiles (online)' : 'Raster tiles (online)'),
        h('div', { class: 'basemap-grid', style: 'margin:4px 0 10px' }, ...list.map((b) => h('button', { class: `basemap-card ${s.basemap === b.id ? 'active' : ''}`, onclick: () => w.updateSettings({ basemap: b.id }) }, b.name))),
      ),
    ),
    toggle('Globe projection', s.projection === 'globe', (v) => w.updateSettings({ projection: v ? 'globe' : 'mercator' })),
    toggle('Modern borders (offline maps)', s.modernBorders, setting(w, 'modernBorders')),
    toggle('3D terrain (online)', s.terrain, setting(w, 'terrain')),
    s.terrain ? slider('Exaggeration', s.terrainExaggeration, 0.5, 5, 0.1, setting(w, 'terrainExaggeration'), (v) => `${v.toFixed(1)}×`) : null,
    toggle('Hillshade (online)', s.hillshade, setting(w, 'hillshade')),
    toggle('Graticule', s.graticule, setting(w, 'graticule')),
    toggle('Auto-rotate globe', s.autoRotate, setting(w, 'autoRotate')),
    toggle('Day / night terminator', s.terminator, setting(w, 'terminator'), 'Computed for the current timeline date'),
    toggle('Country labels', s.countryLabels, setting(w, 'countryLabels')),

    section('Scenario layers'),
    toggle(`Territory (${w.territory.timeline.keys.length.toLocaleString()} cells)`, s.showTerritory, setting(w, 'showTerritory')),
    toggle(`Country control (${sc.countries.length})`, s.showCountries, setting(w, 'showCountries')),
    toggle(`Regions (${sc.regions.length})`, s.showRegions, setting(w, 'showRegions')),
    toggle(`Units & armies (${sc.units.length})`, s.showUnits, setting(w, 'showUnits')),
    toggle(`Routes (${sc.routes.length})`, s.showRoutes, setting(w, 'showRoutes')),
    toggle('Vessels on routes', s.showVessels, setting(w, 'showVessels')),
    toggle(`Flows (${sc.flows.length})`, s.showFlows, setting(w, 'showFlows')),
    toggle(`Events (${sc.events.length})`, s.showEvents, setting(w, 'showEvents')),
    toggle(`Labels (${sc.annotations.length})`, s.showAnnotations, setting(w, 'showAnnotations')),
    toggle(`Data layers (${sc.layers.length})`, s.showData, setting(w, 'showData')),

    section('Territory style'),
    slider('Opacity', s.territoryOpacity, 0.05, 1, 0.01, setting(w, 'territoryOpacity'), (v) => `${Math.round(v * 100)}%`),
    toggle('Borders', s.territoryBorders, setting(w, 'territoryBorders')),
    slider('Border width', s.borderWidth, 0.5, 5, 0.1, setting(w, 'borderWidth'), (v) => `${v.toFixed(1)}px`),
    toggle('Conquest glow', s.conquestGlow, setting(w, 'conquestGlow')),
    slider('Glow duration', s.glowFraction, 0.002, 0.1, 0.001, setting(w, 'glowFraction'), (v) => formatDuration(v * w.span)),
    toggle('3D extrusion by age', s.territoryExtrude, setting(w, 'territoryExtrude')),
    toggle('Show H3 cell grid', s.cellGrid, setting(w, 'cellGrid'), 'Always shown while painting when zoomed in'),
    toggle('Highlight front lines', s.frontLines, setting(w, 'frontLines'), 'Borders between rival factions glow'),
    toggle('Faction names', s.factionLabels, setting(w, 'factionLabels')),
    toggle('Capitals', s.capitals, setting(w, 'capitals')),

    section('Units & routes'),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Trail'), select(s.unitTrail, [{ value: 'fade', label: 'Fading' }, { value: 'full', label: 'Full path travelled' }], (v) => w.updateSettings({ unitTrail: v as any }))),
    s.unitTrail === 'fade' ? slider('Trail length', s.unitTrailFraction, 0.005, 0.3, 0.005, setting(w, 'unitTrailFraction'), (v) => formatDuration(v * w.span)) : null,
    toggle('Planned paths (dashed)', s.plannedPaths, setting(w, 'plannedPaths')),
    toggle('Unit names', s.unitLabels, setting(w, 'unitLabels')),
    slider('Unit size', s.unitScale, 0.5, 2.5, 0.05, setting(w, 'unitScale'), (v) => `${v.toFixed(2)}×`),
    toggle('Animate vessels continuously', s.ambientAnimation, setting(w, 'ambientAnimation'), 'Off = vessels move with the timeline instead'),
    slider('Vessel speed', s.vesselSpeed, 0.1, 5, 0.1, setting(w, 'vesselSpeed'), (v) => `${v.toFixed(1)}×`),
    slider('Vessel size', s.vesselScale, 0.4, 3, 0.1, setting(w, 'vesselScale'), (v) => `${v.toFixed(1)}×`),
    toggle('Event titles', s.eventLabels, setting(w, 'eventLabels')),
  );
}

// ------------------------------------------------------------------ Factions

export function factionsPanel(w: MapWidget): HTMLElement {
  const sc = w.scenario;
  const res = sc.meta.h3Resolution;
  const tl = w.territory.timeline;
  const areas = w.factionAreas();
  const totalArea = areas.reduce((a, b) => a + b, 0);
  const list = h('div');
  sc.factions.forEach((f, i) => {
    const fa = areas[i];
    const countries = w.countryTimeline.counts[i] ?? 0;
    const color = h('input', { type: 'color', value: f.color, title: 'Colour', onchange: () => w.commit('Recolour faction', ['factions'], (s) => (s.factions[i].color = color.value)) });
    const name = h('input', { type: 'text', value: f.name, style: 'flex:1;min-width:0', onchange: () => w.commit('Rename faction', ['factions'], (s) => (s.factions[i].name = name.value)) });
    const selected = (toolOptions.faction ?? sc.factions[0]?.id) === f.id;
    list.append(
      h('div', { class: `list-item ${selected ? 'sel' : ''}`, onclick: (e: MouseEvent) => { if ((e.target as HTMLElement).tagName !== 'INPUT') setToolOptions({ faction: f.id }); } },
        color,
        name,
        h('span', { class: 'meta', title: fa ? `${formatArea(fa)} at the current time${countries ? ` (incl. ${countries} countr${countries === 1 ? 'y' : 'ies'})` : ''}` : 'No territory at the current time' }, fa ? formatAreaCompact(fa) : ''),
        h('span', { class: 'acts' },
          smallBtn('target', 'Zoom to territory', () => zoomToFaction(w, i)),
          smallBtn('pin', 'Set capital: click on the map', () => pickCapital(w, i)),
          smallBtn('trash', 'Delete faction', async () => {
            if (!(await confirmDialog(`Delete ${f.name}?`, 'Its territory events, units and country assignments will be unassigned.'))) return;
            w.commit('Delete faction', ['factions', 'countries', 'units', 'events', 'regions'], (s) => {
              s.factions.splice(i, 1);
              s.countries = s.countries.filter((c) => c.faction !== f.id);
              for (const u of s.units) if (u.faction === f.id) u.faction = undefined;
              for (const e of s.events) if (e.faction === f.id) e.faction = undefined;
              for (const r of s.regions) if (r.faction === f.id) r.faction = undefined;
            });
            const before = sc.cells.length;
            w.scenario.cells = w.scenario.cells.map((c) => (c.faction === f.id ? { ...c, faction: null } : c));
            w.changed(['cells']);
            if (before) toast('Territory released', 'info');
          }),
        ),
      ),
    );
  });
  return h(
    'div',
    null,
    section('Factions', h('button', { class: 'btn small', onclick: () => addFaction(w) }, icon('plus', 12), 'Add')),
    h('small', { class: 'muted' }, 'Click a faction to select it for painting. Areas are at the current time.'),
    list,
    h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'grow muted' }, `Total held: ${formatArea(totalArea)}`)),
    section('Territory grid'),
    h('div', { class: 'row' },
      h('span', { class: 'grow' }, 'H3 resolution'),
      select(String(res), [2, 3, 4, 5, 6].map((r) => ({ value: String(r), label: `${r} · ~${formatArea(cellAreaKm2(r))}/cell` })), (v) => changeResolution(w, parseInt(v, 10))),
    ),
    h('div', { class: 'kv' }, h('span', null, 'Cells tracked'), h('span', null, tl.keys.length.toLocaleString()), h('span', null, 'Ownership events'), h('span', null, sc.cells.length.toLocaleString()), h('span', null, 'Country events'), h('span', null, sc.countries.length.toLocaleString())),
    section('Brush'),
    slider('Brush radius', toolOptions.brush, 0, 25, 1, (v) => setToolOptions({ brush: v }), (v) => `${v} rings`),
    toggle('Paint land only', toolOptions.landOnly, (v) => setToolOptions({ landOnly: v })),
    toggle('Country tool fills cells', toolOptions.countryAsCells, (v) => setToolOptions({ countryAsCells: v })),
    section('Bulk edits'),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn small', onclick: async () => (await confirmDialog('Clear future territory?', `Removes all territory changes after ${fmtT(w, w.time)}.`)) && w.clearTerritoryAfter(w.time) }, 'Clear after now'),
      h('button', { class: 'btn small danger', onclick: async () => (await confirmDialog('Clear all territory?', 'Removes every cell ownership event.')) && w.clearAllTerritory() }, 'Clear all cells'),
      h('button', { class: 'btn small', onclick: () => freezeAt(w) }, 'Snapshot now → start'),
      h('button', { class: 'btn small', onclick: () => shiftTime(w) }, 'Shift times…'),
    ),
  );
}

function addFaction(w: MapWidget) {
  const i = w.scenario.factions.length;
  const id = uid('f');
  w.commit('Add faction', ['factions'], (s) => s.factions.push({ id, name: `Faction ${i + 1}`, color: paletteColor(i) }));
  setToolOptions({ faction: id });
}

function zoomToFaction(w: MapWidget, fi: number) {
  const tl = w.territory.timeline;
  const pts: LonLat[] = [];
  for (let i = 0; i < tl.owner.length; i++) if (tl.owner[i] === fi) pts.push([w.territory.centers[i * 2], w.territory.centers[i * 2 + 1]]);
  if (w.world) for (let i = 0; i < w.countryTimeline.owner.length; i++) {
    if (w.countryTimeline.owner[i] !== fi) continue;
    const c = w.world.byId.get(w.countryTimeline.keys[i]);
    if (c) pts.push([c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[3]]);
  }
  const b = bboxOfPoints(pts);
  if (b) w.fitBounds(b);
  else toast('No territory at this time', 'info');
}

function pickCapital(w: MapWidget, fi: number) {
  toast('Click on the map to place the capital', 'info');
  w.map.getCanvas().style.cursor = 'crosshair';
  w.map.once('click', (e) => {
    w.commit('Set capital', ['factions'], (s) => (s.factions[fi].capital = [e.lngLat.lng, e.lngLat.lat]));
    w.map.getCanvas().style.cursor = '';
  });
}

function changeResolution(w: MapWidget, res: number) {
  const old = w.scenario.meta.h3Resolution;
  if (res === old) return;
  const cells = w.scenario.cells;
  const out: typeof cells = [];
  if (res > old) {
    for (const e of cells) for (const c of cellToChildren(e.cell, res)) out.push({ cell: c, t: e.t, faction: e.faction });
  } else {
    const seen = new Set<string>();
    for (const e of cells) {
      const p = cellToParent(e.cell, res);
      const k = `${p}|${e.t}|${e.faction}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ cell: p, t: e.t, faction: e.faction });
    }
  }
  if (out.length > 3_000_000) return toast('That resolution would create too many cells', 'error');
  const before = { cells, res: old };
  const apply = (c: typeof cells, r: number) => () => {
    w.scenario.cells = c;
    w.scenario.meta.h3Resolution = r;
    w.territory.reset();
    w.changed(['cells', 'meta']);
  };
  apply(out, res)();
  w.history.push({ label: 'Change resolution', undo: apply(before.cells, before.res), redo: apply(out, res) });
  toast(`Resolution ${res}: ${out.length.toLocaleString()} events (${cells.length && getResolution(cells[0].cell)} → ${res})`, 'success');
}

function freezeAt(w: MapWidget) {
  // Bake the current state as the starting state: remove events before now and add one event per owned cell at start.
  const tl = w.territory.timeline;
  const t0 = w.scenario.meta.start;
  const base = [];
  for (let i = 0; i < tl.keys.length; i++) if (tl.owner[i] >= 0) base.push({ cell: tl.keys[i], t: t0, faction: w.scenario.factions[tl.owner[i]].id });
  const rest = w.scenario.cells.filter((e) => e.t > w.time);
  const before = w.scenario.cells;
  const after = [...base, ...rest];
  const apply = (v: typeof before) => () => { w.scenario.cells = v; w.changed(['cells']); };
  apply(after)();
  w.history.push({ label: 'Snapshot as start', undo: apply(before), redo: apply(after) });
  toast('Current territory baked in as the starting state', 'success');
}

async function shiftTime(w: MapWidget) {
  const r = await modal({ title: 'Shift all times', description: 'Moves territory, events, units, labels and camera keys by an offset (years; negative allowed).', fields: [{ key: 'dt', label: 'Offset (years)', type: 'number', value: 0 }] });
  const dt = r?.dt;
  if (!dt) return;
  const cells = w.scenario.cells;
  w.scenario.cells = cells.map((c) => ({ ...c, t: c.t + dt }));
  w.commit('Shift times', ['meta', 'countries', 'units', 'events', 'annotations', 'flows', 'regions', 'camera', 'routes'], (s) => {
    s.meta.start += dt; s.meta.end += dt;
    s.countries.forEach((c) => (c.t += dt));
    s.units.forEach((u) => u.path.forEach((p) => (p[2] += dt)));
    s.events.forEach((e) => { e.t += dt; if (e.end !== undefined) e.end += dt; });
    for (const x of [...s.annotations, ...s.flows, ...s.regions, ...s.routes] as { start?: number; end?: number }[]) {
      if (x.start !== undefined) x.start += dt;
      if (x.end !== undefined) x.end += dt;
    }
    s.camera.forEach((k) => (k.t += dt));
  });
  w.changed(['cells']);
}

// ------------------------------------------------------------------ Scenario objects

export function scenarioPanel(w: MapWidget, app: App): HTMLElement {
  const sc = w.scenario;
  const m = sc.meta;
  const title = h('input', { type: 'text', value: m.title, style: 'width:100%', onchange: () => w.commit('Rename scenario', ['meta'], (s) => (s.meta.title = title.value)) });
  const desc = h('textarea', { rows: 3, style: 'width:100%;resize:vertical', onchange: () => w.commit('Edit description', ['meta'], (s) => (s.meta.description = desc.value)) }, m.description ?? '');
  const start = h('input', { type: 'text', value: formatTimeInput(w, m.start), onchange: () => { const t = parseTime(start.value); if (t !== null && t < m.end) w.commit('Change start', ['meta'], (s) => (s.meta.start = t)); else toast('Invalid start', 'error'); } });
  const end = h('input', { type: 'text', value: formatTimeInput(w, m.end), onchange: () => { const t = parseTime(end.value); if (t !== null && t > m.start) w.commit('Change end', ['meta'], (s) => (s.meta.end = t)); else toast('Invalid end', 'error'); } });
  const filter = h('input', { type: 'text', placeholder: 'Filter objects…', style: 'width:100%;margin:6px 0', value: app.objectFilter });
  const body = h('div');
  const render = () => {
    app.objectFilter = filter.value;
    const q = filter.value.toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    body.replaceChildren(
      objList(w, app, 'Units & armies', sc.units.filter((u) => match(u.name)), (u) => u.name, (u) => `${fmtT(w, u.path[0]?.[2])} → ${fmtT(w, u.path[u.path.length - 1]?.[2])}`, 'unit', 'units', (u) => {
        const pts = u.path.map((p) => [p[0], p[1]] as LonLat);
        const b = bboxOfPoints(pts);
        if (b) w.fitBounds(b);
        w.setTime(u.path[0][2]);
      }),
      objList(w, app, 'Routes', sc.routes.filter((r) => match(r.name)), (r) => r.name, (r) => `${formatDistance(pathLengthKm(r.waypoints), w.settings.distanceUnit)} · ${r.vessels} ships`, 'route', 'routes', (r) => {
        const b = bboxOfPoints(r.waypoints);
        if (b) w.fitBounds(b);
      }),
      objList(w, app, 'Events', [...sc.events].sort((a, b) => a.t - b.t).filter((e) => match(e.title)), (e) => e.title, (e) => fmtT(w, e.t), 'event', 'events', (e) => {
        w.setTime(e.t);
        w.flyTo({ center: e.position, zoom: Math.max(w.map.getZoom(), e.zoom ?? 5) });
      }),
      objList(w, app, 'Regions', sc.regions.filter((r) => match(r.name)), (r) => r.name, (r) => `${fmtT(w, r.start)} → ${fmtT(w, r.end)}`, 'region', 'regions', (r) => {
        const b = bboxOfPoints(r.rings.flat());
        if (b) w.fitBounds(b);
      }),
      objList(w, app, 'Labels', sc.annotations.filter((a) => match(a.text)), (a) => a.text, (a) => (a.start !== undefined ? fmtT(w, a.start) : ''), 'annotation', 'annotations', (a) => w.flyTo({ center: a.position })),
      objList(w, app, 'Flows', sc.flows.filter((f) => match(f.label ?? '')), (f) => f.label || 'Flow', (f) => `value ${f.value}`, 'flow', 'flows', (f) => {
        const b = bboxOfPoints([f.from, f.to]);
        if (b) w.fitBounds(b);
      }),
    );
  };
  filter.addEventListener('input', render);
  render();
  return h(
    'div',
    null,
    section('Scenario'),
    title,
    h('div', { style: 'height:6px' }),
    desc,
    h('div', { class: 'grid2', style: 'margin-top:6px' }, h('label', null, h('small', { class: 'muted' }, 'Start'), start), h('label', null, h('small', { class: 'muted' }, 'End'), end)),
    h('div', { class: 'row' },
      h('span', { class: 'grow' }, 'Event marker lifetime'),
      h('input', { type: 'number', value: String(+(m.eventDuration ?? 0).toFixed(4)), step: 'any', style: 'width:90px', onchange: (e: Event) => w.commit('Event duration', ['meta'], (s) => (s.meta.eventDuration = parseFloat((e.target as HTMLInputElement).value) || undefined)) }),
      h('small', { class: 'muted' }, 'yr'),
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => w.commit('Set start view', ['meta'], (s) => (s.meta.view = { ...w.currentCamera() })) }, icon('camera', 12), 'Use current view as start view'),
    ),
    filter,
    body,
  );
}

function objList<T extends { id: string }>(
  w: MapWidget,
  app: App,
  title: string,
  items: T[],
  name: (x: T) => string,
  meta: (x: T) => string,
  kind: Selection['kind'],
  key: keyof Scenario,
  focus: (x: T) => void,
): HTMLElement {
  const max = 200;
  return h(
    'div',
    null,
    section(`${title} (${items.length})`),
    items.length ? null : h('div', { class: 'empty' }, 'None yet — use the tools on the left.'),
    ...items.slice(0, max).map((x) =>
      h('div', { class: `list-item ${w.selection?.id === x.id ? 'sel' : ''}`, onclick: () => { focus(x); w.select({ kind, id: x.id, object: x }); app.openTab('inspect'); } },
        h('span', { class: 'grow' }, name(x)),
        h('span', { class: 'meta' }, meta(x)),
        h('span', { class: 'acts' }, smallBtn('trash', 'Delete', () => w.commit(`Delete ${kind}`, [key], (s) => ((s as any)[key] = (s as any)[key].filter((y: any) => y.id !== x.id))))),
      ),
    ),
    items.length > max ? h('div', { class: 'empty' }, `…and ${items.length - max} more (use the filter)`) : null,
  );
}

// ------------------------------------------------------------------ Camera

export function cameraPanel(w: MapWidget): HTMLElement {
  const sc = w.scenario;
  return h(
    'div',
    null,
    section('Director'),
    h('small', { class: 'muted' }, 'Keyframes pin the camera to moments on the timeline. With director mode on, playback flies between them — perfect for zooming in on a campaign as it happens.'),
    toggle('Director mode (camera follows keys)', w.settings.director, setting(w, 'director')),
    h('div', { class: 'row', style: 'flex-wrap:wrap' },
      h('button', { class: 'btn small', title: 'Generate keyframes that follow wherever territory is changing hands', onclick: () => runAutoDirect(w, 'conquests') }, icon('sparkle', 12), 'Auto-direct: follow conquests'),
      h('button', { class: 'btn small', title: 'Generate keyframes that visit each event', onclick: () => runAutoDirect(w, 'events') }, icon('sparkle', 12), 'Auto-direct: events'),
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn small primary', onclick: () => w.addCameraKey() }, icon('plus', 12), 'Keyframe at current time'),
      sc.camera.length ? h('button', { class: 'btn small danger', onclick: () => w.commit('Clear keyframes', ['camera'], (s) => (s.camera = [])) }, 'Clear') : null,
    ),
    ...sc.camera.map((k, i) =>
      h('div', { class: 'list-item', onclick: () => { w.setTime(k.t); w.flyTo({ ...k }); } },
        h('span', { class: 'grow' }, fmtT(w, k.t)),
        h('span', { class: 'meta' }, `z${k.zoom.toFixed(1)}${k.pitch ? ` · ${Math.round(k.pitch)}°` : ''}`),
        h('span', { class: 'acts' },
          smallBtn('crosshair', 'Replace with current view', () => w.commit('Update keyframe', ['camera'], (s) => Object.assign(s.camera[i], w.currentCamera()))),
          smallBtn('trash', 'Delete', () => w.commit('Delete keyframe', ['camera'], (s) => s.camera.splice(i, 1))),
        ),
      ),
    ),
    section('Follow'),
    h('div', { class: 'row' },
      h('span', { class: 'grow' }, 'Camera follows unit'),
      select(w.settings.followUnit ?? '', [{ value: '', label: '— off —' }, ...sc.units.map((u) => ({ value: u.id, label: u.name }))], (v) => w.updateSettings({ followUnit: v || null })),
    ),
    section('Bookmarks', h('button', { class: 'btn small', onclick: async () => {
      const r = await modal({ title: 'Bookmark this view', fields: [{ key: 'name', label: 'Name', type: 'text', value: `View ${sc.bookmarks.length + 1}` }, { key: 'withTime', label: 'Also remember the time', type: 'checkbox', value: true }] });
      if (!r) return;
      const cam = w.currentCamera();
      w.commit('Add bookmark', ['bookmarks'], (s) => s.bookmarks.push({ id: uid('bm'), name: r.name, ...cam, t: r.withTime ? w.time : undefined }));
    } }, icon('plus', 12), 'Add')),
    sc.bookmarks.length ? null : h('div', { class: 'empty' }, 'No bookmarks yet.'),
    ...sc.bookmarks.map((b, i) =>
      h('div', { class: 'list-item', onclick: () => { if (b.t !== undefined) w.setTime(b.t); w.flyTo(b); } },
        h('span', { class: 'grow' }, `${i < 9 ? `${i + 1}. ` : ''}${b.name}`),
        h('span', { class: 'meta' }, b.t !== undefined ? fmtT(w, b.t) : ''),
        h('span', { class: 'acts' }, smallBtn('trash', 'Delete', () => w.commit('Delete bookmark', ['bookmarks'], (s) => s.bookmarks.splice(i, 1)))),
      ),
    ),
    sc.bookmarks.length ? h('small', { class: 'muted' }, 'Tip: press Alt+1…9 to jump to bookmarks.') : null,
    section('Tour'),
    h('button', { class: 'btn small', onclick: () => tourBookmarks(w) }, icon('play', 12), 'Tour all bookmarks'),
    h('button', { class: 'btn small', style: 'margin-left:6px', onclick: () => keysFromBookmarks(w) }, 'Bookmarks → keyframes'),
  );
}

async function runAutoDirect(w: MapWidget, mode: 'conquests' | 'events') {
  if (mode === 'conquests' && !w.scenario.cells.length) return toast('No territory changes to follow', 'warn');
  if (mode === 'events' && !w.scenario.events.length) return toast('No events to visit', 'warn');
  if (w.scenario.camera.length && !(await confirmDialog('Replace camera keyframes?', `Generate a new camera track following ${mode}. Existing keyframes will be replaced (undoable).`, 'Generate'))) return;
  const keys = autoDirect(w, { mode });
  w.commit('Auto-direct', ['camera'], (s) => (s.camera = keys));
  w.updateSettings({ director: true });
  toast(`${keys.length} keyframes generated — press Space to watch`, 'success');
}

async function tourBookmarks(w: MapWidget) {
  for (const b of w.scenario.bookmarks) {
    if (b.t !== undefined) w.setTime(b.t);
    w.flyTo({ ...b, duration: 2500 });
    await new Promise((r) => setTimeout(r, 4500));
  }
}

function keysFromBookmarks(w: MapWidget) {
  const bms = w.scenario.bookmarks.filter((b) => b.t !== undefined);
  if (!bms.length) return toast('Bookmarks need times to become keyframes', 'warn');
  w.commit('Keyframes from bookmarks', ['camera'], (s) => {
    for (const b of bms) s.camera.push({ t: b.t!, center: b.center, zoom: b.zoom, bearing: b.bearing, pitch: b.pitch });
  });
}

// ------------------------------------------------------------------ Data & export

export function dataPanel(w: MapWidget, app: App): HTMLElement {
  const sc = w.scenario;
  return h(
    'div',
    null,
    section('Import'),
    h('small', { class: 'muted' }, 'GeoJSON, TopoJSON, CSV/TSV (lat/lon, from/to, or track+time columns), KML, GPX, scenario files, or images (pinned to the current view). You can also drag files onto the map.'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary small', onclick: () => app.importFiles() }, icon('upload', 12), 'Import files…'), h('button', { class: 'btn small', onclick: () => addTileOverlay(w) }, icon('map', 12), 'Add XYZ tiles…')),
    section(`Data layers (${sc.layers.length})`),
    sc.layers.length ? null : h('div', { class: 'empty' }, 'No datasets yet.'),
    ...sc.layers.map((l, i) => dataLayerEditor(w, l, i)),
    sc.tileOverlays.length ? section('Tile overlays') : null,
    ...sc.tileOverlays.map((o, i) =>
      h('div', null,
        h('div', { class: 'list-item' },
          h('input', { type: 'checkbox', checked: o.visible, onchange: (e: Event) => w.commit('Toggle overlay', ['tileOverlays'], (s) => (s.tileOverlays[i].visible = (e.target as HTMLInputElement).checked)) }),
          h('span', { class: 'grow', title: o.url }, o.name),
          h('span', { class: 'acts', style: 'display:flex' }, smallBtn('trash', 'Remove', () => w.commit('Remove overlay', ['tileOverlays'], (s) => s.tileOverlays.splice(i, 1)))),
        ),
        slider('Opacity', o.opacity, 0, 1, 0.05, (v) => { o.opacity = v; w.changed(['tileOverlays']); }, (v) => `${Math.round(v * 100)}%`),
      ),
    ),
    sc.images.length ? section('Image overlays') : null,
    ...sc.images.map((o, i) =>
      h('div', null,
        h('div', { class: 'list-item' },
          h('input', { type: 'checkbox', checked: o.visible, onchange: (e: Event) => w.commit('Toggle image', ['images'], (s) => (s.images[i].visible = (e.target as HTMLInputElement).checked)) }),
          h('span', { class: 'grow' }, o.name),
          h('span', { class: 'acts', style: 'display:flex' },
            smallBtn('crosshair', 'Fit to current view', () => w.commit('Refit image', ['images'], (s) => (s.images[i].corners = viewCorners(w)))),
            smallBtn('trash', 'Remove', () => w.commit('Remove image', ['images'], (s) => s.images.splice(i, 1))),
          ),
        ),
        slider('Opacity', o.opacity, 0, 1, 0.05, (v) => { o.opacity = v; w.changed(['images']); }, (v) => `${Math.round(v * 100)}%`),
      ),
    ),
    section('Performance lab'),
    h('small', { class: 'muted' }, 'Synthetic points spread over the timeline, filtered on the GPU each frame.'),
    h('div', { class: 'grid2', style: 'margin-top:6px' },
      ...[100_000, 1_000_000, 3_000_000, 5_000_000].map((n) => h('button', { class: 'btn small', onclick: () => { w.setStress(n); w.updateSettings({ perfHud: true }); } }, `${n >= 1e6 ? n / 1e6 + 'M' : n / 1e3 + 'k'} points`)),
      h('button', { class: 'btn small', onclick: () => w.stress && ((w.stress.mode = w.stress.mode === 'points' ? 'heatmap' : 'points'), w.requestRender()) }, 'Points ⇄ heatmap'),
      h('button', { class: 'btn small danger', onclick: () => w.setStress(0) }, 'Clear'),
    ),
    section('Export'),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn small', onclick: () => exportScenarioFile(w) }, icon('download', 12), 'Scenario (.json)'),
      h('button', { class: 'btn small', onclick: () => screenshotPNG(w) }, icon('image', 12), 'Screenshot (.png)'),
      h('button', { class: 'btn small', onclick: () => screenshotPNG(w, 2) }, icon('image', 12), 'Hi-res 2× (.png)'),
      h('button', { class: 'btn small', onclick: () => exportTerritory(w) }, icon('download', 12), 'Territory now (.geojson)'),
      h('button', { class: 'btn small', onclick: () => exportFeatures(w) }, icon('download', 12), 'Features (.geojson)'),
      h('button', { class: 'btn small', onclick: () => exportEventsCSV(w) }, icon('download', 12), 'Events (.csv)'),
      h('button', { class: 'btn small', onclick: () => app.recordDialog() }, icon('video', 12), 'Video (.webm)'),
      h('button', { class: 'btn small', onclick: () => copyShare(w, false) }, icon('share', 12), 'Link to view'),
      h('button', { class: 'btn small', onclick: () => copyShare(w, true) }, icon('share', 12), 'Link with scenario'),
    ),
    section('Saved scenarios'),
    h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => app.saveAs() }, 'Save as…'), h('button', { class: 'btn small', onclick: (e: MouseEvent) => app.openSavedMenu(e.currentTarget as HTMLElement) }, 'Open saved…')),
  );
}

async function copyShare(w: MapWidget, embed: boolean) {
  try {
    const url = await shareLink(w, embed);
    await navigator.clipboard.writeText(url).catch(() => {});
    toast(embed ? `Link copied (${Math.round(url.length / 1024)} KB)` : 'Link copied', 'success');
    if (embed && url.length > 100_000) toast('Large link — some apps may truncate it', 'warn', 4000);
  } catch (err) {
    toast(String((err as Error).message), 'error', 4000);
  }
}

export function viewCorners(w: MapWidget): [LonLat, LonLat, LonLat, LonLat] {
  const b = w.map.getBounds();
  return [[b.getWest(), b.getNorth()], [b.getEast(), b.getNorth()], [b.getEast(), b.getSouth()], [b.getWest(), b.getSouth()]];
}

async function addTileOverlay(w: MapWidget) {
  const r = await modal({
    title: 'Add XYZ tile overlay',
    description: 'Any {z}/{x}/{y} raster tile URL — e.g. a georeferenced historical map, weather radar or OpenSeaMap seamarks.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', value: 'Overlay' },
      { key: 'url', label: 'URL template', type: 'url', value: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png' },
      { key: 'opacity', label: 'Opacity', type: 'range', value: 0.8, min: 0, max: 1, step: 0.05 },
      timeField(w, 'start', 'Visible from (optional)'),
      timeField(w, 'end', 'Visible until (optional)'),
    ],
  });
  if (!r?.url) return;
  w.commit('Add tile overlay', ['tileOverlays'], (s) => s.tileOverlays.push({ id: uid('to'), name: r.name, url: r.url, opacity: r.opacity ?? 0.8, visible: true, start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined }));
}

function dataLayerEditor(w: MapWidget, l: DataLayer, i: number): HTMLElement {
  const p = prepare(l);
  const props = Object.keys(l.data.features.find((f) => f.properties)?.properties ?? {});
  const propOpts = [{ value: '', label: '— none —' }, ...props.map((k) => ({ value: k, label: k }))];
  const upd = (patch: Partial<DataLayer['style']>) => {
    l.style = { ...l.style, ...patch };
    w.changed(['layers']);
  };
  const open = !!(l as any)._open;
  const header = h('div', { class: 'list-item', onclick: () => { (l as any)._open = !open; w.changed(['layers']); } },
    h('input', { type: 'checkbox', checked: l.visible, onclick: (e: MouseEvent) => e.stopPropagation(), onchange: (e: Event) => { l.visible = (e.target as HTMLInputElement).checked; w.changed(['layers']); } }),
    h('span', { class: 'swatch', style: `background:${l.style.color}` }),
    h('span', { class: 'grow' }, l.name),
    h('span', { class: 'meta' }, `${l.data.features.length.toLocaleString()} ft`),
    h('span', { class: 'acts' },
      smallBtn('target', 'Zoom to layer', () => {
        const pts: LonLat[] = [];
        for (let k = 0; k < p.n; k += Math.max(1, Math.floor(p.n / 5000))) pts.push([p.positions[k * 2], p.positions[k * 2 + 1]]);
        for (const f of p.others.slice(0, 2000)) collectCoords(f.geometry, pts);
        const b = bboxOfPoints(pts);
        if (b) w.fitBounds(b);
        if (p.timeExtent && (p.timeExtent[0] < w.scenario.meta.start || p.timeExtent[1] > w.scenario.meta.end)) toast('Tip: this layer has times outside the scenario span — see Scenario → Start/End', 'info', 4000);
      }),
      smallBtn('download', 'Download as GeoJSON', () => download(JSON.stringify(l.data), `${l.name}.geojson`, 'application/geo+json')),
      smallBtn('trash', 'Remove', () => w.commit('Remove data layer', ['layers'], (s) => s.layers.splice(i, 1))),
    ),
  );
  if (!open) return header;
  const renders: DataRender[] = ['auto', 'scatter', 'heatmap', 'hexbin', 'grid', 'screengrid', 'geojson', 'arcs', 'trips'];
  return h('div', { style: 'border:1px solid var(--border);border-radius:8px;padding:4px 8px 8px;margin:4px 0' },
    header,
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Render as'), select(l.style.render, renders.map((r) => ({ value: r, label: r })), (v) => upd({ render: v as DataRender }))),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Colour'), h('input', { type: 'color', value: l.style.color, onchange: (e: Event) => upd({ color: (e.target as HTMLInputElement).value }) })),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Colour ramp'), select(l.style.ramp, Object.keys(RAMPS).map((r) => ({ value: r, label: r })), (v) => upd({ ramp: v }))),
    slider('Size / radius', l.style.radius, 0.5, 30, 0.5, (v) => upd({ radius: v })),
    slider('Opacity', l.style.opacity, 0.05, 1, 0.05, (v) => upd({ opacity: v }), (v) => `${Math.round(v * 100)}%`),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Time field'), select(l.style.timeField ?? '', propOpts, (v) => upd({ timeField: v || undefined }))),
    l.style.timeField ? h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Visible window (yr, 0 = cumulative)'), h('input', { type: 'number', value: String(l.style.timeWindow), step: 'any', style: 'width:80px', onchange: (e: Event) => upd({ timeWindow: parseFloat((e.target as HTMLInputElement).value) || 0 }) })) : null,
    p.timeExtent ? h('small', { class: 'muted' }, `Times: ${fmtT(w, p.timeExtent[0])} → ${fmtT(w, p.timeExtent[1])}`) : null,
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Weight / size field'), select(l.style.weightField ?? '', propOpts, (v) => upd({ weightField: v || undefined }))),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Category colour field'), select(l.style.colorField ?? '', propOpts, (v) => upd({ colorField: v || undefined }))),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Label field'), select(l.style.labelField ?? '', propOpts, (v) => upd({ labelField: v || undefined }))),
    toggle('Extrude (hexbin / grid / polygons)', !!l.style.extruded, (v) => upd({ extruded: v })),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: async () => {
        const r = await modal({ title: 'Rename layer', fields: [{ key: 'name', label: 'Name', type: 'text', value: l.name }] });
        if (r?.name) { l.name = r.name; w.changed(['layers']); }
      } }, 'Rename'),
      h('button', { class: 'btn small', onclick: () => { l.style = defaultDataStyle({ color: l.style.color }); w.changed(['layers']); } }, 'Reset style'),
      h('button', { class: 'btn small', onclick: () => fitSpanToLayer(w, l) }, 'Fit timeline'),
    ),
  );
}

function fitSpanToLayer(w: MapWidget, l: DataLayer) {
  const p = prepare(l);
  if (!p.timeExtent) return toast('Set a time field first', 'warn');
  const [a, b] = p.timeExtent;
  const pad = (b - a) * 0.02 || 0.01;
  w.commit('Fit timeline to layer', ['meta'], (s) => { s.meta.start = a - pad; s.meta.end = b + pad; });
  w.setTime(a);
}

function collectCoords(g: any, out: LonLat[]) {
  if (!g) return;
  if (g.type === 'Point') out.push(g.coordinates);
  else if (g.type === 'GeometryCollection') g.geometries.forEach((x: any) => collectCoords(x, out));
  else {
    const walk = (c: any) => (typeof c[0] === 'number' ? out.push(c) : c.forEach(walk));
    walk(g.coordinates);
  }
}

// ------------------------------------------------------------------ Settings

export function settingsPanel(w: MapWidget, app: App): HTMLElement {
  const s = w.settings;
  return h(
    'div',
    null,
    section('Interface'),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Theme'), select(s.theme, [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], (v) => w.updateSettings({ theme: v as any }))),
    h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Distance units'), select(s.distanceUnit, [{ value: 'km', label: 'Kilometres' }, { value: 'mi', label: 'Miles' }, { value: 'nm', label: 'Nautical miles' }], (v) => w.updateSettings({ distanceUnit: v as any }))),
    toggle('Minimap', s.minimap, setting(w, 'minimap')),
    toggle('Performance HUD', s.perfHud, setting(w, 'perfHud')),
    toggle('Event cards during playback', s.eventToasts, setting(w, 'eventToasts')),
    toggle('Loop playback', s.loop, setting(w, 'loop')),
    section('Performance'),
    slider('Max pixel ratio', s.maxPixelRatio, 0.5, 3, 0.25, (v) => { w.updateSettings({ maxPixelRatio: v }); toast('Reload to apply pixel ratio', 'info'); }, (v) => `${v}×`),
    toggle('Ambient animation (vessels/pulses)', s.ambientAnimation, setting(w, 'ambientAnimation'), 'Turn off to let the map idle at 0% CPU when nothing moves'),
    section('Persistence'),
    toggle('Autosave scenario (IndexedDB)', s.autosave, setting(w, 'autosave')),
    toggle('Keep view & time in URL', s.hashState, setting(w, 'hashState')),
    section('Help'),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => app.showHelp() }, icon('help', 12), 'Shortcuts & help'),
      h('button', { class: 'btn small', onclick: () => app.palette.open() }, icon('command', 12), 'Command palette'),
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!(await confirmDialog('Reset all settings?', 'Restores default display settings (your scenario is kept).'))) return;
        w.updateSettings({ ...DEFAULT_SETTINGS });
      } }, 'Reset settings'),
    ),
    section('About'),
    h('small', { class: 'muted', html: 'Built with MapLibre GL, deck.gl and H3. Offline basemaps use Natural Earth data (public domain). Online basemaps are provided by their respective services — see attribution on the map.' }),
  );
}

// ------------------------------------------------------------------ Inspector

export function inspectPanel(w: MapWidget, app: App): HTMLElement {
  const sel = w.selection;
  if (!sel) return h('div', null, section('Inspector'), h('div', { class: 'empty' }, 'Click anything on the map to inspect it.'), statsBlock(w));
  const o: any = sel.object;
  const body = h('div');
  const add = (...xs: (Node | null | undefined | false)[]) => body.append(...(xs.filter(Boolean) as Node[]));
  const prec = precisionForSpan(w.span);
  const header = (title: string, sub?: string) => h('div', null, h('div', { style: 'font-family:var(--serif);font-size:16px;font-weight:700' }, title), sub ? h('small', { class: 'muted' }, sub) : null);
  const editBtn = (key: keyof Scenario, fields: Field[], apply: (x: any, r: Record<string, any>) => void) =>
    h('button', { class: 'btn small', onclick: async () => {
      const r = await modal({ title: 'Edit', fields });
      if (!r) return;
      w.commit('Edit', [key], (s) => {
        const x = (s as any)[key].find((y: any) => y.id === sel.id);
        if (x) apply(x, r);
      });
      const nx = (w.scenario as any)[key].find((y: any) => y.id === sel.id);
      w.select({ ...sel, object: nx });
    } }, icon('edit', 12), 'Edit');
  const delBtn = (key: keyof Scenario) => h('button', { class: 'btn small danger', onclick: () => { w.commit('Delete', [key], (s) => ((s as any)[key] = (s as any)[key].filter((y: any) => y.id !== sel.id))); w.select(null); } }, icon('trash', 12), 'Delete');
  const jsonBtn = (key: keyof Scenario) => h('button', { class: 'btn small', onclick: async () => {
    const r = await modal({ title: 'Edit as JSON', wide: true, fields: [{ key: 'json', label: 'JSON', type: 'textarea', value: JSON.stringify(o, null, 2) }] });
    if (!r) return;
    try {
      const nx = JSON.parse(r.json);
      w.commit('Edit JSON', [key], (s) => { const arr = (s as any)[key]; const idx = arr.findIndex((y: any) => y.id === sel.id); if (idx >= 0) arr[idx] = { ...nx, id: sel.id }; });
      w.select({ ...sel, object: (w.scenario as any)[key].find((y: any) => y.id === sel.id) });
    } catch (err) { toast(`Invalid JSON: ${(err as Error).message}`, 'error'); }
  } }, '{ } JSON');
  const fname = (id?: string) => w.scenario.factions.find((f) => f.id === id)?.name ?? '—';

  switch (sel.kind) {
    case 'unit': {
      const km = pathLengthKm(o.path.map((p: number[]) => [p[0], p[1]]));
      const dur = o.path[o.path.length - 1][2] - o.path[0][2];
      add(
        header(o.name, `${o.kind ?? 'army'} · ${fname(o.faction)}`),
        h('div', { class: 'kv', style: 'margin:10px 0' },
          h('span', null, 'Departs'), h('span', null, formatTime(o.path[0][2], prec)),
          h('span', null, 'Arrives'), h('span', null, formatTime(o.path[o.path.length - 1][2], prec)),
          h('span', null, 'Distance'), h('span', null, formatDistance(km, w.settings.distanceUnit)),
          h('span', null, 'Avg speed'), h('span', null, dur > 0 ? `${formatDistance(km / (dur * 365.2425), w.settings.distanceUnit)}/day` : '—'),
          h('span', null, 'Waypoints'), h('span', null, String(o.path.length)),
          o.strength ? h('span', null, 'Strength') : null, o.strength ? h('span', null, o.strength.toLocaleString()) : null,
        ),
        h('div', { class: 'row', style: 'flex-wrap:wrap' },
          editBtn('units', [
            { key: 'name', label: 'Name', type: 'text', value: o.name },
            factionField(w, 'faction', o.faction ?? ''),
            { key: 'kind', label: 'Kind', type: 'select', value: o.kind ?? 'army', options: ['army', 'fleet', 'ship', 'caravan', 'explorer', 'other'].map((v) => ({ value: v, label: v })) },
            timeField(w, 'start', 'Departs', o.path[0][2]),
            timeField(w, 'end', 'Arrives', o.path[o.path.length - 1][2]),
            { key: 'strength', label: 'Strength', type: 'number', value: o.strength },
            { key: 'width', label: 'Trail width (px)', type: 'number', value: o.width ?? 4, min: 1 },
          ], (x, r) => {
            x.name = r.name; x.faction = r.faction || undefined; x.kind = r.kind; x.strength = r.strength; x.width = r.width;
            const a = parseTime(r.start), b = parseTime(r.end);
            if (a !== null && b !== null && b > a) {
              const a0 = x.path[0][2], b0 = x.path[x.path.length - 1][2];
              x.path = x.path.map((p: number[]) => [p[0], p[1], a + ((p[2] - a0) / (b0 - a0 || 1)) * (b - a)]);
            }
          }),
          h('button', { class: 'btn small', onclick: () => w.updateSettings({ followUnit: w.settings.followUnit === o.id ? null : o.id }) }, icon('crosshair', 12), w.settings.followUnit === o.id ? 'Unfollow' : 'Follow'),
          h('button', { class: 'btn small', onclick: () => w.setTime(o.path[0][2]) }, 'Go to start'),
          h('button', { class: 'btn small', title: 'Make the path follow the sea between its waypoints (keeps departure/arrival times)', onclick: async () => {
            toast('Routing by sea…', 'info', 1200);
            try {
              const pts = o.path.map((p: number[]) => [p[0], p[1]] as LonLat);
              const lane = await seaRouteVia(pts);
              const path = timestampPath(lane, o.path[0][2], o.path[o.path.length - 1][2]);
              w.commit('Route unit by sea', ['units'], (s) => { const x = s.units.find((y) => y.id === o.id); if (x) x.path = path; });
              w.select({ ...sel, object: w.scenario.units.find((y) => y.id === o.id) });
            } catch (err) { toast((err as Error).message, 'error'); }
          } }, icon('ship', 12), 'Sail by sea'),
          jsonBtn('units'),
          delBtn('units'),
        ),
      );
      break;
    }
    case 'route':
      add(
        header(o.name, `${formatDistance(pathLengthKm(o.waypoints), w.settings.distanceUnit)} · ${o.waypoints.length} waypoints`),
        o.description ? h('p', null, o.description) : null,
        h('div', { class: 'kv', style: 'margin:10px 0' }, h('span', null, 'Vessels'), h('span', null, String(o.vessels)), h('span', null, 'Speed'), h('span', null, `${o.speedKnots} kn`),
          h('span', null, 'Transit time'), h('span', null, `${(pathLengthKm(o.waypoints) / (o.speedKnots * 1.852 * 24)).toFixed(1)} days at ${o.speedKnots} kn`), h('span', null, 'Volume'), h('span', null, String(o.volume)), h('span', null, 'Active'), h('span', null, `${fmtT(w, o.start)} → ${fmtT(w, o.end)}`)),
        h('div', { class: 'row', style: 'flex-wrap:wrap' },
          editBtn('routes', [
            { key: 'name', label: 'Name', type: 'text', value: o.name },
            { key: 'color', label: 'Colour', type: 'color', value: o.color },
            { key: 'vessels', label: 'Vessels', type: 'number', value: o.vessels, min: 0, step: 1 },
            { key: 'speedKnots', label: 'Speed (knots)', type: 'number', value: o.speedKnots, min: 1 },
            { key: 'volume', label: 'Volume', type: 'number', value: o.volume, min: 0 },
            { key: 'bidirectional', label: 'Two-way', type: 'checkbox', value: !!o.bidirectional },
            timeField(w, 'start', 'Opens', o.start),
            timeField(w, 'end', 'Closes', o.end),
            { key: 'description', label: 'Description', type: 'textarea', value: o.description ?? '' },
          ], (x, r) => { Object.assign(x, { name: r.name, color: r.color, vessels: r.vessels, speedKnots: r.speedKnots, volume: r.volume, bidirectional: r.bidirectional, description: r.description, start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined }); }),
          h('button', { class: 'btn small', title: 'Recompute the lane by sea between its endpoints and major waypoints', onclick: async () => {
            toast('Routing by sea…', 'info', 1200);
            try {
              const pts: LonLat[] = o.waypoints.length > 12 ? [o.waypoints[0], o.waypoints[o.waypoints.length - 1]] : o.waypoints;
              const lane = await seaRouteVia(pts);
              w.commit('Re-route by sea', ['routes'], (s) => { const x = s.routes.find((y) => y.id === o.id); if (x) x.waypoints = lane; });
              w.select({ ...sel, object: w.scenario.routes.find((y) => y.id === o.id) });
              toast(`Re-routed: ${formatDistance(pathLengthKm(lane), w.settings.distanceUnit)}`, 'success');
            } catch (err) { toast((err as Error).message, 'error'); }
          } }, icon('ship', 12), 'Re-route by sea'),
          jsonBtn('routes'),
          delBtn('routes'),
        ),
      );
      break;
    case 'event':
      add(
        header(o.title, `${o.kind} · ${formatTime(o.t, prec)}${o.faction ? ` · ${fname(o.faction)}` : ''}`),
        o.description ? h('p', { style: 'line-height:1.5' }, o.description) : null,
        h('div', { class: 'row', style: 'flex-wrap:wrap' },
          h('button', { class: 'btn small', onclick: () => { w.setTime(o.t); w.flyTo({ center: o.position, zoom: o.zoom ?? 5 }); } }, icon('target', 12), 'Go'),
          editBtn('events', [
            { key: 'title', label: 'Title', type: 'text', value: o.title },
            { key: 'kind', label: 'Kind', type: 'select', value: o.kind, options: ['battle', 'siege', 'founding', 'treaty', 'disaster', 'discovery', 'note'].map((v) => ({ value: v, label: v })) },
            timeField(w, 't', 'When', o.t),
            timeField(w, 'end', 'Visible until', o.end),
            factionField(w, 'faction', o.faction ?? ''),
            { key: 'description', label: 'Description', type: 'textarea', value: o.description ?? '' },
          ], (x, r) => { Object.assign(x, { title: r.title, kind: r.kind, t: parseTime(r.t) ?? x.t, end: parseTime(r.end) ?? undefined, faction: r.faction || undefined, description: r.description }); }),
          jsonBtn('events'),
          delBtn('events'),
        ),
      );
      break;
    case 'region':
      add(header(o.name, fname(o.faction)), h('div', { class: 'row', style: 'flex-wrap:wrap' },
        editBtn('regions', [{ key: 'name', label: 'Name', type: 'text', value: o.name }, factionField(w, 'faction', o.faction ?? ''), { key: 'color', label: 'Colour', type: 'color', value: o.color ?? '#888888' }, timeField(w, 'start', 'From', o.start), timeField(w, 'end', 'Until', o.end)],
          (x, r) => Object.assign(x, { name: r.name, faction: r.faction || undefined, color: r.color, start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined })),
        jsonBtn('regions'), delBtn('regions')));
      break;
    case 'annotation':
      add(header(o.text), h('div', { class: 'row', style: 'flex-wrap:wrap' },
        editBtn('annotations', [{ key: 'text', label: 'Text', type: 'text', value: o.text }, { key: 'color', label: 'Colour', type: 'color', value: o.color ?? '#ffffff' }, timeField(w, 'start', 'From', o.start), timeField(w, 'end', 'Until', o.end)],
          (x, r) => Object.assign(x, { text: r.text, color: r.color, start: parseTime(r.start) ?? undefined, end: parseTime(r.end) ?? undefined })),
        jsonBtn('annotations'), delBtn('annotations')));
      break;
    case 'flow':
      add(header(o.label ?? 'Flow', `value ${o.value}`), h('div', { class: 'row' }, jsonBtn('flows'), delBtn('flows')));
      break;
    case 'cell': {
      const tl = w.territory.timeline;
      const history = w.scenario.cells.filter((e) => e.cell === sel.id).sort((a, b) => a.t - b.t);
      add(
        header('Territory cell', sel.id),
        h('div', { class: 'kv', style: 'margin:10px 0' }, h('span', null, 'Area'), h('span', null, `~${formatArea(cellAreaKm2(w.scenario.meta.h3Resolution))}`), h('span', null, 'Owner now'), h('span', null, (() => { const k = tl.keyIndex.get(sel.id); const ow = k === undefined ? -1 : tl.owner[k]; return ow >= 0 ? w.scenario.factions[ow].name : 'unclaimed'; })())),
        section('Ownership history'),
        ...history.map((e) => h('div', { class: 'list-item', onclick: () => w.setTime(e.t) }, h('span', { class: 'grow' }, e.faction ? fname(e.faction) : 'released'), h('span', { class: 'meta' }, formatTime(e.t, prec)))),
      );
      break;
    }
    case 'country': {
      const name = o.properties?.name ?? sel.id;
      const history = w.scenario.countries.filter((e) => e.country === sel.id).sort((a, b) => a.t - b.t);
      add(header(name, 'Country'), section('Control history'), ...history.map((e) => h('div', { class: 'list-item', onclick: () => w.setTime(e.t) }, h('span', { class: 'grow' }, e.faction ? fname(e.faction) : 'released'), h('span', { class: 'meta' }, formatTime(e.t, prec)))), history.length ? null : h('div', { class: 'empty' }, 'Never assigned. Use the Assign-country tool.'));
      break;
    }
    case 'data': {
      const props = o?.properties ?? o ?? {};
      add(header('Data feature', sel.layerId?.replace(/^data-/, '')), h('div', { class: 'kv', style: 'margin-top:8px' }, ...Object.entries(props).flatMap(([k, v]) => [h('span', null, k), h('span', { style: 'word-break:break-word' }, typeof v === 'object' ? JSON.stringify(v) : String(v))])));
      break;
    }
    default:
      add(header(sel.kind));
  }
  if (sel.position) add(h('small', { class: 'muted', style: 'display:block;margin-top:10px' }, `${sel.position[1].toFixed(4)}°, ${sel.position[0].toFixed(4)}°`));
  void app;
  return h('div', null, section('Inspector', smallBtn('x', 'Clear selection', () => w.select(null))), body, statsBlock(w));
}

function statsBlock(w: MapWidget): HTMLElement {
  const st = w.lastStats;
  const s = w.scenario;
  return h('div', null,
    section('Scenario stats'),
    h('div', { class: 'kv' },
      h('span', null, 'Span'), h('span', null, `${fmtT(w, s.meta.start)} → ${fmtT(w, s.meta.end)} (${formatDuration(w.span)})`),
      h('span', null, 'Factions'), h('span', null, String(s.factions.length)),
      h('span', null, 'Territory events'), h('span', null, s.cells.length.toLocaleString()),
      h('span', null, 'Cells owned now'), h('span', null, st.ownedCells.toLocaleString()),
      h('span', null, 'Units / routes'), h('span', null, `${s.units.length} / ${s.routes.length}`),
      h('span', null, 'Events / labels'), h('span', null, `${s.events.length} / ${s.annotations.length}`),
      h('span', null, 'Data features'), h('span', null, s.layers.reduce((a, l) => a + l.data.features.length, 0).toLocaleString()),
    ),
  );
}

export { toolEvents, menu };
