/**
 * Story authoring (editor sidebar): write guided chapters (a moment in time, a
 * camera view and a short caption), preview the map as the embeddable widget
 * and download it as a map file for a host app.
 */
import type { MapWidget } from '../widget/MapWidget';
import type { StoryStep } from '../core/scenario';
import { uid } from '../core/scenario';
import { formatTime, parseTime, precisionForSpan } from '../core/time';
import { h, icon, modal, toast, download, confirmDialog, type Field } from './dom';
import type { App } from './app';

function fmt(w: MapWidget, t: number) {
  return formatTime(t, precisionForSpan(w.span));
}

export function storyPanel(w: MapWidget, app: App): HTMLElement {
  const steps = w.scenario.story;
  const cur = steps.reduce((k, s, i) => (w.time >= s.t ? i : k), -1);
  return h(
    'div',
    null,
    h('h4', null, h('span', null, `Story (${steps.length} chapters)`)),
    h('small', { class: 'muted' }, 'Chapters turn the map into a guided story: each one has a moment in time, a camera view and a short caption. Readers step through them in the embedded widget.'),
    h('div', { class: 'row', style: 'flex-wrap:wrap;margin-top:6px' },
      h('button', { class: 'btn small primary', onclick: () => editStep(w, null) }, icon('plus', 12), 'Chapter here & now'),
      h('button', { class: 'btn small', onclick: () => previewWidget(w) }, icon('play', 12), 'Preview as widget'),
      h('button', { class: 'btn small', onclick: () => downloadMapFile(w, app) }, icon('download', 12), 'Download map file'),
    ),
    steps.length ? null : h('div', { class: 'empty' }, 'No chapters yet. Move the map and timeline to an important moment, then click “Chapter here & now”.'),
    ...steps.map((s, i) =>
      h('div', { class: `list-item ${i === cur ? 'sel' : ''}`, onclick: () => goTo(w, s) },
        h('span', { class: 'lp-letter', style: 'flex:none' }, String(i + 1)),
        h('span', { class: 'grow' }, s.title),
        h('span', { class: 'meta' }, fmt(w, s.t)),
        h('span', { class: 'acts' },
          smallBtn('edit', 'Edit', () => editStep(w, s)),
          smallBtn('crosshair', 'Use the current camera view for this chapter', () => {
            w.commit('Update chapter view', ['story'], (sc) => {
              const x = sc.story.find((y) => y.id === s.id);
              if (x) x.view = w.currentCamera();
            });
            toast('Chapter view updated', 'success', 1200);
          }),
          smallBtn('trash', 'Delete', () => w.commit('Delete chapter', ['story'], (sc) => (sc.story = sc.story.filter((y) => y.id !== s.id)))),
        ),
      ),
    ),
    steps.length
      ? h('div', { class: 'row', style: 'flex-wrap:wrap' },
          h('button', { class: 'btn small', title: 'Replace the camera track with one that visits each chapter’s view', onclick: async () => {
            if (w.scenario.camera.length && !(await confirmDialog('Replace camera keyframes?', 'The director camera will visit each chapter’s view at its time.', 'Replace'))) return;
            w.commit('Camera from story', ['camera'], (sc) => {
              sc.camera = [];
              for (const st of sc.story) if (st.view) sc.camera.push({ t: st.t, center: st.view.center, zoom: st.view.zoom, bearing: st.view.bearing ?? 0, pitch: st.view.pitch ?? 0 });
            });
            w.updateSettings({ director: true });
          } }, icon('film', 12), 'Camera follows story'),
        )
      : null,
    h('h4', null, h('span', null, 'Sources')),
    h('label', { class: 'mw-field' }, h('span', { class: 'lbl' }, 'Sources (one per line)'),
      h('textarea', { rows: 3, onchange: (e: Event) => w.commit('Edit sources', ['meta'], (sc) => (sc.meta.sources = (e.target as HTMLTextAreaElement).value.split('\n').map((x) => x.trim()).filter(Boolean))) }, (w.scenario.meta.sources ?? []).join('\n'))),
  );
}

