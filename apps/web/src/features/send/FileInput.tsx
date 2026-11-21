import { useRef, useState } from 'react';
import { MAX_FILE_BYTES, MAX_TEXT_BYTES, isEnvFileName } from '@hashbox/shared';
import { formatBytes } from '../../lib/format';
import type { SendPayload } from './types';

/** 파일 선택·드래그 앤 드롭 (FE1). MAX_FILE_BYTES 초과 시 안내, .env 파일이면 env 탭으로 전환 */
export default function FileInput(props: {
  onPayload: (p: SendPayload | null) => void;
  onEnvFile?: (text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f: File | null) {
    if (!f) return;
    // 작은 .env 파일은 내용을 읽어 .env 탭으로 넘긴다. 큰 파일은 일반 파일로 보낸다.
    if (isEnvFileName(f.name) && props.onEnvFile && f.size > 0 && f.size <= MAX_TEXT_BYTES) {
      props.onEnvFile(await f.text());
      return;
    }
    if (f.size === 0) {
      setError('빈 파일은 보낼 수 없어요.');
      setFile(null);
      props.onPayload(null);
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(`파일이 너무 커요. 최대 ${formatBytes(MAX_FILE_BYTES)}까지 보낼 수 있어요.`);
      setFile(null);
      props.onPayload(null);
      return;
    }
    const buf = new Uint8Array(await f.arrayBuffer());
    setError(null);
    setFile({ name: f.name, size: f.size });
    props.onPayload({
      header: {
        v: 1,
        kind: 'file',
        name: f.name,
        mime: f.type || 'application/octet-stream',
        size: f.size,
      },
      content: buf,
    });
  }

  function clear() {
    setFile(null);
    setError(null);
    props.onPayload(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="field">
      <div
        className="dropzone"
        data-active={active}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setActive(false);
          pick(e.dataTransfer.files[0] ?? null);
        }}
      >
        {file ? (
          <>
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)} · 눌러서 다른 파일 선택</span>
          </>
        ) : (
          <>
            <strong>파일을 끌어서 놓거나 눌러서 선택</strong>
            <span>1개, 최대 {formatBytes(MAX_FILE_BYTES)}</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      {file && (
        <button className="linklike" type="button" onClick={clear}>
          선택 취소
        </button>
      )}
      {error && (
        <p className="bytecount" data-over="true">
          {error}
        </p>
      )}
    </div>
  );
}
