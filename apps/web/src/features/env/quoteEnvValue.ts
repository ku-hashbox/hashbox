/** 따옴표 없이 보내도 받는 쪽 파서가 그대로 읽는 글자만 */
const PLAIN = /^[A-Za-z0-9_\-./:@+=,%]*$/;

/**
 * "키 직접 추가"에서 입력한 값을 .env 한 줄에 넣을 형태로 바꾼다.
 * 파서(packages/shared/src/env-parser)는 따옴표 없는 값을 ` #`에서 자르고 앞뒤 공백을 지우며,
 * 따옴표로 시작하면 따옴표 값으로 읽는다. 그래서 평범하지 않은 값은 큰따옴표로 감싸고
 * 파서가 되돌리는 이스케이프(\\ \" \n \r)만 쓴다.
 */
export function quoteEnvValue(value: string): string {
  if (PLAIN.test(value)) return value;
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `"${escaped}"`;
}
