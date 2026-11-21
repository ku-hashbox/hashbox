/** 1536 → "1.5KB" */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const s = Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
  return `${s}${units[i]}`;
}

/** 남은 시간 → "52분 후 만료" */
export function formatRemaining(expiresAt: number, now = Date.now()): string {
  const ms = expiresAt - now;
  if (ms <= 0) return '만료됨';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(1, min)}분 후 만료`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 후 만료`;
  const day = Math.floor(hr / 24);
  return `${day}일 후 만료`;
}

/** 보내기 완료 화면에서 링크 조립 */
export function buildReceiveUrl(id: string, linkKey: string): string {
  return `${window.location.origin}/s/${id}#${linkKey}`;
}

export function buildManageUrl(manageToken: string): string {
  return `${window.location.origin}/m#${manageToken}`;
}
