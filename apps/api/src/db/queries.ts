/** D1 SQL 모음. 스키마는 migrations/0001_init.sql, 설계는 개발 기획서 6·7장 */

export const INSERT_SHARE = `
INSERT INTO shares (id, kind, size, status, created_at, expires_at, max_views, views_left,
                    has_password, kdf_salt, kdf_iter, auth_hash, manage_hash, upload_hash)
VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`;

export const SELECT_SHARE = `SELECT * FROM shares WHERE id = ?1`;

export const SELECT_BY_MANAGE = `SELECT * FROM shares WHERE manage_hash = ?1`;

export const MARK_READY = `
UPDATE shares SET status = 'ready', upload_hash = NULL
WHERE id = ?1 AND status = 'pending' AND upload_hash = ?2
  AND expires_at > ?3 AND created_at > ?4`;

/** 원자적 차감. 갱신된 행을 반환 (?1 id, ?2 now, ?3 authHash 또는 NULL) */
export const OPEN_SHARE = `
UPDATE shares
SET views_left      = views_left - 1,
    status          = CASE WHEN views_left - 1 = 0 THEN 'consumed' ELSE status END,
    first_opened_at = COALESCE(first_opened_at, ?2),
    last_opened_at  = ?2
WHERE id = ?1
  AND status = 'ready'
  AND views_left > 0
  AND expires_at > ?2
  AND (has_password = 0 OR auth_hash = ?3)
RETURNING status, views_left`;

/** 비밀번호 실패도 열기·파기와 같은 상태 조건으로 갱신한다. */
export const ADD_FAILED_ATTEMPT = `
UPDATE shares
SET failed_attempts = failed_attempts + 1,
    status = CASE WHEN failed_attempts + 1 >= ?2 THEN 'locked' ELSE status END
WHERE id = ?1 AND status = 'ready' AND expires_at > ?3 AND has_password = 1
RETURNING status, failed_attempts`;

export const REVOKE = `
UPDATE shares SET status = 'revoked', upload_hash = NULL
WHERE id = ?1 AND expires_at > ?2 AND (
  status = 'ready' OR (status = 'pending' AND created_at > ?3)
)
RETURNING id`;

export const MARK_EXPIRED = `
UPDATE shares SET status = 'expired', upload_hash = NULL
WHERE id = ?1 AND (
  (status = 'ready' AND expires_at <= ?2)
  OR (status = 'pending' AND (expires_at <= ?2 OR created_at <= ?3))
)
RETURNING *`;

export const EXPIRE_BATCH = `
UPDATE shares SET status = 'expired', upload_hash = NULL
WHERE id IN (
  SELECT id FROM shares
  WHERE (status = 'ready' AND expires_at <= ?1)
     OR (status = 'pending' AND (expires_at <= ?1 OR created_at <= ?2))
  ORDER BY expires_at, id LIMIT ?3
)`;

export const SELECT_BLOBS_TO_DELETE = `
SELECT id FROM shares
WHERE status IN ('consumed', 'expired', 'revoked', 'locked') AND blob_deleted = 0
ORDER BY expires_at, id LIMIT ?1`;

export const MARK_BLOBS_DELETED = `
UPDATE shares SET blob_deleted = 1
WHERE id IN (SELECT value FROM json_each(?1))`;

export const RETRY_BLOB_DELETION = `
UPDATE shares SET blob_deleted = 0 WHERE id = ?1`;

/** Cron: 톰스톤 보관 기간이 지난 행 삭제 (?1 기준 시각) */
export const DELETE_OLD_ROWS = `
DELETE FROM shares
WHERE status IN ('consumed', 'expired', 'revoked', 'locked')
  AND expires_at <= ?1 AND blob_deleted = 1`;
