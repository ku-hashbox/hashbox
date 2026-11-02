import { describe, it } from 'vitest';

describe('crypto (보안 담당)', () => {
  it.todo('평문 포맷: encodePlain → decodePlain 왕복');
  it.todo('저장 포맷: packBlob → unpackBlob 왕복, 버전이 다르면 거부');
  it.todo('비밀번호 없음: encryptPayload → decryptPayload 왕복');
  it.todo('비밀번호 있음: 같은 비밀번호로 왕복 성공');
  it.todo('비밀번호가 틀리면 DecryptError');
  it.todo('linkKey 1글자 변조 시 DecryptError');
  it.todo('암호문 1바이트 변조 시 DecryptError');
  it.todo('같은 입력을 두 번 암호화하면 blob이 서로 다름 (IV 랜덤)');
});
