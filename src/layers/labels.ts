/**
 * Canvas2D overlay for text and icons.
 *
 * Draws on top of the WebGL map each map frame, with greedy priority-based
 * collision detection and globe-horizon occlusion. Works identically in
 * Mercator and globe projections and is trivially composited into recordings.
 */
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import type { LonLat } from '../core/geo';
import { drawIcon, type IconName } from './icons';

export interface LabelItem {
  pos: LonLat;
  text?: string;
  /** CSS font family/weight, e.g. "600 13px Inter" is assembled from these. */
  font?: string;
  weight?: number;
  /** Text size in px. Ignored if sizeMeters is set. */
  size?: number;
  /** Size that scales with the map, clamped to [minPx, maxPx]. */
  sizeMeters?: number;
  minPx?: number;
  maxPx?: number;
  color?: string;
  halo?: string;
  haloWidth?: number;
  /** Pixel offset of the text from the anchor. */
  offset?: [number, number];
  priority?: number;
  /** Participate in collision detection (default true for text). */
  collide?: boolean;
  icon?: IconName;
  iconColor?: string;
  iconSize?: number;
  /** Icon rotation in degrees clockwise from north (map bearing is compensated). */
  angle?: number;
  alpha?: number;
  letterSpacing?: number;
  uppercase?: boolean;
}

const EARTH_CIRC = 40075016.686;

export class LabelOverlay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private items: LabelItem[] = [];
  private dpr = 1;
  private w = 0;
  private h = 0;
  enabled = true;
  drawn = 0;
  private measureCache = new Map<string, number>();

  constructor(private map: MLMap, private maxDpr = 2) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mw-label-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
    map.getCanvasContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    map.on('render', () => this.draw());
    map.on('resize', () => this.resize());
    // web fonts arriving late change text metrics
    (document as any).fonts?.addEventListener?.('loadingdone', () => {
      this.measureCache.clear();
      map.triggerRepaint();
    });
    this.resize();
  }

  setItems(items: LabelItem[]): void {
    this.items = items;
  }

  private resize(): void {
    const c = this.map.getCanvas();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.w = c.clientWidth;
    this.h = c.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  draw(): void {
    const { ctx, map } = this;
    const c = map.getCanvas();
    if (c.clientWidth !== this.w || c.clientHeight !== this.h) this.resize();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.enabled || !this.items.length) {
      this.drawn = 0;
      return;
    }
    const transform: any = (map as any).transform;
    const globe = (map as any).getProjection?.()?.type === 'globe';
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pad = 40;
    // priority order (stable)
    const order = this.items.map((_, i) => i);
    order.sort((a, b) => (this.items[b].priority ?? 0) - (this.items[a].priority ?? 0));
    const placed: number[] = []; // flat [x0,y0,x1,y1,...]
    const grid = new Map<number, number[]>();
    const CELL = 64;
    const collides = (x0: number, y0: number, x1: number, y1: number) => {
      for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
        for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
          const list = grid.get(gx * 100003 + gy);
          if (!list) continue;
          for (const i of list) if (x0 < placed[i + 2] && x1 > placed[i] && y0 < placed[i + 3] && y1 > placed[i + 1]) return true;
        }
      return false;
    };
    const insert = (x0: number, y0: number, x1: number, y1: number) => {
      const i = placed.length;
      placed.push(x0, y0, x1, y1);
      for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
        for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
          const k = gx * 100003 + gy;
          let list = grid.get(k);
          if (!list) grid.set(k, (list = []));
          list.push(i);
        }
    };
    let drawn = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const idx of order) {
      const it = this.items[idx];
      const lng = it.pos[0], lat = it.pos[1];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const ll = new maplibregl.LngLat(lng, lat);
      if (globe && transform?.isLocationOccluded?.(ll)) continue;
      const p = map.project(ll);
      if (p.x < -pad || p.y < -pad || p.x > this.w + pad || p.y > this.h + pad) continue;
      let size = it.size ?? 12;
      if (it.sizeMeters) {
        const mpp = (EARTH_CIRC * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom));
        size = it.sizeMeters / mpp;
        if (it.minPx !== undefined && size < it.minPx) {
          if (it.minPx > 0 && size < it.minPx * 0.6) continue; // too small to read: hide instead of clamping
          size = it.minPx;
        }
        if (it.maxPx !== undefined) size = Math.min(size, it.maxPx);
      }
      const alpha = it.alpha ?? 1;
      if (alpha <= 0.01) continue;
      const ox = it.offset?.[0] ?? 0, oy = it.offset?.[1] ?? 0;
      let text = it.text;
      if (text && it.uppercase) text = text.toUpperCase();
      let tw = 0;
      if (text) {
        // measure at a reference size and scale: avoids re-measuring as label sizes animate with zoom
        const family = it.font ?? 'Inter, system-ui, sans-serif';
        const key = `${it.weight ?? 600}|${family}|${it.letterSpacing ?? 0}|${text}`;
        let w100 = this.measureCache.get(key);
        if (w100 === undefined) {
          ctx.font = `${it.weight ?? 600} 100px ${family}`;
          (ctx as any).letterSpacing = it.letterSpacing ? `${(it.letterSpacing * 100) / 12}px` : '0px';
          w100 = ctx.measureText(text).width;
          if (this.measureCache.size > 20000) this.measureCache.clear();
          this.measureCache.set(key, w100);
        }
        tw = (w100 * size) / 100;
        ctx.font = `${it.weight ?? 600} ${size}px ${family}`;
        (ctx as any).letterSpacing = it.letterSpacing ? `${(it.letterSpacing * size) / 12}px` : '0px';
      }
      const iconS = it.icon ? it.iconSize ?? 16 : 0;
      if (it.collide !== false && text) {
        const x0 = p.x + ox - tw / 2 - 2, x1 = p.x + ox + tw / 2 + 2;
        const y0 = p.y + oy - size / 2 - 1, y1 = p.y + oy + size / 2 + 1;
        if (collides(x0, y0, x1, y1)) {
          // still draw the icon (no text) for collided items
          if (!it.icon) continue;
          text = undefined;
        } else insert(x0, y0, x1, y1);
      }
      ctx.globalAlpha = alpha;
      if (it.icon) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (it.angle !== undefined) ctx.rotate(((it.angle - bearing) * Math.PI) / 180);
        if (it.halo) {
          ctx.shadowColor = it.halo;
          ctx.shadowBlur = 3;
        }
        drawIcon(ctx, it.icon, iconS, it.iconColor ?? it.color ?? '#fff');
        ctx.restore();
      }
      if (text) {
        if (it.halo && (it.haloWidth ?? 3) > 0) {
          ctx.strokeStyle = it.halo;
          ctx.lineWidth = (it.haloWidth ?? 3) * 2;
          ctx.strokeText(text, p.x + ox, p.y + oy);
        }
        ctx.fillStyle = it.color ?? '#fff';
        ctx.fillText(text, p.x + ox, p.y + oy);
      }
      drawn++;
    }
    ctx.globalAlpha = 1;
    (ctx as any).letterSpacing = '0px';
    this.drawn = drawn;
  }
}
