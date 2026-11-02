import { initialFragment } from '../lib/fragment';

export default function ManagePage() {
  const manageToken = initialFragment;
  return (
    <main>
      <h1>관리 화면 (FE 1 담당)</h1>
      <p>관리 토큰: {manageToken ? '있음' : '없음'}</p>
    </main>
  );
}
