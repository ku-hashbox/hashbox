import { useState } from 'react';
import { EXPIRES_OPTIONS, VIEWS_OPTIONS } from '@hashbox/shared';
import type { ExpiresIn, MaxViews } from '@hashbox/shared';
import type { SendOptions } from './types';
import { MIN_PASSWORD_LENGTH, isPasswordTooShort, passwordLength } from './password';

const EXPIRES_LABEL: Record<ExpiresIn, string> = {
  600: '10분',
  3600: '1시간',
  86400: '1일',
  604800: '7일',
};

/** 만료 시간·열람 횟수(EXPIRES_OPTIONS, VIEWS_OPTIONS)와 비밀번호 (FE1) */
export default function OptionsPicker(props: {
  value: SendOptions;
  onChange: (v: SendOptions) => void;
}) {
  const { value, onChange } = props;
  const enabled = value.usePassword;
  const [show, setShow] = useState(false);

  function togglePw(on: boolean) {
    onChange({ ...value, usePassword: on, password: on ? value.password : '' });
  }

  return (
    <div className="options">
      <div className="field">
        <span className="field-label">만료</span>
        <div className="seg">
          {EXPIRES_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={value.expiresIn === s}
              onClick={() => onChange({ ...value, expiresIn: s })}
            >
              {EXPIRES_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">열람 횟수</span>
        <div className="seg">
          {VIEWS_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={value.maxViews === n}
              onClick={() => onChange({ ...value, maxViews: n })}
            >
              {n}회
            </button>
          ))}
        </div>
      </div>

      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => togglePw(e.target.checked)} />
        비밀번호 걸기
      </label>

      {enabled && (
        <div className="field pwfield">
          <div className="pwrow">
            <input
              type={show ? 'text' : 'password'}
              aria-label="비밀번호"
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`비밀번호 입력 (${MIN_PASSWORD_LENGTH}자 이상)`}
              value={value.password}
              onChange={(e) => onChange({ ...value, password: e.target.value })}
            />
            <button className="linklike" type="button" onClick={() => setShow(!show)}>
              {show ? '숨기기' : '보기'}
            </button>
          </div>
          {value.password !== '' && isPasswordTooShort(value.password) && (
            <p className="bytecount" data-over="true">
              {MIN_PASSWORD_LENGTH}자 이상 입력하세요 ({passwordLength(value.password)}/
              {MIN_PASSWORD_LENGTH})
            </p>
          )}
          <p className="hint left">
            비밀번호는 링크와 다른 방법으로 전달하세요. 5번 틀리면 상자가 삭제돼요.
          </p>
        </div>
      )}
    </div>
  );
}
