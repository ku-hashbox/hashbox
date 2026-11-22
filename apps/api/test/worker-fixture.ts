import worker from '../src/index';
import type { Env } from '../src/env';

/** Inject storage failures while running the real API with local D1 and R2. */
export default {
  ...worker,
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const length = request.headers.get('X-Test-Content-Length');
    if (length !== null) {
      request = new Request(request);
      request.headers.set('Content-Length', length);
    }
    const fault = request.headers.get('X-Test-R2-Failure');
    if (!fault) return worker.fetch(request, env, ctx);

    const bucket = new Proxy(env.BLOBS, {
      get(target, key) {
        if (key === fault) {
          return async () => {
            throw new Error('simulated storage failure: ' + request.headers.get('Authorization'));
          };
        }
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return worker.fetch(request, { ...env, BLOBS: bucket }, ctx);
  },
};
