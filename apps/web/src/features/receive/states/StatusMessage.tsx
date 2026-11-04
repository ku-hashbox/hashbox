import type { ReceiveState } from '../types';
import Notice from '../../../components/Notice';

type MessageState = Exclude<ReceiveState['type'], 'ready' | 'password' | 'opened'>;

/** 상태별 문구 (개발 기획서 8-3) */
const MESSAGES: Record<MessageState, { tone: 'info' | 'warning' | 'danger'; text: string }> = {
  loading: { tone: 'info', text: '불러오는 중이에요.' },
  opening: { tone: 'info', text: '여는 중이에요.' },
  'link-error': {
    tone: 'danger',
    text: '링크 끝부분이 잘린 것 같아요. 링크 전체를 복사했는지 확인하세요.',
  },
  'not-found': { tone: 'danger', text: '없는 링크예요.' },
  'decrypt-error': { tone: 'danger', text: '열쇠가 맞지 않아요. 링크가 정확한지 확인하세요.' },
  consumed: {
    tone: 'danger',
    text: '이미 열람된 링크예요. 본인이 연 게 아니라면 보낸 사람에게 알리고 키를 교체하세요.',
  },
  expired: { tone: 'warning', text: '만료된 링크예요. 보낸 사람에게 다시 요청하세요.' },
  revoked: { tone: 'warning', text: '보낸 사람이 파기한 링크예요.' },
  locked: { tone: 'danger', text: '비밀번호를 5번 틀려 삭제됐어요.' },
};

export default function StatusMessage(props: { state: MessageState }) {
  const m = MESSAGES[props.state];
  return <Notice tone={m.tone}>{m.text}</Notice>;
}
