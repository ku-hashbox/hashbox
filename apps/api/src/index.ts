import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ErrorResponse } from '@hashbox/shared';
import type { Env } from './env';

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

// TODO(BE, 2주차): POST /api/shares, PUT /api/shares/:id/blob, GET /api/shares/:id, POST /api/shares/:id/open
// TODO(BE, 3주차): GET·DELETE /api/manage

app.notFound((c) =>
  c.json<ErrorResponse>({ error: { code: 'NOT_FOUND', message: '없는 경로예요.' } }, 404),
);

app.onError((err, c) => {
  // 요청 본문·토큰은 절대 로그에 남기지 않는다
  console.error('unhandled error', err.name);
  return c.json<ErrorResponse>(
    { error: { code: 'INTERNAL', message: '서버 오류가 발생했어요.' } },
    500,
  );
});

export default {
  fetch: app.fetch,
  // TODO(BE, 3주차): 만료 정리 (개발 기획서 7-1)
  async scheduled(_event: ScheduledController, _env: Env, _ctx: ExecutionContext) {},
} satisfies ExportedHandler<Env>;
