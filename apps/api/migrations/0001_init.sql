-- Hashbox 초기 스키마. 개발 기획서 6장 참고
CREATE TABLE shares (
  id               TEXT PRIMARY KEY,
  kind             TEXT    NOT NULL CHECK (kind IN ('text', 'env', 'file')),
  size             INTEGER NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'ready', 'consumed', 'expired', 'revoked', 'locked')),
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  max_views        INTEGER NOT NULL,
  views_left       INTEGER NOT NULL,
  has_password     INTEGER NOT NULL DEFAULT 0,
  kdf_salt         TEXT,
  kdf_iter         INTEGER,
  auth_hash        TEXT,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  manage_hash      TEXT    NOT NULL UNIQUE,
  upload_hash      TEXT,
  first_opened_at  INTEGER,
  last_opened_at   INTEGER
);

CREATE INDEX idx_shares_expires ON shares (expires_at);
CREATE INDEX idx_shares_status  ON shares (status);
