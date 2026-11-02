import type { ExpiresIn, MaxViews } from './constants';

export type ShareKind = 'text' | 'env' | 'file';
export type ShareStatus = 'pending' | 'ready' | 'consumed' | 'expired' | 'revoked' | 'locked';

/** POST /api/shares */
export interface CreateShareRequest {
  kind: ShareKind;
  /** 업로드할 암호문 바이트 수 */
  size: number;
  expiresIn: ExpiresIn;
  maxViews: MaxViews;
  password?: {
    salt: string; // base64url
    iter: number;
    authToken: string; // base64url
  };
}
export interface CreateShareResponse {
  id: string;
  manageToken: string;
  uploadToken: string;
  expiresAt: number;
}

/** GET /api/shares/{id} */
export interface ShareMetaResponse {
  status: Exclude<ShareStatus, 'pending'>;
  kind: ShareKind;
  size: number;
  expiresAt: number;
  viewsLeft: number;
  hasPassword: boolean;
  kdf?: { salt: string; iter: number };
}

/** POST /api/shares/{id}/open */
export interface OpenShareRequest {
  authToken?: string;
}

/** GET /api/manage */
export interface ManageResponse {
  id: string;
  status: ShareStatus;
  maxViews: number;
  viewsLeft: number;
  expiresAt: number;
  firstOpenedAt: number | null;
  lastOpenedAt: number | null;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'CONSUMED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'LOCKED'
  | 'TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ErrorResponse {
  error: { code: ErrorCode; message: string; attemptsLeft?: number };
}
