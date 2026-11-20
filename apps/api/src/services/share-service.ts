import {
  MAX_PASSWORD_ATTEMPTS,
  PENDING_TTL_MS,
  maxBlobBytes,
  type CreateShareRequest,
  type CreateShareResponse,
  type ManageResponse,
  type ShareMetaResponse,
} from '@hashbox/shared';
import {
  ADD_FAILED_ATTEMPT,
  INSERT_SHARE,
  MARK_BLOBS_DELETED,
  MARK_EXPIRED,
  MARK_READY,
  OPEN_SHARE,
  RETRY_BLOB_DELETION,
  REVOKE,
  SELECT_BY_MANAGE,
  SELECT_SHARE,
} from '../db/queries';
import type { ShareRow } from '../db/types';
import type { Env } from '../env';
import { newShareId, newToken, safeEqual, sha256b64url } from '../lib/tokens';
import { isBase64url } from '../lib/validate';
import { deleteBlobs, getBlob, putBlob } from '../storage/blobs';

type OpenFailure = 'NOT_FOUND' | 'CONSUMED' | 'EXPIRED' | 'REVOKED' | 'LOCKED';

export type OpenResult =
  | { ok: true; blob: ArrayBuffer; viewsLeft: number }
  | { ok: false; reason: OpenFailure }
  | { ok: false; reason: 'WRONG_PASSWORD'; attemptsLeft: number };

function findShare(env: Env, id: string): Promise<ShareRow | null> {
  if (!isBase64url(id, 12)) return Promise.resolve(null);
  return env.DB.prepare(SELECT_SHARE).bind(id).first<ShareRow>();
}

async function purgeBlob(env: Env, id: string): Promise<boolean> {
  try {
    await deleteBlobs(env.BLOBS, [id]);
    await env.DB.prepare(MARK_BLOBS_DELETED)
      .bind(JSON.stringify([id]))
      .run();
    return true;
  } catch {
    // 상태를 유지하고 Cron에서 삭제를 재시도한다.
    console.error('share blob deletion failed');
    return false;
  }
}

async function expireIfDue(env: Env, row: ShareRow | null): Promise<ShareRow | null> {
  if (!row || (row.status !== 'pending' && row.status !== 'ready')) return row;

  const now = Date.now();
  const pendingBefore = now - PENDING_TTL_MS;
  const pendingTimedOut = row.status === 'pending' && row.created_at <= pendingBefore;
  if (row.expires_at > now && !pendingTimedOut) return row;

  const expired = await env.DB.prepare(MARK_EXPIRED)
    .bind(row.id, now, pendingBefore)
    .first<ShareRow>();
  if (!expired) return findShare(env, row.id);
  if (await purgeBlob(env, row.id)) expired.blob_deleted = 1;
  return expired;
}

async function readShare(env: Env, id: string): Promise<ShareRow | null> {
  return expireIfDue(env, await findShare(env, id));
}

export async function createShare(
  env: Env,
  { kind, size, expiresIn, maxViews, password }: CreateShareRequest,
): Promise<CreateShareResponse> {
  const id = newShareId();
  const manageToken = newToken();
  const uploadToken = newToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + expiresIn * 1_000;
  const [manageHash, uploadHash, authHash] = await Promise.all([
    sha256b64url(manageToken),
    sha256b64url(uploadToken),
    password ? sha256b64url(password.authToken) : null,
  ]);

  await env.DB.prepare(INSERT_SHARE)
    .bind(
      id,
      kind,
      size,
      createdAt,
      expiresAt,
      maxViews,
      password ? 1 : 0,
      password?.salt ?? null,
      password?.iter ?? null,
      authHash,
      manageHash,
      uploadHash,
    )
    .run();

  return { id, manageToken, uploadToken, expiresAt };
}

async function readUploadBody(
  request: Request,
  size: number,
  limit: number,
): Promise<ArrayBuffer | 'SIZE_MISMATCH' | 'TOO_LARGE'> {
  const length = request.headers.get('Content-Length');
  if (length !== null) {
    if (!/^\d+$/.test(length)) return 'SIZE_MISMATCH';
    if (Number(length) > limit) return 'TOO_LARGE';
    if (Number(length) !== size) return 'SIZE_MISMATCH';
  }
  if (!request.body) return 'SIZE_MISMATCH';

  // 헤더가 없는 요청도 등록한 크기 이상 읽지 않는다.
  const reader = request.body.getReader();
  const bytes = new Uint8Array(size);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const end = offset + value.byteLength;
      if (end > size) {
        return end > limit ? 'TOO_LARGE' : 'SIZE_MISMATCH';
      }
      bytes.set(value, offset);
      offset = end;
    }
  } catch {
    return 'SIZE_MISMATCH';
  } finally {
    reader.releaseLock();
  }
  return offset === size ? bytes.buffer : 'SIZE_MISMATCH';
}

