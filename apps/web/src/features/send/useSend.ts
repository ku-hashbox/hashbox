import type { PlainHeader } from '@hashbox/shared';
import type { SendDone, SendOptions } from './types';

/**
 * 보내기 흐름 (개발 기획서 5-6)
 * encryptPayload → createShare → uploadBlob → 링크 2개 조립
 */
export function useSend() {
  async function send(
    header: PlainHeader,
    content: Uint8Array,
    options: SendOptions,
  ): Promise<SendDone> {
    throw new Error('TODO(FE1): useSend.send');
  }
  return { send };
}
