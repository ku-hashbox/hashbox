import type { ReactNode } from 'react';

/** 안내·경고 박스 (FE2) */
export default function Notice(props: {
  tone: 'info' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return (
    <div role={props.tone === 'danger' ? 'alert' : 'status'} data-tone={props.tone}>
      {props.children}
    </div>
  );
}
