import { Hono } from 'hono';
import type { Env } from '../env';
import { notImplemented } from '../lib/errors';

/** /api/manage — Authorization: Bearer manageToken */
export const manage = new Hono<{ Bindings: Env }>();

// 관리용 상태 조회 → 200 ManageResponse
manage.get('/', (c) => notImplemented(c)); // TODO(BE)

// 즉시 파기 → 204
manage.delete('/', (c) => notImplemented(c)); // TODO(BE)
