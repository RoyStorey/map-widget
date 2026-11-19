import type { MapWidget } from '../widget/MapWidget';
import { formatDuration, formatTime, niceTimeStep, parseTime, precisionForSpan, type Precision } from '../core/time';
import { h, icon, menu, modal, toast } from './dom';
import { cellAreaKm2, kindColor } from '../layers/build';
import { sampleWeighted } from '../core/ownership';

/**
 * Bottom timeline: transport controls, a big date readout, and a canvas track
 * with a stacked area chart of faction territory, event ticks, camera keys
 * and a draggable playhead. Wheel zooms the visible window, drag pans with Shift.
 */
export class Timeline {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timeLabel: HTMLElement;
  private chronicle: HTMLElement;
  private playBtn: HTMLButtonElement;
  private loopBtn: HTMLButtonElement;
  private directorBtn: HTMLButtonElement;
  private speedSel: HTMLSelectElement;
  private tip: HTMLElement;
  private view: [number, number] | null = null; // zoomed window; null = full scenario
  private chartCache: { key: string; data: Float64Array[]; max: number } | null = null;
  private dragging = false;
  private panning: { x: number; view: [number, number] } | null = null;
  private dirty = true;
  private raf = 0;
  private dpr = 1;

  constructor(private w: MapWidget, private onRecord: () => void) {
    this.timeLabel = h('div', { class: 'mw-tl-time', title: 'Click to jump to a date', onclick: () => this.promptTime() });
    this.playBtn = h('button', { class: 'icon-btn', title: 'Play / pause (Space)', onclick: () => w.togglePlay() }, icon('play', 20));
    this.loopBtn = h('button', { class: 'icon-btn', title: 'Loop', onclick: () => w.updateSettings({ loop: !w.settings.loop }) }, icon('loop', 16));
    this.directorBtn = h('button', { class: 'icon-btn', title: 'Director mode: camera follows keyframes (D)', onclick: () => w.updateSettings({ director: !w.settings.director }) }, icon('film', 16));
    this.speedSel = h('select', { title: 'Playback speed (time for a full run)', onchange: () => w.setSpeed(parseFloat(this.speedSel.value)) });
    this.chronicle = h('div', { class: 'mw-chronicle' });
    const controls = h(
      'div',
      { class: 'mw-tl-controls' },
      h('button', { class: 'icon-btn', title: 'Go to start (Home)', onclick: () => w.setTime(w.scenario.meta.start) }, icon('skipBack', 16)),
      h('button', { class: 'icon-btn', title: 'Previous change (,)', onclick: () => w.stepEvent(-1) }, icon('stepBack', 16)),
      this.playBtn,
      h('button', { class: 'icon-btn', title: 'Next change (.)', onclick: () => w.stepEvent(1) }, icon('stepFwd', 16)),
      h('button', { class: 'icon-btn', title: 'Go to end (End)', onclick: () => w.setTime(w.scenario.meta.end) }, icon('skipFwd', 16)),
      this.timeLabel,
      h('div', { class: 'mw-speed' }, icon('activity', 14), this.speedSel),
      this.loopBtn,
      this.directorBtn,
      h('button', { class: 'icon-btn', title: 'Add camera keyframe at current time (K)', onclick: () => { w.addCameraKey(); toast('Camera keyframe added', 'success', 1200); } }, icon('camera', 16)),
      h('button', { class: 'icon-btn', title: 'Record video', onclick: () => this.onRecord() }, icon('video', 16)),
      this.chronicle,
      h('button', { class: 'icon-btn', title: 'Timeline options', onclick: (e: MouseEvent) => this.optionsMenu(e.currentTarget as HTMLElement) }, icon('settings', 15)),
    );
    this.canvas = h('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.tip = h('div', { class: 'mw-tl-tip' });
    const wrap = h('div', { class: 'mw-tl-canvas-wrap' }, this.canvas, this.tip);
    this.el = h('div', { class: 'mw-timeline glass' }, controls, wrap);

    this.bindCanvas();
    w.on('time', () => this.update());
    w.on('play', () => this.updateButtons());
    w.on('speed', () => this.updateSpeeds());
    w.on('settings', () => this.updateButtons());
    w.on('scenario', () => {
      this.chartCache = null;
      this.view = null;
      this.updateSpeeds();
      this.update();
    });
    new ResizeObserver(() => this.update()).observe(wrap);
    this.updateSpeeds();
    this.updateButtons();
    this.update();
  }

  private get range(): [number, number] {
    return this.view ?? [this.w.scenario.meta.start, this.w.scenario.meta.end];
  }

  private updateButtons() {
    this.playBtn.replaceChildren(icon(this.w.playing ? 'pause' : 'play', 20));
    this.loopBtn.classList.toggle('on', this.w.settings.loop);
    this.directorBtn.classList.toggle('on', this.w.settings.director);
  }

  private updateSpeeds() {
    const span = this.w.span;
    const durations = [8, 15, 30, 60, 120, 240, 600];
    const cur = this.w.speed;
    const opts = durations.map((d) => ({ v: span / d, label: `${d >= 60 ? d / 60 + ' min' : d + ' s'} run · ${formatDuration(span / d)}/s` }));
    if (!opts.some((o) => Math.abs(o.v - cur) / cur < 1e-3)) opts.push({ v: cur, label: `${formatDuration(cur)}/s (custom)` });
    opts.sort((a, b) => a.v - b.v);
    this.speedSel.replaceChildren(...opts.map((o) => h('option', { value: String(o.v), selected: Math.abs(o.v - cur) / cur < 1e-3 }, o.label)));
  }

  private precision(): Precision {
    const [a, b] = this.range;
    return precisionForSpan(b - a);
  }

  update() {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.dirty) this.draw();
    });
  }

  private async promptTime() {
    const r = await modal({ title: 'Jump to time', fields: [{ key: 't', label: 'Date / year', type: 'time', value: formatTime(this.w.time, this.precision()), placeholder: '1241, 500 BCE, 2024-03-15…' }], submitLabel: 'Go' });
    if (!r) return;
    const t = parseTime(r.t);
    if (t === null) return toast('Could not parse that date', 'error');
    this.w.setTime(t);
  }

  private optionsMenu(anchor: HTMLElement) {
    const w = this.w;
    menu(anchor, [
      { label: 'Set custom speed…', onClick: async () => {
        const r = await modal({ title: 'Playback speed', fields: [{ key: 'sec', label: 'Seconds for a full run', type: 'number', value: Math.round(w.span / w.speed), min: 1 }] });
        if (r?.sec) w.setSpeed(w.span / r.sec);
      } },
      { label: 'Zoom timeline to selection…', hint: 'wheel', onClick: async () => {
        const [a, b] = this.range;
        const r = await modal({ title: 'Timeline window', fields: [{ key: 'a', label: 'From', type: 'time', value: formatTime(a, this.precision()) }, { key: 'b', label: 'To', type: 'time', value: formatTime(b, this.precision()) }] });
        const ta = parseTime(r?.a), tb = parseTime(r?.b);
        if (ta !== null && tb !== null && tb > ta) { this.view = [ta, tb]; this.update(); }
      } },
      { label: 'Reset timeline zoom', hint: 'double-click', onClick: () => { this.view = null; this.update(); } },
      'sep',
      { label: 'Trim scenario to window', onClick: () => {
        const [a, b] = this.range;
        w.commit('Change time span', ['meta'], (s) => { s.meta.start = a; s.meta.end = b; });
        this.view = null;
      } },
      { label: 'Fit scenario span to content', onClick: () => this.fitToContent() },
      'sep',
      { label: 'Add era / period…', onClick: () => this.addEra() },
      ...this.w.scenario.eras.map((e) => ({ label: `Remove era “${e.name}”`, onClick: () => this.w.commit('Remove era', ['eras'], (s) => (s.eras = s.eras.filter((x) => x.id !== e.id))) })),
    ]);
  }

  private async addEra() {
    const w = this.w;
    const [a, b] = this.range;
    const r = await modal({
      title: 'New era',
      description: 'A named period shown as a band on the timeline and in the chronicle.',
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: '' },
        { key: 'start', label: 'Start', type: 'time', value: formatTime(Math.max(a, w.time - (b - a) * 0.1), this.precision()) },
        { key: 'end', label: 'End', type: 'time', value: formatTime(Math.min(b, w.time + (b - a) * 0.1), this.precision()) },
        { key: 'color', label: 'Colour', type: 'color', value: ['#ffd43b', '#74c0fc', '#ff8787', '#8ce99a', '#e599f7'][w.scenario.eras.length % 5] },
      ],
    });
    const s0 = parseTime(r?.start), e0 = parseTime(r?.end);
    if (!r?.name || s0 === null || e0 === null || e0 <= s0) return;
    w.commit('Add era', ['eras'], (s) => s.eras.push({ id: `era_${Date.now().toString(36)}`, name: r.name, start: s0, end: e0, color: r.color }));
  }

  private fitToContent() {
    const w = this.w;
    const ts: number[] = [];
    const ext = w.territory.timeline.timeExtent();
    if (ext) ts.push(...ext);
    for (const e of w.scenario.events) ts.push(e.t);
    for (const u of w.scenario.units) if (u.path.length) ts.push(u.path[0][2], u.path[u.path.length - 1][2]);
    for (const c of w.scenario.countries) ts.push(c.t);
    if (ts.length < 2) return toast('Not enough timed content', 'warn');
    const a = Math.min(...ts), b = Math.max(...ts);
    const pad = (b - a) * 0.03 || 1;
    w.commit('Fit time span', ['meta'], (s) => { s.meta.start = a - pad; s.meta.end = b + pad; });
  }

  // ------------------------------------------------------------------ interaction

  private tAt(x: number): number {
    const [a, b] = this.range;
    return a + (x / this.canvas.clientWidth) * (b - a);
  }
  private xAt(t: number): number {
    const [a, b] = this.range;
    return ((t - a) / (b - a)) * this.canvas.clientWidth;
  }

  private bindCanvas() {
    const c = this.canvas;
    const snap = (t: number, e: MouseEvent) => {
      if (!e.altKey) return t;
      // snap to nearest event / keyframe within 8px
      const cands = [...this.w.scenario.events.map((x) => x.t), ...this.w.scenario.camera.map((k) => k.t)];
      let best = t, bd = 8;
      for (const ct of cands) {
        const d = Math.abs(this.xAt(ct) - this.xAt(t));
        if (d < bd) { bd = d; best = ct; }
      }
      return best;
    };
    c.addEventListener('mousedown', (e) => {
      if (e.shiftKey || e.button === 1) {
        this.panning = { x: e.clientX, view: [...this.range] as [number, number] };
        return;
      }
      this.dragging = true;
      this.w.setTime(snap(this.tAt(e.offsetX), e));
    });
    window.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (this.panning) {
        const [a, b] = this.panning.view;
        const dt = ((e.clientX - this.panning.x) / r.width) * (b - a);
        this.view = this.clampView([a - dt, b - dt]);
        this.update();
        return;
      }
      if (this.dragging) this.w.setTime(snap(this.tAt(Math.max(0, Math.min(r.width, x))), e));
      if (e.target === c || this.dragging) {
        this.tip.style.display = 'block';
        this.tip.style.left = `${Math.max(40, Math.min(r.width - 40, x))}px`;
        const t = this.tAt(x);
        const ev = this.eventNear(x);
        this.tip.textContent = ev ? `${formatTime(ev.t, this.precision())} · ${ev.title}` : formatTime(t, this.precision() === 'year' ? 'year' : this.precision());
      } else this.tip.style.display = 'none';
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
      this.panning = null;
    });
    c.addEventListener('mouseleave', () => !this.dragging && (this.tip.style.display = 'none'));
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [a, b] = this.range;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const dt = (e.deltaX / c.clientWidth) * (b - a);
        this.view = this.clampView([a + dt, b + dt]);
      } else {
        const t = this.tAt(e.offsetX);
        const f = Math.exp(e.deltaY * 0.0015);
        this.view = this.clampView([t - (t - a) * f, t + (b - t) * f]);
      }
      this.update();
    }, { passive: false });
    c.addEventListener('dblclick', () => {
      this.view = null;
      this.update();
    });
  }

  private clampView([a, b]: [number, number]): [number, number] | null {
    const { start, end } = this.w.scenario.meta;
    const span = end - start;
    let len = Math.min(span, Math.max(span * 0.002, b - a));
    if (len >= span) return null;
    let s = Math.max(start, Math.min(end - len, a));
    return [s, s + len];
  }

  private eventNear(x: number) {
    let best = null, bd = 5;
    for (const e of this.w.scenario.events) {
      const d = Math.abs(this.xAt(e.t) - x);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------------ drawing

  private chart() {
    const w = this.w;
    const [a, b] = this.range;
    const key = `${w.revision}|${a}|${b}|${this.canvas.width}|${!!w.world}`;
    if (this.chartCache?.key === key) return this.chartCache;
    const samples = Math.min(400, Math.max(50, Math.floor(this.canvas.clientWidth / 3)));
    const tl = w.territory.timeline;
    const cellA = cellAreaKm2(w.scenario.meta.h3Resolution);
    let data: Float64Array[] = [];
    if (tl.eventCount) data = sampleWeighted(tl, a, b, samples, () => cellA);
    if (w.countryTimeline.eventCount && w.world) {
      const ct = w.countryTimeline;
      const cd = sampleWeighted(ct, a, b, samples, (k) => w.world!.byId.get(ct.keys[k])?.areaKm2 ?? 0);
      data = data.length ? data.map((row, i) => row.map((v, j) => v + (cd[i][j] ?? 0))) : cd;
    }
    let max = 1;
    for (const row of data) {
      let s = 0;
      for (const v of row) s += v;
      if (s > max) max = s;
    }
    this.chartCache = { key, data, max };
    return this.chartCache;
  }

  private draw() {
    this.dirty = false;
    const w = this.w;
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr) || dpr !== this.dpr) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      this.dpr = dpr;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const light = document.documentElement.dataset.theme === 'light';
    const fg = light ? '20,24,36' : '232,235,242';
    const [a, b] = this.range;
    const axisH = 16;
    const chartTop = 10, chartBottom = H - axisH;

    // background
    ctx.fillStyle = `rgba(${fg},0.04)`;
    ctx.fillRect(0, chartTop, W, chartBottom - chartTop);

    // stacked area chart of territory
    const ch = this.chart();
    if (ch.data.length > 1) {
      const n = ch.data.length;
      const fcount = w.scenario.factions.length;
      const base = new Float32Array(n);
      for (let f = 0; f < fcount; f++) {
        let any = false;
        for (let i = 0; i < n; i++) if (ch.data[i][f]) { any = true; break; }
        if (!any) continue;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * W;
          const y = chartBottom - ((base[i] + (ch.data[i][f] ?? 0)) / ch.max) * (chartBottom - chartTop) * 0.92;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        for (let i = n - 1; i >= 0; i--) {
          const x = (i / (n - 1)) * W;
          const y = chartBottom - (base[i] / ch.max) * (chartBottom - chartTop) * 0.92;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = w.scenario.factions[f].color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        for (let i = 0; i < n; i++) base[i] += ch.data[i][f] ?? 0;
      }
    }

    // ticks
    const step = niceTimeStep(b - a, W, 90);
    const prec: Precision = step >= 1 ? 'year' : step >= 1 / 12 - 1e-9 ? 'month' : step >= 1 / 366 ? 'day' : 'hour';
    ctx.fillStyle = `rgba(${fg},0.55)`;
    ctx.strokeStyle = `rgba(${fg},0.12)`;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const first = Math.ceil(a / step) * step;
    for (let t = first; t <= b + 1e-9; t += step) {
      const x = this.xAt(t);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, chartTop);
      ctx.lineTo(x + 0.5, chartBottom);
      ctx.stroke();
      ctx.fillText(formatTime(t, prec), x, chartBottom + 3);
    }

    // eras (named periods) as bands across the top of the chart
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const eras = [...w.scenario.eras].sort((x, y) => x.start - y.start);
    const rowEnd: number[] = [];
    for (const era of eras) {
      if (era.end < a || era.start > b) continue;
      const x0 = Math.max(0, this.xAt(era.start)), x1 = Math.min(W, this.xAt(era.end));
      let row = rowEnd.findIndex((e) => e <= x0);
      if (row < 0) { row = rowEnd.length; rowEnd.push(0); }
      rowEnd[row] = x1 + 2;
      const y = chartTop + 11 + row * 13;
      ctx.fillStyle = era.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x0, y - 5, Math.max(2, x1 - x0), 11);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#111';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y - 6, x1 - x0, 12);
      ctx.clip();
      ctx.fillText(era.name, x0 + 4, y + 0.5);
      ctx.restore();
    }

    // camera keyframes
    ctx.fillStyle = '#4dabf7';
    for (const k of w.scenario.camera) {
      if (k.t < a || k.t > b) continue;
      const x = this.xAt(k.t);
      ctx.beginPath();
      ctx.moveTo(x, chartBottom - 9);
      ctx.lineTo(x + 4, chartBottom - 5);
      ctx.lineTo(x, chartBottom - 1);
      ctx.lineTo(x - 4, chartBottom - 5);
      ctx.fill();
    }

    // events
    for (const e of w.scenario.events) {
      if (e.t < a || e.t > b) continue;
      const x = this.xAt(e.t);
      ctx.fillStyle = kindColor(e.kind);
      ctx.fillRect(x - 1, chartTop, 2, 9);
    }

    // played region shade + playhead
    const px = this.xAt(w.time);
    ctx.fillStyle = `rgba(${fg},0.05)`;
    ctx.fillRect(0, chartTop, Math.max(0, px), chartBottom - chartTop);
    ctx.strokeStyle = '#ffb000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 2);
    ctx.lineTo(px, chartBottom);
    ctx.stroke();
    ctx.fillStyle = '#ffb000';
    ctx.beginPath();
    ctx.arc(px, 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // zoomed indicator
    if (this.view) {
      const { start, end } = w.scenario.meta;
      const x0 = ((a - start) / (end - start)) * W, x1 = ((b - start) / (end - start)) * W;
      ctx.fillStyle = 'rgba(255,176,0,0.6)';
      ctx.fillRect(x0, H - 2, Math.max(2, x1 - x0), 2);
    }

    // labels
    this.timeLabel.textContent = formatTime(w.time, precisionForSpan(w.span));
    const latest = this.latestEvent();
    const curEras = w.scenario.eras.filter((e) => w.time >= e.start && w.time <= e.end).map((e) => `<span style="color:${e.color}">${escapeHtml(e.name)}</span>`);
    const evText = latest ? `<b>${escapeHtml(latest.title)}</b> · ${formatTime(latest.t, precisionForSpan(w.span))}` : `<span>${escapeHtml(w.scenario.meta.title)}</span>`;
    this.chronicle.innerHTML = (curEras.length ? curEras.join(' · ') + ' — ' : '') + evText;
  }

  private latestEvent() {
    let best = null;
    for (const e of this.w.scenario.events) if (e.t <= this.w.time && (!best || e.t > best.t)) best = e;
    return best;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
