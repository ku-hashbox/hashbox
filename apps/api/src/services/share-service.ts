import type {
  CreateShareRequest,
  CreateShareResponse,
  ManageResponse,
  ShareMetaResponse,
} from '@hashbox/shared';
import type { Env } from '../env';

/** 라우트는 요청·응답 변환만 하고, 규칙은 여기에 둔다 */

export type OpenResult =
  | { ok: true; blob: ArrayBuffer; viewsLeft: number }
  | { ok: false; reason: 'NOT_FOUND' | 'CONSUMED' | 'EXPIRED' | 'REVOKED' | 'LOCKED' }
  | { ok: false; reason: 'WRONG_PASSWORD'; attemptsLeft: number };

export async function createShare(env: Env, req: CreateShareRequest): Promise<CreateShareResponse> {
  throw new Error('TODO(BE): createShare');
}

/** uploadToken 확인 → 크기 확인 → R2 저장 → status=ready */
export async function uploadBlob(
  env: Env,
  id: string,
  uploadToken: string,
  body: ArrayBuffer,
): Promise<'OK' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'SIZE_MISMATCH'> {
  throw new Error('TODO(BE): uploadBlob');
}

/** 차감 없음 */
export async function getShareMeta(env: Env, id: string): Promise<ShareMetaResponse | null> {
  throw new Error('TODO(BE): getShareMeta');
}

/** OPEN_SHARE로 원자적 차감 → 실패 원인 판별 → 비밀번호 실패 누적·잠금 → consumed면 R2 삭제 */
export async function openShare(env: Env, id: string, authToken?: string): Promise<OpenResult> {
  throw new Error('TODO(BE): openShare');
}

export async function getManage(env: Env, manageToken: string): Promise<ManageResponse | null> {
  throw new Error('TODO(BE): getManage');
}

export async function revokeShare(env: Env, manageToken: string): Promise<void> {
  throw new Error('TODO(BE): revokeShare');
}
