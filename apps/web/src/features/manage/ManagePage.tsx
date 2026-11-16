import { useEffect, useState } from 'react';
import type { ManageResponse, ShareStatus } from '@hashbox/shared';
import { ApiError, deleteManage, getManage } from '../../lib/api';
import { initialFragment } from '../../lib/fragment';
import { formatRemaining } from '../../lib/format';
import Button from '../../components/Button';
import Notice from '../../components/Notice';

const STATUS_LABEL: Record<ShareStatus, string> = {
  pending: '업로드 안 됨',
  ready: '열람 대기 중',
  consumed: '열람 완료',
  expired: '만료됨',
  revoked: '파기됨',
  locked: '잠김',
};

/** 파기 버튼이 보이는 (아직 끝나지 않은) 상태 */
const REVOCABLE: ShareStatus[] = ['ready', 'pending'];

function fmtTime(epoch: number): string {
  return new Date(epoch).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 관리 화면 (FE1, screens 6-8) */
export default function ManagePage() {
  const [token] = useState<string | null>(initialFragment);
  const [data, setData] = useState<ManageResponse | null>(null);
  const [error, setError] = useState<'no-token' | 'not-found' | 'load' | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function load() {
    if (!token) {
      setError('no-token');
      return;
    }
    setLoading(true);
    try {
      const d = await getManage(token);
      setData(d);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiError && (e.status === 404 || e.status === 401) ? 'not-found' : 'load',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function revoke() {
    if (!token || revoking) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await deleteManage(token);
      setConfirming(false);
      await load();
    } catch {
      setRevokeError('파기하지 못했어요. 다시 시도하세요.');
    } finally {
      setRevoking(false);
    }
  }

  const header = (
    <>
      <h1>상자 관리</h1>
      <p className="intro">보낸 사람만 볼 수 있는 화면이에요.</p>
    </>
  );

  if (error === 'no-token') {
    return (
      <section className="card manage">
        {header}
        <Notice tone="info">
          관리 링크를 처음부터 다시 열어주세요. 보안을 위해 링크의 # 뒷부분은 페이지를 연 직후
          주소창에서 지워지므로, 새로고침하면 다시 쓸 수 없어요.
        </Notice>
      </section>
    );
  }

  if (error === 'not-found') {
    return (
      <section className="card manage">
        {header}
        <Notice tone="warning">
          관리 링크가 올바르지 않거나, 기록이 정리된 상자예요 (끝난 뒤 7일 보존).
        </Notice>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="card manage">
        {header}
        {loading && <p className="hint">불러오는 중…</p>}
        {error === 'load' && (
          <Notice tone="danger">
            상태를 불러오지 못했어요.{' '}
            <button className="linklike" type="button" onClick={load}>
              다시 시도
            </button>
          </Notice>
        )}
      </section>
    );
  }

  const opened = data.maxViews - data.viewsLeft;
  const canRevoke = REVOCABLE.includes(data.status);

  return (
    <section className="card manage">
      {header}

      <div className="statusline">
        <strong>
          <span className="dot" data-active={canRevoke} /> {STATUS_LABEL[data.status]}
        </strong>
        <button className="linklike" type="button" onClick={load}>
          새로고침
        </button>
      </div>

      <dl className="kv">
        <div>
          <dt>열람</dt>
          <dd>
            {opened} / {data.maxViews}회 (남은 횟수 {data.viewsLeft}회)
          </dd>
        </div>
        <div>
          <dt>처음 열린 시각</dt>
          <dd>{data.firstOpenedAt ? fmtTime(data.firstOpenedAt) : '아직 안 열림'}</dd>
        </div>
        <div>
          <dt>마지막으로 열린 시각</dt>
          <dd>{data.lastOpenedAt ? fmtTime(data.lastOpenedAt) : '아직 안 열림'}</dd>
        </div>
        <div>
          <dt>만료</dt>
          <dd>
            {fmtTime(data.expiresAt)} ({formatRemaining(data.expiresAt)})
          </dd>
        </div>
      </dl>

      {data.firstOpenedAt && (
        <p className="hint left">
          받는 사람이 연 결과와 맞는지 확인하세요. 모르는 시각에 열렸다면 링크가 새어 나간 것이니
          키를 바로 교체하세요.
        </p>
      )}

      {canRevoke ? (
        confirming ? (
          <div className="confirm">
            <Notice tone="danger">
              파기하면 받는 사람이 더 이상 열 수 없고, 되돌릴 수 없어요.
            </Notice>
            {revokeError && <p className="hint left">{revokeError}</p>}
            <div className="confirm-actions">
              <Button variant="primary" disabled={revoking} onClick={revoke}>
                {revoking ? '파기하는 중…' : '파기'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            지금 파기하기
          </Button>
        )
      ) : (
        <p className="hint left">끝난 상자(열람 완료·만료·파기됨·잠김)는 파기 버튼이 없어요.</p>
      )}
    </section>
  );
}
