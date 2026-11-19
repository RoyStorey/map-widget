/**
 * Atlas lesson player — the student-facing, embeddable view.
 *
 *   lesson.html?lesson=lessons/norman-conquest-1066.json   (lesson JSON or scenario JSON URL)
 *   lesson.html?demo=ww2                                   (built-in scenario)
 *   lesson.html#lesson=<deflate+base64url JSON>            (self-contained link)
 *
 * Options: &mode=guided|explore  &step=3  &theme=light|dark  &story=0 (hide the story panel)
 *          &autoplay=1  &globe=1  &title=0
 *
 * Embedding: the page speaks the same postMessage API as the editor
 * (see io/bridge.ts) plus { method: 'loadLesson', args: [spec] }, and posts
 * { type: 'atlas:progress' } / { type: 'atlas:quiz' } events to the parent so a
 * course platform can record progress.
 */
import '../styles/app.css';
import './player.css';
import { MapWidget, describePick } from '../widget/MapWidget';
import { Timeline } from '../ui/timeline';
import { h, icon, esc, toast } from '../ui/dom';
import { formatTime, precisionForSpan } from '../core/time';
import { formatAreaCompact, haversineKm } from '../core/geo';
import maplibregl from 'maplibre-gl';
import type { MapEvent, Scenario, StoryStep } from '../core/scenario';
import { DEMOS } from '../demos/index';
import { decompress } from '../io/storage';
import { installBridge } from '../io/bridge';

type Mode = 'guided' | 'explore';

const params = new URLSearchParams(location.search);
const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));

class Player {
  readonly w: MapWidget;
  private root: HTMLElement;
  private storyEl: HTMLElement;
  private legendEl: HTMLElement;
  private eventCard: HTMLElement;
  private titleEl: HTMLElement;
  private modeBtn!: HTMLButtonElement;
  private timeline: Timeline;
  private mode: Mode = (params.get('mode') as Mode) === 'explore' ? 'explore' : 'guided';
  private step = -1;
  /** Index of the chapter currently being played in guided mode (pauses at its end). */
  private playingStep = -1;
  private answers = new Map<number, number>();
  private storyOpen = params.get('story') !== '0';
  private eventTimer = 0;
  private legendTimer = 0;

