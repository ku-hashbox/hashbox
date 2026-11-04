import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Env } from '../env';
import { fail, notImplemented } from '../lib/errors';
import { bearer } from '../lib/tokens';
import { isBase64url, MAX_TEXT_BLOB_BYTES, validateCreateShare } from '../lib/validate';
import { createShare, getShareMeta, openShare, uploadBlob } from '../services/share-service';

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
  if (result.value.kind !== 'text' || result.value.password) return notImplemented(c);

  return c.json(await createShare(c.env, result.value), 201);
});

// 암호문 업로드 (Authorization: Bearer uploadToken) → 204
shares.put(
  '/:id/blob',
  bodyLimit({
    maxSize: MAX_TEXT_BLOB_BYTES,
    onError: (c) => fail(c, 413, 'TOO_LARGE', '암호문 크기가 허용 범위를 벗어났어요.'),
  }),
  async (c) => {
    const token = bearer(c.req.header('Authorization'));
    if (!isBase64url(token, 32))
      return fail(c, 401, 'UNAUTHORIZED', '업로드 토큰이 올바르지 않아요.');

    const body = await c.req.arrayBuffer();
    const result = await uploadBlob(c.env, c.req.param('id'), token, body);
    switch (result) {
      case 'OK':
        return c.body(null, 204);
      case 'NOT_FOUND':
        return fail(c, 404, 'NOT_FOUND', '상자를 찾을 수 없어요.');
      case 'UNAUTHORIZED':
        return fail(c, 401, 'UNAUTHORIZED', '업로드 토큰이 올바르지 않아요.');
      case 'SIZE_MISMATCH':
        return fail(c, 400, 'BAD_REQUEST', '등록된 암호문 크기와 일치하지 않아요.');
      case 'UPLOAD_CONFLICT':
        return fail(c, 409, 'UPLOAD_CONFLICT', '이 상자에 암호문이 이미 업로드됐어요.');
      case 'EXPIRED':
        return fail(c, 410, 'EXPIRED', '만료된 링크예요.');
    }
  },
);

// 상태 조회, 차감 없음 → 200 ShareMetaResponse
shares.get('/:id', async (c) => {
  const meta = await getShareMeta(c.env, c.req.param('id'));
  return meta ? c.json(meta) : fail(c, 404, 'NOT_FOUND', '상자를 찾을 수 없어요.');
});

const OPEN_ERRORS = {
  NOT_FOUND: [404, '상자를 찾을 수 없어요.'],
  CONSUMED: [410, '이미 열람된 링크예요.'],
  EXPIRED: [410, '만료된 링크예요.'],
  REVOKED: [410, '파기된 링크예요.'],
  LOCKED: [410, '잠긴 링크예요.'],
} as const;

// 열기: 차감 후 암호문 → 200 octet-stream, X-Views-Left 헤더
shares.post('/:id/open', async (c) => {
  const result = await openShare(c.env, c.req.param('id'));
  if (!result.ok) {
    if (result.reason === 'NOT_IMPLEMENTED') return notImplemented(c);
    const [status, message] = OPEN_ERRORS[result.reason];
    return fail(c, status, result.reason, message);
  }

  return c.body(result.blob, 200, {
    'Content-Type': 'application/octet-stream',
    'X-Views-Left': String(result.viewsLeft),
  });
});
