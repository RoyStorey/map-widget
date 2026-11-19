/**
 * Equirectangular land bitmap rasterised from Natural Earth land polygons.
 * isLand() is a single array lookup – far faster than polygon tests, which
 * matters when masking tens of thousands of H3 cells.
 */
import { loadWorld } from './world';

const W = 4320; // 1/12 degree ≈ 9 km at the equator
const H = 2160;

let mask: Uint8Array | null = null;
let promise: Promise<void> | null = null;

export function loadLandMask(): Promise<void> {
  if (promise) return promise;
  promise = loadWorld().then((world) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    const px = (lon: number) => ((lon + 180) / 360) * W;
    const py = (lat: number) => ((90 - lat) / 180) * H;
    for (const f of world.land.features) {
      const g: any = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        ctx.beginPath();
        for (const ring of poly) {
          ring.forEach((c: number[], i: number) => (i ? ctx.lineTo(px(c[0]), py(c[1])) : ctx.moveTo(px(c[0]), py(c[1]))));
          ctx.closePath();
        }
        ctx.fill('evenodd');
      }
    }
    const data = ctx.getImageData(0, 0, W, H).data;
    mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  });
  return promise;
}

/** Raw mask (1 = land), width and height – used by the routing worker. */
export function getLandMask(): { mask: Uint8Array; w: number; h: number } | null {
  return mask ? { mask, w: W, h: H } : null;
}

export function landMaskReady(): boolean {
  return mask !== null;
}

/** True if the point is on land (false until the mask has loaded). */
export function isLand(lon: number, lat: number): boolean {
  if (!mask) return false;
  let x = Math.floor(((((lon + 180) % 360) + 360) % 360 / 360) * W);
  let y = Math.floor(((90 - lat) / 180) * H);
  if (x >= W) x = W - 1;
  if (y < 0) y = 0;
  if (y >= H) y = H - 1;
  return mask[y * W + x] === 1;
}
