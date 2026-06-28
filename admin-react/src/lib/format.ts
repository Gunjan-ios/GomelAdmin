// ---------------- Formatting helpers ----------------
// Ported 1:1 from the vanilla panel. Note: JSX escapes text by default, so the
// original `esc()` is unnecessary in React — it is intentionally NOT ported.

// Only treat a stored image as web-loadable if it's an absolute http(s) URL,
// a data URI, or a server-relative path. Older records can hold a phone's local
// file path that 404s, so we render a placeholder instead.
export function imgSrc(s: string | undefined | null): string {
  const str = String(s ?? '');
  // Rewrite any /uploads/ URL to a path on the admin's own origin so it loads
  // regardless of the host it was saved with.
  const up = str.match(/\/uploads\/[^?#]+(?:[?#].*)?$/);
  if (up && /^https?:\/\//.test(str)) return up[0];
  return /^(https?:|data:|\/uploads\/)/.test(str) ? str : '';
}

export function money(n: number | undefined | null): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

export function fmtDate(d: string | number | Date | undefined | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

export function fmtDateTime(d: string | number | Date | undefined | null): string {
  return d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

export function fmtTime(d: string | number | Date | undefined | null): string {
  return d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
}

// Pretty Indian phone "+91 98765 43210" from any stored form. Mirrors backend
// src/utils/phone.js.
export function fmtPhone(raw: string | undefined | null): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (!d) return '—';
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : `+91 ${d}`;
}
