/**
 * Land as a triangle mesh whose edges are all short (a few degrees).
 *
 * deck.gl draws triangles as straight 3D chords, so on the globe the long
 * slivers earcut produces for huge polygons (Eurasia spans >200° of longitude)
 * would cut across the sphere. Subdividing every triangle until its edges are
 * short keeps the land stencil glued to the surface.
 */
import earcut from 'earcut';

const cache = new WeakMap<object, Float32Array>();

export function landTriangles(fc: GeoJSON.FeatureCollection, maxEdgeDeg = 3): Float32Array {
  const hit = cache.get(fc);
  if (hit) return hit;
  const out: number[] = [];
  const max2 = maxEdgeDeg * maxEdgeDeg;
  const d2 = (ax: number, ay: number, bx: number, by: number) => {
    const k = Math.cos((((ay + by) / 2) * Math.PI) / 180); // shrink longitude near the poles
    return ((bx - ax) * k) ** 2 + (by - ay) ** 2;
  };
  const emit = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, depth: number) => {
    const ab = d2(ax, ay, bx, by), bc = d2(bx, by, cx, cy), ca = d2(cx, cy, ax, ay);
    if (depth >= 10 || (ab <= max2 && bc <= max2 && ca <= max2)) {
      out.push(ax, ay, bx, by, cx, cy);
      return;
    }
    // split the longest edge
    if (ab >= bc && ab >= ca) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      emit(ax, ay, mx, my, cx, cy, depth + 1);
      emit(mx, my, bx, by, cx, cy, depth + 1);
    } else if (bc >= ca) {
      const mx = (bx + cx) / 2, my = (by + cy) / 2;
      emit(ax, ay, bx, by, mx, my, depth + 1);
      emit(ax, ay, mx, my, cx, cy, depth + 1);
    } else {
      const mx = (cx + ax) / 2, my = (cy + ay) / 2;
      emit(ax, ay, bx, by, mx, my, depth + 1);
      emit(mx, my, bx, by, cx, cy, depth + 1);
    }
  };
  for (const f of fc.features) {
    const g: any = f.geometry;
    const polys: number[][][][] = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      const flat: number[] = [];
      const holes: number[] = [];
      poly.forEach((ring, i) => {
        if (i) holes.push(flat.length / 2);
        for (const p of ring) flat.push(p[0], p[1]);
      });
      const idx = earcut(flat, holes, 2);
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 2, b = idx[i + 1] * 2, c = idx[i + 2] * 2;
        emit(flat[a], flat[a + 1], flat[b], flat[b + 1], flat[c], flat[c + 1], 0);
      }
    }
  }
  const arr = Float32Array.from(out);
  cache.set(fc, arr);
  return arr;
}
