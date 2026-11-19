/**
 * Story authoring (editor sidebar) and lesson publishing: write guided
 * chapters with quiz questions, preview them as a student, and generate the
 * iframe code to embed the lesson in a course.
 */
import type { MapWidget } from '../widget/MapWidget';
import type { StoryStep } from '../core/scenario';
import { uid } from '../core/scenario';
import { formatTime, parseTime, precisionForSpan } from '../core/time';
import { h, icon, modal, toast, download, confirmDialog, type Field } from './dom';
import { compress } from '../io/storage';
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
    h('small', { class: 'muted' }, 'Chapters turn the map into a guided lesson: each one has a moment in time, a camera view, a short text for students and an optional quiz question.'),
    h('div', { class: 'row', style: 'flex-wrap:wrap;margin-top:6px' },
      h('button', { class: 'btn small primary', onclick: () => editStep(w, null) }, icon('plus', 12), 'Chapter here & now'),
      h('button', { class: 'btn small', onclick: () => previewAsStudent(w) }, icon('play', 12), 'Preview as student'),
      h('button', { class: 'btn small', onclick: () => embedDialog(w, app) }, icon('share', 12), 'Embed in course…'),
    ),
    steps.length ? null : h('div', { class: 'empty' }, 'No chapters yet. Move the map and timeline to an important moment, then click “Chapter here & now”.'),
    ...steps.map((s, i) =>
      h('div', { class: `list-item ${i === cur ? 'sel' : ''}`, onclick: () => goTo(w, s) },
        h('span', { class: 'lp-letter', style: 'flex:none' }, String(i + 1)),
        h('span', { class: 'grow' }, s.title, s.question ? h('small', { class: 'muted' }, ' · quiz') : null),
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
    h('h4', null, h('span', null, 'Lesson details')),
    h('label', { class: 'mw-field' }, h('span', { class: 'lbl' }, 'Audience'),
      h('input', { type: 'text', value: w.scenario.meta.audience ?? '', placeholder: 'e.g. Grade 9 World History', onchange: (e: Event) => w.commit('Edit audience', ['meta'], (sc) => (sc.meta.audience = (e.target as HTMLInputElement).value || undefined)) })),
    h('label', { class: 'mw-field', style: 'margin-top:6px' }, h('span', { class: 'lbl' }, 'Sources (one per line)'),
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
  const q = s?.question;
  const fields: Field[] = [
    { key: 'title', label: 'Chapter title', type: 'text', value: s?.title ?? '' },
    { key: 'text', label: 'Text for students (**bold**, *italic*, blank line = new paragraph)', type: 'textarea', value: s?.text ?? '' },
    { key: 't', label: 'Starts at', type: 'time', value: fmt(w, s?.t ?? w.time) },
    { key: 'end', label: 'Plays until (optional – default: next chapter)', type: 'time', value: s?.end !== undefined && s ? fmt(w, s.end) : '' },
    { key: 'useView', label: s ? 'Replace the camera view with the current one' : 'Use the current camera view', type: 'checkbox', value: !s },
    { key: 'image', label: 'Image URL (optional)', type: 'url', value: s?.image ?? '' },
    { key: 'imageCaption', label: 'Image caption', type: 'text', value: s?.imageCaption ?? '' },
    { key: 'prompt', label: 'Quiz question (optional)', type: 'text', value: q?.prompt ?? '' },
    { key: 'choices', label: 'Answer choices – one per line, put * before the correct one', type: 'textarea', value: q ? q.choices.map((c, i) => (i === q.answer ? `*${c}` : c)).join('\n') : '' },
    { key: 'explain', label: 'Explanation shown after answering', type: 'text', value: q?.explain ?? '' },
  ];
  const r = await modal({ title: s ? 'Edit chapter' : 'New chapter', wide: true, fields, submitLabel: s ? 'Save' : 'Add chapter' });
  if (!r) return;
  if (!r.title?.trim()) return toast('A chapter needs a title', 'warn');
  let question: StoryStep['question'];
  if (r.prompt?.trim()) {
    const lines = String(r.choices).split('\n').map((x) => x.trim()).filter(Boolean);
    const answer = Math.max(0, lines.findIndex((x) => x.startsWith('*')));
    const choices = lines.map((x) => x.replace(/^\*\s*/, ''));
    if (choices.length < 2) return toast('A question needs at least two choices', 'warn');
    question = { prompt: r.prompt.trim(), choices, answer, explain: r.explain?.trim() || undefined };
  }
  const t = parseTime(r.t) ?? w.time;
  const end = parseTime(r.end) ?? undefined;
  const view = r.useView ? w.currentCamera() : s?.view;
  w.commit(s ? 'Edit chapter' : 'Add chapter', ['story'], (sc) => {
    const step: StoryStep = { id: s?.id ?? uid('step'), title: r.title.trim(), text: r.text ?? '', t, end, view, question, image: r.image || undefined, imageCaption: r.imageCaption || undefined };
    sc.story = sc.story.filter((x) => x.id !== step.id);
    sc.story.push(step);
    sc.story.sort((a, b) => a.t - b.t);
  });
}

// ------------------------------------------------------------------ preview & embed

function playerURL(): URL {
  return new URL('lesson.html', location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, ''));
}

/** Open the student player in a new tab and hand it the current scenario. */
export function previewAsStudent(w: MapWidget): void {
  const url = playerURL();
  url.searchParams.set('wait', '1');
  const win = window.open(url.toString(), '_blank');
  if (!win) return toast('Allow pop-ups to preview the lesson', 'warn');
  const scenario = w.exportScenario();
  const onMsg = (ev: MessageEvent) => {
    if (ev.source !== win || ev.data?.type !== 'atlas:ready') return;
    window.removeEventListener('message', onMsg);
    win.postMessage({ type: 'atlas', id: 1, method: 'loadLesson', args: [scenario] }, '*');
  };
  window.addEventListener('message', onMsg);
}

export async function embedDialog(w: MapWidget, app: App): Promise<void> {
  const title = w.scenario.meta.title;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
  const useSpec = !!app.lessonSpec && !w.history.canUndo;
  const fileJSON = useSpec ? JSON.stringify(app.lessonSpec, null, 2) : JSON.stringify(w.exportScenario());
  const r = await modal({
    title: 'Embed in a course',
    description: 'Students get a clean player with the timeline, the guided story and quiz questions – no editing tools.',
    wide: true,
    fields: [
      { key: 'how', label: 'How to publish', type: 'select', value: fileJSON.length < 400_000 ? 'link' : 'file', options: [
        { value: 'file', label: 'Host a lesson file (recommended – small, fast, editable)' },
        { value: 'link', label: `Self-contained link (everything inside the URL – ${(fileJSON.length / 1024).toFixed(0)} KB before compression)` },
      ] },
      { key: 'path', label: 'If hosting: where the file will live (relative to lesson.html, or a full URL)', type: 'text', value: `lessons/${slug}.json` },
      { key: 'mode', label: 'Start in', type: 'select', value: 'guided', options: [{ value: 'guided', label: 'Guided tour' }, { value: 'explore', label: 'Free exploration' }] },
      { key: 'theme', label: 'Theme', type: 'select', value: 'dark', options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }] },
      { key: 'height', label: 'Embed height (px)', type: 'number', value: 640, min: 320 },
      { key: 'globe', label: 'Start on the globe', type: 'checkbox', value: false },
    ],
    submitLabel: 'Create embed code',
  });
  if (!r) return;
  const url = playerURL();
  if (r.mode !== 'guided') url.searchParams.set('mode', r.mode);
  if (r.theme !== 'dark') url.searchParams.set('theme', r.theme);
  if (r.globe) url.searchParams.set('globe', '1');
  if (r.how === 'file') url.searchParams.set('lesson', r.path);
  else url.hash = `lesson=${await compress(fileJSON)}`;
  const src = url.toString();
  const iframe = `<iframe src="${src.replace(/"/g, '&quot;')}" title="${title.replace(/"/g, '&quot;')} – interactive map" width="100%" height="${r.height || 640}" style="border:0;border-radius:12px;max-width:100%" allow="fullscreen" loading="lazy"></iframe>`;
  const area = (text: string) => h('textarea', { readonly: true, rows: 4, style: 'width:100%;font-size:11px', onclick: (e: Event) => (e.target as HTMLTextAreaElement).select() }, text);
  const copy = (text: string, what: string) => h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(text).then(() => toast(`${what} copied`, 'success'), () => toast('Copy failed – select the text and copy it', 'warn')) }, icon('share', 12), `Copy ${what}`);
  const body = h('div', { class: 'mw-form' },
    r.how === 'file'
      ? h('div', null,
          h('p', null, h('b', null, '1. '), `Download the lesson file and upload it so it is reachable at `, h('code', null, new URL(r.path, url).toString())),
          h('button', { class: 'btn small primary', onclick: () => download(fileJSON, `${slug}.json`) }, icon('download', 12), useSpec ? 'Download lesson (atlas-lesson@1)' : 'Download lesson (scenario JSON)'),
          h('p', null, h('b', null, '2. '), 'Paste this into your course page:'))
      : h('p', null, 'Paste this into your course page (the whole lesson is inside the link):'),
    area(iframe),
    h('div', { class: 'row' }, copy(iframe, 'embed code'), copy(src, 'link'), h('a', { class: 'btn small', href: src, target: '_blank', rel: 'noopener' }, icon('play', 12), 'Open')),
    src.length > 8000 ? h('small', { class: 'muted' }, `This link is ${(src.length / 1024).toFixed(0)} KB long. Most sites accept it, but hosting a file is more robust.`) : null,
  );
  modal({ title: 'Embed code', wide: true, body, cancelLabel: null, submitLabel: 'Done' });
}

// re-export for the command palette
export type { Field };
