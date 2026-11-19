/// <reference lib="webworker" />
/** Off-main-thread H3 polygon fills (complex country outlines can take a while). */
import { polygonToCells } from 'h3-js';

type Req = { id: number; type: 'polyfill'; res: number; polygons: number[][][][] };

self.onmessage = (ev: MessageEvent<Req>) => {
  const msg = ev.data;
  const set = new Set<string>();
  for (const p of msg.polygons) {
    try {
      for (const c of polygonToCells(p, msg.res, true)) set.add(c);
    } catch {
      /* polygons wrapping a pole can't be filled – skip */
    }
  }
  (self as any).postMessage({ id: msg.id, ok: true, cells: [...set] });
};
