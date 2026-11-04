import { describe, it } from 'vitest';

describe('env-parser', () => {
  it.todo('KEY=VALUE 줄을 key, value로 나눈다');
  it.todo('export 접두사를 허용한다');
  it.todo('따옴표 값은 원문 그대로 유지한다');
  it.todo('주석과 빈 줄은 ignorable');
  it.todo('= 가 없는 줄은 invalid');
  it.todo('serializeEnv는 선택한 줄을 원래 순서로 합친다');
  it.todo('isEnvFileName: .env, .env.local, .env.production → true / env.txt → false');
});