function smallBtn(ic: Parameters<typeof icon>[0], title: string, onclick: () => void): HTMLButtonElement {
  return h('button', { class: 'icon-btn', title, 'aria-label': title, onclick: (e: MouseEvent) => { e.stopPropagation(); onclick(); } }, icon(ic, 14));
}

function goTo(w: MapWidget, s: StoryStep) {
  w.pause();
  w.setTime(s.t);
  if (s.view) w.flyTo({ ...s.view, duration: 1200 });
}

async function editStep(w: MapWidget, s: StoryStep | null) {
  const fields: Field[] = [
    { key: 'title', label: 'Chapter title', type: 'text', value: s?.title ?? '' },
    { key: 'text', label: 'Caption: 1–3 sentences (**bold**, *italic*)', type: 'textarea', value: s?.text ?? '' },
    { key: 't', label: 'Starts at', type: 'time', value: fmt(w, s?.t ?? w.time) },
    { key: 'end', label: 'Plays until (optional – default: next chapter)', type: 'time', value: s?.end !== undefined && s ? fmt(w, s.end) : '' },
    { key: 'useView', label: s ? 'Replace the camera view with the current one' : 'Use the current camera view', type: 'checkbox', value: !s },
    { key: 'image', label: 'Image URL (optional)', type: 'url', value: s?.image ?? '' },
    { key: 'imageCaption', label: 'Image caption', type: 'text', value: s?.imageCaption ?? '' },
  ];
  const r = await modal({ title: s ? 'Edit chapter' : 'New chapter', wide: true, fields, submitLabel: s ? 'Save' : 'Add chapter' });
  if (!r) return;
  if (!r.title?.trim()) return toast('A chapter needs a title', 'warn');
  const t = parseTime(r.t) ?? w.time;
  const end = parseTime(r.end) ?? undefined;
  const view = r.useView ? w.currentCamera() : s?.view;
  w.commit(s ? 'Edit chapter' : 'Add chapter', ['story'], (sc) => {
    const step: StoryStep = { id: s?.id ?? uid('step'), title: r.title.trim(), text: r.text ?? '', t, end, view, image: r.image || undefined, imageCaption: r.imageCaption || undefined };
    sc.story = sc.story.filter((x) => x.id !== step.id);
    sc.story.push(step);
    sc.story.sort((a, b) => a.t - b.t);
  });
}

// ------------------------------------------------------------------ preview & export

function slugOf(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map';
}

/** What a host app would load: the original atlas-map@1 spec if unedited, else the full scenario. */
function mapFileJSON(w: MapWidget, app: App): string {
  return app.mapSpec && !w.history.canUndo ? JSON.stringify(app.mapSpec, null, 2) : JSON.stringify(w.exportScenario());
}

/** Open the widget preview page in a new tab and hand it the current map. */
export function previewWidget(w: MapWidget): void {
  const url = new URL('widget.html', location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, ''));
  url.searchParams.set('wait', '1');
  const win = window.open(url.toString(), '_blank');
  if (!win) return toast('Allow pop-ups to preview the widget', 'warn');
  const scenario = w.exportScenario();
  const onMsg = (ev: MessageEvent) => {
    if (ev.source !== win || ev.data?.type !== 'atlas:ready') return;
    window.removeEventListener('message', onMsg);
    win.postMessage({ type: 'atlas:load', map: scenario }, '*');
  };
  window.addEventListener('message', onMsg);
}

/** Download the map for a host app (see docs/embedding.md). */
export function downloadMapFile(w: MapWidget, app: App): void {
  const spec = !!app.mapSpec && !w.history.canUndo;
  download(mapFileJSON(w, app), `${slugOf(w.scenario.meta.title)}${spec ? '' : '.scenario'}.json`);
  toast(spec ? 'Downloaded the atlas-map@1 file' : 'Downloaded the full scenario (edited maps are saved as scenarios; the widget accepts both)', 'success', 3500);
}

// re-export for the command palette
export type { Field };
