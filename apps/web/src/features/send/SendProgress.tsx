import type { SendStatus } from './useSend';
import Button from '../../components/Button';
import Notice from '../../components/Notice';

const STEPS = ['브라우저에서 암호화', '상자 등록', '암호문 올리는 중'];

/** 보내는 중·실패 화면 (FE1, screen 4) */
export default function SendProgress(props: {
  status: SendStatus;
  hasPassword: boolean;
  onRetry: () => void;
  onReset: () => void;
}) {
  const { status } = props;
  const isError = status.phase === 'error';
  const failedIdx = status.canRetryUpload ? 2 : 0;
  const activeIdx =
    status.phase === 'encrypting'
      ? 0
      : status.phase === 'registering'
        ? 1
        : status.phase === 'uploading'
          ? 2
          : status.phase === 'done'
            ? 3
            : failedIdx;

  function stepState(i: number): string {
    if (isError) return i < failedIdx ? '완료' : i === failedIdx ? '실패' : '대기';
    if (status.phase === 'done' || i < activeIdx) return '완료';
    if (i === activeIdx) return i === 2 ? '올리는 중' : '진행 중';
    return '대기';
  }

  return (
    <section className="card send">
      <p className="intro">
        내용은 이 브라우저에서 잠긴 뒤 올라가요. 서버는 열쇠를 모르고, 링크는 정해진 횟수만 열려요.
      </p>

      <div className="field">
        <div className="disabled-box">입력한 내용 (수정 불가)</div>
        <p className="hint left">만료·열람 횟수·비밀번호 옵션 (보내는 동안 모두 비활성)</p>
      </div>

      <ol className="steps">
        {STEPS.map((label, i) => (
          <li className="step" key={label} data-state={stepState(i)}>
            <span>
              {i + 1}. {label}
            </span>
            <small>{stepState(i)}</small>
          </li>
        ))}
      </ol>
      {props.hasPassword && (
        <p className="hint left">
          비밀번호를 걸면 맨 앞에 "비밀번호로 열쇠를 만드는 중" 단계가 추가돼요 (휴대폰은 좀 더
          걸려요).
        </p>
      )}

      {isError ? (
        <>
          <Notice tone="danger">
            {status.error ?? '업로드 중 연결이 끊겼어요. 다시 시도하세요.'}
          </Notice>
          <Button variant="primary" onClick={props.onRetry}>
            {status.canRetryUpload ? '업로드 다시 시도' : '다시 보내기'}
          </Button>
          {status.canRetryUpload && (
            <p className="hint">
              상자는 새로 만들지 않고 업로드만 다시 해요. 1시간이 지나면 처음부터 다시 보내야 해요.
            </p>
          )}
          <Button variant="ghost" onClick={props.onReset}>
            처음으로
          </Button>
        </>
      ) : (
        <Button variant="primary" disabled>
          보내는 중…
        </Button>
      )}
    </section>
  );
}
