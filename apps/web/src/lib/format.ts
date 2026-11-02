/** 1536 → "1.5 KB" */
export function formatBytes(n: number): string {
  throw new Error('TODO: formatBytes');
}

/** 남은 시간 → "52분 후 만료" */
export function formatRemaining(expiresAt: number, now = Date.now()): string {
  throw new Error('TODO: formatRemaining');
}

/** 보내기 완료 화면에서 링크 조립 */
export function buildReceiveUrl(id: string, linkKey: string): string {
  return `${window.location.origin}/s/${id}#${linkKey}`;
}

export function buildManageUrl(manageToken: string): string {
  return `${window.location.origin}/m#${manageToken}`;
}
