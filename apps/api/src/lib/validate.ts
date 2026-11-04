import {
  CIPHER_OVERHEAD_BYTES,
  EXPIRES_OPTIONS,
  MAX_FILE_BYTES,
  MAX_HEADER_BYTES,
  MAX_TEXT_BYTES,
  PBKDF2_ITERATIONS,
  VIEWS_OPTIONS,
  fromBase64url,
  toBase64url,
  type CreateShareRequest,
  type ExpiresIn,
  type MaxViews,
} from '@hashbox/shared';

/** EXPIRES_OPTIONS 중 하나인지 */
export function isExpiresIn(value: unknown): value is ExpiresIn {
  return EXPIRES_OPTIONS.some((option) => option === value);
}

/** VIEWS_OPTIONS 중 하나인지 */
export function isMaxViews(value: unknown): value is MaxViews {
  return VIEWS_OPTIONS.some((option) => option === value);
}

export function isBase64url(value: unknown, bytes?: number): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (bytes !== undefined && value.length !== Math.ceil((bytes * 8) / 6)) return false;

  try {
    return toBase64url(fromBase64url(value)) === value;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateCreateShare(
  body: unknown,
): { ok: true; value: CreateShareRequest } | { ok: false; message: string } {
  if (!isRecord(body)) return { ok: false, message: '요청 본문은 JSON 객체여야 해요.' };

  const { kind, size, expiresIn, maxViews, password } = body;
  if (kind !== 'text' && kind !== 'env' && kind !== 'file') {
    return { ok: false, message: '지원하지 않는 공유 유형이에요.' };
  }
  if (!isExpiresIn(expiresIn)) return { ok: false, message: '지원하지 않는 만료 시간이에요.' };
  if (!isMaxViews(maxViews)) return { ok: false, message: '지원하지 않는 열람 횟수예요.' };

  const maxContentBytes = kind === 'file' ? MAX_FILE_BYTES : MAX_TEXT_BYTES;
  // 암호문에는 내용과 함께 헤더 길이(4바이트), 헤더, 암호화 오버헤드가 들어간다.
  const maxBlobBytes = maxContentBytes + 4 + MAX_HEADER_BYTES + CIPHER_OVERHEAD_BYTES;
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0 || size > maxBlobBytes) {
    return { ok: false, message: '암호문 크기가 허용 범위를 벗어났어요.' };
  }

  const value: CreateShareRequest = { kind, size, expiresIn, maxViews };
  if (password !== undefined) {
    if (!isRecord(password)) return { ok: false, message: '비밀번호 옵션은 객체여야 해요.' };

    const { salt, iter, authToken } = password;
    if (!isBase64url(salt, 16) || iter !== PBKDF2_ITERATIONS || !isBase64url(authToken, 32)) {
      return { ok: false, message: '비밀번호 검증 정보의 형식이 올바르지 않아요.' };
    }
    value.password = { salt, iter, authToken };
  }

  return { ok: true, value };
}
