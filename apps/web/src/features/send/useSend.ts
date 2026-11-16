import { useRef, useState } from 'react';
import type {
  CreateShareRequest,
  CreateShareResponse,
  ErrorCode,
  PlainHeader,
} from '@hashbox/shared';
import { encryptPayload } from '@hashbox/shared';
import { ApiError, createShare, uploadBlob } from '../../lib/api';
import { buildManageUrl, buildReceiveUrl } from '../../lib/format';
import type { SendDone, SendOptions } from './types';

export type SendPhase = 'idle' | 'encrypting' | 'registering' | 'uploading' | 'done' | 'error';

export interface SendStatus {
  phase: SendPhase;
  error: string | null;
  /** phase가 'error'일 때, 어느 단계에서 실패했는지 */
  failedPhase?: SendPhase;
  /** 업로드 단계까지 갔다가 실패 → 상자는 그대로, 업로드만 재시도 가능 */
  canRetryUpload: boolean;
}

interface Pending {
  id: string;
  uploadToken: string;
  blob: Uint8Array;
  done: SendDone;
}

/** 보내기 중 서버가 줄 수 있는 오류 코드별 안내 문구 */
const SEND_ERROR_TEXT: Partial<Record<ErrorCode, string>> = {
  BAD_REQUEST: '보낼 수 없는 요청이에요. 옵션을 다시 확인하세요.',
  TOO_LARGE: '내용이 너무 커요. 크기를 줄여서 다시 보내세요.',
  RATE_LIMITED: '요청이 너무 많아요. 잠시 후 다시 시도하세요.',
  UNAUTHORIZED: '업로드 권한이 만료됐어요. 처음부터 다시 보내세요.',
  NOT_FOUND: '상자를 찾을 수 없어요. 처음부터 다시 보내세요.',
  EXPIRED: '상자가 만료됐어요. 처음부터 다시 보내세요.',
  INTERNAL: '서버에 문제가 생겼어요. 잠시 후 다시 시도하세요.',
};

function sendErrorMessage(e: unknown, fallback: string): string {
  // fetch 자체가 실패하면 TypeError (오프라인, CORS, 서버 꺼짐)
  if (e instanceof TypeError) return '서버에 연결할 수 없어요. 네트워크를 확인하세요.';
  if (e instanceof ApiError && e.code) return SEND_ERROR_TEXT[e.code] ?? fallback;
  console.error(e);
  return fallback;
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
    let current: SendPhase = 'encrypting';
    try {
      // 1. 브라우저에서 암호화. 서버는 평문도 열쇠도 보지 못한다.
      pending.current = null;
      setStatus({ phase: 'encrypting', error: null, canRetryUpload: false });
      const enc = await encryptPayload(header, content, { password });

      // 2. 상자 등록 (메타만).
      current = 'registering';
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
      current = 'uploading';
      setStatus({ phase: 'uploading', error: null, canRetryUpload: true });
      await uploadBlob(share.id, share.uploadToken, enc.blob);

      pending.current = null;
      setStatus({ phase: 'done', error: null, canRetryUpload: false });
      return done;
    } catch (e) {
      setStatus({
        phase: 'error',
        error: sendErrorMessage(e, '전송에 실패했어요.'),
        failedPhase: current,
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
        error: sendErrorMessage(e, '업로드에 실패했어요.'),
        failedPhase: 'uploading',
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
