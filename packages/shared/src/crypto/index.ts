import type {
  DecryptOptions,
  DecryptResult,
  EncryptOptions,
  EncryptResult,
  PlainHeader,
} from './types';

export * from './types';
export { BLOB_VERSION } from './format';

/**
 * 보내기: 평문 포맷 → (비밀번호 키 유도) → contentKey → AES-GCM → 저장 포맷
 * 순서는 개발 기획서 5-6 참고
 */
export async function encryptPayload(
  header: PlainHeader,
  content: Uint8Array,
  options: EncryptOptions = {},
): Promise<EncryptResult> {
  throw new Error('TODO(보안): encryptPayload');
}

/**
 * 받기: 저장 포맷 → (비밀번호 키 유도) → contentKey → AES-GCM 복호화 → 평문 포맷
 * 순서는 개발 기획서 5-7 참고
 */
export async function decryptPayload(
  blob: Uint8Array,
  linkKey: string,
  options: DecryptOptions = {},
): Promise<DecryptResult> {
  throw new Error('TODO(보안): decryptPayload');
}

/** 받기 화면에서 비밀번호 입력 후 서버에 보낼 authToken만 먼저 계산할 때 사용 */
export async function computeAuthToken(
  password: string,
  salt: string,
  iter: number,
): Promise<string> {
  throw new Error('TODO(보안): computeAuthToken');
}
