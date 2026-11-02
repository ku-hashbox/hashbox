import type { ExpiresIn, MaxViews } from '@hashbox/shared';

export type SendTab = 'text' | 'env' | 'file';

export interface SendOptions {
  expiresIn: ExpiresIn;
  maxViews: MaxViews;
  /** 빈 문자열이면 비밀번호 없음 */
  password: string;
}

export interface SendDone {
  receiveUrl: string;
  manageUrl: string;
  hasPassword: boolean;
}
