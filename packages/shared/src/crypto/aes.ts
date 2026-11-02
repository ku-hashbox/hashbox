/** AES-256-GCM 암호화. 반환값은 암호문+태그 */
export async function aesEncrypt(
  key: CryptoKey,
  iv: Uint8Array,
  plain: Uint8Array,
): Promise<Uint8Array> {
  throw new Error('TODO(보안): aesEncrypt');
}

/** 열쇠가 틀리거나 변조되면 DecryptError */
export async function aesDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  throw new Error('TODO(보안): aesDecrypt');
}
