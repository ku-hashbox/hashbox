import { useState } from 'react';
import { MAX_TEXT_BYTES } from '@hashbox/shared';
import { formatBytes } from '../../lib/format';
import type { SendPayload } from './types';

const encoder = new TextEncoder();

/** 텍스트 붙여넣기 (FE1). MAX_TEXT_BYTES 초과 시 안내 */
export default function TextInput(props: { onPayload: (p: SendPayload | null) => void }) {
  const [text, setText] = useState('');
  const bytes = encoder.encode(text);
  const over = bytes.length > MAX_TEXT_BYTES;

  function onChange(v: string) {
    setText(v);
    const b = encoder.encode(v);
    if (v.trim() === '' || b.length > MAX_TEXT_BYTES) {
      props.onPayload(null);
    } else {
      props.onPayload({ header: { v: 1, kind: 'text' }, content: b });
    }
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor="send-text">
        보낼 내용
      </label>
      <textarea
        id="send-text"
        placeholder="API 키, 비밀번호, 메모 등 보낼 내용을 붙여넣으세요."
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="bytecount" data-over={over}>
        {over ? '너무 길어요 · ' : ''}
        {formatBytes(bytes.length)} / {formatBytes(MAX_TEXT_BYTES)}
      </div>
    </div>
  );
}
