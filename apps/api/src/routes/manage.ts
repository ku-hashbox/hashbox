import { Hono } from 'hono';
import type { Env } from '../env';
import { fail } from '../lib/errors';
import { bearer } from '../lib/tokens';
import { isBase64url } from '../lib/validate';
import { getManage, revokeShare } from '../services/share-service';

/** /api/manage — Authorization: Bearer manageToken */
export const manage = new Hono<{ Bindings: Env }>();

// 관리용 상태 조회 → 200 ManageResponse
manage.get('/', async (c) => {
  const token = bearer(c.req.header('Authorization'));
  const status = isBase64url(token, 32) ? await getManage(c.env, token) : null;
  return status ? c.json(status) : fail(c, 401, 'UNAUTHORIZED', '관리 토큰이 올바르지 않아요.');
});

// 즉시 파기 → 204
manage.delete('/', async (c) => {
  const token = bearer(c.req.header('Authorization'));
  if (!isBase64url(token, 32) || !(await revokeShare(c.env, token))) {
    return fail(c, 401, 'UNAUTHORIZED', '관리 토큰이 올바르지 않아요.');
  }
  return c.body(null, 204);
});
