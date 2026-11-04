/** D1 SQL 모음. 스키마는 migrations/0001_init.sql, 설계는 개발 기획서 6·7장 */

export const INSERT_SHARE = `
INSERT INTO shares (id, kind, size, status, created_at, expires_at, max_views, views_left,
                    has_password, kdf_salt, kdf_iter, auth_hash, manage_hash, upload_hash)
VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`;

export const SELECT_SHARE = `SELECT * FROM shares WHERE id = ?1`;

export const SELECT_BY_MANAGE = `SELECT * FROM shares WHERE manage_hash = ?1`;

export const MARK_READY = `
UPDATE shares SET status = 'ready', upload_hash = NULL
WHERE id = ?1 AND status = 'pending' AND upload_hash = ?2`;

/** 원자적 차감. 바뀐 행이 1개면 성공 (?1 id, ?2 now, ?3 authHash 또는 NULL) */
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
  AND (has_password = 0 OR auth_hash = ?3)`;

export const ADD_FAILED_ATTEMPT = `
UPDATE shares
SET failed_attempts = failed_attempts + 1,
    status = CASE WHEN failed_attempts + 1 >= ?2 THEN 'locked' ELSE status END
WHERE id = ?1 AND status = 'ready'`;

export const REVOKE = `
UPDATE shares SET status = 'revoked'
WHERE manage_hash = ?1 AND status IN ('pending', 'ready')`;

/** Cron: 만료 대상 id 목록 (?1 now, ?2 pending 기준 시각) */
export const SELECT_EXPIRING = `
SELECT id FROM shares
WHERE (status = 'ready' AND expires_at <= ?1)
   OR (status = 'pending' AND (expires_at <= ?1 OR created_at <= ?2))`;

export const MARK_EXPIRED = `UPDATE shares SET status = 'expired' WHERE id = ?1`;

/** Cron: 톰스톤 보관 기간이 지난 행 삭제 (?1 기준 시각) */
export const DELETE_OLD_ROWS = `
DELETE FROM shares
WHERE status IN ('consumed', 'expired', 'revoked', 'locked') AND expires_at <= ?1`;
