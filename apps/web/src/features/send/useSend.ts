import { useRef, useState } from 'react';
import type { CreateShareRequest, CreateShareResponse, PlainHeader } from '@hashbox/shared';
import { encryptPayload } from '@hashbox/shared';
import { createShare, uploadBlob } from '../../lib/api';
import { buildManageUrl, buildReceiveUrl } from '../../lib/format';
import type { SendDone, SendOptions } from './types';

export type SendPhase = 'idle' | 'encrypting' | 'registering' | 'uploading' | 'done' | 'error';

export interface SendStatus {
  phase: SendPhase;
  error: string | null;
  /** 업로드 단계까지 갔다가 실패 → 상자는 그대로, 업로드만 재시도 가능 */
  canRetryUpload: boolean;
}

interface Pending {
  id: string;
  uploadToken: string;
  blob: Uint8Array;
  done: SendDone;
}

/**
 * 보내기 흐름 (개발 기획서 5-6)
 * encryptPayload → createShare → uploadBlob → 링크 2개 조립
 */
export function useSend() {
  const [status, setStatus] = useState<SendStatus>({
    phase: 'idle',
    error: null,
    canRetryUpload: false,
  });
  const pending = useRef<Pending | null>(null);

  async function send(
    header: PlainHeader,
    content: Uint8Array,
    options: SendOptions,
  ): Promise<SendDone | null> {
    const password = options.usePassword && options.password ? options.password : undefined;
    try {
      // 1. 브라우저에서 암호화. 서버는 평문도 열쇠도 보지 못한다.
      pending.current = null;
      setStatus({ phase: 'encrypting', error: null, canRetryUpload: false });
      const enc = await encryptPayload(header, content, { password });

      // 2. 상자 등록 (메타만).
      setStatus({ phase: 'registering', error: null, canRetryUpload: false });
      const req: CreateShareRequest = {
        kind: header.kind,
        size: enc.blob.length,
        expiresIn: options.expiresIn,
        maxViews: options.maxViews,
        password: enc.password,
      };
      const share: CreateShareResponse = await createShare(req);

      const done: SendDone = {
        receiveUrl: buildReceiveUrl(share.id, enc.linkKey),
        manageUrl: buildManageUrl(share.manageToken),
        hasPassword: Boolean(enc.password),
        maxViews: options.maxViews,
        expiresAt: share.expiresAt,
      };
      pending.current = { id: share.id, uploadToken: share.uploadToken, blob: enc.blob, done };

      // 3. 암호문 업로드.
      setStatus({ phase: 'uploading', error: null, canRetryUpload: true });
      await uploadBlob(share.id, share.uploadToken, enc.blob);

      pending.current = null;
      setStatus({ phase: 'done', error: null, canRetryUpload: false });
      return done;
    } catch (e) {
      setStatus({
        phase: 'error',
        error:
          e instanceof TypeError
            ? '서버에 연결할 수 없어요. 네트워크를 확인하세요.'
            : e instanceof Error
              ? e.message
              : '전송에 실패했어요.',
        canRetryUpload: pending.current !== null,
      });
      return null;
    }
  }

  /** 상자는 새로 만들지 않고 업로드만 다시 시도 */
  async function retryUpload(): Promise<SendDone | null> {
    const p = pending.current;
    if (!p) return null;
    try {
      setStatus({ phase: 'uploading', error: null, canRetryUpload: true });
      await uploadBlob(p.id, p.uploadToken, p.blob);
      pending.current = null;
      setStatus({ phase: 'done', error: null, canRetryUpload: false });
      return p.done;
    } catch (e) {
      setStatus({
        phase: 'error',
        error:
          e instanceof TypeError
            ? '서버에 연결할 수 없어요. 네트워크를 확인하세요.'
            : e instanceof Error
              ? e.message
              : '업로드에 실패했어요.',
        canRetryUpload: true,
      });
      return null;
    }
  }

  function reset() {
    pending.current = null;
    setStatus({ phase: 'idle', error: null, canRetryUpload: false });
  }

  return { send, retryUpload, reset, status };
}
