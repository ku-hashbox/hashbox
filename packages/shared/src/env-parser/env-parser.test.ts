import { describe, expect, it } from 'vitest';
import { envKeyEntries, isEnvFileName, parseEnv, serializeEnv } from './index';

const kv = (text: string) => envKeyEntries(parseEnv(text)).map((e) => [e.key, e.value] as const);

describe('parseEnv: 기본 규칙 (기획서 8-2)', () => {
  it('KEY=VALUE 줄을 key, value로 나눈다', () => {
    expect(kv('A=1\nB=hello world\nC=')).toEqual([
      ['A', '1'],
      ['B', 'hello world'],
      ['C', ''],
    ]);
  });

  it('export 접두사와 = 앞뒤 공백을 허용한다', () => {
    expect(kv('export A=1\nB = 2\n  export   C=3')).toEqual([
      ['A', '1'],
      ['B', '2'],
      ['C', '3'],
    ]);
  });

  it('따옴표 값: raw는 원문 그대로, value는 따옴표를 벗긴 값', () => {
    const [a, b] = parseEnv(`A="x y"\nB='p@ss'`);
    expect(a!.raw).toBe('A="x y"');
    expect(a!.value).toBe('x y');
    expect(b!.raw).toBe(`B='p@ss'`);
    expect(b!.value).toBe('p@ss');
  });

  it('주석과 빈 줄은 ignorable', () => {
    const e = parseEnv('# 설명\n\n   \nA=1\n  # 들여쓴 주석');
    expect(e.map((x) => x.ignorable)).toEqual([true, true, true, false, true]);
  });

  it('= 가 없거나 키가 이상한 줄은 invalid', () => {
    const e = parseEnv('JUST_TEXT\n1ABC=x\nA-B C=1\nKEY: value');
    expect(e.every((x) => x.invalid && x.key === undefined)).toBe(true);
  });

  it('줄 번호는 1부터, CRLF·BOM도 처리', () => {
    const e = parseEnv('\uFEFFA=1\r\nB=2\r\n');
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ line: 1, key: 'A', value: '1', raw: 'A=1' });
    expect(e[1]).toMatchObject({ line: 2, key: 'B', value: '2' });
  });
});

describe('parseEnv: 실제 .env에서 자주 나오는 형태', () => {
  it('따옴표 안 여러 줄 값(PEM 개인 키)을 한 항목으로 묶는다', () => {
    const text = [
      'A=1',
      'PRIVATE_KEY="-----BEGIN PRIVATE KEY-----',
      'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
      '-----END PRIVATE KEY-----"',
      'B=2',
    ].join('\n');
    const e = parseEnv(text);
    expect(e).toHaveLength(3);
    expect(e[1]).toMatchObject({
      line: 2,
      endLine: 4,
      key: 'PRIVATE_KEY',
      value:
        '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----',
    });
    expect(e[2]).toMatchObject({ line: 5, key: 'B' });
  });

  it('큰따옴표 안 \\n 이스케이프를 풀고, 작은따옴표는 그대로 둔다', () => {
    expect(kv(`A="line1\\nline2"\nB='raw\\n'\nC="say \\"hi\\""`)).toEqual([
      ['A', 'line1\nline2'],
      ['B', 'raw\\n'],
      ['C', 'say "hi"'],
    ]);
  });

  it('따옴표 없는 값은 공백 뒤 # 부터 주석, 붙어 있는 #은 값', () => {
    expect(kv('A=abc # 메모\nB=abc#def\nC="x # y" # 주석')).toEqual([
      ['A', 'abc'],
      ['B', 'abc#def'],
      ['C', 'x # y'],
    ]);
  });

  it('URL·base64처럼 = 이 들어간 값', () => {
    expect(kv('DB=postgres://u:p@h:5432/db?ssl=true\nK=YWJj==')).toEqual([
      ['DB', 'postgres://u:p@h:5432/db?ssl=true'],
      ['K', 'YWJj=='],
    ]);
  });

  it('닫는 따옴표가 없으면 그 줄만 invalid, 다음 줄은 정상 해석', () => {
    const e = parseEnv('A="never closed\nB=2\nC=3');
    expect(e[0]).toMatchObject({ invalid: true, line: 1 });
    expect(kv('A="never closed\nB=2\nC=3')).toEqual([
      ['B', '2'],
      ['C', '3'],
    ]);
  });

  it('닫는 따옴표 뒤에 주석 외의 글자가 있으면 invalid', () => {
    expect(parseEnv('A="x"y')[0]!.invalid).toBe(true);
  });

  it('같은 키가 여러 번 나오면 마지막만 적용, 앞의 것은 overridden', () => {
    const e = parseEnv('A=1\nB=2\nA=3');
    expect(e.map((x) => x.overridden ?? false)).toEqual([true, false, false]);
  });

  it('닫히지 않은 따옴표가 큰 입력에서도 빨리 끝난다', () => {
    const big = 'A="' + '\nx'.repeat(20_000);
    const t = performance.now();
    parseEnv(big);
    expect(performance.now() - t).toBeLessThan(500);
  });
});

describe('serializeEnv', () => {
  it('선택한 줄을 원래 순서로 합친다 (raw 기준, 끝 줄바꿈 1개)', () => {
    const e = parseEnv('# c\nA=1\nB="x"\nC=3 # memo');
    const picked = [e[3]!, e[1]!]; // 순서를 섞어서 넘겨도
    expect(serializeEnv(picked)).toBe('A=1\nC=3 # memo\n');
  });

  it('여러 줄 값도 원문 그대로 복원', () => {
    const text = 'K="a\nb\nc"\nZ=1\n';
    expect(serializeEnv(parseEnv(text))).toBe(text);
  });

  it('전체를 다시 합치면 원문과 같다 (CRLF는 LF로)', () => {
    const text = '# top\nexport A=1\n\nB = "q"\n';
    expect(serializeEnv(parseEnv(text))).toBe(text);
    expect(serializeEnv(parseEnv('A=1\r\nB=2\r\n'))).toBe('A=1\nB=2\n');
  });

  it('아무것도 선택하지 않으면 빈 문자열', () => {
    expect(serializeEnv([])).toBe('');
  });
});

describe('isEnvFileName', () => {
  it.each(['.env', '.env.local', '.env.production', '.env.example', 'prod.env', 'apps/api/.env'])(
    '%s → true',
    (name) => expect(isEnvFileName(name)).toBe(true),
  );
  it.each(['env.txt', '.envrc', 'env', 'my.env.txt', '.env.', 'config.json'])(
    '%s → false',
    (name) => expect(isEnvFileName(name)).toBe(false),
  );
});
