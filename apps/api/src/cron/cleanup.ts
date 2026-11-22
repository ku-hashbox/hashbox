import { PENDING_TTL_MS, TOMBSTONE_DAYS } from '@hashbox/shared';
import {
  DELETE_OLD_ROWS,
  EXPIRE_BATCH,
  MARK_BLOBS_DELETED,
  SELECT_BLOBS_TO_DELETE,
} from '../db/queries';
import type { Env } from '../env';
import { deleteBlobs } from '../storage/blobs';

const BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * 10분마다 실행 (개발 기획서 7-1)
 * 1. 만료된 ready·pending → expired, R2 삭제
 * 2. 업로드 없이 1시간 지난 pending → expired
 * 3. 종결된 상자의 R2 삭제 재시도, 만료 시각부터 7일 지난 행 정리
 */
export async function runCleanup(env: Env, now = Date.now()): Promise<void> {
  await env.DB.prepare(EXPIRE_BATCH)
    .bind(now, now - PENDING_TTL_MS, BATCH_SIZE)
    .run();
  const { results } = await env.DB.prepare(SELECT_BLOBS_TO_DELETE)
    .bind(BATCH_SIZE)
    .all<{ id: string }>();
  const ids = results.map(({ id }) => id);
  if (ids.length > 0) {
    await deleteBlobs(env.BLOBS, ids);
    await env.DB.prepare(MARK_BLOBS_DELETED).bind(JSON.stringify(ids)).run();
  }
  await env.DB.prepare(DELETE_OLD_ROWS)
    .bind(now - TOMBSTONE_DAYS * DAY_MS)
    .run();
}
