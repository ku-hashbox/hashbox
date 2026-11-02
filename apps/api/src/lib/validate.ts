import type { CreateShareRequest, ExpiresIn, MaxViews } from '@hashbox/shared';

/** EXPIRES_OPTIONS 중 하나인지 */
export function isExpiresIn(v: unknown): v is ExpiresIn {
  throw new Error('TODO(BE): isExpiresIn');
}

/** VIEWS_OPTIONS 중 하나인지 */
export function isMaxViews(v: unknown): v is MaxViews {
  throw new Error('TODO(BE): isMaxViews');
}

export function isBase64url(v: unknown, bytes?: number): v is string {
  throw new Error('TODO(BE): isBase64url');
}

/** 실패 시 사람이 읽을 수 있는 오류 메시지, 성공 시 null */
export function validateCreateShare(
  body: unknown,
): { ok: true; value: CreateShareRequest } | { ok: false; message: string } {
  throw new Error('TODO(BE): validateCreateShare');
}
