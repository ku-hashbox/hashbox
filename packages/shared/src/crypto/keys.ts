import { randomBytes } from '../base64url';
import { PBKDF2_ITERATIONS } from '../constants';
import { bytes } from './buffer';
import { InvalidInputError } from './errors';

export const LINK_KEY_BYTES = 32;
export const SALT_BYTES = 16;
/** 서버가 보내준 iter를 그대로 믿지 않는다: 너무 낮으면 약해지고, 너무 높으면 브라우저가 멈춘다 */
export const MAX_PBKDF2_ITERATIONS = 10_000_000;
const HKDF_INFO = new TextEncoder().encode('hashbox/content/v1');

/** 링크 열쇠 32B 생성 */
export function generateLinkKey(): Uint8Array {
  return randomBytes(LINK_KEY_BYTES);
}

/** 비밀번호 KDF용 salt 16B 생성 */
export function generateSalt(): Uint8Array {
  return randomBytes(SALT_BYTES);
}

/** KDF 파라미터 검증 (받기 쪽에서는 서버가 준 값이라 신뢰하지 않는다) */
export function assertKdfParams(salt: Uint8Array, iter: number): void {
  if (salt.length !== SALT_BYTES) throw new InvalidInputError('salt must be 16 bytes');
  if (!Number.isInteger(iter) || iter < PBKDF2_ITERATIONS || iter > MAX_PBKDF2_ITERATIONS) {
    throw new InvalidInputError(`bad pbkdf2 iterations: ${iter}`);
  }
}

/** PBKDF2-SHA256(password, salt, iter) → 64B → 앞 32B pwKey, 뒤 32B authToken */
export async function derivePasswordKeys(
  password: string,
  salt: Uint8Array,
  iter: number,
): Promise<{ pwKey: Uint8Array; authToken: Uint8Array }> {
  if (password.length === 0) throw new InvalidInputError('empty password');
  assertKdfParams(salt, iter);

  // 같은 글자가 기기마다 다른 유니코드로 입력되는 경우(한글 NFD 등)를 맞춘다
  const pwBytes = new TextEncoder().encode(password.normalize('NFC'));
  const baseKey = await crypto.subtle.importKey('raw', bytes(pwBytes), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: iter },
      baseKey,
      64 * 8,
    ),
  );
  return { pwKey: bits.slice(0, 32), authToken: bits.slice(32, 64) };
}

/**
 * 비밀번호 없음: contentKey = linkKey
 * 비밀번호 있음: contentKey = HKDF-SHA256(linkKey ‖ pwKey, info="hashbox/content/v1")
 * 반환 키는 추출 불가(extractable=false)
 */
export async function deriveContentKey(
  linkKey: Uint8Array,
  pwKey?: Uint8Array,
): Promise<CryptoKey> {
  if (linkKey.length !== LINK_KEY_BYTES) throw new InvalidInputError('linkKey must be 32 bytes');
  const usages: Array<'encrypt' | 'decrypt'> = ['encrypt', 'decrypt'];

  if (!pwKey) {
    return crypto.subtle.importKey('raw', bytes(linkKey), { name: 'AES-GCM' }, false, usages);
  }
  if (pwKey.length !== 32) throw new InvalidInputError('pwKey must be 32 bytes');

  const ikm = new Uint8Array(LINK_KEY_BYTES + 32);
  ikm.set(linkKey, 0);
  ikm.set(pwKey, LINK_KEY_BYTES);
  const baseKey = await crypto.subtle.importKey('raw', bytes(ikm), 'HKDF', false, ['deriveKey']);
  ikm.fill(0);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: HKDF_INFO },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}
