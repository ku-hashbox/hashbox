import { initialFragment } from '../../lib/fragment';

/** 관리 화면 (FE1): getManage로 상태 카드, 파기 버튼(페이지 안 확인 단계) */
export default function ManagePage() {
  const manageToken = initialFragment;
  if (!manageToken) return <p>관리 링크가 올바르지 않아요.</p>;
  return <section>관리 화면 (TODO FE1)</section>;
}
