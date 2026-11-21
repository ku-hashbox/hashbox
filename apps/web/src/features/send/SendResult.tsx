import type { SendDone } from './types';
import CopyButton from '../../components/CopyButton';
import Notice from '../../components/Notice';
import Button from '../../components/Button';
import { formatRemaining } from '../../lib/format';

/** 완료 화면: 받기 링크, 관리 링크, 비밀번호 별도 전달 안내 (FE1, screen 5) */
export default function SendResult(props: { result: SendDone; onReset: () => void }) {
  const { result } = props;
  return (
    <section className="card result">
      <h1>링크가 만들어졌어요</h1>
      <p className="intro">
        {result.maxViews}회 열람 가능 · {formatRemaining(result.expiresAt)}
      </p>

      <div className="field">
        <label className="field-label">
          받기 링크 <span className="muted">(받는 사람에게 보내세요)</span>
        </label>
        <div className="linkrow">
          <input readOnly value={result.receiveUrl} />
          <CopyButton text={result.receiveUrl} label="복사" />
        </div>
      </div>

      {result.hasPassword && (
        <Notice tone="info">비밀번호는 링크와 다른 방법으로 전달하세요.</Notice>
      )}

      <div className="field">
        <label className="field-label">
          관리 링크 <span className="muted">(나만 보관)</span>
        </label>
        <div className="linkrow">
          <input readOnly value={result.manageUrl} />
          <CopyButton text={result.manageUrl} label="복사" />
          <Button
            variant="ghost"
            onClick={() => window.open(result.manageUrl, '_blank', 'noopener')}
          >
            열기
          </Button>
        </div>
      </div>

      <Notice tone="warning">
        이 링크는 다시 볼 수 없어요. 따로 보관하세요. 열람 여부 확인과 즉시 파기할 때 필요해요.
      </Notice>

      <Button variant="primary" onClick={props.onReset}>
        다른 내용 보내기
      </Button>
    </section>
  );
}
