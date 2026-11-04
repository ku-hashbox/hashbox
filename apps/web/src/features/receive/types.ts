import type { DecryptResult, ShareMetaResponse } from '@hashbox/shared';

/** 받기 화면 상태 (개발 기획서 8-3) */
export type ReceiveState =
  | { type: 'loading' }
  | { type: 'link-error' } // # 뒤 열쇠 없음·형식 오류
  | { type: 'not-found' }
  | { type: 'ready'; meta: ShareMetaResponse } // 열기 전
  | { type: 'password'; meta: ShareMetaResponse; attemptsLeft?: number }
  | { type: 'opening' }
  | { type: 'opened'; result: DecryptResult }
  | { type: 'decrypt-error' } // 열쇠·비밀번호 불일치
  | { type: 'consumed' }
  | { type: 'expired' }
  | { type: 'revoked' }
  | { type: 'locked' };
