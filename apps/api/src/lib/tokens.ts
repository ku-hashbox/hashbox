/** 상자 id: 12B 랜덤 → base64url 16자 */
export function newShareId(): string {
  throw new Error('TODO(BE): newShareId');
}

/** 관리·업로드 토큰: 32B 랜덤 → base64url */
export function newToken(): string {
  throw new Error('TODO(BE): newToken');
}

/** 토큰은 이 해시로만 저장·비교한다 */
export async function sha256b64url(value: string): Promise<string> {
  throw new Error('TODO(BE): sha256b64url');
}

/** 타이밍 공격 방지용 상수 시간 비교 */
export function safeEqual(a: string, b: string): boolean {
  throw new Error('TODO(BE): safeEqual');
}

/** Authorization: Bearer <token> 에서 토큰 추출 */
export function bearer(header: string | undefined): string | null {
  throw new Error('TODO(BE): bearer');
}
