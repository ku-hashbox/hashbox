import type { ShareKind, ShareStatus } from '@hashbox/shared';

/** shares 테이블 한 행 */
export interface ShareRow {
  id: string;
  kind: ShareKind;
  size: number;
  status: ShareStatus;
  created_at: number;
  expires_at: number;
  max_views: number;
  views_left: number;
  has_password: 0 | 1;
  kdf_salt: string | null;
  kdf_iter: number | null;
  auth_hash: string | null;
  failed_attempts: number;
  manage_hash: string;
  upload_hash: string | null;
  first_opened_at: number | null;
  last_opened_at: number | null;
}
