import type { SendPhase, SendStatus } from './useSend';
import Button from '../../components/Button';
import Notice from '../../components/Notice';

type StepPhase = Extract<SendPhase, 'encrypting' | 'registering' | 'uploading'>;

interface Step {
  phase: StepPhase;
  label: string;
}

const KEY_STEP: Step = { phase: 'encrypting', label: '비밀번호로 열쇠 만드는 중' };
const STEPS: Step[] = [
  { phase: 'encrypting', label: '브라우저에서 암호화' },
  { phase: 'registering', label: '상자 등록' },
  { phase: 'uploading', label: '암호문 올리는 중' },
];
const ORDER: StepPhase[] = ['encrypting', 'registering', 'uploading'];

/** 보내는 중·실패 화면 (FE1, screen 4) */
export default function SendProgress(props: {
  status: SendStatus;
  hasPassword: boolean;
  onRetry: () => void;
  onReset: () => void;
}) {
  const { status } = props;
  const isError = status.phase === 'error';
  // 비밀번호 열쇠 만들기와 암호화는 encryptPayload 한 번에 일어나므로 같은 단계로 묶어 표시한다
  const steps = props.hasPassword ? [KEY_STEP, ...STEPS] : STEPS;
  const at = isError ? (status.failedPhase ?? 'encrypting') : status.phase;
  const atIdx = at === 'done' ? ORDER.length : ORDER.indexOf(at as StepPhase);

  function stepState(step: Step): string {
    const i = ORDER.indexOf(step.phase);
    if (i < atIdx) return '완료';
    if (i > atIdx) return '대기';
    if (isError) return '실패';
    return step.phase === 'uploading' ? '올리는 중' : '진행 중';
  }

  return (
    <section className="card send" aria-busy={!isError}>
      <p className="intro">
        내용은 이 브라우저에서 잠긴 뒤 올라가요. 서버는 열쇠를 모르고, 링크는 정해진 횟수만 열려요.
      </p>

      <ol className="steps">
        {steps.map((step, i) => (
          <li className="step" key={step.label} data-state={stepState(step)}>
            <span>
              {i + 1}. {step.label}
            </span>
            <small>{stepState(step)}</small>
          </li>
        ))}
      </ol>
      {props.hasPassword && status.phase === 'encrypting' && (
        <p className="hint left">
          비밀번호로 열쇠를 만드는 중이에요. 몇 초 걸릴 수 있고, 휴대폰에서는 더 걸려요.
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