  constructor(host: HTMLElement) {
    document.documentElement.dataset.theme = params.get('theme') === 'light' ? 'light' : 'dark';
    this.root = h('div', { class: 'mw-root lp-root' });
    host.append(this.root);
    const mapEl = h('div', { class: 'mw-map', role: 'application', 'aria-label': 'Interactive history map' });
    this.root.append(mapEl);
    this.w = new MapWidget({
      container: mapEl,
      persistSettings: false,
      settings: { minimap: false, perfHud: false, battleDive: 'off', eventToasts: true, loop: false, director: true, hashState: false, autosave: false, theme: 'dark', projection: params.get('globe') === '1' ? 'globe' : 'mercator' },
    });
    (window as any).widget = this.w;

    // ---- header
    this.titleEl = h('div', { class: 'lp-title' });
    this.modeBtn = h('button', { class: 'btn lp-mode', onclick: () => this.setMode(this.mode === 'guided' ? 'explore' : 'guided') });
    const header = h(
      'div',
      { class: 'lp-header' },
      h('div', { class: 'lp-brand glass' }, this.titleEl),
      h('div', { class: 'mw-spacer' }),
      h('div', { class: 'lp-actions glass' },
        this.modeBtn,
        h('button', { class: 'icon-btn', title: 'Show / hide the story', 'aria-label': 'Show or hide the story', onclick: () => this.toggleStory() }, icon('list', 17)),
        h('button', { class: 'icon-btn', title: 'Globe / flat map', 'aria-label': 'Toggle globe', onclick: () => this.w.updateSettings({ projection: this.w.settings.projection === 'globe' ? 'mercator' : 'globe' }) }, icon('globe', 17)),
        h('button', { class: 'icon-btn', title: 'Printable worksheet (with answer key)', 'aria-label': 'Print worksheet', onclick: () => this.worksheet() }, icon('download', 17)),
        h('button', { class: 'icon-btn', title: 'About this map & sources', 'aria-label': 'About this map and sources', onclick: () => this.showAbout() }, icon('help', 17)),
        h('button', { class: 'icon-btn', title: 'Full screen', 'aria-label': 'Full screen', onclick: () => this.fullscreen() }, icon('maximize', 17)),
      ),
    );
    if (params.get('title') === '0') header.querySelector('.lp-brand')?.remove();

    this.storyEl = h('aside', { class: 'lp-story glass', 'aria-live': 'polite' });
    this.legendEl = h('div', { class: 'lp-legend glass' });
    this.eventCard = h('div', { class: 'lp-event glass', role: 'status' });
    const tooltip = h('div', { class: 'mw-tooltip glass' });
    this.timeline = new Timeline(this.w, () => {}, { compact: true });
    this.timeline.onStepClick = (i) => this.goToStep(i, true);
    this.root.append(header, this.storyEl, this.legendEl, this.eventCard, tooltip, this.timeline.el);
    this.root.classList.toggle('story-hidden', !this.storyOpen);

    // ---- widget events
    const w = this.w;
    w.on('hover', (hv) => {
      if (!hv) return void (tooltip.style.display = 'none');
      tooltip.innerHTML = hv.html;
      tooltip.style.display = 'block';
      const r = w.container.getBoundingClientRect();
      tooltip.style.left = `${Math.min(window.innerWidth - tooltip.offsetWidth - 8, r.left + hv.x + 14)}px`;
      tooltip.style.top = `${Math.min(window.innerHeight - tooltip.offsetHeight - 8, r.top + hv.y + 14)}px`;
    });
    w.on('time', (t) => this.onTime(t));
    w.on('play', () => this.renderStory());
    w.on('eventsPassed', (evs) => this.showEvent(evs[evs.length - 1]));
    // click anything (army, event, territory, label…) for details
    const popup = h('div', { class: 'lp-popup glass', role: 'dialog' });
    this.root.append(popup);
    w.map.on('click', (e) => {
      if (this.locating) return this.answerLocate([e.lngLat.lng, e.lngLat.lat], e.point);
      const info = w.pick(e.point.x, e.point.y, undefined, 6);
      const html = info?.picked ? describePick(w, info, false) : null;
      if (!html) return void popup.classList.remove('show');
      popup.innerHTML = `<button class="icon-btn lp-popup-x" aria-label="Close">✕</button>${html}`;
      popup.querySelector('button')!.addEventListener('click', () => popup.classList.remove('show'));
      const r = w.container.getBoundingClientRect();
      popup.classList.add('show');
      popup.style.left = `${Math.max(8, Math.min(r.right - popup.offsetWidth - 8, r.left + e.point.x - popup.offsetWidth / 2))}px`;
      popup.style.top = `${Math.max(60, r.top + e.point.y - popup.offsetHeight - 16)}px`;
    });
    w.map.on('movestart', (e: any) => e.originalEvent && popup.classList.remove('show'));
    w.on('scenario', () => this.onScenario());
    w.map.on('dragstart', () => {
      // a student taking the camera means "let me look around"
      if (this.mode === 'guided' && w.playing) w.updateSettings({ director: false });
    });

    window.addEventListener('keydown', (e) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.getAttribute('role') === 'slider')) return;
      if (e.key === ' ') { e.preventDefault(); w.togglePlay(); }
      else if (e.key === 'ArrowRight' || e.key === 'n') this.next();
      else if (e.key === 'ArrowLeft' || e.key === 'p') this.prev();
      else if (e.key === 'f') this.fullscreen();
    });

    this.setMode(this.mode, true);
  }

  // ------------------------------------------------------------------ loading

  async load(): Promise<void> {
    try {
      const s = await this.resolveSource();
      if (!s) {
        if (params.has('wait')) {
          // opened by the editor's "Preview as student": it will send the lesson by postMessage
          this.setStory(h('div', { class: 'lp-kicker' }, 'Loading'), h('h2', null, 'Preparing the lesson…'));
          (window.opener ?? window.parent)?.postMessage({ type: 'atlas:ready' }, '*');
          return;
        }
        await this.showGallery();
        return;
      }
      this.loadScenario(s);
    } catch (err) {
      console.error(err);
      const report = (err as any).report as string | undefined;
      this.showError(`This lesson could not be loaded: ${(err as Error).message}`, report);
    }
  }

  private async resolveSource(): Promise<Scenario | null> {
    const packed = hashParams.get('lesson');
    if (packed) return this.fromJSON(JSON.parse(await decompress(packed)));
    const url = params.get('lesson');
    if (url) {
      const res = await fetch(new URL(url, document.baseURI));
      if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
      return this.fromJSON(await res.json());
    }
    const demo = DEMOS.find((d) => d.id === params.get('demo'));
    if (demo) return demo.load();
    return null;
  }

  /** Accepts a lesson spec (compiled here) or a full scenario JSON. */
  async fromJSON(json: any): Promise<Scenario> {
    if (json?.format?.startsWith?.('atlas-lesson')) {
      const { compileLesson } = await import('../lesson/compile');
      return compileLesson(json);
    }
    if (json?.version === 1 && json.meta) return json as Scenario;
    throw new Error('Unrecognised file: expected an atlas-lesson@1 lesson or an Atlas scenario.');
  }

  loadScenario(s: Scenario): void {
    this.answers.clear();
    this.step = -1;
    this.playingStep = -1;
    this.w.loadScenario(s);
    this.w.updateSettings({ director: this.mode === 'guided', loop: false, battleDive: 'off' });
    const want = parseInt(params.get('step') ?? '', 10);
    const steps = this.w.scenario.story;
    if (steps.length) this.goToStep(Number.isFinite(want) ? Math.max(0, Math.min(steps.length - 1, want - 1)) : 0, params.get('autoplay') === '1');
    else if (params.get('autoplay') === '1') setTimeout(() => this.w.play(), 1500);
    this.post({ type: 'atlas:loaded', title: s.meta.title, steps: steps.length, questions: steps.filter((x) => x.question).length });
  }

  private onScenario(): void {
    const m = this.w.scenario.meta;
    this.titleEl.innerHTML = `<b>${esc(m.title)}</b>${m.audience ? `<small>${esc(m.audience)}</small>` : ''}`;
    document.title = `${m.title} — Atlas`;
    this.root.classList.toggle('no-story', !this.w.scenario.story.length);
    this.renderStory();
    this.renderLegend();
  }

  // ------------------------------------------------------------------ modes & steps

  private setMode(mode: Mode, quiet = false): void {
    this.mode = mode;
    this.modeBtn.replaceChildren(icon(mode === 'guided' ? 'film' : 'pointer', 14), mode === 'guided' ? 'Guided' : 'Explore');
    this.modeBtn.title = mode === 'guided' ? 'Guided: the camera follows the story and pauses after each chapter. Click to explore freely.' : 'Explore: drag the timeline and the map freely. Click for the guided tour.';
    this.root.classList.toggle('explore', mode === 'explore');
    this.w.updateSettings({ director: mode === 'guided' });
    if (!quiet) toast(mode === 'guided' ? 'Guided tour: use Next to move through the story' : 'Explore freely: drag the timeline and the map', 'info', 2200);
    this.renderStory();
  }

  goToStep(i: number, play: boolean): void {
    this.clearLocateMarkers();
    this.locating = null;
    if (this.speaking) {
      window.speechSynthesis.cancel();
      this.speaking = false;
    }
    const steps = this.w.scenario.story;
    if (!steps.length) return;
    i = Math.max(0, Math.min(steps.length - 1, i));
    const st = steps[i];
    this.step = i;
    this.w.pause();
    this.w.setTime(st.t);
    if (this.mode === 'guided') this.w.updateSettings({ director: true });
    else if (st.view) this.w.flyTo({ ...st.view, duration: 1500 });
    this.renderStory();
    this.post({ type: 'atlas:progress', step: i + 1, of: steps.length, title: st.title });
    if (play) this.playStep();
  }

  /** Play the current chapter from its start to its end, then pause (guided mode). */
  playStep(): void {
    const st = this.w.scenario.story[this.step];
    if (!st) return this.w.play();
    if (this.w.time >= (st.end ?? this.w.scenario.meta.end) - this.w.span * 1e-4) this.w.setTime(st.t);
    this.playingStep = this.step;
    this.w.updateSettings({ director: this.mode === 'guided' });
    this.w.play();
  }

  next(): void {
    const n = this.w.scenario.story.length;
    if (this.step < n - 1) this.goToStep(this.step + 1, this.mode === 'guided');
    else this.showSummary();
  }

  prev(): void {
    if (this.step > 0) this.goToStep(this.step - 1, false);
  }

  private onTime(t: number): void {
    const steps = this.w.scenario.story;
    // pause at the end of the chapter being played (guided)
    if (this.w.playing && this.mode === 'guided' && this.playingStep >= 0) {
      const st = steps[this.playingStep];
      if (st && t >= (st.end ?? Infinity)) {
        this.w.pause();
        this.w.setTime(Math.min(st.end!, this.w.scenario.meta.end));
        this.playingStep = -1;
        this.storyEl.querySelector('.lp-next')?.classList.add('pulse');
        return;
      }
    }
    // keep the visible chapter in sync with the timeline (dragging, explore mode, free play)
    let cur = -1;
    for (let i = 0; i < steps.length; i++) if (t >= steps[i].t - this.w.span * 1e-6) cur = i;
    if (cur !== this.step && cur >= 0 && this.playingStep < 0) {
      this.step = cur;
      this.renderStory();
    }
    clearTimeout(this.legendTimer);
    this.legendTimer = window.setTimeout(() => this.renderLegend(), 120);
  }

  // ------------------------------------------------------------------ rendering

  private renderStory(): void {
    const steps = this.w.scenario.story;
    if (!steps.length) {
      this.storyEl.replaceChildren(
        h('div', { class: 'lp-step-head' }, h('div', { class: 'lp-kicker' }, 'Explore')),
        h('h2', null, this.w.scenario.meta.title),
        h('div', { class: 'lp-text', html: md(this.w.scenario.meta.description ?? 'Press play or drag the timeline to see what happened.') }),
      );
      return;
    }
    const i = Math.max(0, this.step);
    const st = steps[i];
    const prec = precisionForSpan(this.w.span);
    const dots = h('div', { class: 'lp-dots', role: 'tablist', 'aria-label': 'Chapters' },
      ...steps.map((s, k) => h('button', { class: `lp-dot ${k === i ? 'on' : ''} ${this.answers.has(k) ? (this.answers.get(k) === s.question?.answer ? 'right' : 'wrong') : ''}`, role: 'tab', 'aria-selected': String(k === i), title: `${k + 1}. ${s.title}`, 'aria-label': `Chapter ${k + 1}: ${s.title}`, onclick: () => this.goToStep(k, this.mode === 'guided') })),
    );
    const playing = this.w.playing;
    const body: (HTMLElement | null)[] = [
      h('div', { class: 'lp-step-head' },
        h('div', { class: 'lp-kicker' }, `Chapter ${i + 1} of ${steps.length} · ${formatTime(st.t, prec)}`),
        h('span', { style: 'display:flex;gap:2px' },
          'speechSynthesis' in window ? h('button', { class: `icon-btn ${this.speaking ? 'on' : ''}`, title: this.speaking ? 'Stop reading' : 'Read aloud', 'aria-label': this.speaking ? 'Stop reading' : 'Read this chapter aloud', onclick: () => this.readAloud(st) }, icon(this.speaking ? 'pause' : 'activity', 14)) : null,
          h('button', { class: 'icon-btn lp-collapse', title: 'Hide story', 'aria-label': 'Hide story', onclick: () => this.toggleStory() }, icon('x', 14)),
        ),
      ),
      h('h2', null, st.title),
      st.image ? h('figure', { class: 'lp-figure' }, h('img', { src: st.image, alt: st.imageCaption ?? '', loading: 'lazy' }), st.imageCaption ? h('figcaption', null, st.imageCaption) : null) : null,
      h('div', { class: 'lp-text', html: md(st.text) }),
      st.question ? this.renderQuestion(st, i) : null,
      h('div', { class: 'lp-nav' },
        h('button', { class: 'btn', disabled: i === 0, onclick: () => this.prev(), 'aria-label': 'Previous chapter' }, icon('stepBack', 14), 'Back'),
        h('button', { class: 'btn', onclick: () => (playing ? this.w.pause() : this.playStep()), 'aria-label': playing ? 'Pause' : 'Play this chapter' }, icon(playing ? 'pause' : 'play', 14), playing ? 'Pause' : 'Play'),
        h('button', { class: 'btn primary lp-next', onclick: () => this.next(), 'aria-label': i === steps.length - 1 ? 'Finish' : 'Next chapter' }, i === steps.length - 1 ? 'Finish' : 'Next', icon('stepFwd', 14)),
      ),
      dots,
    ];
    this.storyEl.replaceChildren(...(body.filter(Boolean) as HTMLElement[]));
  }

  private speaking = false;
  /** Text-to-speech for a chapter (title, text and question). */
  private readAloud(st: StoryStep): void {
    const synth = window.speechSynthesis;
    if (this.speaking) {
      synth.cancel();
      this.speaking = false;
      return this.renderStory();
    }
    const plain = (x: string) => x.replace(/\*\*|\*|\[([^\]]+)\]\([^)]+\)/g, (m, a) => a ?? '');
    const parts = [st.title, plain(st.text)];
    if (st.question) parts.push(`Question: ${st.question.prompt}`, ...st.question.choices.map((c, i) => `${String.fromCharCode(65 + i)}: ${c}`));
    const u = new SpeechSynthesisUtterance(parts.join('. '));
    u.rate = 0.95;
    u.onend = u.onerror = () => {
      this.speaking = false;
      this.renderStory();
    };
    synth.cancel();
    synth.speak(u);
    this.speaking = true;
    this.renderStory();
  }

  private setStory(...kids: (Node | null | undefined)[]): void {
    this.storyEl.replaceChildren(...(kids.filter(Boolean) as Node[]));
  }

  // ------------------------------------------------------------------ find-it-on-the-map questions

  private locating: { i: number; st: StoryStep } | null = null;
  private locateMarkers: maplibregl.Marker[] = [];
  private locateFeedback = new Map<number, string>();

  private startLocate(i: number, st: StoryStep): void {
    this.locating = { i, st };
    this.w.pause();
    this.w.updateSettings({ director: false });
    this.w.map.getCanvas().style.cursor = 'crosshair';
    toast('Click on the map to answer', 'info', 2500);
    this.renderStory();
  }

  private answerLocate(p: [number, number], _pt: unknown): void {
    const loc = this.locating;
    if (!loc) return;
    this.locating = null;
    this.w.map.getCanvas().style.cursor = '';
    const q = loc.st.question!;
    const km = haversineKm(p, q.locate!);
    const right = km <= (q.radiusKm ?? 300);
    this.answers.set(loc.i, right ? q.answer : -1);
    const dist = km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString()} km`;
    this.locateFeedback.set(loc.i, right ? `✓ Correct! You were ${dist} away. ` : `✗ Not quite – that was ${dist} away. The right place is marked in green. `);
    this.clearLocateMarkers();
    const mk = (lngLat: [number, number], cls: string) => {
      const el = h('div', { class: `lp-pin ${cls}` });
      const m = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(this.w.map);
      this.locateMarkers.push(m);
    };
    mk(p, right ? 'right' : 'wrong');
    mk(q.locate!, 'target');
    const b = [Math.min(p[0], q.locate![0]), Math.min(p[1], q.locate![1]), Math.max(p[0], q.locate![0]), Math.max(p[1], q.locate![1])] as [number, number, number, number];
    this.w.fitBounds(b, 120);
    this.post({ type: 'atlas:quiz', step: loc.i + 1, question: q.prompt, kind: 'locate', distanceKm: km, correct: right, score: this.score() });
    this.renderStory();
  }

  private clearLocateMarkers(): void {
    this.locateMarkers.forEach((m) => m.remove());
    this.locateMarkers = [];
  }

  private renderQuestion(st: StoryStep, i: number): HTMLElement {
    const q = st.question!;
    const chosen = this.answers.get(i);
    if (q.locate) {
      const box = h('div', { class: 'lp-quiz', role: 'group', 'aria-label': 'Check your understanding' },
        h('div', { class: 'lp-quiz-title' }, icon('target', 14), 'Find it on the map'),
        h('div', { class: 'lp-quiz-prompt' }, q.prompt),
      );
      if (chosen === undefined) {
        const active = this.locating?.i === i;
        box.append(h('button', { class: `btn ${active ? '' : 'primary'}`, style: 'justify-content:center', onclick: () => (active ? ((this.locating = null), this.renderStory()) : this.startLocate(i, st)) }, icon('crosshair', 14), active ? 'Click the map… (cancel)' : 'Answer on the map'));
      } else {
        const right = chosen === q.answer;
        box.append(h('div', { class: `lp-feedback ${right ? 'right' : 'wrong'}` }, this.locateFeedback.get(i) ?? '', q.explain ?? ''));
      }
      return box;
    }
    const box = h('div', { class: 'lp-quiz', role: 'group', 'aria-label': 'Check your understanding' },
      h('div', { class: 'lp-quiz-title' }, icon('help', 14), 'Check your understanding'),
      h('div', { class: 'lp-quiz-prompt' }, q.prompt),
      ...q.choices.map((c, k) =>
        h('button', {
          class: `lp-choice ${chosen !== undefined ? (k === q.answer ? 'right' : k === chosen ? 'wrong' : 'dim') : ''}`,
          disabled: chosen !== undefined,
          onclick: () => {
            this.answers.set(i, k);
            this.post({ type: 'atlas:quiz', step: i + 1, question: q.prompt, chosen: k, correct: k === q.answer, score: this.score() });
            this.renderStory();
          },
        }, h('span', { class: 'lp-letter' }, String.fromCharCode(65 + k)), c),
      ),
    );
    if (chosen !== undefined) {
      const right = chosen === q.answer;
      box.append(h('div', { class: `lp-feedback ${right ? 'right' : 'wrong'}` }, right ? '✓ Correct! ' : `✗ Not quite — the answer is ${String.fromCharCode(65 + q.answer)}. `, q.explain ?? ''));
    }
    return box;
  }

  private score() {
    const steps = this.w.scenario.story;
    let right = 0, asked = 0;
    steps.forEach((s, k) => {
      if (!s.question) return;
      asked++;
      if (this.answers.get(k) === s.question.answer) right++;
    });
    return { right, answered: this.answers.size, asked };
  }

  private showSummary(): void {
    const sc = this.score();
    const m = this.w.scenario.meta;
    this.setStory(
      h('div', { class: 'lp-step-head' }, h('div', { class: 'lp-kicker' }, 'Lesson complete')),
      h('h2', null, '🎉 Well done!'),
      sc.asked ? h('div', { class: 'lp-score' }, h('b', null, `${sc.right} / ${sc.asked}`), ' questions correct') : null,
      h('div', { class: 'lp-text', html: md('Now **explore freely**: drag the timeline, zoom into places and click on markers, armies and territories to learn more.') }),
      m.sources?.length ? h('div', { class: 'lp-sources' }, h('b', null, 'Sources & further reading'), h('ul', null, ...m.sources.map((x) => h('li', { html: md(x) })))) : null,
      h('div', { class: 'lp-nav' },
        h('button', { class: 'btn', onclick: () => { this.answers.clear(); this.goToStep(0, false); } }, icon('undo', 14), 'Start over'),
        h('button', { class: 'btn primary', onclick: () => this.setMode('explore') }, icon('pointer', 14), 'Explore'),
      ),
    );
    this.post({ type: 'atlas:complete', score: sc });
  }

  private renderLegend(): void {
    const w = this.w;
    const areas = w.factionAreas();
    const rows = w.scenario.factions.map((f, i) => ({ f, a: areas[i] })).filter((r) => r.a > 0).sort((a, b) => b.a - a.a).slice(0, 8);
    this.legendEl.style.display = rows.length ? '' : 'none';
    this.legendEl.replaceChildren(
      ...rows.map((r) => h('div', { class: 'lg-row' }, h('span', { class: 'swatch', style: `background:${r.f.color}` }), h('span', null, r.f.name), h('span', { class: 'v' }, formatAreaCompact(r.a)))),
    );
  }

  private showEvent(e: MapEvent | undefined): void {
    if (!e) return;
    const prec = precisionForSpan(this.w.span);
    this.eventCard.innerHTML = `<div class="when">${esc(formatTime(e.t, prec))}</div><div class="what">${esc(e.title)}</div>${e.description ? `<div class="muted">${esc(e.description)}</div>` : ''}`;
    this.eventCard.classList.add('show');
    clearTimeout(this.eventTimer);
    this.eventTimer = window.setTimeout(() => this.eventCard.classList.remove('show'), 4500);
  }

  private toggleStory(): void {
    this.storyOpen = !this.storyOpen;
    this.root.classList.toggle('story-hidden', !this.storyOpen);
    setTimeout(() => this.w.map.resize(), 230);
  }

  private showAbout(): void {
    const m = this.w.scenario.meta;
    const overlay = h('div', { class: 'mw-overlay', onclick: (e: MouseEvent) => e.target === overlay && overlay.remove() },
      h('div', { class: 'mw-modal', role: 'dialog', 'aria-label': 'About this map' },
        h('h3', null, m.title),
        m.description ? h('div', { class: 'lp-text', html: md(m.description) }) : null,
        m.sources?.length ? h('div', { class: 'lp-sources' }, h('b', null, 'Sources & further reading'), h('ul', null, ...m.sources.map((x) => h('li', { html: md(x) })))) : null,
        h('p', { class: 'muted', style: 'margin-top:12px' }, 'How to use: press Play or drag the timeline at the bottom. In Guided mode the map follows the story; switch to Explore to look around on your own. Click armies, events and territories for details. Keys: Space play/pause, ← → previous/next chapter, F full screen.'),
        h('p', { class: 'muted' }, 'Maps and dates are simplified for teaching. Borders are approximate.'),
        h('div', { class: 'mw-actions' }, h('button', { class: 'btn primary', onclick: () => overlay.remove() }, 'Close')),
      ),
    );
    document.body.append(overlay);
  }

  private progressEl: HTMLElement | null = null;
  private async worksheet(): Promise<void> {
    const { printWorksheet } = await import('./worksheet');
    await printWorksheet(this.w, md, (msg) => {
      if (!msg) {
        this.progressEl?.remove();
        this.progressEl = null;
        return;
      }
      this.progressEl ??= this.root.appendChild(h('div', { class: 'lp-progress glass', role: 'status' }));
      this.progressEl.textContent = msg;
    });
  }

  private fullscreen(): void {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  /** No lesson in the URL: list the lessons in lessons/index.json. */
  private async showGallery(): Promise<void> {
    let list: { file: string; title: string; kind?: string; audience?: string }[] = [];
    try {
      list = (await (await fetch(new URL('lessons/index.json', document.baseURI))).json()).lessons ?? [];
    } catch {
      /* no index */
    }
    if (!list.length) return this.showError('No lesson given. Add ?lesson=path/to/lesson.json or ?demo=ww2 to the address.');
    this.setStory(
      h('div', { class: 'lp-step-head' }, h('div', { class: 'lp-kicker' }, 'Lessons')),
      h('h2', null, 'Choose a lesson'),
      ...list.map((l) => {
        const url = new URL(location.href);
        url.searchParams.set('lesson', `lessons/${l.file}`);
        return h('a', { class: 'lp-choice', href: url.toString(), style: 'text-decoration:none;color:inherit' }, h('span', { class: 'lp-letter' }, '▶'), h('span', null, h('b', null, l.title), h('br'), h('small', { class: 'muted' }, [l.kind, l.audience].filter(Boolean).join(' · '))));
      }),
    );
    this.root.classList.remove('story-hidden');
  }

  private showError(msg: string, report?: string): void {
    this.setStory(h('div', { class: 'lp-step-head' }, h('div', { class: 'lp-kicker' }, 'Problem')), h('h2', null, 'Lesson unavailable'), h('p', null, msg), report ? h('pre', { class: 'lp-report' }, report) : null);
    this.root.classList.remove('story-hidden');
  }

  private post(msg: Record<string, unknown>): void {
    if (window.parent !== window) window.parent.postMessage(msg, '*');
  }
}

/** Tiny, safe Markdown: escaping, **bold**, *italic*, [links](https://…) and paragraphs. */
export function md(src: string): string {
  return esc(src)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// ------------------------------------------------------------------ boot

const player = new Player(document.getElementById('app')!);
(window as any).player = player;
installBridge(player.w);
window.addEventListener('message', async (ev) => {
  const m = ev.data;
  if (m?.type !== 'atlas' || m.method !== 'loadLesson') return;
  if (ev.source !== window.opener && ev.source !== window.parent) return;
  try {
    player.loadScenario(await player.fromJSON(m.args?.[0]));
    (ev.source as Window | null)?.postMessage({ type: 'atlas:result', id: m.id, result: true }, { targetOrigin: ev.origin || '*' });
  } catch (err) {
    (ev.source as Window | null)?.postMessage({ type: 'atlas:result', id: m.id, error: String((err as any).report ?? (err as Error).message) }, { targetOrigin: ev.origin || '*' });
  }
});
player.load();
