import type { ExpiresIn, MaxViews, PlainHeader } from '@hashbox/shared';

export type SendTab = 'text' | 'env' | 'file';

export interface SendOptions {
  expiresIn: ExpiresIn;
  maxViews: MaxViews;
  /** '비밀번호 걸기'를 켰는지. 켰는데 비어 있으면 보낼 수 없다 */
  usePassword: boolean;
  password: string;
}

/** 각 입력 탭이 SendPage로 올려주는 평문 (암호화 전) */
export interface SendPayload {
  header: PlainHeader;
  content: Uint8Array;
}

export interface SendDone {
  receiveUrl: string;
  manageUrl: string;
  hasPassword: boolean;
  maxViews: MaxViews;
  expiresAt: number;
}
