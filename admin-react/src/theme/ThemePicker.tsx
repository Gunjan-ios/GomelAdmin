import { useEffect, useRef, useState } from 'react';
import {
  THEMES,
  SVG,
  applyTheme,
  getThemePref,
  prefersDark,
  setThemePref,
  type ThemePref,
} from './theme';
import { Swatch } from './Swatch';

// Topbar appearance dropdown, ported from initThemePicker().
export function ThemePicker() {
  const [pref, setPref] = useState<ThemePref>(getThemePref());
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(pref);
  }, [pref]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onSystem = () => {
      if (getThemePref() === 'system') applyTheme('system');
    };
    // Keep in sync when the theme changes elsewhere (Settings tiles).
    const onThemeChange = () => setPref(getThemePref());
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    prefersDark.addEventListener('change', onSystem);
    window.addEventListener('themechange', onThemeChange);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      prefersDark.removeEventListener('change', onSystem);
      window.removeEventListener('themechange', onThemeChange);
    };
  }, []);

  const cur = THEMES.find((t) => t.id === pref) || THEMES[2];

  const pick = (id: ThemePref) => {
    setPref(id);
    setThemePref(id);
    setOpen(false);
  };

  return (
    <div className={`theme-dd ${open ? 'open' : ''}`} ref={ddRef}>
      <button
        className="theme-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Appearance"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="ti" dangerouslySetInnerHTML={{ __html: cur.icon }} />
        <span className="tl">{cur.label}</span>
        <span className="chev" dangerouslySetInnerHTML={{ __html: SVG.chev }} />
      </button>
      <div className="theme-menu" role="menu">
        <div className="theme-menu-h">Appearance</div>
        {THEMES.map((t) => {
          const active = t.id === pref;
          return (
            <button
              key={t.id}
              className={`theme-opt ${active ? 'active' : ''}`}
              role="menuitemradio"
              aria-checked={active}
              type="button"
              onClick={() => pick(t.id)}
            >
              <Swatch kind={t.sw} />
              <span className="ot">
                <span className="ol">{t.label}</span>
                <span className="od">{t.desc}</span>
              </span>
              <span className="radio" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
