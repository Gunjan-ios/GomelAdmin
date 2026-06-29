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

// Aggressively compress an image in the browser before upload: re-encode to
// JPEG, downscale so the longest side is <= maxDim px, and apply a low quality.
// Mirrors the mobile app's settings so Cloudinary uploads stay tiny. Returns
// the original file untouched if it isn't a compressible image or anything
// fails (e.g. SVG, or a decode error).
async function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.55,
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // White backdrop so transparent PNGs don't turn black when encoded to JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;
    // Don't bother if compression somehow made it bigger.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Upload a single image file to /uploads (multipart) and return its URL.
// Note: no Content-Type header — the browser sets the multipart boundary.
export async function uploadFile(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const fd = new FormData();
  fd.append('file', compressed);
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
