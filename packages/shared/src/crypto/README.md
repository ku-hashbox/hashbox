# crypto

보안·암호화 담당이 1~2주차에 구현한다. 설계는 Notion 「Hashbox 개발 기획서」 5장 참고.

구현할 함수 (안):

- `encryptPayload(input, { password? })` → `{ blob, linkKey, kdf? , authToken? }`
- `decryptPayload(blob, linkKey, { password?, kdf? })` → `{ header, content }`
- `derivePasswordKeys(password, salt, iter)` → `{ pwKey, authToken }`

원칙: WebCrypto(`crypto.subtle`)만 사용, 직접 만든 암호 알고리즘 금지, 모든 함수에 왕복 테스트 작성.
