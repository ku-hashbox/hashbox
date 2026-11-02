import type { Env } from '../env';

/**
 * 10분마다 실행 (개발 기획서 7-1)
 * 1. 만료된 ready·pending → expired, R2 삭제
 * 2. 업로드 없이 1시간 지난 pending → expired
 * 3. 끝난 상태로 7일 지난 행 삭제
 */
export async function runCleanup(env: Env, now = Date.now()): Promise<void> {
  // TODO(BE, 3주차)
}
