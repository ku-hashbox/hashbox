import { describe, expect, it } from 'vitest';
import { fromBase64url, randomBytes, toBase64url } from './base64url';

describe('base64url', () => {
  it('32바이트 열쇠는 43자로 인코딩되고 그대로 복원된다', () => {
    const key = randomBytes(32);
    const s = toBase64url(key);
    expect(s).toHaveLength(43);
    expect(s).not.toMatch(/[+/=]/);
    expect(fromBase64url(s)).toEqual(key);
  });

  it('잘못된 문자가 있으면 거부한다', () => {
    expect(() => fromBase64url('abc+def')).toThrow();
  });
});
