/**
 * Scanline rasteriser for land polygons into an equirectangular mask (1 = land), the same
 * layout the browser draws with a canvas in landmask.ts. Pure code, used in Node.
 */
export function rasterizeLand(polygons: number[][][][], W: number, H: number): Uint8Array {
  const rows: number[][] = Array.from({ length: H }, () => []);
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  for (const poly of polygons)
    for (const ring of poly)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const x0 = px(a[0]), y0 = py(a[1]), x1 = px(b[0]), y1 = py(b[1]);
        if (y0 === y1) continue;
        const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
        for (let y = Math.max(0, Math.ceil(ya - 0.5)); y <= Math.min(H - 1, Math.floor(yb - 0.5)); y++) {
          const yc = y + 0.5;
          if (yc < ya || yc >= yb) continue;
          rows[y].push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const xs = rows[y].sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5)), to = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      if (to >= from) mask.fill(1, y * W + from, y * W + to + 1);
    }
  }
  return mask;
}
