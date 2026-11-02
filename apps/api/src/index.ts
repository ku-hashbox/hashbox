import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { fail } from './lib/errors';
import { shares } from './routes/shares';
import { manage } from './routes/manage';
import { runCleanup } from './cron/cleanup';

const app = new Hono<{ Bindings: Env }>();

// 프론트 출처만 허용
app.use('/api/*', (c, next) =>
  cors({
    origin: c.env.WEB_ORIGIN,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Views-Left'],
    maxAge: 600,
  })(c, next),
);

// 모든 API 응답은 캐시 금지
app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/shares', shares);
app.route('/api/manage', manage);

app.notFound((c) => fail(c, 404, 'NOT_FOUND', '없는 경로예요.'));

app.onError((err, c) => {
  // 요청 본문·토큰은 절대 로그에 남기지 않는다
  console.error('unhandled error', err.name);
  return fail(c, 500, 'INTERNAL', '서버 오류가 발생했어요.');
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCleanup(env));
  },
} satisfies ExportedHandler<Env>;
