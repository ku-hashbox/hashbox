import { useState } from 'react';

/** 복사 버튼: 성공 시 "복사됨" 표시 (FE2) */
export default function CopyButton(props: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return <button onClick={copy}>{copied ? '복사됨' : (props.label ?? '복사')}</button>;
}
