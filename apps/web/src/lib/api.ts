import type {
  CreateShareRequest,
  CreateShareResponse,
  ErrorCode,
  ErrorResponse,
  ManageResponse,
  ShareMetaResponse,
} from '@hashbox/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export class ApiError extends Error {
  /** 서버가 준 오류 코드. JSON 본문이 없으면 null */
  readonly code: ErrorCode | null;
  /** WRONG_PASSWORD일 때 남은 시도 횟수 */
  readonly attemptsLeft: number | undefined;

  constructor(
    public status: number,
    public body: ErrorResponse | null,
  ) {
    super(body?.error.message ?? `API ${status}`);
    this.name = 'ApiError';
    this.code = body?.error.code ?? null;
    this.attemptsLeft = body?.error.attemptsLeft;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: ErrorResponse | null = null;
  try {
    body = (await res.json()) as ErrorResponse;
  } catch {
    /* no JSON body */
  }
  return new ApiError(res.status, body);
}

export async function health(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.ok;
}

export async function createShare(req: CreateShareRequest): Promise<CreateShareResponse> {
  const res = await fetch(`${API_BASE}/api/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as CreateShareResponse;
}

export async function uploadBlob(id: string, uploadToken: string, blob: Uint8Array): Promise<void> {
  const res = await fetch(`${API_BASE}/api/shares/${id}/blob`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      Authorization: `Bearer ${uploadToken}`,
    },
    body: blob as BodyInit,
  });
  if (!res.ok) throw await toApiError(res);
}

export async function getShare(id: string): Promise<ShareMetaResponse> {
  throw new Error('TODO(FE2): getShare');
}

/** 성공 시 암호문 바이트. 실패 시 ApiError (401 WRONG_PASSWORD, 410 CONSUMED 등) */
export async function openShare(id: string, authToken?: string): Promise<Uint8Array> {
  throw new Error('TODO(FE2): openShare');
}

export async function getManage(manageToken: string): Promise<ManageResponse> {
  const res = await fetch(`${API_BASE}/api/manage`, {
    headers: { Authorization: `Bearer ${manageToken}` },
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as ManageResponse;
}

export async function deleteManage(manageToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/manage`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${manageToken}` },
  });
  if (!res.ok) throw await toApiError(res);
}
