/// <reference lib="webworker" />
/** Routing worker: runs the Router (src/core/router.ts) off the main thread. */
import { Router } from '../core/router';

let router: Router | null = null;

self.onmessage = (ev: MessageEvent) => {
  const m = ev.data;
  if (m.type === 'init') {
    router = new Router(m.mask, m.w, m.h);
    return;
  }
  if (m.type === 'route') {
    try {
      const mode = m.mode === 'land' ? 'land' : 'sea';
      const path = router!.route(mode, m.from, m.to, { polar: !!m.polar, weight: m.weight });
      if (!path) return (self as any).postMessage({ id: m.id, ok: false, error: mode === 'land' ? 'No overland route' : 'No sea route found' });
      (self as any).postMessage({ id: m.id, ok: true, path });
    } catch (err) {
      (self as any).postMessage({ id: m.id, ok: false, error: String(err) });
    }
  }
};
