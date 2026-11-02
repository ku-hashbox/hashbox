import type { PlainHeader } from '@hashbox/shared';

/** 파일: 원래 이름·크기 + 다운로드 (Blob URL 사용 후 즉시 revoke) (FE2) */
export default function FileView(props: { header: PlainHeader; content: Uint8Array }) {
  return <div>파일 다운로드 (TODO FE2)</div>;
}
