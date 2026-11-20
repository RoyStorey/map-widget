/**
 * Route check for map specs: makes sure armies stay on land and ships stay on water.
 *
 * For every leg of every move it works out how the leg travels (see legMode) and checks it
 * against the Natural Earth coastline. The same Router the widget uses for drawing:
 * - an overland leg that can't be routed overland (different land masses) is an error;
 * - an overland leg whose detour is far longer than the straight line is a warning;
 * - a straight leg that crosses water (armies) or land (ships) is a warning.
 *
 * Runs in Node (npm run map:check) and in the browser. The coastline loads on first use.
 */
import { Router, pathKm, haversine, type LonLat } from '../core/router';
import { rasterizeLand } from '../core/rasterize';
import { findPlace } from '../core/places';
import { legMode, type MapSpec, type Place } from './spec';
import type { Issue } from './validate';

const MASK_W = 4320, MASK_H = 2160; // 1/12°, as in the widget

let shared: Promise<Router> | null = null;

/** The Router over Natural Earth 1:50m land (built once, ~1 s). */
export function coastlineRouter(): Promise<Router> {
  shared ??= (async () => {
    const [{ feature }, topo] = await Promise.all([import('topojson-client'), import('world-atlas/land-50m.json')]);
    const land: any = feature((topo as any).default ?? topo, ((topo as any).default ?? topo).objects.land);
    const polygons: number[][][][] = land.features.flatMap((f: any) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
    return new Router(rasterizeLand(polygons, MASK_W, MASK_H), MASK_W, MASK_H);
  })();
  return shared;
}

const name = (p: Place) => (typeof p === 'string' ? p : `[${p[0]}, ${p[1]}]`);
const resolve = (p: Place): LonLat | null => (typeof p === 'string' ? findPlace(p) : Array.isArray(p) && p.length === 2 ? [p[0], p[1]] : null);

/** Warnings and errors about moves crossing water (or ships crossing land). Run after validateMap. */
export async function checkMapRoutes(spec: MapSpec, router?: Router): Promise<{ errors: Issue[]; warnings: Issue[] }> {
  const errors: Issue[] = [], warnings: Issue[] = [];
  const r = router ?? (await coastlineRouter());
  (spec.moves ?? []).forEach((m, i) => {
    for (let k = 1; k < (m.path?.length ?? 0); k++) {
      const a = resolve(m.path[k - 1].at), b = resolve(m.path[k].at);
      if (!a || !b || (a[0] === b[0] && a[1] === b[1])) continue;
      const path = `moves[${i}].path[${k}]`;
      const leg = `${m.name}: ${name(m.path[k - 1].at)} → ${name(m.path[k].at)}`;
      const mode = legMode(m, k);
      const straightKm = haversine(a[0], a[1], b[0], b[1]);
      if (mode === 'land') {
        if (r.blockedKm('land', a, b) < 3) continue; // a straight line stays on land
        const route = r.route('land', a, b);
        if (!route) {
          errors.push({ path, message: `${leg} can't be made overland: the two places are on different land masses. If they sailed, add "by": "sea" to this waypoint.` });
          continue;
        }
        const km = pathKm(route);
        if (km > straightKm * 2.2 && km - straightKm > 150)
          warnings.push({ path, message: `${leg} goes overland for ${Math.round(km)} km around the water, against ${Math.round(straightKm)} km in a straight line. If they crossed by sea, add "by": "sea"; if they marched around, add the places they passed so the route follows them.` });
      } else if (mode === 'sea') {
        if (!r.route('sea', a, b)) errors.push({ path, message: `${leg} can't be made by sea: no water route connects the two places.` });
      } else if (m.kind !== 'aircraft') {
        const ship = m.kind === 'fleet' || m.kind === 'ship';
        const blocked = r.blockedKm(ship ? 'sea' : 'land', a, b);
        if (blocked > 20)
          warnings.push({
            path,
            message: ship
              ? `${leg} sails ${Math.round(blocked)} km over land in a straight line. Set "bySea": true on the move (or "by": "sea" here) so it follows the water.`
              : `${leg} crosses ${Math.round(blocked)} km of water in a straight line. Remove "by": "straight" so it goes overland, or mark it "by": "sea" if they sailed.`,
          });
      }
    }
  });
  return { errors, warnings };
}
