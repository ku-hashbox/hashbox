import type { SendDone } from './types';
import CopyButton from '../../components/CopyButton';
import Notice from '../../components/Notice';

/** 완료 화면: 받기 링크, 관리 링크, 비밀번호 별도 전달 안내 (FE1) */
export default function SendResult(props: { result: SendDone; onReset: () => void }) {
  const { result } = props;
  return (
    <section>
      <h1>링크가 만들어졌어요</h1>
      <p>{result.receiveUrl}</p>
      <CopyButton text={result.receiveUrl} label="받기 링크 복사" />
      <p>{result.manageUrl}</p>
      <CopyButton text={result.manageUrl} label="관리 링크 복사" />
      <Notice tone="warning">관리 링크는 다시 볼 수 없어요. 따로 보관하세요.</Notice>
      {result.hasPassword && (
        <Notice tone="info">비밀번호는 링크와 다른 방법으로 전달하세요.</Notice>
      )}
      <button onClick={props.onReset}>새로 보내기</button>
    </section>
  );
}
