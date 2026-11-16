/** 암호화 모듈이 던지는 오류의 공통 부모 */
export class HashboxCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * 열 수 없는 상자: 열쇠·비밀번호가 틀렸거나, 암호문이 변조·손상됨.
 * 받기 화면에서는 "열쇠가 맞지 않아요"로 표시한다.
 * (원인을 더 자세히 구분하지 않는 건 의도된 것: 공격자에게 힌트를 주지 않는다)
 */
export class DecryptError extends HashboxCryptoError {
  constructor(message = '복호화에 실패했어요. 링크나 비밀번호가 맞는지 확인하세요.') {
    super(message);
  }
}

/** 호출하는 쪽의 입력이 잘못됨: 링크 열쇠 길이, 크기 초과, 빈 비밀번호, 이상한 KDF 파라미터 등 */
export class InvalidInputError extends HashboxCryptoError {}
