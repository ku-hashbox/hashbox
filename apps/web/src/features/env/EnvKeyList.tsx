import { useEffect, useState } from 'react';
import { MAX_TEXT_BYTES, parseEnv, serializeEnv } from '@hashbox/shared';
import type { EnvEntry } from '@hashbox/shared';
import type { SendPayload } from '../send/types';
import Button from '../../components/Button';
import { formatBytes } from '../../lib/format';

const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const encoder = new TextEncoder();

/**
 * .env 모드 (FE1)
 * 붙여넣기 → parseEnv → 키 목록(체크박스, 값 가림, 보기 버튼) → 선택한 줄만 serializeEnv
 */
export default function EnvKeyList(props: {
  onPayload: (p: SendPayload | null) => void;
  /** 파일 탭에서 넘어온 .env 파일 내용 */
  initialText?: string;
}) {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reveal, setReveal] = useState<Set<number>>(new Set());
  const [raw, setRaw] = useState('');
  /** 입력 중인 원문. 타이핑할 때마다 파싱하지 않고, 붙여넣기·버튼에서만 파싱한다 */
  const [draft, setDraft] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);

  useEffect(() => {
    if (props.initialText) load(props.initialText);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyEntries = entries.filter((e) => e.key);
  const invalidEntries = entries.filter((e) => e.invalid);
  const selectedKeyCount = keyEntries.filter((e) => selected.has(e.line)).length;

  function emit(all: EnvEntry[], sel: Set<number>) {
    const chosen = all.filter((e) => sel.has(e.line));
    if (chosen.length === 0) {
      setTooBig(false);
      props.onPayload(null);
      return;
    }
    const content = encoder.encode(serializeEnv(chosen));
    const over = content.length > MAX_TEXT_BYTES;
    setTooBig(over);
    props.onPayload(over ? null : { header: { v: 1, kind: 'env' }, content });
  }

  function load(text: string) {
    setRaw(text);
    const parsed = parseEnv(text);
    setEntries(parsed);
    const all = new Set(parsed.filter((e) => e.key).map((e) => e.line));
    setSelected(all);
    emit(parsed, all);
  }

  function toggle(line: number) {
    const next = new Set(selected);
    if (next.has(line)) next.delete(line);
    else next.add(line);
    setSelected(next);
    emit(entries, next);
  }

  function toggleAll() {
    // 키 줄만 켜고 끈다. 해석 불가 줄의 선택은 그대로 둔다.
    const next = new Set(selected);
    const allOn = keyEntries.every((e) => next.has(e.line));
    for (const e of keyEntries) {
      if (allOn) next.delete(e.line);
      else next.add(e.line);
    }
    setSelected(next);
    emit(entries, next);
  }

  function toggleReveal(line: number) {
    const next = new Set(reveal);
    if (next.has(line)) next.delete(line);
    else next.add(line);
    setReveal(next);
  }

  function addManual() {
    const key = newKey.trim();
    if (!key) return;
    if (!KEY_NAME.test(key)) {
      setAddError('키는 영문·숫자·_ 만 쓸 수 있고, 숫자로 시작할 수 없어요.');
      return;
    }
    if (keyEntries.some((e) => e.key === key)) {
      setAddError('이미 있는 키예요.');
      return;
    }
    if (/[\r\n]/.test(newVal)) {
      setAddError('값에 줄바꿈은 넣을 수 없어요.');
      return;
    }
    setAddError(null);
    // 여러 줄 값(PEM 등)은 endLine까지 차지하므로 끝 줄 기준으로 다음 번호를 정한다
    const maxLine = entries.reduce((m, e) => Math.max(m, e.endLine), 0);
    const entry: EnvEntry = {
      line: maxLine + 1,
      endLine: maxLine + 1,
      raw: `${key}=${newVal}`,
      key,
      value: newVal,
      ignorable: false,
      invalid: false,
    };
    const next = [...entries, entry];
    const sel = new Set(selected);
    sel.add(entry.line);
    setEntries(next);
    setSelected(sel);
    setNewKey('');
    setNewVal('');
    emit(next, sel);
  }

  if (keyEntries.length === 0) {
    return (
      <div className="field">
        <label className="field-label" htmlFor="env-paste">
          .env 붙여넣기
        </label>
        <textarea
          id="env-paste"
          placeholder="KEY=VALUE 형식의 .env 내용을 붙여넣으세요."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (!pasted) return;
            e.preventDefault();
            // 커서 위치(선택 영역)에 붙여넣는다
            const el = e.currentTarget;
            const text = draft.slice(0, el.selectionStart) + pasted + draft.slice(el.selectionEnd);
            setDraft('');
            load(text);
          }}
        />
        {raw.trim() !== '' && (
          <p className="hint left">
            KEY=VALUE 형식의 줄을 찾지 못했어요. 그대로 보내려면 텍스트 탭을 이용하세요.
          </p>
        )}
        <Button
          variant="ghost"
          type="button"
          disabled={draft.trim() === ''}
          onClick={() => {
            const text = draft;
            setDraft('');
            load(text);
          }}
        >
          키 목록 보기
        </Button>
      </div>
    );
  }

  /** 목록을 닫고, 지금까지의 내용(직접 추가한 키 포함)을 입력 칸으로 되돌려 고칠 수 있게 한다 */
  function editSource() {
    setDraft(serializeEnv(entries));
    setEntries([]);
    setSelected(new Set());
    setReveal(new Set());
    setRaw('');
    setAddError(null);
    setTooBig(false);
    props.onPayload(null);
  }

  const allSelected = selectedKeyCount === keyEntries.length;
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
        전체 선택{' '}
        <span className="muted">
          {selectedKeyCount}/{keyEntries.length}개 선택
        </span>
      </label>

      <div className="envlist">
        {keyEntries.map((e) => (
          <div className="envrow" key={e.line}>
            <input
              type="checkbox"
              checked={selected.has(e.line)}
              onChange={() => toggle(e.line)}
              aria-label={e.key}
            />
            <code>{e.key}</code>
            <span className="envval">{reveal.has(e.line) ? e.value || '(빈 값)' : '••••••'}</span>
            <button className="linklike" type="button" onClick={() => toggleReveal(e.line)}>
              {reveal.has(e.line) ? '가림' : '보기'}
            </button>
          </div>
        ))}
      </div>

      {invalidEntries.length > 0 && (
        <div className="field">
          <p className="hint left">
            해석할 수 없는 줄 {invalidEntries.length}개 (여러 줄 값 등). 체크하면 원문 그대로, 원래
            순서에 맞춰 보내요.
          </p>
          <div className="envlist">
            {invalidEntries.map((e) => (
              <div className="envrow" key={e.line}>
                <input
                  type="checkbox"
                  checked={selected.has(e.line)}
                  onChange={() => toggle(e.line)}
                  aria-label={`${e.line}번째 줄`}
                />
                <code>{e.line}번째 줄</code>
                <span className="envval">{reveal.has(e.line) ? e.raw : '••••••'}</span>
                <button className="linklike" type="button" onClick={() => toggleReveal(e.line)}>
                  {reveal.has(e.line) ? '가림' : '보기'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">키 직접 추가</span>
        <div className="addrow">
          <input placeholder="KEY" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input placeholder="VALUE" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          <button className="linklike" type="button" onClick={addManual}>
            추가
          </button>
        </div>
        {addError && (
          <p className="bytecount" data-over="true">
            {addError}
          </p>
        )}
      </div>

      {tooBig && (
        <p className="bytecount" data-over="true">
          너무 커요. 선택한 내용은 최대 {formatBytes(MAX_TEXT_BYTES)}까지 보낼 수 있어요.
        </p>
      )}

      <button className="linklike" type="button" onClick={editSource}>
        원문 수정하기
      </button>
    </div>
  );
}
