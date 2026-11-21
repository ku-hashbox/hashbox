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

const KEY_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

/** 따옴표로 시작했는데 같은 줄에서 닫히지 않으면 여러 줄 값 → 해석 불가 */
function opensUnclosedQuote(value: string): boolean {
  const q = value[0];
  if (q !== '"' && q !== "'") return false;
  return value.indexOf(q, 1) === -1;
}

/**
 * - KEY=VALUE 한 줄씩, `export ` 접두사 허용
 * - 따옴표는 원문 유지
 * - # 주석·빈 줄은 ignorable
 * - 해석 불가 줄은 invalid
 */
export function parseEnv(text: string): EnvEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: EnvEntry[] = lines.map((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      return { line, raw, ignorable: true, invalid: false };
    }
    const m = raw.match(KEY_RE);
    if (m) {
      const value = (m[2] ?? '').trim();
      if (opensUnclosedQuote(value)) return { line, raw, ignorable: false, invalid: true };
      return { line, raw, key: m[1], value, ignorable: false, invalid: false };
    }
    return { line, raw, ignorable: false, invalid: true };
  });
  // 마지막 줄이 파일 끝 개행으로 생긴 빈 줄이면 버린다
  if (entries.length > 1) {
    const last = entries[entries.length - 1];
    if (last && last.ignorable && last.raw === '') entries.pop();
  }
  return entries;
}

/** 선택된 줄만 원래 순서대로 다시 합친다 (원문 raw 기준) */
export function serializeEnv(entries: EnvEntry[]): string {
  return entries.map((e) => e.raw).join('\n');
}

/** 파일 이름이 .env, .env.local 같은 형태인지 */
export function isEnvFileName(name: string): boolean {
  const base = (name.split(/[\\/]/).pop() ?? name).trim();
  return /^\.env(\.[A-Za-z0-9_.-]+)?$/.test(base) || /\.env$/.test(base);
}
