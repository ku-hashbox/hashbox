import { useRef, useState } from 'react';
import type {
  CreateShareRequest,
  CreateShareResponse,
  ErrorCode,
  PlainHeader,
} from '@hashbox/shared';
import { encryptPayload } from '@hashbox/shared';
import { ApiError, createShare, getManage, uploadBlob } from '../../lib/api';
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
  /** 업로드 응답을 잃었을 때 상자가 이미 올라갔는지 확인하는 데 쓴다 */
  manageToken: string;
  blob: Uint8Array;
  done: SendDone;
}

/** UPLOAD_CONFLICT(409)는 BE PR #45에서 ErrorCode에 추가된다. 머지 후엔 ErrorCode만 써도 된다 */
type SendErrorCode = ErrorCode | 'UPLOAD_CONFLICT';

/** 보내기 중 서버가 줄 수 있는 오류 코드별 안내 문구 */
const SEND_ERROR_TEXT: Partial<Record<SendErrorCode, string>> = {
  BAD_REQUEST: '보낼 수 없는 요청이에요. 옵션을 다시 확인하세요.',
  TOO_LARGE: '내용이 너무 커요. 크기를 줄여서 다시 보내세요.',
  RATE_LIMITED: '요청이 너무 많아요. 잠시 후 다시 시도하세요.',
  UNAUTHORIZED: '업로드 권한이 만료됐어요. 처음부터 다시 보내세요.',
  NOT_FOUND: '상자를 찾을 수 없어요. 처음부터 다시 보내세요.',
  EXPIRED: '상자가 만료됐어요. 처음부터 다시 보내세요.',
  UPLOAD_CONFLICT: '이미 업로드된 상자예요. 처음부터 다시 보내세요.',
  INTERNAL: '서버에 문제가 생겼어요. 잠시 후 다시 시도하세요.',
};

function sendErrorMessage(e: unknown, fallback: string): string {
  // fetch 자체가 실패하면 TypeError (오프라인, CORS, 서버 꺼짐)
  if (e instanceof TypeError) return '서버에 연결할 수 없어요. 네트워크를 확인하세요.';
  if (e instanceof ApiError && e.code) return SEND_ERROR_TEXT[e.code] ?? fallback;
  console.error(e);
  return fallback;
}

/** 업로드를 다시 해도 소용없는 오류: 상자가 없거나, 만료됐거나, 이미 업로드됨 */
const FATAL_UPLOAD: SendErrorCode[] = ['NOT_FOUND', 'EXPIRED', 'UNAUTHORIZED', 'UPLOAD_CONFLICT'];

function isFatalUpload(e: unknown): boolean {
  return e instanceof ApiError && e.code !== null && FATAL_UPLOAD.includes(e.code);
}

/**
 * 업로드. 앞선 업로드가 실제로는 성공했는데 응답만 잃은 경우,
 * 서버는 재시도에 401·409를 준다. 그때 상자가 ready면 성공으로 본다.
 */
async function uploadOrConfirm(p: Pending): Promise<void> {
  try {
    await uploadBlob(p.id, p.uploadToken, p.blob);
  } catch (e) {
    // 업로드가 이미 끝난 상자에 다시 올리면 서버가 주는 오류
    const recheck: SendErrorCode[] = ['UNAUTHORIZED', 'UPLOAD_CONFLICT'];
    if (e instanceof ApiError && e.code !== null && recheck.includes(e.code)) {
      const m = await getManage(p.manageToken).catch(() => null);
      if (m?.status === 'ready') return;
    }
    throw e;
  }
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
      pending.current = {
        id: share.id,
        uploadToken: share.uploadToken,
        manageToken: share.manageToken,
        blob: enc.blob,
        done,
      };

      // 3. 암호문 업로드.
      current = 'uploading';
      setStatus({ phase: 'uploading', error: null, canRetryUpload: true });
      await uploadOrConfirm(pending.current);

      pending.current = null;
      setStatus({ phase: 'done', error: null, canRetryUpload: false });
      return done;
    } catch (e) {
      // 다시 올려도 안 되는 오류면 상자를 버리고 처음부터 보내게 한다
      if (isFatalUpload(e)) pending.current = null;
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
      await uploadOrConfirm(p);
      pending.current = null;
      setStatus({ phase: 'done', error: null, canRetryUpload: false });
      return p.done;
    } catch (e) {
      const fatal = isFatalUpload(e);
      if (fatal) pending.current = null;
      setStatus({
        phase: 'error',
        error: sendErrorMessage(e, '업로드에 실패했어요.'),
        failedPhase: 'uploading',
        canRetryUpload: !fatal,
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
