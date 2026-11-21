import { bytes } from './buffer';
import { DecryptError, InvalidInputError } from './errors';
import { IV_BYTES } from './format';

/** AES-256-GCM 암호화. 반환값은 암호문+태그(16B) */
export async function aesEncrypt(
  key: CryptoKey,
  iv: Uint8Array,
  plain: Uint8Array,
): Promise<Uint8Array> {
  if (iv.length !== IV_BYTES) throw new InvalidInputError('iv must be 12 bytes');
  const out = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytes(iv), tagLength: 128 },
    key,
    bytes(plain),
  );
  return new Uint8Array(out);
}

/** 열쇠가 틀리거나 변조되면 DecryptError */
export async function aesDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  if (iv.length !== IV_BYTES) throw new DecryptError('iv must be 12 bytes');
  try {
    const out = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(iv), tagLength: 128 },
      key,
      bytes(ciphertext),
    );
    return new Uint8Array(out);
  } catch {
    // GCM 인증 실패 = 열쇠가 틀렸거나 암호문이 바뀜. 둘을 구분할 방법은 없다
    throw new DecryptError('authentication failed');
  }
}
