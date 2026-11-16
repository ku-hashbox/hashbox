import { describe, expect, it } from 'vitest';
import { randomBytes } from '../base64url';
import { MAX_TEXT_BYTES, PBKDF2_ITERATIONS } from '../constants';
import { aesDecrypt, aesEncrypt } from './aes';
import { DecryptError, InvalidInputError } from './errors';
import { BLOB_VERSION, IV_BYTES, decodePlain, encodePlain, packBlob, unpackBlob } from './format';
import { deriveContentKey, derivePasswordKeys, generateLinkKey } from './keys';
import { computeAuthToken, decryptPayload, encryptPayload, parseLinkKey } from './index';
import type { PlainHeader } from './types';

const enc = new TextEncoder();
const dec = new TextDecoder();
const textHeader: PlainHeader = { v: 1, kind: 'text' };

/** base64url 문자열의 첫 글자를 다른 글자로 바꾼다 (마지막 글자는 버려지는 비트가 있어 피함) */
function tamperFirstChar(s: string): string {
  return (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
}

describe('평문 포맷', () => {
  it('encodePlain → decodePlain 왕복', () => {
    const header: PlainHeader = {
      v: 1,
      kind: 'file',
      name: '인증서.pem',
      mime: 'application/x-pem-file',
      size: 3,
    };
    const content = new Uint8Array([1, 2, 3]);
    const out = decodePlain(encodePlain(header, content));
    expect(out.header).toEqual(header);
    expect(out.content).toEqual(content);
  });

  it('앞 4바이트는 헤더 길이(big-endian)', () => {
    const plain = encodePlain(textHeader, new Uint8Array());
    const headerLen = enc.encode(JSON.stringify(textHeader)).length;
    expect(new DataView(plain.buffer).getUint32(0, false)).toBe(headerLen);
  });

  it('헤더 길이가 전체보다 길면 DecryptError', () => {
    const plain = encodePlain(textHeader, new Uint8Array());
    new DataView(plain.buffer).setUint32(0, 9999, false);
    expect(() => decodePlain(plain)).toThrow(DecryptError);
  });

  it('지원하지 않는 헤더 버전·종류는 DecryptError', () => {
    const bad = encodePlain({ v: 2, kind: 'text' } as unknown as PlainHeader, new Uint8Array());
    expect(() => decodePlain(bad)).toThrow(DecryptError);
  });

  it('헤더가 MAX_HEADER_BYTES를 넘으면 InvalidInputError', () => {
    const header: PlainHeader = { v: 1, kind: 'file', name: 'a'.repeat(2000) };
    expect(() => encodePlain(header, new Uint8Array())).toThrow(InvalidInputError);
  });
});

describe('저장 포맷', () => {
  it('packBlob → unpackBlob 왕복', () => {
    const iv = randomBytes(IV_BYTES);
    const ct = randomBytes(40);
    const blob = packBlob(iv, ct);
    expect(blob[0]).toBe(BLOB_VERSION);
    expect(blob.length).toBe(1 + IV_BYTES + 40);
    const out = unpackBlob(blob);
    expect(out.iv).toEqual(iv);
    expect(out.ciphertext).toEqual(ct);
  });

  it('버전이 다르면 거부', () => {
    const blob = packBlob(randomBytes(IV_BYTES), randomBytes(40));
    blob[0] = 0x02;
    expect(() => unpackBlob(blob)).toThrow(DecryptError);
  });

  it('너무 짧으면 거부', () => {
    expect(() => unpackBlob(new Uint8Array(10))).toThrow(DecryptError);
  });
});

describe('AES-256-GCM', () => {
  it('암호화 → 복호화 왕복, 암호문은 평문 + 16B', async () => {
    const key = await deriveContentKey(generateLinkKey());
    const iv = randomBytes(IV_BYTES);
    const plain = enc.encode('hello');
    const ct = await aesEncrypt(key, iv, plain);
    expect(ct.length).toBe(plain.length + 16);
    expect(await aesDecrypt(key, iv, ct)).toEqual(plain);
  });

  it('다른 열쇠로 풀면 DecryptError', async () => {
    const iv = randomBytes(IV_BYTES);
    const ct = await aesEncrypt(await deriveContentKey(generateLinkKey()), iv, enc.encode('x'));
    const other = await deriveContentKey(generateLinkKey());
    await expect(aesDecrypt(other, iv, ct)).rejects.toThrow(DecryptError);
  });
});

describe('encryptPayload / decryptPayload (비밀번호 없음)', () => {
  it('왕복', async () => {
    const content = enc.encode('DB_PASSWORD=hunter2\n');
    const { blob, linkKey, password } = await encryptPayload({ v: 1, kind: 'env' }, content);
    expect(linkKey).toHaveLength(43);
    expect(password).toBeUndefined();
    const out = await decryptPayload(blob, linkKey);
    expect(out.header).toEqual({ v: 1, kind: 'env' });
    expect(dec.decode(out.content)).toBe('DB_PASSWORD=hunter2\n');
  });

  it('blob에 평문·파일명이 그대로 보이지 않는다', async () => {
    const { blob } = await encryptPayload(
      { v: 1, kind: 'file', name: 'secret-name.pem' },
      enc.encode('top-secret-value'),
    );
    const asText = new TextDecoder('latin1').decode(blob);
    expect(asText).not.toContain('top-secret-value');
    expect(asText).not.toContain('secret-name');
  });

  it('linkKey 1글자 변조 시 DecryptError', async () => {
    const { blob, linkKey } = await encryptPayload(textHeader, enc.encode('hi'));
    await expect(decryptPayload(blob, tamperFirstChar(linkKey))).rejects.toThrow(DecryptError);
  });

  it('linkKey 1바이트(1비트)만 바뀌어도 DecryptError', async () => {
    const { blob, linkKey } = await encryptPayload(textHeader, enc.encode('hi'));
    const bytes = parseLinkKey(linkKey);
    bytes[0]! ^= 0x01;
    const { toBase64url } = await import('../base64url');
    await expect(decryptPayload(blob, toBase64url(bytes))).rejects.toThrow(DecryptError);
  });

  it('암호문 1바이트 변조 시 DecryptError', async () => {
    const { blob, linkKey } = await encryptPayload(textHeader, enc.encode('hi'));
    blob[blob.length - 1]! ^= 0xff;
    await expect(decryptPayload(blob, linkKey)).rejects.toThrow(DecryptError);
  });

  it('IV 1바이트 변조 시 DecryptError', async () => {
    const { blob, linkKey } = await encryptPayload(textHeader, enc.encode('hi'));
    blob[1]! ^= 0x01;
    await expect(decryptPayload(blob, linkKey)).rejects.toThrow(DecryptError);
  });

  it('같은 입력을 두 번 암호화하면 blob과 linkKey가 서로 다름', async () => {
    const a = await encryptPayload(textHeader, enc.encode('same'));
    const b = await encryptPayload(textHeader, enc.encode('same'));
    expect(a.blob).not.toEqual(b.blob);
    expect(a.linkKey).not.toBe(b.linkKey);
    expect(a.blob.subarray(1, 13)).not.toEqual(b.blob.subarray(1, 13));
  });

  it('잘린 링크 열쇠는 InvalidInputError (복호화 시도 전)', async () => {
    const { blob, linkKey } = await encryptPayload(textHeader, enc.encode('hi'));
    await expect(decryptPayload(blob, linkKey.slice(0, 30))).rejects.toThrow(InvalidInputError);
    expect(() => parseLinkKey('abc+def')).toThrow(InvalidInputError);
  });

  it('텍스트 크기 제한을 넘으면 InvalidInputError', async () => {
    await expect(encryptPayload(textHeader, new Uint8Array(MAX_TEXT_BYTES + 1))).rejects.toThrow(
      InvalidInputError,
    );
  });
});

describe('encryptPayload / decryptPayload (비밀번호 있음)', { timeout: 30_000 }, () => {
  it('같은 비밀번호로 왕복 성공, authToken은 computeAuthToken과 같다', async () => {
    const { blob, linkKey, password } = await encryptPayload(textHeader, enc.encode('pw-secret'), {
      password: '한글비번123',
    });
    expect(password).toBeDefined();
    expect(password!.iter).toBe(PBKDF2_ITERATIONS);
    const kdf = { salt: password!.salt, iter: password!.iter };

    expect(await computeAuthToken('한글비번123', kdf.salt, kdf.iter)).toBe(password!.authToken);
    const out = await decryptPayload(blob, linkKey, { password: '한글비번123', kdf });
    expect(dec.decode(out.content)).toBe('pw-secret');
  });

  it('비밀번호가 틀리면 DecryptError, 링크 열쇠만으로도 못 연다', async () => {
    const { blob, linkKey, password } = await encryptPayload(textHeader, enc.encode('x'), {
      password: 'right',
    });
    const kdf = { salt: password!.salt, iter: password!.iter };
    await expect(decryptPayload(blob, linkKey, { password: 'wrong', kdf })).rejects.toThrow(
      DecryptError,
    );
    await expect(decryptPayload(blob, linkKey)).rejects.toThrow(DecryptError);
  });

  it('pwKey와 authToken은 서로 다르고 각 32B', async () => {
    const { pwKey, authToken } = await derivePasswordKeys('pw', randomBytes(16), PBKDF2_ITERATIONS);
    expect(pwKey).toHaveLength(32);
    expect(authToken).toHaveLength(32);
    expect(pwKey).not.toEqual(authToken);
  });

  it('NFC/NFD로 입력된 같은 한글 비밀번호는 같은 결과', async () => {
    const salt = 'AAAAAAAAAAAAAAAAAAAAAA';
    const nfc = '가나다'.normalize('NFC');
    const nfd = '가나다'.normalize('NFD');
    expect(nfc).not.toBe(nfd);
    expect(await computeAuthToken(nfc, salt, PBKDF2_ITERATIONS)).toBe(
      await computeAuthToken(nfd, salt, PBKDF2_ITERATIONS),
    );
  });

  it('서버가 준 iter가 너무 낮거나 salt 길이가 틀리면 InvalidInputError', async () => {
    await expect(computeAuthToken('pw', 'AAAAAAAAAAAAAAAAAAAAAA', 1000)).rejects.toThrow(
      InvalidInputError,
    );
    await expect(computeAuthToken('pw', 'AAAA', PBKDF2_ITERATIONS)).rejects.toThrow(
      InvalidInputError,
    );
  });

  it('빈 비밀번호는 InvalidInputError', async () => {
    await expect(encryptPayload(textHeader, enc.encode('x'), { password: '' })).rejects.toThrow(
      InvalidInputError,
    );
  });
});
