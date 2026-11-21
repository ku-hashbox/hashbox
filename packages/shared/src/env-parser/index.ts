/**
 * .env 파서. 기본 규칙은 개발 기획서 8-2, 거기에 실제 .env에서 자주 나오는 형태를 더했다.
 *
 * - `KEY=VALUE`, `export KEY=VALUE`, `KEY = VALUE` (= 앞뒤 공백 허용)
 * - 따옴표 값: "..." / '...' / `...`. 따옴표 안의 줄바꿈 허용(개인 키 PEM 등 여러 줄 값)
 * - 큰따옴표 안에서는 \n \r \t \" \\ 를 해석한다(dotenv와 같음). 작은따옴표·백틱은 그대로
 * - 따옴표 없는 값은 앞에 공백이 있는 ` #`부터를 주석으로 본다. `abc#def`의 #은 값의 일부
 * - # 주석·빈 줄은 ignorable, 해석할 수 없는 줄은 invalid
 * - 같은 키가 여러 번 나오면 마지막 것이 적용되고, 앞의 것은 overridden
 *
 * `raw`는 항상 원문 그대로다. 다운로드·전송은 raw로 다시 조립하므로 해석 규칙이 틀려도 원본이 바뀌지 않는다.
 * `value`는 받기 화면의 키별 복사·미리보기에만 쓴다.
 */

export interface EnvEntry {
  /** 원래 줄 번호 (1부터). 여러 줄 값이면 시작 줄 */
  line: number;
  /** 끝 줄 번호. 한 줄짜리면 line과 같다 */
  endLine: number;
  /** 원문 그대로 (여러 줄 값이면 줄바꿈 포함) */
  raw: string;
  /** 해석 가능한 KEY=VALUE 줄이면 채워짐 */
  key?: string;
  /** 따옴표를 벗기고 이스케이프를 풀고 주석을 뗀 실제 값 */
  value?: string;
  /** 주석·빈 줄 */
  ignorable: boolean;
  /** KEY=VALUE로 해석할 수 없는 줄 */
  invalid: boolean;
  /** 같은 키가 뒤에 또 있어서 적용되지 않는 줄 */
  overridden?: boolean;
}

const ASSIGN_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=[ \t]*(.*)$/;
const QUOTES = new Set(['"', "'", '`']);

export function parseEnv(text: string): EnvEntry[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  // 파일 끝 줄바꿈 때문에 생기는 마지막 빈 줄은 버린다
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();

  const entries: EnvEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    const lineText = lines[i]!;
    const lineNo = i + 1;
    const trimmed = lineText.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      entries.push(simple(lineNo, lineText, { ignorable: true }));
      i++;
      continue;
    }

    const m = ASSIGN_RE.exec(lineText);
    if (!m) {
      entries.push(simple(lineNo, lineText, { invalid: true }));
      i++;
      continue;
    }

    const key = m[1]!;
    const rest = m[2]!;
    const q = rest[0];

    if (q !== undefined && QUOTES.has(q)) {
      const quoted = readQuoted(lines, i, lineText.length - rest.length, q);
      if (!quoted) {
        // 닫는 따옴표가 없음: 이 줄만 invalid로 두고 다음 줄부터 다시 해석
        entries.push(simple(lineNo, lineText, { invalid: true }));
        i++;
        continue;
      }
      entries.push({
        line: lineNo,
        endLine: quoted.endIndex + 1,
        raw: lines.slice(i, quoted.endIndex + 1).join('\n'),
        key,
        value: q === '"' ? unescapeDouble(quoted.inner) : quoted.inner,
        ignorable: false,
        invalid: false,
      });
      i = quoted.endIndex + 1;
      continue;
    }

    entries.push({
      line: lineNo,
      endLine: lineNo,
      raw: lineText,
      key,
      value: stripInlineComment(rest),
      ignorable: false,
      invalid: false,
    });
    i++;
  }

  markOverridden(entries);
  return entries;
}

/**
 * 선택된 줄만 원래 순서대로 다시 합친다 (원문 raw 기준). 끝에 줄바꿈 하나를 붙인다.
 * 보내기 화면에서는 체크한 항목만 넘기면 된다.
 */
export function serializeEnv(entries: EnvEntry[]): string {
  if (entries.length === 0) return '';
  return (
    [...entries]
      .sort((a, b) => a.line - b.line)
      .map((e) => e.raw)
      .join('\n') + '\n'
  );
}

/** 키가 있는(목록에 보여줄) 항목만 */
export function envKeyEntries(entries: EnvEntry[]): EnvEntry[] {
  return entries.filter((e) => e.key !== undefined);
}

/**
 * 파일 이름이 .env 형태인지. 드래그 앤 드롭 시 .env 탭 자동 전환에 쓴다.
 * - `.env`, `.env.local`, `.env.production`, `.env.example`
 * - `prod.env`, `backend.env` (docker compose 등에서 흔한 형태)
 */
export function isEnvFileName(name: string): boolean {
  const base = name.split(/[\\/]/).pop() ?? '';
  return /^\.env(\.[A-Za-z0-9_-]+)*$/.test(base) || /^[A-Za-z0-9_.-]+\.env$/.test(base);
}

// ---- 내부 ----

function simple(
  line: number,
  raw: string,
  flags: { ignorable?: boolean; invalid?: boolean },
): EnvEntry {
  return {
    line,
    endLine: line,
    raw,
    ignorable: flags.ignorable ?? false,
    invalid: flags.invalid ?? false,
  };
}

/**
 * lines[start]의 col 위치에 있는 여는 따옴표 q부터 닫는 따옴표를 찾는다.
 * 줄을 넘어가도 이어서 찾고, 이미 본 글자는 다시 보지 않는다(입력 크기에 선형).
 * 닫는 따옴표 뒤에는 공백이나 # 주석만 올 수 있다.
 */
function readQuoted(
  lines: string[],
  start: number,
  col: number,
  q: string,
): { inner: string; endIndex: number } | null {
  const parts: string[] = [];
  let lineIdx = start;
  let pos = col + 1;
  let escaped = false;

  while (lineIdx < lines.length) {
    const s = lines[lineIdx]!;
    for (let k = pos; k < s.length; k++) {
      const c = s[k]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\' && q === '"') {
        escaped = true;
        continue;
      }
      if (c === q) {
        const tail = s.slice(k + 1).trim();
        if (tail !== '' && !tail.startsWith('#')) return null;
        parts.push(s.slice(pos, k));
        return { inner: parts.join('\n'), endIndex: lineIdx };
      }
    }
    parts.push(s.slice(pos));
    escaped = false; // 줄 끝의 \ 는 다음 줄 첫 글자에 영향을 주지 않는다
    lineIdx++;
    pos = 0;
  }
  return null;
}

function unescapeDouble(s: string): string {
  return s.replace(/\\([nrt"\\])/g, (_, c: string) =>
    c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c,
  );
}

function stripInlineComment(rest: string): string {
  const m = /\s#/.exec(rest);
  return (m ? rest.slice(0, m.index) : rest).trim();
}

function markOverridden(entries: EnvEntry[]): void {
  const seen = new Set<string>();
  for (let k = entries.length - 1; k >= 0; k--) {
    const e = entries[k]!;
    if (e.key === undefined) continue;
    if (seen.has(e.key)) e.overridden = true;
    else seen.add(e.key);
  }
}
