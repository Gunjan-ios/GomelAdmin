import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api, uploadFile } from '../lib/api';
import { money, fmtDate } from '../lib/format';
import { toast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { THEMES, getThemePref, setThemePref, type ThemePref } from '../theme/theme';
import { Swatch } from '../theme/Swatch';
import type { AdminUser, AppConfig, Envelope, LoyaltyTier, Maintenance } from '../lib/types';

const STRENGTH = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STR_COLOR = ['var(--c-red)', 'var(--c-red)', 'var(--c-amber)', 'var(--c-blue)', 'var(--c-green)'];

const TIER_COLORS: Record<string, string> = {
  bronze: '#b08d57',
  silver: '#9aa6c4',
  gold: 'var(--c-amber)',
  platinum: 'var(--c-cyan)',
};

// CSS custom properties aren't in React's CSSProperties type; this lets us set them.
const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---- Profile hero (signed-in admin) ----
function ProfileHero({ admin }: { admin: AdminUser }) {
  const initials = (admin.name || admin.email || 'A').trim().charAt(0).toUpperCase();
  const memberSince = admin.createdAt ? fmtDate(admin.createdAt) : null;
  return (
    <div className="set-hero">
      <div className="set-hero-cover" />
      <div className="set-hero-body">
        <div className="set-avatar">
          {admin.avatarUrl ? <img src={admin.avatarUrl} alt="" /> : initials}
        </div>
        <div className="set-hero-info">
          <div className="set-hero-name">{admin.name || 'Administrator'}</div>
          <div className="set-hero-mail">{admin.email || '—'}</div>
        </div>
        <div className="set-hero-badge">
          <span className="set-role">
            <i style={cssVars({ '--icon': 'var(--ic-shield)' })} />
            Administrator
          </span>
        </div>
      </div>
      <div className="set-hero-meta">
        <div className="set-chip">
          <span className="set-chip-l">Role</span>
          <span className="set-chip-v">Full access</span>
        </div>
        <div className="set-chip">
          <span className="set-chip-l">Status</span>
          <span className="set-chip-v ok">● Active</span>
        </div>
        <div className="set-chip">
          <span className="set-chip-l">Member since</span>
          <span className="set-chip-v">{memberSince || '—'}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Edit profile (avatar upload + name/email) ----
function ProfileCard({ admin, setAdmin }: { admin: AdminUser; setAdmin: (u: AdminUser) => void }) {
  const initials = (admin.name || admin.email || 'A').trim().charAt(0).toUpperCase();
  const [name, setName] = useState(admin.name || '');
  const [email, setEmail] = useState(admin.email || '');
  const [pic, setPic] = useState(admin.avatarUrl || '');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    name.trim() !== (admin.name || '') ||
    email.trim() !== (admin.email || '') ||
    pic !== (admin.avatarUrl || '');

  const pickFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      setPic(await uploadFile(file));
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      const { data } = await api<Envelope<AdminUser>>('/admin/profile', {
        method: 'PATCH',
        body: { name: name.trim(), email: email.trim(), avatarUrl: pic },
      });
      setAdmin(data);
      toast('Profile updated');
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card set-card">
      <div className="set-card-head">
        <span className="set-card-ic" style={cssVars({ '--c': 'var(--c-indigo)' })}>
          <i style={cssVars({ '--icon': 'var(--ic-users)' })} />
        </span>
        <div>
          <h2>Profile</h2>
          <p>Update your photo, name and email.</p>
        </div>
      </div>
      <div className="set-profile">
        <div className={`set-pic${busy ? ' busy' : ''}`}>
          <div className="set-pic-img">{pic ? <img src={pic} alt="" /> : initials}</div>
          <button type="button" className="set-pic-cam" aria-label="Change photo" onClick={pickFile} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>
        <div className="set-pic-side">
          <div className="set-pic-actions">
            <button type="button" className="btn ghost sm" onClick={pickFile}>
              Change photo
            </button>
            <button
              type="button"
              className="btn danger sm"
              style={{ display: pic ? '' : 'none' }}
              onClick={() => setPic('')}
            >
              Remove
            </button>
          </div>
          <p className="set-pic-hint">JPG or PNG. A square image looks best.</p>
        </div>
      </div>
      <div className="set-fields">
        <div className="set-field">
          <label>Full name</label>
          <div className="set-input">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <div className="set-field">
          <label>Email</label>
          <div className="set-input">
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="error set-err">{err}</div>
        <div className="set-actions">
          <button className="btn" disabled={!dirty || saving} onClick={save}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Password & security ----
function SecurityCard() {
  const [cur, setCur] = useState('');
  const [np, setNp] = useState('');
  const [np2, setNp2] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const checks = {
    len: np.length >= 8,
    case: /[a-z]/.test(np) && /[A-Z]/.test(np),
    num: /\d/.test(np),
    match: np.length > 0 && np === np2,
  };

  let score = 0;
  if (np.length >= 8) score++;
  if (np.length >= 12) score++;
  if (/[a-z]/.test(np) && /[A-Z]/.test(np)) score++;
  if (/\d/.test(np)) score++;
  if (/[^A-Za-z0-9]/.test(np)) score++;
  score = Math.min(4, score);
  const pct = np ? Math.max(12, (score / 4) * 100) : 0;

  const canSave = !!(cur && checks.len && checks.match);

  const save = async () => {
    setErr('');
    if (!cur || !np) {
      setErr('Fill in all fields.');
      return;
    }
    if (np.length < 8) {
      setErr('New password must be at least 8 characters.');
      return;
    }
    if (np !== np2) {
      setErr('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api('/admin/change-password', {
        method: 'POST',
        body: { currentPassword: cur, newPassword: np },
      });
      toast('Password updated');
      setCur('');
      setNp('');
      setNp2('');
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card set-card">
      <div className="set-card-head">
        <span className="set-card-ic" style={cssVars({ '--c': 'var(--c-blue)' })}>
          <i style={cssVars({ '--icon': 'var(--ic-lock)' })} />
        </span>
        <div>
          <h2>Password &amp; security</h2>
          <p>Use a strong, unique password for the admin account.</p>
        </div>
      </div>
      <div className="set-sec">
        <div className="set-field">
          <label>Current password</label>
          <div className="set-input">
            <input
              type={showCur ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter current password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
            />
            <button
              type="button"
              className={`set-eye${showCur ? ' on' : ''}`}
              aria-label="Show password"
              onClick={() => setShowCur((s) => !s)}
            />
          </div>
        </div>
        <div className="set-field">
          <label>New password</label>
          <div className="set-input">
            <input
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a new password"
              value={np}
              onChange={(e) => setNp(e.target.value)}
            />
            <button
              type="button"
              className={`set-eye${showNew ? ' on' : ''}`}
              aria-label="Show password"
              onClick={() => setShowNew((s) => !s)}
            />
          </div>
          <div className="set-meter">
            <span
              className="set-meter-bar"
              style={{ width: pct + '%', background: np ? STR_COLOR[score] : 'transparent' }}
            />
          </div>
          <div className="set-meter-label" style={{ color: np ? STR_COLOR[score] : 'var(--text-3)' }}>
            {np ? STRENGTH[score] : 'Password strength'}
          </div>
        </div>
        <div className="set-field">
          <label>Confirm new password</label>
          <div className="set-input">
            <input
              type={showNew2 ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={np2}
              onChange={(e) => setNp2(e.target.value)}
            />
            <button
              type="button"
              className={`set-eye${showNew2 ? ' on' : ''}`}
              aria-label="Show password"
              onClick={() => setShowNew2((s) => !s)}
            />
          </div>
        </div>
        <ul className="set-reqs">
          <li className={checks.len ? 'met' : ''}>At least 8 characters</li>
          <li className={checks.case ? 'met' : ''}>Upper &amp; lowercase letters</li>
          <li className={checks.num ? 'met' : ''}>Contains a number</li>
          <li className={checks.match ? 'met' : ''}>Both passwords match</li>
        </ul>
        <div className="error set-err">{err}</div>
        <div className="set-actions">
          <button className="btn" disabled={!canSave || saving} onClick={save}>
            Update password
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Appearance tiles (reuse shared theme helpers) ----
function AppearanceCard() {
  const [pref, setPref] = useState<ThemePref>(getThemePref());

  useEffect(() => {
    const onThemeChange = () => setPref(getThemePref());
    window.addEventListener('themechange', onThemeChange);
    return () => window.removeEventListener('themechange', onThemeChange);
  }, []);

  const pick = (id: ThemePref) => {
    setThemePref(id);
    setPref(id);
  };

  return (
    <div className="card set-card">
      <div className="set-card-head">
        <span className="set-card-ic" style={cssVars({ '--c': 'var(--c-violet)' })}>
          <i style={cssVars({ '--icon': 'var(--ic-palette)' })} />
        </span>
        <div>
          <h2>Appearance</h2>
          <p>Choose how the panel looks.</p>
        </div>
      </div>
      <div className="set-themes">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`set-theme ${t.id === pref ? 'active' : ''}`}
            onClick={() => pick(t.id)}
          >
            <Swatch kind={t.sw} />
            <span className="set-theme-l">{t.label}</span>
            <span className="set-theme-d">{t.desc}</span>
            <span className="set-theme-check" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Maintenance mode ----
function MaintenanceCard() {
  const [on, setOn] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    api<Envelope<Maintenance>>('/admin/maintenance')
      .then(({ data }) => {
        if (!alive) return;
        setOn(!!data.maintenanceMode);
        setSavedMsg(data.maintenanceMessage || '');
        setMsg(data.maintenanceMessage || '');
        setLoaded(true);
      })
      .catch((e) => {
        if (alive) setErr(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async () => {
    setErr('');
    setToggling(true);
    try {
      const { data } = await api<Envelope<Maintenance>>('/admin/maintenance', {
        method: 'PATCH',
        body: { maintenanceMode: !on },
      });
      const next = !!data.maintenanceMode;
      setOn(next);
      toast(next ? 'Maintenance mode ON' : 'Maintenance mode OFF');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setToggling(false);
    }
  };

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      const { data } = await api<Envelope<Maintenance>>('/admin/maintenance', {
        method: 'PATCH',
        body: { maintenanceMessage: msg.trim() },
      });
      const next = data.maintenanceMessage || '';
      setSavedMsg(next);
      setMsg(next);
      toast('Maintenance message saved');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const pillCls = !loaded ? 'pill gray' : `pill ${on ? 'bad' : 'ok'}`;
  const pillText = !loaded ? 'Loading…' : on ? '● On' : '● Off';
  const hint = !loaded ? '' : on ? 'Customer & host apps are offline.' : 'Apps are live for everyone.';
  const toggleCls = !loaded ? 'btn ghost sm' : `btn sm ${on ? '' : 'danger'}`;
  const toggleText = !loaded ? '—' : on ? 'Turn off' : 'Turn on';
  const saveDisabled = !loaded || saving || msg.trim() === savedMsg;

  return (
    <div className="card set-card">
      <div className="set-card-head">
        <span className="set-card-ic" style={cssVars({ '--c': 'var(--c-red)' })}>
          <i style={cssVars({ '--icon': 'var(--ic-alert)' })} />
        </span>
        <div>
          <h2>Maintenance mode</h2>
          <p>Take the customer &amp; host apps offline.</p>
        </div>
      </div>
      <div className="set-maint">
        <div className="set-maint-row">
          <div className="set-maint-state">
            <span className={pillCls}>{pillText}</span>
            <span className="set-maint-hint">{hint}</span>
          </div>
          <button type="button" className={toggleCls} disabled={!loaded || toggling} onClick={toggle}>
            {toggleText}
          </button>
        </div>
        <div className="set-field">
          <label>Message shown to users</label>
          <textarea
            rows={3}
            placeholder="We'll be back shortly…"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
        </div>
        <div className="error set-err">{err}</div>
        <div className="set-actions">
          <button className="btn" disabled={saveDisabled} onClick={save}>
            Save message
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Application config (read-only) ----
function ConfigBody({ cfg }: { cfg: AppConfig }) {
  const tiers: LoyaltyTier[] = (cfg.loyaltyTiers || []).slice().sort((x, y) => x.min - y.min);
  return (
    <>
      <div className="set-cfg-row">
        <span className="set-cfg-l">Platform commission</span>
        <span className="set-cfg-v">{Math.round((cfg.platformCommissionRate || 0) * 100)}%</span>
      </div>
      <div className="set-cfg-row">
        <span className="set-cfg-l">Referral reward</span>
        <span className="set-cfg-v">{money(cfg.referralReward)}</span>
      </div>
      <div className="set-cfg-row">
        <span className="set-cfg-l">Loyalty earn rate</span>
        <span className="set-cfg-v">{cfg.loyaltyEarnRate || 0} pt / ₹</span>
      </div>
      <div className="set-cfg-tiers">
        <span className="set-cfg-l">Loyalty tiers</span>
        <div className="set-tier-row">
          {tiers.map((t) => (
            <span
              key={t.tier}
              className="set-tier"
              style={cssVars({ '--tc': TIER_COLORS[t.tier] || 'var(--text-3)' })}
            >
              {t.tier} <em>{t.min}+</em>
            </span>
          ))}
        </div>
      </div>
      <p className="set-cfg-note">
        Read-only · edit in <code>config/business.js</code>
      </p>
    </>
  );
}

function ConfigCard() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    api<Envelope<AppConfig>>('/admin/config')
      .then(({ data }) => {
        if (alive) setCfg(data);
      })
      .catch((e) => {
        if (alive) setErr(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="card set-card">
      <div className="set-card-head">
        <span className="set-card-ic" style={cssVars({ '--c': 'var(--c-amber)' })}>
          <i style={cssVars({ '--icon': 'var(--ic-sliders)' })} />
        </span>
        <div>
          <h2>Application config</h2>
          <p>Business rules locked with the client.</p>
        </div>
      </div>
      <div className="set-config">
        {err ? (
          <div className="set-config-loading">{err}</div>
        ) : !cfg ? (
          <div className="set-config-loading">Loading…</div>
        ) : (
          <ConfigBody cfg={cfg} />
        )}
      </div>
    </div>
  );
}

export function Settings() {
  const { admin, setAdmin } = useAuth();
  const a = admin || {};

  return (
    <div className="set-wrap">
      <ProfileHero admin={a} />
      <div className="set-grid">
        <div className="set-main">
          <ProfileCard admin={a} setAdmin={setAdmin} />
          <SecurityCard />
        </div>
        <div className="set-side">
          <AppearanceCard />
          <MaintenanceCard />
          <ConfigCard />
        </div>
      </div>
    </div>
  );
}
