import {
  PENDING_TTL_MS,
  type CreateShareRequest,
  type CreateShareResponse,
  type ManageResponse,
  type ShareMetaResponse,
} from '@hashbox/shared';
import { INSERT_SHARE, MARK_EXPIRED, MARK_READY, OPEN_SHARE, SELECT_SHARE } from '../db/queries';
import type { ShareRow } from '../db/types';
import type { Env } from '../env';
import { newShareId, newToken, safeEqual, sha256b64url } from '../lib/tokens';
import { isBase64url } from '../lib/validate';
import { deleteBlob, getBlob, putBlob } from '../storage/blobs';

/** 라우트는 요청·응답 변환만 하고, 규칙은 여기에 둔다 */

type OpenFailure = 'NOT_FOUND' | 'CONSUMED' | 'EXPIRED' | 'REVOKED' | 'LOCKED' | 'NOT_IMPLEMENTED';

export type OpenResult =
  { ok: true; blob: ArrayBuffer; viewsLeft: number } | { ok: false; reason: OpenFailure };

function findShare(env: Env, id: string): Promise<ShareRow | null> {
  if (!isBase64url(id, 12)) return Promise.resolve(null);
  return env.DB.prepare(SELECT_SHARE).bind(id).first<ShareRow>();
}

async function purgeBlob(env: Env, id: string): Promise<void> {
  try {
    await deleteBlob(env.BLOBS, id);
  } catch {
    // 종결된 상태는 유지한다. 같은 링크를 다시 열면 삭제를 재시도한다.
    console.error('share blob deletion failed');
  }
}

async function readShare(env: Env, id: string): Promise<ShareRow | null> {
  const row = await findShare(env, id);
  if (!row || (row.status !== 'pending' && row.status !== 'ready')) return row;

  const now = Date.now();
  const pendingBefore = now - PENDING_TTL_MS;
  const pendingTimedOut = row.status === 'pending' && row.created_at <= pendingBefore;
  if (row.expires_at > now && !pendingTimedOut) return row;

  const expired = await env.DB.prepare(MARK_EXPIRED).bind(id, now, pendingBefore).first<ShareRow>();
  if (!expired) return findShare(env, id);

  await purgeBlob(env, id);
  return expired;
}

export async function createShare(
  env: Env,
  { kind, size, expiresIn, maxViews }: Omit<CreateShareRequest, 'password'>,
): Promise<CreateShareResponse> {
  const id = newShareId();
  const manageToken = newToken();
  const uploadToken = newToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + expiresIn * 1_000;
  const [manageHash, uploadHash] = await Promise.all([
    sha256b64url(manageToken),
    sha256b64url(uploadToken),
  ]);

  await env.DB.prepare(INSERT_SHARE)
    .bind(
      id,
      kind,
      size,
      createdAt,
      expiresAt,
      maxViews,
      0,
      null,
      null,
      null,
      manageHash,
      uploadHash,
    )
    .run();

  return { id, manageToken, uploadToken, expiresAt };
}

/** uploadToken 확인 → 크기 확인 → R2 저장 → status=ready */
export async function uploadBlob(
  env: Env,
  id: string,
  uploadToken: string,
  body: ArrayBuffer,
): Promise<'OK' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'SIZE_MISMATCH' | 'UPLOAD_CONFLICT' | 'EXPIRED'> {
  const row = await readShare(env, id);
  if (!row) return 'NOT_FOUND';
  if (row.status === 'expired') return 'EXPIRED';

  const uploadHash = await sha256b64url(uploadToken);
  if (row.status !== 'pending' || !row.upload_hash || !safeEqual(uploadHash, row.upload_hash)) {
    return 'UNAUTHORIZED';
  }
  if (body.byteLength !== row.size) return 'SIZE_MISMATCH';

  const stored = await putBlob(env.BLOBS, id, body);
  if (!stored) {
    // R2 저장 뒤 D1 갱신에 실패한 업로드는 같은 암호문으로 재시도할 수 있다.
    const existing = await getBlob(env.BLOBS, id);
    if (
      !existing ||
      existing.byteLength !== body.byteLength ||
      !crypto.subtle.timingSafeEqual(existing, body)
    ) {
      return 'UPLOAD_CONFLICT';
    }
  }

  const now = Date.now();
  const ready = await env.DB.prepare(MARK_READY)
    .bind(id, uploadHash, now, now - PENDING_TTL_MS)
    .run();
  if (ready.meta.changes === 1) return 'OK';

  const current = await readShare(env, id);
  if (!current || (current.status !== 'ready' && current.status !== 'pending')) {
    // 업로드 도중 만료 또는 소진된 상자의 암호문이 남지 않게 한다.
    await purgeBlob(env, id);
  }
  return current?.status === 'expired' ? 'EXPIRED' : 'UPLOAD_CONFLICT';
}

/** 차감 없음 */
export async function getShareMeta(env: Env, id: string): Promise<ShareMetaResponse | null> {
  const row = await readShare(env, id);
  if (!row || row.status === 'pending') return null;

  const meta: ShareMetaResponse = {
    status: row.status,
    kind: row.kind,
    size: row.size,
    expiresAt: row.expires_at,
    viewsLeft: row.views_left,
    hasPassword: row.has_password === 1,
  };
  if (meta.hasPassword && row.kdf_salt && row.kdf_iter !== null) {
    meta.kdf = { salt: row.kdf_salt, iter: row.kdf_iter };
  }
  return meta;
}

function openFailure(row: ShareRow | null): OpenFailure | null {
  switch (row?.status) {
    case 'ready':
      if (row.has_password) return 'NOT_IMPLEMENTED';
      return row.views_left > 0 ? null : 'CONSUMED';
    case 'consumed':
      return 'CONSUMED';
    case 'expired':
      return 'EXPIRED';
    case 'revoked':
      return 'REVOKED';
    case 'locked':
      return 'LOCKED';
    default:
      return 'NOT_FOUND';
  }
}

/** 암호문을 확보한 요청 중 D1 차감에 성공한 요청만 암호문을 받는다. */
export async function openShare(env: Env, id: string): Promise<OpenResult> {
  const initialFailure = openFailure(await readShare(env, id));
  if (initialFailure) {
    if (initialFailure === 'CONSUMED' || initialFailure === 'EXPIRED') await purgeBlob(env, id);
    return { ok: false, reason: initialFailure };
  }

  const blob = await getBlob(env.BLOBS, id);
  const opened =
    blob &&
    (await env.DB.prepare(OPEN_SHARE)
      .bind(id, Date.now(), null)
      .first<Pick<ShareRow, 'status' | 'views_left'>>());
  if (!blob || !opened) {
    const reason = openFailure(await readShare(env, id));
    if (reason) return { ok: false, reason };
    throw new Error('ready share could not be opened');
  }

  if (opened.status === 'consumed') await purgeBlob(env, id);
  return { ok: true, blob, viewsLeft: opened.views_left };
}

export async function getManage(env: Env, manageToken: string): Promise<ManageResponse | null> {
  throw new Error('TODO(BE): getManage');
}

export async function revokeShare(env: Env, manageToken: string): Promise<void> {
  throw new Error('TODO(BE): revokeShare');
}
