# crypto — 보안·암호화 담당

설계: Notion 「Hashbox 개발 기획서」 5장.

| 파일        | 내용                                                             |
| ----------- | ---------------------------------------------------------------- |
| `format.ts` | 평문 포맷(헤더+내용) 직렬화, 저장 포맷(버전+IV+암호문) 묶기·풀기 |
| `keys.ts`   | 열쇠 생성, 비밀번호 키 유도(PBKDF2), contentKey 유도(HKDF)       |
| `aes.ts`    | AES-256-GCM 암호화·복호화                                        |
| `index.ts`  | 외부에 공개하는 함수: `encryptPayload`, `decryptPayload`         |

원칙

- WebCrypto(`crypto.subtle`)만 사용한다. 직접 만든 암호 알고리즘 금지.
- 랜덤 값은 `crypto.getRandomValues`로만 만든다.
- 모든 함수에 왕복 테스트와 변조 실패 테스트를 작성한다.
- 이 폴더를 바꾸는 PR은 보안 담당 리뷰 필수.
