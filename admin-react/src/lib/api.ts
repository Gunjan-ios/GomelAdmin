// ---------------- HTTP helper ----------------
// Same-origin API, mirroring the original vanilla panel. The token lives in
// localStorage; AuthContext keeps the in-memory copy here in sync via setToken.

export const API = `${location.origin}/api`;

const TOKEN_KEY = 'gomel_admin_token';

let token = localStorage.getItem(TOKEN_KEY) || '';

export function getToken(): string {
  return token;
}

export function setToken(next: string): void {
  token = next || '';
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions {
  method?: string;
  body?: unknown;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body } = opts;
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const message = (data as { message?: string }).message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

// Upload a single image file to /uploads (multipart) and return its URL.
// Note: no Content-Type header — the browser sets the multipart boundary.
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(API + '/uploads', {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const message = (data as { message?: string }).message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return (data as { url: string }).url;
}
