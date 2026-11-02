/** .env 파서. 규칙은 개발 기획서 8-2 */

export interface EnvEntry {
  /** 원래 줄 번호 (1부터) */
  line: number;
  /** 원문 그대로 */
  raw: string;
  /** 해석 가능한 KEY=VALUE 줄이면 채워짐 */
  key?: string;
  value?: string;
  /** 주석·빈 줄 */
  ignorable: boolean;
  /** KEY=VALUE로 해석할 수 없는 줄 */
  invalid: boolean;
}

/**
 * - KEY=VALUE 한 줄씩, `export ` 접두사 허용
 * - 따옴표는 원문 유지
 * - # 주석·빈 줄은 ignorable
 * - 해석 불가 줄은 invalid
 */
export function parseEnv(text: string): EnvEntry[] {
  throw new Error('TODO: parseEnv');
}

/** 선택된 줄만 원래 순서대로 다시 합친다 (원문 raw 기준) */
export function serializeEnv(entries: EnvEntry[]): string {
  throw new Error('TODO: serializeEnv');
}

/** 파일 이름이 .env, .env.local 같은 형태인지 */
export function isEnvFileName(name: string): boolean {
  throw new Error('TODO: isEnvFileName');
}