/** uploadToken 확인 → 크기 확인 → R2 저장 → status=ready */
export async function uploadBlob(
  env: Env,
  id: string,
  uploadToken: string,
  request: Request,
): Promise<
  | 'OK'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'SIZE_MISMATCH'
  | 'TOO_LARGE'
  | 'UPLOAD_CONFLICT'
  | 'EXPIRED'
> {
  const row = await readShare(env, id);
  if (!row) return 'NOT_FOUND';
  if (row.status === 'expired') return 'EXPIRED';

  const uploadHash = await sha256b64url(uploadToken);
  if (row.status !== 'pending' || !row.upload_hash || !safeEqual(uploadHash, row.upload_hash)) {
    return 'UNAUTHORIZED';
  }
  const body = await readUploadBody(request, row.size, maxBlobBytes(row.kind));
  if (typeof body === 'string') return body;

  const stored = await putBlob(env.BLOBS, id, body);
  if (!stored) {
    // R2 저장 뒤 D1 갱신에 실패했다면 같은 암호문으로 다시 시도할 수 있다.
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
    // 업로드 직전에 다른 요청이 파기·만료 처리하고 삭제했을 수도 있다.
    await env.DB.prepare(RETRY_BLOB_DELETION).bind(id).run();
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

function failedOpen(row: ShareRow | null): OpenResult {
  const reason = openFailure(row);
  if (!reason) throw new Error('ready share could not be opened');
  return { ok: false, reason };
}

/** 암호문을 확보한 요청 중 D1 차감에 성공한 요청만 암호문을 받는다. */
export async function openShare(env: Env, id: string, authToken?: string): Promise<OpenResult> {
  const row = await readShare(env, id);
  if (!row || openFailure(row)) return failedOpen(row);

  let authHash: string | null = null;
  if (row.has_password === 1) {
    authHash = authToken ? await sha256b64url(authToken) : null;
    if (!authHash || !row.auth_hash || !safeEqual(authHash, row.auth_hash)) {
      const attempt = await env.DB.prepare(ADD_FAILED_ATTEMPT)
        .bind(id, MAX_PASSWORD_ATTEMPTS, Date.now())
        .first<Pick<ShareRow, 'status' | 'failed_attempts'>>();
      if (!attempt) return failedOpen(await readShare(env, id));
      if (attempt.status === 'locked') {
        await purgeBlob(env, id);
        return { ok: false, reason: 'LOCKED' };
      }
      return {
        ok: false,
        reason: 'WRONG_PASSWORD',
        attemptsLeft: MAX_PASSWORD_ATTEMPTS - attempt.failed_attempts,
      };
    }
  }

  const blob = await getBlob(env.BLOBS, id);
  const opened =
    blob &&
    (await env.DB.prepare(OPEN_SHARE)
      .bind(id, Date.now(), authHash)
      .first<Pick<ShareRow, 'status' | 'views_left'>>());
  if (!blob || !opened) return failedOpen(await readShare(env, id));

  if (opened.status === 'consumed') await purgeBlob(env, id);
  return { ok: true, blob, viewsLeft: opened.views_left };
}

async function findManagedShare(env: Env, manageToken: string): Promise<ShareRow | null> {
  const hash = await sha256b64url(manageToken);
  return env.DB.prepare(SELECT_BY_MANAGE).bind(hash).first<ShareRow>();
}

export async function getManage(env: Env, manageToken: string): Promise<ManageResponse | null> {
  const row = await expireIfDue(env, await findManagedShare(env, manageToken));
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    maxViews: row.max_views,
    viewsLeft: row.views_left,
    expiresAt: row.expires_at,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
  };
}

export async function revokeShare(env: Env, manageToken: string): Promise<boolean> {
  const row = await findManagedShare(env, manageToken);
  if (!row) return false;

  const now = Date.now();
  const revoked = await env.DB.prepare(REVOKE)
    .bind(row.id, now, now - PENDING_TTL_MS)
    .first<{ id: string }>();
  const current = revoked ? null : await readShare(env, row.id);
  if ((revoked || current?.blob_deleted === 0) && !(await purgeBlob(env, row.id))) {
    throw new Error('share revocation cleanup failed');
  }
  return true;
}
