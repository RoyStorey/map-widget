import type { MapWidget } from '../widget/MapWidget';
import { h } from './dom';

/**
 * Lightweight 2D-canvas overview map (no second WebGL context): land, owned
 * territory, units and the current viewport. Click or drag to navigate.
 */
export class Minimap {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement | null = null;
  private baseKey = '';
  private terrKey = '';
  private terr: HTMLCanvasElement | null = null;
  private raf = 0;

  constructor(private w: MapWidget) {
    this.canvas = h('canvas');
    this.el = h('div', { class: 'mw-minimap glass', title: 'Overview — click to navigate' }, this.canvas);
    const nav = (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      const lon = ((e.clientX - r.left) / r.width) * 360 - 180;
      const lat = 90 - ((e.clientY - r.top) / r.height) * 180;
      w.map.jumpTo({ center: [lon, Math.max(-80, Math.min(80, lat))] });
    };
    let down = false;
    this.canvas.addEventListener('mousedown', (e) => { down = true; nav(e); });
    window.addEventListener('mousemove', (e) => down && nav(e));
    window.addEventListener('mouseup', () => (down = false));
    w.map.on('move', () => this.schedule());
    w.on('time', () => this.scheduleThrottled());
    w.on('world', () => this.schedule());
    w.on('basemap', () => { this.baseKey = ''; this.schedule(); });
    w.on('settings', () => { this.el.style.display = this.visible ? '' : 'none'; this.schedule(); });
    this.el.style.display = this.visible ? '' : 'none';
    this.schedule();
  }

  private get visible() {
    return this.w.settings.minimap && this.w.perf.minimap;
  }

  private schedule() {
    if (!this.raf && this.visible) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  }

  /** During playback the territory overview only needs a few updates per second. */
  private lastTime = 0;
  private timer = 0;
  private scheduleThrottled() {
    if (this.timer || !this.visible) return;
    const wait = Math.max(0, 1000 / this.w.perf.minimapHz - (performance.now() - this.lastTime));
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.lastTime = performance.now();
      this.schedule();
    }, wait);
  }

  private draw() {
    const w = this.w;
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (!W) return;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; this.baseKey = ''; this.terrKey = ''; }
    const ctx = c.getContext('2d')!;
    const dark = w.basemap.dark;
    const key = `${c.width}|${dark}|${!!w.world}`;
    if (key !== this.baseKey && w.world) {
      this.baseKey = key;
      const b = document.createElement('canvas');
      b.width = c.width; b.height = c.height;
      const bx = b.getContext('2d')!;
      bx.fillStyle = dark ? '#0b1322' : '#cdd9e3';
      bx.fillRect(0, 0, b.width, b.height);
      bx.fillStyle = dark ? '#283247' : '#f4f1e8';
      for (const f of w.world.land.features) {
        const g: any = f.geometry;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        for (const poly of polys) {
          bx.beginPath();
          for (const ring of poly) ring.forEach((p: number[], i: number) => {
            const x = ((p[0] + 180) / 360) * b.width, y = ((90 - p[1]) / 180) * b.height;
            i ? bx.lineTo(x, y) : bx.moveTo(x, y);
          });
          bx.fill('evenodd');
        }
      }
      this.base = b;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.base) ctx.drawImage(this.base, 0, 0);
    else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height); }
    // territory (cached per ownership version): one pixel per cell centre, written straight into
    // an ImageData buffer at low resolution, then scaled up – far cheaper than a fillRect per cell
    const tl = w.territory.timeline;
    const tk = `${tl.version}|${w.revision}|${c.width}`;
    if (tk !== this.terrKey) {
      this.terrKey = tk;
      const TW = 360, TH = 180;
      const t = this.terr ?? document.createElement('canvas');
      t.width = TW; t.height = TH;
      const tx = t.getContext('2d')!;
      const img = tx.createImageData(TW, TH);
      const px = new Uint32Array(img.data.buffer);
      const cols = w.factionRgb.map((c) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]);
      const cen = w.territory.centers;
      for (let i = 0; i < tl.owner.length; i++) {
        const o = tl.owner[i];
        if (o < 0) continue;
        const x = Math.floor(((cen[i * 2] + 180) / 360) * TW), y = Math.floor(((90 - cen[i * 2 + 1]) / 180) * TH);
        if (x >= 0 && x < TW && y >= 0 && y < TH) px[y * TW + x] = cols[o];
      }
      tx.putImageData(img, 0, 0);
      this.terr = t;
    }
    if (this.terr) { ctx.globalAlpha = 0.85; ctx.imageSmoothingEnabled = false; ctx.drawImage(this.terr, 0, 0, c.width, c.height); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1; }
    // viewport
    const b = w.map.getBounds();
    if (b.getEast() - b.getWest() > 300 || w.settings.projection === 'globe' && w.map.getZoom() < 3) {
      // whole hemisphere visible: show a crosshair at the centre instead of a box
      const cc = w.map.getCenter();
      const cx = ((((cc.lng + 540) % 360) - 180 + 180) / 360) * c.width, cy = ((90 - cc.lat) / 180) * c.height;
      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 * dpr, 0, Math.PI * 2);
      ctx.moveTo(cx - 12 * dpr, cy); ctx.lineTo(cx + 12 * dpr, cy);
      ctx.moveTo(cx, cy - 12 * dpr); ctx.lineTo(cx, cy + 12 * dpr);
      ctx.stroke();
      return;
    }
    const x0 = ((Math.max(-180, b.getWest()) + 180) / 360) * c.width, x1 = ((Math.min(180, b.getEast()) + 180) / 360) * c.width;
    const y0 = ((90 - Math.min(85, b.getNorth())) / 180) * c.height, y1 = ((90 - Math.max(-85, b.getSouth())) / 180) * c.height;
    ctx.strokeStyle = '#ffb000';
    ctx.lineWidth = 1.5 * dpr;
    ctx.fillStyle = 'rgba(255,176,0,0.12)';
    const rw = Math.max(4 * dpr, x1 - x0), rh = Math.max(4 * dpr, y1 - y0);
    ctx.fillRect(x0, y0, rw, rh);
    ctx.strokeRect(x0, y0, rw, rh);
  }
}
