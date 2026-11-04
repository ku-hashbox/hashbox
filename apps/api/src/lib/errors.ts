import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode, ErrorResponse } from '@hashbox/shared';

/** 오류 응답 형식 통일: { error: { code, message } } */
export function fail(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  extra: { attemptsLeft?: number } = {},
) {
  return c.json<ErrorResponse>({ error: { code, message, ...extra } }, status);
}

/** 구현 전 엔드포인트용 */
export function notImplemented(c: Context) {
  return c.json({ error: { code: 'NOT_IMPLEMENTED', message: '아직 구현되지 않았어요.' } }, 501);
}
