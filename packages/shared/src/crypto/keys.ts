/** 링크 열쇠 32B 생성 */
export function generateLinkKey(): Uint8Array {
  throw new Error('TODO(보안): generateLinkKey');
}

/** PBKDF2-SHA256(password, salt, iter) → 64B → 앞 32B pwKey, 뒤 32B authToken */
export async function derivePasswordKeys(
  password: string,
  salt: Uint8Array,
  iter: number,
): Promise<{ pwKey: Uint8Array; authToken: Uint8Array }> {
  throw new Error('TODO(보안): derivePasswordKeys');
}

/**
 * 비밀번호 없음: contentKey = linkKey
 * 비밀번호 있음: contentKey = HKDF-SHA256(linkKey ‖ pwKey, info="hashbox/content/v1")
 */
export async function deriveContentKey(
  linkKey: Uint8Array,
  pwKey?: Uint8Array,
): Promise<CryptoKey> {
  throw new Error('TODO(보안): deriveContentKey');
}
