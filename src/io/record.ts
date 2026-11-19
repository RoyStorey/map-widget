/**
 * Video recording: composites the WebGL map, the label overlay and a burned-in
 * title / date / legend onto a 2D canvas, then records it with MediaRecorder.
 */
import type { MapWidget } from '../widget/MapWidget';
import { formatTime, precisionForSpan } from '../core/time';

export interface RecordOptions {
  /** Play the timeline from start to end while recording. */
  fullRun?: boolean;
  fps?: number;
  burnIn?: boolean;
  bitrate?: number;
  /** Override playback duration in seconds for the full run. */
  duration?: number;
}

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private raf = 0;
  private offEnd: (() => void) | null = null;
  recording = false;
  onstop: ((blob: Blob, mime: string) => void) | null = null;

  constructor(private w: MapWidget) {}

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  }

  start(opts: RecordOptions = {}): void {
    if (this.recording) return;
    const w = this.w;
    const src = w.map.getCanvas();
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d')!;
    const fps = opts.fps ?? 30;
    const stream = canvas.captureStream(fps);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    this.rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: opts.bitrate ?? 12_000_000 });
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => {
      const blob = new Blob(this.chunks, { type: mime || 'video/webm' });
      this.onstop?.(blob, mime || 'video/webm');
    };

    // Draw synchronously after each map render so the WebGL buffer is still valid.
    const draw = () => {
      if (canvas.width !== src.width || canvas.height !== src.height) {
        canvas.width = src.width;
        canvas.height = src.height;
      }
      ctx.drawImage(src, 0, 0);
      ctx.drawImage(w.labels.canvas, 0, 0, canvas.width, canvas.height);
      if (opts.burnIn !== false) this.burnIn(ctx, canvas.width, canvas.height);
    };
    w.map.on('render', draw);
    const pump = () => {
      w.map.triggerRepaint();
      this.raf = requestAnimationFrame(pump);
    };
    this.raf = requestAnimationFrame(pump);
    this.offEnd = () => w.map.off('render', draw);

    if (opts.fullRun) {
      w.updateSettings({ loop: false });
      if (opts.duration) w.setSpeed(w.span / opts.duration);
      w.setTime(w.scenario.meta.start);
      w.play();
      const off = w.on('play', (p) => {
        if (!p) {
          off();
          setTimeout(() => this.stop(), 600);
        }
      });
    }
    this.rec.start(250);
    this.recording = true;
  }

  stop(): void {
    if (!this.recording) return;
    this.recording = false;
    cancelAnimationFrame(this.raf);
    this.offEnd?.();
    this.rec?.stop();
    this.rec = null;
  }

  private burnIn(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const w = this.w;
    const s = Math.max(1, W / 1400);
    const dark = w.basemap.dark;
    ctx.save();
    // date
    const date = formatTime(w.time, precisionForSpan(w.span));
    ctx.font = `700 ${Math.round(44 * s)}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 6 * s;
    ctx.strokeStyle = dark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)';
    ctx.fillStyle = dark ? '#fff' : '#1b1b1f';
    ctx.strokeText(date, W - 28 * s, H - 24 * s);
    ctx.fillText(date, W - 28 * s, H - 24 * s);
    // title
    ctx.font = `700 ${Math.round(22 * s)}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.strokeText(w.scenario.meta.title, 28 * s, 24 * s);
    ctx.fillText(w.scenario.meta.title, 28 * s, 24 * s);
    // legend: factions currently holding territory
    const counts = w.territory.timeline.counts;
    const cc = w.countryTimeline.counts;
    const rows = w.scenario.factions.map((f, i) => ({ f, n: (counts[i] ?? 0) + (cc[i] ?? 0) * 50 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 8);
    let y = 64 * s;
    ctx.font = `600 ${Math.round(15 * s)}px Inter, system-ui, sans-serif`;
    for (const r of rows) {
      ctx.fillStyle = r.f.color;
      ctx.fillRect(28 * s, y + 2 * s, 14 * s, 14 * s);
      ctx.fillStyle = dark ? '#fff' : '#1b1b1f';
      ctx.strokeText(r.f.name, 50 * s, y);
      ctx.fillText(r.f.name, 50 * s, y);
      y += 22 * s;
    }
    ctx.restore();
  }
}
