/**
 * Worker factories. The app build emits each worker as its own file; the
 * package build (vite --mode lib) swaps this module for workers.inline.ts so
 * the workers travel inside the bundle and work under any host's URL layout.
 */
export const createH3Worker = () => new Worker(new URL('../workers/h3.worker.ts', import.meta.url), { type: 'module' });
export const createRouteWorker = () => new Worker(new URL('../workers/route.worker.ts', import.meta.url), { type: 'module' });
