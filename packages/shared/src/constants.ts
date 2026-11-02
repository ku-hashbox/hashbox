/** 프론트·백엔드가 공통으로 쓰는 값. 값을 바꿀 땐 개발 기획서도 같이 고친다. */

/** 만료 시간 선택지 (초): 10분, 1시간, 1일, 7일 */
export const EXPIRES_OPTIONS = [600, 3600, 86400, 604800] as const;
export type ExpiresIn = (typeof EXPIRES_OPTIONS)[number];
export const DEFAULT_EXPIRES: ExpiresIn = 3600;

/** 열람 횟수 선택지 */
export const VIEWS_OPTIONS = [1, 3, 5, 10] as const;
export type MaxViews = (typeof VIEWS_OPTIONS)[number];
export const DEFAULT_VIEWS: MaxViews = 1;

/** 평문 크기 제한 */
export const MAX_TEXT_BYTES = 64 * 1024; // 텍스트·.env 64KB
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 파일 25MB

/** 암호화 오버헤드: 버전 1B + IV 12B + GCM 태그 16B (+ 평문 헤더는 별도) */
export const CIPHER_OVERHEAD_BYTES = 1 + 12 + 16;
export const MAX_HEADER_BYTES = 1024;

export const MAX_PASSWORD_ATTEMPTS = 5;
export const PBKDF2_ITERATIONS = 600_000;

/** 열람·만료 후 상태 행을 남겨두는 기간 (일). "이미 열람됨" 표시에 필요 */
export const TOMBSTONE_DAYS = 7;

/** 업로드가 안 된 pending 상자를 만료시키는 시간 (ms) */
export const PENDING_TTL_MS = 60 * 60 * 1000;
