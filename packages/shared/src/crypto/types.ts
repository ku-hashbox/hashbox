import type { ShareKind } from '../types';

/** 암호문 안에 함께 들어가는 헤더. 서버는 볼 수 없다 */
export interface PlainHeader {
  v: 1;
  kind: ShareKind;
  /** 파일일 때만 */
  name?: string;
  mime?: string;
  size?: number;
}

export interface KdfParams {
  salt: string; // base64url
  iter: number;
}

export interface EncryptOptions {
  password?: string;
}

export interface EncryptResult {
  /** R2에 올라갈 저장 포맷 바이트 */
  blob: Uint8Array;
  /** 링크 # 뒤에 붙일 열쇠 (base64url 43자) */
  linkKey: string;
  /** 비밀번호를 설정했을 때만: 서버에 보낼 값 */
  password?: KdfParams & { authToken: string };
}

export interface DecryptOptions {
  password?: string;
  kdf?: KdfParams;
}

export interface DecryptResult {
  header: PlainHeader;
  content: Uint8Array;
}

export class DecryptError extends Error {
  constructor(message = '복호화에 실패했어요. 링크나 비밀번호가 맞는지 확인하세요.') {
    super(message);
    this.name = 'DecryptError';
  }
}
