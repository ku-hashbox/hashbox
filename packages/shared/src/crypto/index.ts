import { fromBase64url, randomBytes, toBase64url } from '../base64url';
import { PBKDF2_ITERATIONS, maxContentBytes } from '../constants';
import { aesDecrypt, aesEncrypt } from './aes';
import { InvalidInputError } from './errors';
import { IV_BYTES, decodePlain, encodePlain, packBlob, unpackBlob } from './format';
import {
  LINK_KEY_BYTES,
  deriveContentKey,
  derivePasswordKeys,
  generateLinkKey,
  generateSalt,
} from './keys';
import type {
  DecryptOptions,
  DecryptResult,
  EncryptOptions,
  EncryptResult,
  PlainHeader,
} from './types';

export * from './types';
export * from './errors';
export { BLOB_VERSION } from './format';

/**
 * 링크 # 뒤 문자열을 32B 열쇠로 바꾼다.
 * 받기 화면에서 API 호출 전에 먼저 불러서, 실패하면 "링크가 잘린 것 같아요"를 보여준다.
 */
export function parseLinkKey(linkKey: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64url(linkKey);
  } catch {
    throw new InvalidInputError('linkKey is not base64url');
  }
  if (bytes.length !== LINK_KEY_BYTES) throw new InvalidInputError('linkKey must be 32 bytes');
  return bytes;
}

/**
 * 보내기: 평문 포맷 → (비밀번호 키 유도) → contentKey → AES-GCM → 저장 포맷
 * 순서는 개발 기획서 5-6 참고
 */
export async function encryptPayload(
  header: PlainHeader,
  content: Uint8Array,
  options: EncryptOptions = {},
): Promise<EncryptResult> {
  if (content.length > maxContentBytes(header.kind)) {
    throw new InvalidInputError(`content too large for ${header.kind}: ${content.length}B`);
  }
  const plain = encodePlain(header, content);
  const linkKey = generateLinkKey();
  const iv = randomBytes(IV_BYTES);

  let pwKey: Uint8Array | undefined;
  let password: EncryptResult['password'];
  if (options.password !== undefined) {
    const salt = generateSalt();
    const iter = PBKDF2_ITERATIONS;
    const keys = await derivePasswordKeys(options.password, salt, iter);
    pwKey = keys.pwKey;
    password = { salt: toBase64url(salt), iter, authToken: toBase64url(keys.authToken) };
  }

  const key = await deriveContentKey(linkKey, pwKey);
  const ciphertext = await aesEncrypt(key, iv, plain);
  pwKey?.fill(0);

  const result: EncryptResult = { blob: packBlob(iv, ciphertext), linkKey: toBase64url(linkKey) };
  if (password) result.password = password;
  linkKey.fill(0);
  return result;
}

/**
 * 받기: 저장 포맷 → (비밀번호 키 유도) → contentKey → AES-GCM 복호화 → 평문 포맷
 * 순서는 개발 기획서 5-7 참고
 *
 * - 링크 열쇠 형식이 틀리면 InvalidInputError
 * - 열쇠·비밀번호가 틀리거나 암호문이 손상되면 DecryptError
 */
export async function decryptPayload(
  blob: Uint8Array,
  linkKey: string,
  options: DecryptOptions = {},
): Promise<DecryptResult> {
  const linkKeyBytes = parseLinkKey(linkKey);
  const { iv, ciphertext } = unpackBlob(blob);

  let pwKey: Uint8Array | undefined;
  if (options.kdf) {
    if (options.password === undefined) throw new InvalidInputError('password required');
    const salt = decodeSalt(options.kdf.salt);
    pwKey = (await derivePasswordKeys(options.password, salt, options.kdf.iter)).pwKey;
  } else if (options.password !== undefined) {
    throw new InvalidInputError('kdf params required when password is given');
  }

  const key = await deriveContentKey(linkKeyBytes, pwKey);
  pwKey?.fill(0);
  linkKeyBytes.fill(0);
  const plain = await aesDecrypt(key, iv, ciphertext);
  return decodePlain(plain);
}

/** 받기 화면에서 비밀번호 입력 후 서버에 보낼 authToken만 먼저 계산할 때 사용 */
export async function computeAuthToken(
  password: string,
  salt: string,
  iter: number,
): Promise<string> {
  const keys = await derivePasswordKeys(password, decodeSalt(salt), iter);
  keys.pwKey.fill(0);
  return toBase64url(keys.authToken);
}

function decodeSalt(salt: string): Uint8Array {
  try {
    return fromBase64url(salt);
  } catch {
    throw new InvalidInputError('salt is not base64url');
  }
}
