import { useParams } from 'react-router-dom';
import { initialFragment } from '../lib/fragment';

export default function ReceivePage() {
  const { id } = useParams();
  const linkKey = initialFragment;

  return (
    <main>
      <h1>받기 화면 (FE 2 담당)</h1>
      <p>상자 번호: {id}</p>
      <p>열쇠: {linkKey ? '있음' : '없음 (링크가 잘렸을 수 있어요)'}</p>
    </main>
  );
}
