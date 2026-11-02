/**
 * 주소의 # 뒷부분(열쇠·관리 토큰)을 앱 시작 시 딱 한 번 읽고,
 * 즉시 주소창·방문 기록에서 지운다.
 * (React StrictMode는 컴포넌트 초기화를 두 번 실행하므로 컴포넌트 안에서 읽으면 안 된다)
 */
function consumeFragment(): string | null {
  const v = window.location.hash.slice(1);
  if (!v) return null;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return v;
}

export const initialFragment: string | null = consumeFragment();
