import { Hono } from 'hono';
import type { Env } from '../env';
import { fail, notImplemented } from '../lib/errors';
import { validateCreateShare } from '../lib/validate';

/** /api/shares — 개발 기획서 7장 */
export const shares = new Hono<{ Bindings: Env }>();

// 상자 등록 → 201 { id, manageToken, uploadToken, expiresAt }
shares.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return fail(c, 400, 'BAD_REQUEST', '요청 본문을 JSON으로 읽을 수 없어요.');
  }

  const result = validateCreateShare(body);
  if (!result.ok) return fail(c, 400, 'BAD_REQUEST', result.message);

  return notImplemented(c); // TODO(BE): 상자 등록
});

// 암호문 업로드 (Authorization: Bearer uploadToken) → 204
shares.put('/:id/blob', (c) => notImplemented(c)); // TODO(BE)

// 상태 조회, 차감 없음 → 200 ShareMetaResponse
shares.get('/:id', (c) => notImplemented(c)); // TODO(BE)

// 열기: 차감 후 암호문 → 200 octet-stream, X-Views-Left 헤더
shares.post('/:id/open', (c) => notImplemented(c)); // TODO(BE)
