import type {
  CreateShareRequest,
  CreateShareResponse,
  ErrorResponse,
  ManageResponse,
  ShareMetaResponse,
} from '@hashbox/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ErrorResponse | null,
  ) {
    super(body?.error.message ?? `API ${status}`);
  }
}

export async function health(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.ok;
}

export async function createShare(req: CreateShareRequest): Promise<CreateShareResponse> {
  throw new Error('TODO(FE1): createShare');
}

export async function uploadBlob(id: string, uploadToken: string, blob: Uint8Array): Promise<void> {
  throw new Error('TODO(FE1): uploadBlob');
}

export async function getShare(id: string): Promise<ShareMetaResponse> {
  throw new Error('TODO(FE2): getShare');
}

/** 성공 시 암호문 바이트. 실패 시 ApiError (401 WRONG_PASSWORD, 410 CONSUMED 등) */
export async function openShare(id: string, authToken?: string): Promise<Uint8Array> {
  throw new Error('TODO(FE2): openShare');
}

export async function getManage(manageToken: string): Promise<ManageResponse> {
  throw new Error('TODO(FE1): getManage');
}

export async function revokeShare(manageToken: string): Promise<void> {
  throw new Error('TODO(FE1): revokeShare');
}
