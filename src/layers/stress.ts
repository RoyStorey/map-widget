import type { Layer } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { aggregationLayers } from './data';
import { DataFilterExtension } from '@deck.gl/extensions';
import type { MapWidget } from '../widget/MapWidget';
import { rng } from '../core/geo';
import { rampColors } from '../core/color';

const filter1 = new DataFilterExtension({ filterSize: 1 });

export interface StressData {
  n: number;
  positions: Float32Array;
  times: Float32Array; // relative to scenario start
  colors: Uint8Array;
  mode: 'points' | 'heatmap';
  window: number; // years visible behind current time (0 = all)
}

/**
 * Generate N clustered random points spread over the scenario's time span.
 * Everything is typed arrays → zero per-frame CPU cost; filtering happens on the GPU.
 */
export function generateStress(n: number, span: number, seed = 42): StressData {
  const r = rng(seed);
  const positions = new Float32Array(n * 2);
  const times = new Float32Array(n);
  const colors = new Uint8Array(n * 4);
  const centers = Array.from({ length: 60 }, () => [r() * 340 - 170, r() * 120 - 55, 2 + r() * 12]);
  const ramp = rampColors('inferno');
  for (let i = 0; i < n; i++) {
    const c = centers[(r() * centers.length) | 0];
    // Box–Muller gaussian around a cluster centre
    const u = Math.max(1e-9, r()), v = r();
    const m = Math.sqrt(-2 * Math.log(u)) * c[2];
    positions[i * 2] = c[0] + m * Math.cos(2 * Math.PI * v);
    positions[i * 2 + 1] = Math.max(-85, Math.min(85, c[1] + m * Math.sin(2 * Math.PI * v) * 0.6));
    times[i] = r() * span;
    const col = ramp[2 + ((r() * (ramp.length - 2)) | 0)];
    colors[i * 4] = col[0];
    colors[i * 4 + 1] = col[1];
    colors[i * 4 + 2] = col[2];
    colors[i * 4 + 3] = 255;
  }
  return { n, positions, times, colors, mode: 'points', window: span * 0.1 };
}

export function buildStressLayers(w: MapWidget): Layer[] {
  const s = w.stress;
  if (!s) return [];
  const rt = w.time - w.scenario.meta.start;
  const range = s.window > 0 ? [rt - s.window, rt] : [-1e9, rt];
  if (s.mode === 'heatmap') {
    const A = aggregationLayers(w);
    if (!A) return [];
    return [
      new A.HeatmapLayer({
        id: 'stress-heat',
        data: { length: s.n, attributes: { getPosition: { value: s.positions, size: 2 } } },
        radiusPixels: 25,
        intensity: 1,
        colorRange: rampColors('inferno'),
      } as any),
    ];
  }
  return [
    new ScatterplotLayer({
      id: 'stress-points',
      data: {
        length: s.n,
        attributes: {
          getPosition: { value: s.positions, size: 2 },
          getFillColor: { value: s.colors, size: 4, normalized: true },
          getFilterValue: { value: s.times, size: 1 },
        },
      },
      getRadius: 2,
      radiusUnits: 'pixels',
      radiusMinPixels: 1,
      opacity: 0.8,
      extensions: [filter1],
      filterRange: range,
      filterSoftRange: s.window > 0 ? [rt - s.window * 0.6, rt] : undefined,
    } as any),
  ];
}
