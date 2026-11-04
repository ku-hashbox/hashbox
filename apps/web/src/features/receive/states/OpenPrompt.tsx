import type { ShareMetaResponse } from '@hashbox/shared';

/** 열기 전: 종류·크기·남은 시간·횟수 + "열기" 버튼. 여기까지는 차감 없음 (FE2) */
export default function OpenPrompt(props: { meta: ShareMetaResponse; onOpen: () => void }) {
  return (
    <section>
      <h1>비밀 메시지가 도착했어요</h1>
      <p>열면 서버에서 삭제돼요.</p>
      {/* TODO(FE2): 메타 정보 표시 */}
      <button onClick={props.onOpen}>열기</button>
    </section>
  );
}
