/**
 * The embeddable map widget: a self-contained historical map with a draggable
 * timeline and an optional guided story (chapters), designed to sit inside a
 * host page such as a lesson or article.
 *
 *   import { mountMap } from 'map-widget/embed';
 *   const map = mountMap(element, spec);      // spec: atlas-map@1 object, Scenario, or URL
 *   map.destroy();                              // when the host element goes away
 *
 * Styling is scoped to `.atlas-map` and takes its colours and fonts from CSS
 * custom properties (`--atlas-paper`, `--atlas-ink`, `--atlas-accent`, …), so
 * the host's theme carries into the map. No global CSS, no global listeners
 * that outlive `destroy()`.
 */
import { describePick, MapWidget } from '../widget/MapWidget';
import { Timeline } from '../ui/timeline';
import { h, icon } from '../ui/dom';
import { formatTime, precisionForSpan } from '../core/time';
import { formatAreaCompact } from '../core/geo';
import type { MapEvent, Scenario } from '../core/scenario';
import type { MapSpec } from '../spec/spec';
import { isMapSpec } from '../spec/spec';
import cssText from './embed.css?inline';
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline';

export type MapSource = MapSpec | Scenario | string;

export interface MountOptions {
  /** 'light' or 'dark' chrome (map colours come from the map itself). Default: the page's colour scheme. */
  theme?: 'light' | 'dark';
  /** Chapter to open on (0-based). Default 0. */
  chapter?: number;
  /** Create the map only when the widget scrolls into view (default true). */
  lazy?: boolean;
  /** Show the story panel when the map has chapters (default true). */
  story?: boolean;
  /** Accessible name for the map region (default: the map's title). */
  label?: string;
  /** Called when the reader moves to another chapter. */
  onChapter?: (index: number, count: number) => void;
  /** Called once the map has loaded (or failed to). */
  onReady?: (error?: Error) => void;
}

export interface AtlasMapHandle {
  readonly element: HTMLElement;
  /** Resolves when the map is built and showing. */
  readonly ready: Promise<void>;
  goToChapter(index: number, play?: boolean): void;
  play(): void;
  pause(): void;
  setTheme(theme: 'light' | 'dark'): void;
  /** The underlying MapWidget (null until the map has been created). */
  readonly widget: MapWidget | null;
  destroy(): void;
}

/** Mount a map into `host` (its contents are replaced). */
export function mountMap(host: HTMLElement, source: MapSource, options: MountOptions = {}): AtlasMapHandle {
  return new AtlasMap(host, source, options);
}

// ------------------------------------------------------------------ styles (injected once per document)

function injectStyles(doc: Document) {
  if (doc.getElementById('atlas-map-styles')) return;
  const style = doc.createElement('style');
  style.id = 'atlas-map-styles';
  // maplibre's own rules are scoped by its class names (.maplibregl-*) so they are safe to add
  style.textContent = `${maplibreCss}\n${cssText}`;
  doc.head.append(style);
}

