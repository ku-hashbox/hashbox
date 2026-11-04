import type { SendOptions } from './types';

/** 만료 시간·열람 횟수(EXPIRES_OPTIONS, VIEWS_OPTIONS)와 비밀번호 (FE1) */
export default function OptionsPicker(props: {
  value: SendOptions;
  onChange: (v: SendOptions) => void;
}) {
  return <div>옵션 선택 (TODO FE1)</div>;
}
