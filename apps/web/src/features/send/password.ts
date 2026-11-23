/** 비밀번호 최소 길이 (위협 모델 C5: 서버가 털려도 짧은 비밀번호를 오프라인 대입으로 깨기 어렵게) */
export const MIN_PASSWORD_LENGTH = 8;

/** 글자 수. 한글·이모지도 한 글자로 센다 */
export function passwordLength(pw: string): number {
  return [...pw].length;
}

export function isPasswordTooShort(pw: string): boolean {
  return passwordLength(pw) < MIN_PASSWORD_LENGTH;
}
