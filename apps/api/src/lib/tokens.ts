import { randomBytes, toBase64url } from '@hashbox/shared';

const encoder = new TextEncoder();

/** 상자 id: 12B 랜덤 → base64url 16자 */
export function newShareId(): string {
  return toBase64url(randomBytes(12));
}

/** 관리·업로드 토큰: 32B 랜덤 → base64url */
export function newToken(): string {
  return toBase64url(randomBytes(32));
}

/** 토큰은 이 해시로만 저장·비교한다 */
export async function sha256b64url(value: string): Promise<string> {
  return toBase64url(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/** 타이밍 공격 방지용 상수 시간 비교 */
export function safeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  return aBytes.byteLength === bBytes.byteLength && crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

/** Authorization: Bearer <token> 에서 토큰 추출 */
export function bearer(header: string | undefined): string | null {
  return header?.match(/^Bearer +([A-Za-z0-9_-]+)$/i)?.[1] ?? null;
}
