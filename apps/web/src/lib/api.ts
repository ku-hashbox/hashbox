const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export async function health(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.ok;
}

// TODO(FE): createShare, uploadBlob, getShare, openShare, getManage, revoke
