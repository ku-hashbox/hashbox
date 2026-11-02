import { useEffect, useState } from 'react';
import { DEFAULT_EXPIRES, DEFAULT_VIEWS } from '@hashbox/shared';
import { health } from '../lib/api';

export default function SendPage() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  useEffect(() => {
    health()
      .then(setApiOk)
      .catch(() => setApiOk(false));
  }, []);

  return (
    <main>
      <h1>Hashbox</h1>
      <p>보내기 화면 (FE 1 담당)</p>
      <p>
        기본값: {DEFAULT_EXPIRES / 60}분 · {DEFAULT_VIEWS}회
      </p>
      <p>API 연결: {apiOk === null ? '확인 중' : apiOk ? '정상' : '실패'}</p>
    </main>
  );
}