async function resolveScenario(source: MapSource): Promise<Scenario> {
  let data: unknown = source;
  if (typeof source === 'string') {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Could not load the map (${res.status})`);
    data = await res.json();
  }
  if (isMapSpec(data)) {
    const { compileMap } = await import('../spec/compile');
    return compileMap(data);
  }
  return data as Scenario;
}

// ------------------------------------------------------------------ widget

class AtlasMap implements AtlasMapHandle {
  readonly element: HTMLElement;
  readonly ready: Promise<void>;
  widget: MapWidget | null = null;

  private stage: HTMLElement;
  private mapEl: HTMLElement;
  private storyEl: HTMLElement;
  private legendEl: HTMLElement;
  private eventCard: HTMLElement;
  private tooltip: HTMLElement;
  private popup: HTMLElement;
  private statusEl: HTMLElement;
  private timeline: Timeline | null = null;
  private step = -1;
  private playingStep = -1;
  private destroyed = false;
  private visible = false;
  private io: IntersectionObserver | null = null;
  private timers = new Set<number>();
  private offs: (() => void)[] = [];
  private resolveReady!: () => void;
  private rejectReady!: (e: Error) => void;

  constructor(private host: HTMLElement, private source: MapSource, private opts: MountOptions) {
    injectStyles(host.ownerDocument);
    this.ready = new Promise<void>((res, rej) => {
      this.resolveReady = res;
      this.rejectReady = rej;
    });
    this.ready.catch(() => {}); // reported through onReady and the status panel

    const theme = opts.theme ?? (matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.mapEl = h('div', { class: 'am-map' });
    this.tooltip = h('div', { class: 'am-tooltip' });
    this.popup = h('div', { class: 'am-popup', role: 'dialog' });
    this.legendEl = h('div', { class: 'am-legend' });
    this.eventCard = h('div', { class: 'am-event', role: 'status' });
    this.statusEl = h('div', { class: 'am-status' }, h('span', { class: 'am-spinner' }), 'Loading map…');
    const tools = h('div', { class: 'am-tools' },
      h('button', { class: 'am-icon', title: 'Back to the chapter view', 'aria-label': 'Reset the view', onclick: () => this.resetView() }, icon('target', 16)),
      h('button', { class: 'am-icon', title: 'Full screen', 'aria-label': 'Full screen', onclick: () => this.fullscreen() }, icon('maximize', 16)),
    );
    this.stage = h('div', { class: 'am-stage' }, this.mapEl, tools, this.legendEl, this.eventCard, this.tooltip, this.popup, this.statusEl);
    this.storyEl = h('div', { class: 'am-story', 'aria-live': 'polite' });
    this.element = h('div', { class: 'atlas-map', 'data-theme': theme, role: 'region', tabindex: 0, 'aria-label': opts.label ?? 'Interactive historical map' }, this.stage, this.storyEl);
    host.replaceChildren(this.element);
    this.element.addEventListener('keydown', (e) => this.onKey(e));

    if (opts.lazy === false || typeof IntersectionObserver === 'undefined') this.start();
    else {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        if (this.visible && !this.widget) this.start();
        // nobody is watching: stop playback (and let the render loop idle)
        if (!this.visible && this.widget?.playing) this.widget.pause();
      }, { rootMargin: '200px 0px' });
      this.io.observe(this.element);
    }
  }

  // ------------------------------------------------------------------ lifecycle

  private resizeObs: ResizeObserver | null = null;
  /** Views are authored for a ~1000 px wide map: zoom out (or in) to show the same area at this size. */
  private fitZoom() {
    const w = this.widget;
    if (!w) return;
    const width = this.stage.clientWidth || 1000;
    const next = Math.max(-2, Math.min(0.5, Math.log2(width / 1000)));
    if (Math.abs(next - w.zoomOffset) < 0.05) return;
    const d = next - w.zoomOffset;
    w.zoomOffset = next;
    w.map.setZoom(w.map.getZoom() + d);
  }

  private started = false;
  private async start() {
    if (this.started || this.destroyed) return;
    this.started = true;
    try {
      const scenario = await resolveScenario(this.source);
      if (this.destroyed) return;
      const w = new MapWidget({
        container: this.mapEl,
        persistSettings: false,
        scenario,
        settings: { minimap: false, perfHud: false, battleDive: 'off', eventToasts: false, loop: false, director: true, hashState: false, autosave: false, projection: 'mercator' },
        // inside a scrolling page: Ctrl/⌘ + scroll zooms, two fingers pan on touch screens
        mapOptions: { cooperativeGestures: true },
      });
      this.widget = w;
      this.fitZoom();
      this.resizeObs = new ResizeObserver(() => this.fitZoom());
      this.resizeObs.observe(this.stage);
      this.timeline = new Timeline(w, () => {}, { compact: true });
      this.timeline.onStepClick = (i) => this.goToChapter(i, true);
      this.stage.after(this.timeline.el);
      if (!this.opts.label) this.element.setAttribute('aria-label', `${scenario.meta?.title ?? 'Historical map'} – interactive map`);
      this.bind(w);
      this.element.classList.toggle('has-story', this.opts.story !== false && w.scenario.story.length > 0);
      const steps = w.scenario.story;
      if (steps.length) this.goToChapter(Math.max(0, Math.min(steps.length - 1, this.opts.chapter ?? 0)), false, true);
      else this.renderStory();
      this.renderLegend();
      w.once('ready', () => {
        this.statusEl.remove();
        this.resolveReady();
        this.opts.onReady?.();
      });
    } catch (err) {
      console.error('[atlas-map]', err);
      const e = err instanceof Error ? err : new Error(String(err));
      this.statusEl.replaceChildren(h('b', null, 'The map could not be shown. '), (e as any).report ? h('pre', null, (e as any).report) : e.message);
      this.statusEl.classList.add('error');
      this.rejectReady(e);
      this.opts.onReady?.(e);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.io?.disconnect();
    this.resizeObs?.disconnect();
    for (const t of this.timers) clearTimeout(t);
    this.offs.forEach((off) => off());
    this.timeline?.destroy();
    this.widget?.destroy();
    this.widget = null;
    this.element.remove();
  }

  private later(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  private bind(w: MapWidget) {
    this.offs.push(
      w.on('hover', (hv) => {
        if (!hv) return void (this.tooltip.style.display = 'none');
        this.tooltip.innerHTML = hv.html;
        this.tooltip.style.display = 'block';
        const sw = this.stage.clientWidth, sh = this.stage.clientHeight;
        this.tooltip.style.left = `${Math.min(sw - this.tooltip.offsetWidth - 6, hv.x + 14)}px`;
        this.tooltip.style.top = `${Math.min(sh - this.tooltip.offsetHeight - 6, hv.y + 14)}px`;
      }),
      w.on('time', (t) => this.onTime(t)),
      w.on('play', () => this.renderStory()),
      w.on('eventsPassed', (evs) => w.playing && this.showEvent(evs[evs.length - 1])),
    );
    // click anything (army, event, territory, label…) for details
    w.map.on('click', (e) => {
      const info = w.pick(e.point.x, e.point.y, undefined, 6);
      const html = info?.picked ? describePick(w, info, false) : null;
      if (!html) return void this.popup.classList.remove('show');
      this.popup.innerHTML = `<button class="am-icon am-popup-x" aria-label="Close">✕</button>${html}`;
      this.popup.querySelector('button')!.addEventListener('click', () => this.popup.classList.remove('show'));
      this.popup.classList.add('show');
      const sw = this.stage.clientWidth;
      this.popup.style.left = `${Math.max(6, Math.min(sw - this.popup.offsetWidth - 6, e.point.x - this.popup.offsetWidth / 2))}px`;
      this.popup.style.top = `${Math.max(6, e.point.y - this.popup.offsetHeight - 14)}px`;
    });
    w.map.on('movestart', (e: any) => e.originalEvent && this.popup.classList.remove('show'));
    // a reader taking the camera means "let me look around"
    w.map.on('dragstart', () => w.playing && w.updateSettings({ director: false }));
    this.host.ownerDocument.addEventListener('fullscreenchange', this.onFullscreen);
    this.offs.push(() => this.host.ownerDocument.removeEventListener('fullscreenchange', this.onFullscreen));
  }

  // ------------------------------------------------------------------ chapters

  goToChapter(i: number, play = false, initial = false): void {
    const w = this.widget;
    if (!w) return;
    const steps = w.scenario.story;
    if (!steps.length) return;
    i = Math.max(0, Math.min(steps.length - 1, i));
    const st = steps[i];
    this.step = i;
    this.playingStep = -1;
    w.pause();
    w.setTime(st.t);
    w.updateSettings({ director: true });
    if (st.view && initial) w.map.jumpTo({ center: st.view.center, zoom: st.view.zoom + w.zoomOffset, bearing: st.view.bearing ?? 0, pitch: st.view.pitch ?? 0 });
    this.renderStory();
    this.opts.onChapter?.(i, steps.length);
    if (play) this.playChapter();
  }

  /** Play the current chapter from its start to its end, then pause. */
  private playChapter() {
    const w = this.widget;
    if (!w) return;
    const st = w.scenario.story[this.step];
    if (!st) return w.play();
    if (w.time >= (st.end ?? w.scenario.meta.end) - w.span * 1e-4) w.setTime(st.t);
    this.playingStep = this.step;
    w.updateSettings({ director: true });
    w.play();
  }

  play(): void {
    if (this.widget?.scenario.story.length) this.playChapter();
    else this.widget?.play();
  }

  pause(): void {
    this.widget?.pause();
  }

  private next() {
    const n = this.widget?.scenario.story.length ?? 0;
    if (this.step < n - 1) this.goToChapter(this.step + 1, true);
  }

  private prev() {
    if (this.step > 0) this.goToChapter(this.step - 1, false);
  }

  private onTime(t: number) {
    const w = this.widget!;
    const steps = w.scenario.story;
    if (w.playing && this.playingStep >= 0) {
      const st = steps[this.playingStep];
      if (st && t >= (st.end ?? Infinity)) {
        w.pause();
        w.setTime(Math.min(st.end!, w.scenario.meta.end));
        this.playingStep = -1;
        this.storyEl.querySelector('.am-next')?.classList.add('pulse');
        return;
      }
    }
    // keep the visible chapter in step with the timeline (dragging, free play)
    let cur = -1;
    for (let i = 0; i < steps.length; i++) if (t >= steps[i].t - w.span * 1e-6) cur = i;
    if (cur !== this.step && cur >= 0 && this.playingStep < 0) {
      this.step = cur;
      this.renderStory();
      this.opts.onChapter?.(cur, steps.length);
    }
    this.legendTimer && clearTimeout(this.legendTimer);
    this.legendTimer = this.later(() => this.renderLegend(), 150);
  }
  private legendTimer = 0;

  private resetView() {
    const w = this.widget;
    if (!w) return;
    const st = w.scenario.story[this.step];
    const v = st?.view ?? w.scenario.meta.view;
    if (v) w.flyTo({ ...v, duration: 900 });
    w.updateSettings({ director: true });
  }

  // ------------------------------------------------------------------ rendering

  private renderStory() {
    const w = this.widget;
    if (!w || this.opts.story === false) return;
    const steps = w.scenario.story;
    if (!steps.length) return void this.storyEl.replaceChildren();
    const i = Math.max(0, this.step);
    const st = steps[i];
    const prec = precisionForSpan(w.span);
    const playing = w.playing;
    this.storyEl.replaceChildren(
      h('div', { class: 'am-kicker' }, `${i + 1} / ${steps.length} · ${formatTime(st.t, prec)}`),
      h('div', { class: 'am-title' }, st.title),
      h('div', { class: 'am-text', html: md(st.text) }),
      h('div', { class: 'am-nav' },
        h('button', { class: 'am-btn', disabled: i === 0, onclick: () => this.prev(), 'aria-label': 'Previous chapter' }, icon('stepBack', 14), h('span', { class: 'am-label' }, 'Back')),
        h('button', { class: 'am-btn', onclick: () => (playing ? w.pause() : this.playChapter()), 'aria-label': playing ? 'Pause' : 'Play this chapter' }, icon(playing ? 'pause' : 'play', 14), h('span', { class: 'am-label' }, playing ? 'Pause' : 'Play')),
        h('div', { class: 'am-dots', role: 'tablist', 'aria-label': 'Chapters' },
          ...steps.map((s, k) => h('button', { class: `am-dot ${k === i ? 'on' : ''}`, role: 'tab', 'aria-selected': String(k === i), title: `${k + 1}. ${s.title}`, 'aria-label': `Chapter ${k + 1}: ${s.title}`, onclick: () => this.goToChapter(k, false) }))),
        h('button', { class: 'am-btn primary am-next', disabled: i === steps.length - 1, onclick: () => this.next(), 'aria-label': 'Next chapter' }, h('span', { class: 'am-label' }, 'Next'), icon('stepFwd', 14)),
      ),
    );
  }

  private renderLegend() {
    const w = this.widget;
    if (!w) return;
    const areas = w.factionAreas();
    const rows = w.scenario.factions.map((f, i) => ({ f, a: areas[i] })).filter((r) => r.a > 0).sort((a, b) => b.a - a.a).slice(0, 6);
    this.legendEl.style.display = rows.length ? '' : 'none';
    this.legendEl.replaceChildren(
      ...rows.map((r) => h('div', { class: 'am-lg-row' }, h('span', { class: 'am-swatch', style: `background:${r.f.color}` }), h('span', null, r.f.name), h('span', { class: 'v' }, formatAreaCompact(r.a)))),
    );
  }

  private eventTimer = 0;
  private showEvent(e: MapEvent | undefined) {
    if (!e || !this.widget) return;
    const prec = precisionForSpan(this.widget.span);
    this.eventCard.innerHTML = `<div class="when">${esc(formatTime(e.t, prec))}</div><div class="what">${esc(e.title)}</div>${e.description ? `<div class="desc">${esc(e.description)}</div>` : ''}`;
    this.eventCard.classList.add('show');
    if (this.eventTimer) clearTimeout(this.eventTimer);
    this.eventTimer = this.later(() => this.eventCard.classList.remove('show'), 4500);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.element.dataset.theme = theme;
    this.widget?.requestRender();
  }

  // ------------------------------------------------------------------ input

  private onKey(e: KeyboardEvent) {
    const tgt = e.target as HTMLElement;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.getAttribute('role') === 'slider')) return;
    if (e.key === ' ' && tgt === this.element) {
      e.preventDefault();
      this.widget?.playing ? this.pause() : this.play();
    } else if (e.key === 'ArrowRight' && tgt === this.element) this.next();
    else if (e.key === 'ArrowLeft' && tgt === this.element) this.prev();
    else if (e.key === 'Escape') this.popup.classList.remove('show');
  }

  private fullscreen() {
    const doc = this.host.ownerDocument;
    if (doc.fullscreenElement) doc.exitFullscreen();
    else this.element.requestFullscreen?.().catch(() => {});
  }

  private onFullscreen = () => {
    const full = this.host.ownerDocument.fullscreenElement === this.element;
    this.element.classList.toggle('full', full);
    const coop = (this.widget?.map as any)?.cooperativeGestures;
    if (coop) full ? coop.disable() : coop.enable();
    this.later(() => this.widget?.map.resize(), 50);
  };
}

// ------------------------------------------------------------------ text helpers

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Tiny, safe Markdown: escaping, **bold**, *italic*, [links](https://…) and paragraphs. */
function md(src: string): string {
  return esc(src)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
