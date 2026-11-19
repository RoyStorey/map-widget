/**
 * postMessage bridge so a parent page can drive an embedded widget (iframe):
 *
 *   iframe.contentWindow.postMessage({ type: 'atlas', id: 1, method: 'setTime', args: [1241] }, '*')
 *
 * Replies with { type: 'atlas:result', id, result | error } and forwards
 * widget events as { type: 'atlas:event', name, payload }.
 */
import type { MapWidget } from '../widget/MapWidget';

const METHODS = [
  'setTime', 'play', 'pause', 'togglePlay', 'setSpeed', 'stepEvent', 'flyTo', 'fitBounds', 'loadScenario', 'exportScenario',
  'updateSettings', 'addFaction', 'addUnit', 'addRoute', 'addEvent', 'addLabel', 'addFlow', 'addRegion', 'addDataLayer', 'remove',
  'conquer', 'setCountries', 'paintCells', 'seaRoute', 'undo', 'redo', 'addCameraKey', 'addBookmark', 'screenshot', 'setStress',
] as const;

export function installBridge(w: MapWidget, allowedOrigin = '*'): () => void {
  const target = window.parent !== window ? window.parent : null;
  const post = (msg: unknown) => target?.postMessage(msg, allowedOrigin === '*' ? '*' : allowedOrigin);
  const onMessage = async (ev: MessageEvent) => {
    if (allowedOrigin !== '*' && ev.origin !== allowedOrigin) return;
    const m = ev.data;
    if (!m || m.type !== 'atlas') return;
    const reply = (data: object) => (ev.source as Window | null)?.postMessage({ type: 'atlas:result', id: m.id, ...data }, { targetOrigin: ev.origin || '*' });
    if (m.method === 'getState') return reply({ result: { time: w.time, playing: w.playing, speed: w.speed, settings: w.settings, title: w.scenario.meta.title, start: w.scenario.meta.start, end: w.scenario.meta.end } });
    if (!(METHODS as readonly string[]).includes(m.method)) return reply({ error: `Unknown method ${m.method}` });
    try {
      const result = await (w as any)[m.method](...(m.args ?? []));
      reply({ result: result === undefined ? null : JSON.parse(JSON.stringify(result)) });
    } catch (err) {
      reply({ error: String((err as Error).message ?? err) });
    }
  };
  window.addEventListener('message', onMessage);
  let timer: ReturnType<typeof setTimeout> | 0 = 0, lastT = NaN;
  const offs = [
    // time changes every frame while playing: forward at most ~4 per second (plus the final value)
    w.on('time', (t) => {
      lastT = t;
      if (timer) return;
      post({ type: 'atlas:event', name: 'time', payload: t });
      timer = setTimeout(() => {
        timer = 0;
        if (lastT !== t) post({ type: 'atlas:event', name: 'time', payload: lastT });
      }, 250);
    }),
    w.on('play', (p) => post({ type: 'atlas:event', name: 'play', payload: p })),
    w.on('select', (s) => post({ type: 'atlas:event', name: 'select', payload: s ? { kind: s.kind, id: s.id, position: s.position } : null })),
    w.on('ready', () => post({ type: 'atlas:event', name: 'ready', payload: null })),
  ];
  return () => {
    window.removeEventListener('message', onMessage);
    offs.forEach((o) => o());
    if (timer) clearTimeout(timer);
  };
}
