// ---------------- Theme core ----------------
// Ported from the vanilla panel's theme picker. The pre-paint inline script in
// index.html applies the initial theme; this keeps it in sync at runtime.

export const THEME_KEY = 'gomel_admin_theme';

export type ThemePref = 'light' | 'dark' | 'system';

export interface ThemeDef {
  id: ThemePref;
  label: string;
  desc: string;
  icon: string; // raw SVG markup
  sw: string; // swatch class
}

export const SVG = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  chev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
};

export const THEMES: ThemeDef[] = [
  { id: 'light', label: 'Light', desc: 'Always light', icon: SVG.sun, sw: 'sw-light' },
  { id: 'dark', label: 'Dark', desc: 'Always dark', icon: SVG.moon, sw: 'sw-dark' },
  { id: 'system', label: 'System', desc: 'Match your device', icon: SVG.system, sw: 'sw-system' },
];

export const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  return (localStorage.getItem(THEME_KEY) as ThemePref) || 'system';
}

export function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  return pref === 'dark' || (pref === 'system' && prefersDark.matches) ? 'dark' : 'light';
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
}

export function setThemePref(pref: ThemePref): void {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
  // Notify other mounts (Settings tiles ⇆ topbar dropdown) to repaint.
  window.dispatchEvent(new Event('themechange'));
}

// Mini app-preview swatch markup (styled in CSS by the .sw-* class).
export const swatchHtml = (kind: string): string =>
  `<span class="sw ${kind}"><span class="sw-rail"></span><span class="sw-line l1"></span><span class="sw-line l2"></span><span class="sw-dot"></span></span>`;
