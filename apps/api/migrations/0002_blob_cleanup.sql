-- Keep terminal rows eligible for cleanup until R2 confirms the delete.
ALTER TABLE shares ADD COLUMN blob_deleted INTEGER NOT NULL DEFAULT 0
  CHECK (blob_deleted IN (0, 1));

CREATE INDEX idx_shares_blob_cleanup ON shares (expires_at, id)
  WHERE blob_deleted = 0 AND status IN ('consumed', 'expired', 'revoked', 'locked');
