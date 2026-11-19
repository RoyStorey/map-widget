import type { CameraKey } from './scenario';
import type { LonLat } from './geo';

const D2R = Math.PI / 180;

function lonLatToMerc([lon, lat]: LonLat): [number, number] {
  const y = Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * D2R) / 2));
  return [lon * D2R, y];
}
function mercToLonLat([x, y]: [number, number]): LonLat {
  return [x / D2R, (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / D2R];
}

function smooth(f: number) {
  return f * f * (3 - 2 * f);
}

function lerpAngle(a: number, b: number, f: number) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * f;
}

/**
 * Camera state at time t, interpolated between keyframes. Uses a
 * "zoom-out-and-in" curve (simplified van Wijk) when keys are far apart so
 * long jumps read as flights rather than smears.
 */
export function cameraAt(keys: CameraKey[], t: number): Omit<CameraKey, 't'> | null {
  if (!keys.length) return null;
  if (t <= keys[0].t) return keys[0];
  const last = keys[keys.length - 1];
  if (t >= last.t) return last;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[i + 1];
  const f = smooth((t - a.t) / Math.max(1e-12, b.t - a.t));
  // shortest longitude path
  let bLon = b.center[0];
  while (bLon - a.center[0] > 180) bLon -= 360;
  while (bLon - a.center[0] < -180) bLon += 360;
  const ma = lonLatToMerc(a.center), mb = lonLatToMerc([bLon, b.center[1]]);
  const center = mercToLonLat([ma[0] + (mb[0] - ma[0]) * f, ma[1] + (mb[1] - ma[1]) * f]);
  // distance in "world widths" at the lower zoom → how far to pull back
  const dist = Math.hypot(mb[0] - ma[0], mb[1] - ma[1]) / (2 * Math.PI);
  const minZoom = Math.min(a.zoom, b.zoom);
  const visibleWorld = 1 / Math.pow(2, minZoom);
  const pull = dist > visibleWorld ? Math.log2(dist / visibleWorld) : 0;
  const zoom = a.zoom + (b.zoom - a.zoom) * f - pull * Math.sin(f * Math.PI) * 0.9;
  return {
    center: [((center[0] + 540) % 360) - 180, center[1]],
    zoom,
    bearing: lerpAngle(a.bearing, b.bearing, f),
    pitch: a.pitch + (b.pitch - a.pitch) * f,
  };
}
