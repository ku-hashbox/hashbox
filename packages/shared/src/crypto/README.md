# crypto — 보안·암호화 담당

설계: Notion 「Hashbox 개발 기획서」 5장. 이 문서는 그 설계를 코드 기준으로 확정한 것이다.

| 파일        | 내용                                                             |
| ----------- | ---------------------------------------------------------------- |
| `index.ts`  | 외부에 공개하는 함수 (아래 "사용법")                             |
| `format.ts` | 평문 포맷(헤더+내용) 직렬화, 저장 포맷(버전+IV+암호문) 묶기·풀기 |
| `keys.ts`   | 열쇠·salt 생성, 비밀번호 키 유도(PBKDF2), contentKey 유도(HKDF)  |
| `aes.ts`    | AES-256-GCM 암호화·복호화                                        |
| `errors.ts` | `DecryptError`, `InvalidInputError`                              |
| `types.ts`  | `PlainHeader`, `EncryptResult` 등 타입                           |

## 사용법

```ts
import { encryptPayload, decryptPayload, computeAuthToken, parseLinkKey } from '@hashbox/shared';

// 보내기 (FE1)
const { blob, linkKey, password } = await encryptPayload(
  { v: 1, kind: 'text' },
  new TextEncoder().encode(text),
  { password: pw }, // 비밀번호 없으면 생략
);
// POST /api/shares { kind, size: blob.length, expiresIn, maxViews, password }
// PUT  /api/shares/{id}/blob  ← blob
// 링크: `${origin}/s/${id}#${linkKey}`

// 받기 (FE2)
parseLinkKey(hash); // 실패하면 "링크가 잘린 것 같아요" 화면
const meta = await getShare(id); // GET /api/shares/{id}
const authToken = meta.hasPassword
  ? await computeAuthToken(pw, meta.kdf!.salt, meta.kdf!.iter)
  : undefined;
const blob = await openShare(id, authToken); // POST /api/shares/{id}/open
const { header, content } = await decryptPayload(
  blob,
  hash,
  meta.hasPassword ? { password: pw, kdf: meta.kdf } : {},
);
```

| 함수                                                 | 설명                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `encryptPayload(header, content, { password? })`     | → `{ blob, linkKey, password?: { salt, iter, authToken } }` |
| `decryptPayload(blob, linkKey, { password?, kdf? })` | → `{ header, content }`                                     |
| `computeAuthToken(password, salt, iter)`             | 서버 `open` 요청에 보낼 authToken (base64url)               |
| `parseLinkKey(linkKey)`                              | `#` 뒤 문자열 검증. 43자 base64url = 32B가 아니면 오류      |

### 오류

| 오류                | 언제                                                                  | 화면 문구 (기획서 8-3)  |
| ------------------- | --------------------------------------------------------------------- | ----------------------- |
| `InvalidInputError` | 링크 열쇠 형식·길이 틀림, 크기 초과, 빈 비밀번호, 이상한 KDF 파라미터 | 링크 오류 / 입력값 안내 |
| `DecryptError`      | 열쇠·비밀번호 틀림, 암호문 변조·손상, 버전 불일치                     | "열쇠가 맞지 않아요"    |

`error.message`는 디버깅용이다. 화면 문구는 `instanceof`로 구분해서 정한다.

## 포맷

**평문 포맷** (암호화 전. 파일명도 여기 들어가서 서버가 못 본다)

```txt
[ 헤더 길이 4B big-endian ][ 헤더 JSON UTF-8 (최대 1024B) ][ 내용 바이트 ]
헤더: { "v": 1, "kind": "text" | "env" | "file", "name"?, "mime"?, "size"? }
```

**저장 포맷** (R2에 올라가는 것)

```txt
[ 버전 1B = 0x01 ][ IV 12B ][ AES-256-GCM 암호문 + 태그 16B ]
```

→ `blob.length = 내용 길이 + 29` (`CIPHER_OVERHEAD_BYTES`) + 4 + 헤더 길이

## 키 유도

| 이름         | 크기 | 만드는 법                                                                                                         |
| ------------ | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `linkKey`    | 32B  | `crypto.getRandomValues`, 링크 `#` 뒤 43자                                                                        |
| `iv`         | 12B  | `crypto.getRandomValues`, 암호화마다 새로                                                                         |
| `salt`       | 16B  | `crypto.getRandomValues`, 비밀번호 상자만                                                                         |
| `pwKey`      | 32B  | PBKDF2-SHA256(NFC(비밀번호), salt, 600,000) 출력 64B의 앞 32B                                                     |
| `authToken`  | 32B  | 같은 출력의 뒤 32B. 서버는 SHA-256만 저장                                                                         |
| `contentKey` | 256b | 비밀번호 없음: `linkKey` 그대로 / 있음: HKDF-SHA256(ikm=`linkKey‖pwKey`, salt=빈 값, info=`"hashbox/content/v1"`) |

- 비밀번호는 `NFC`로 정규화한다. macOS 등에서 한글이 NFD로 들어와도 같은 키가 나온다.
- 받기 쪽은 서버가 준 `iter`를 그대로 믿지 않는다. `600,000 ≤ iter ≤ 10,000,000`, salt 16B가 아니면 `InvalidInputError`. (서버가 장악돼 iter=1을 내려주는 공격 방지)
- `contentKey`는 추출 불가(`extractable: false`) CryptoKey로 만든다.

## 원칙

- WebCrypto(`crypto.subtle`)만 사용한다. 직접 만든 암호 알고리즘 금지.
- 랜덤 값은 `crypto.getRandomValues`로만 만든다.
- 모든 함수에 왕복 테스트와 변조 실패 테스트를 작성한다 (`crypto.test.ts`).
- 이 폴더를 바꾸는 PR은 보안 담당 리뷰 필수.

## 리뷰 때 논의할 것

1. **PBKDF2 64B 출력**: SHA-256 기반 PBKDF2로 64B를 뽑으면 내부적으로 60만 회를 **두 번** 돈다(모바일 체감 시간 2배). 반면 공격자는 authToken 해시만 맞춰보면 되므로 한 번만 돌면 된다. 대안: PBKDF2 32B → HKDF로 `pwKey`/`authToken`을 각각 유도. 바꾸면 기획서 5-2도 수정.
2. **받기 쪽 PBKDF2 중복**: 지금은 `computeAuthToken`과 `decryptPayload`가 각각 PBKDF2를 계산한다(비밀번호 상자 열 때 2회). 필요하면 한 번 계산한 결과를 넘기는 API로 바꾼다.
