import { useState } from 'react';
import type { ReceiveState } from './types';

/**
 * 받기 흐름 (개발 기획서 5-7)
 * getShare → (비밀번호면 computeAuthToken) → openShare → decryptPayload
 */
export function useReceive(id: string, linkKey: string | null) {
  const [state, setState] = useState<ReceiveState>(
    linkKey ? { type: 'loading' } : { type: 'link-error' },
  );

  // TODO(FE2): 마운트 시 getShare로 상태 조회
  async function open(password?: string) {
    throw new Error('TODO(FE2): useReceive.open');
  }

  return { state, open, setState };
}
