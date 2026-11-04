import { useEffect, useState } from 'react';
import { health } from '../lib/api';

/** 개발 중 API 연결 확인용 표시. 배포 전에 지워도 됨 */
export default function ApiStatus() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    health()
      .then(setOk)
      .catch(() => setOk(false));
  }, []);
  return <small>API 연결: {ok === null ? '확인 중' : ok ? '정상' : '실패'}</small>;
}
