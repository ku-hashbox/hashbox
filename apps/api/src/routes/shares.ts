import { Hono } from 'hono';
import type { Env } from '../env';
import { notImplemented } from '../lib/errors';

/** /api/shares — 개발 기획서 7장 */
export const shares = new Hono<{ Bindings: Env }>();

// 상자 등록 → 201 { id, manageToken, uploadToken, expiresAt }
shares.post('/', (c) => notImplemented(c)); // TODO(BE)

// 암호문 업로드 (Authorization: Bearer uploadToken) → 204
shares.put('/:id/blob', (c) => notImplemented(c)); // TODO(BE)

// 상태 조회, 차감 없음 → 200 ShareMetaResponse
shares.get('/:id', (c) => notImplemented(c)); // TODO(BE)

// 열기: 차감 후 암호문 → 200 octet-stream, X-Views-Left 헤더
shares.post('/:id/open', (c) => notImplemented(c)); // TODO(BE)
