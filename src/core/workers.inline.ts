/** Package-build replacement for workers.ts: workers inlined as blobs (see vite.config.ts). */
import H3Worker from '../workers/h3.worker.ts?worker&inline';
import RouteWorker from '../workers/route.worker.ts?worker&inline';

export const createH3Worker = () => new H3Worker();
export const createRouteWorker = () => new RouteWorker();
