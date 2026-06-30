import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, MUTATED_EVENT } from '../lib/api';
import { fmtDateTime } from '../lib/format';

// One actionable item the admin should look at, derived live by the backend.
interface NotifItem {
  id: string;
  kind: 'kyc' | 'claim' | 'payout' | 'support';
  title: string;
  body: string;
  time: string;
  link: string; // tab to open on click, e.g. 'users' | 'claims' | 'payouts' | 'support'
}

interface NotifResponse {
  count: number;
  groups: Record<string, number>;
  items: NotifItem[];
}

// How often to re-poll the badge while the panel is open.
const POLL_MS = 45_000;

// A coloured dot per kind so the list is scannable at a glance.
const KIND_DOT: Record<NotifItem['kind'], string> = {
  kyc: '#6366f1',
  claim: '#ef4444',
  payout: '#10b981',
  support: '#f59e0b',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifResponse | null>(null);
  const ddRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<{ data: NotifResponse }>('/admin/notifications')
      .then((r) => setData(r.data))
      .catch(() => {
        /* transient — keep the last good count */
      });
  }, []);

  // Poll on mount and on an interval; also refresh each time the menu opens.
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Re-fetch the moment an admin action completes (any successful mutation) or
  // when the tab regains focus, so the badge drops as soon as an item is cleared.
  useEffect(() => {
    window.addEventListener(MUTATED_EVENT, load);
    window.addEventListener('focus', load);
    return () => {
      window.removeEventListener(MUTATED_EVENT, load);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  // Close on outside-click / Escape, mirroring the theme dropdown.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const items = data?.items || [];
  const count = data?.count || 0;
  const badge = count > 99 ? '99+' : String(count);

  const openItem = (it: NotifItem) => {
    setOpen(false);
    navigate(`/${it.link}`);
  };

  return (
    <div className={`notif-dd ${open ? 'open' : ''}`} ref={ddRef}>
      <button
        className="notif-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={count ? `${count} notifications` : 'Notifications'}
        title="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
          />
        </svg>
        {count > 0 && <span className="notif-badge">{badge}</span>}
      </button>

      <div className="notif-menu" role="menu">
        <div className="notif-menu-h">
          <span>Notifications</span>
          {count > 0 && <span className="notif-menu-count">{count}</span>}
        </div>
        <div className="notif-list">
          {items.length === 0 ? (
            <div className="notif-empty">You're all caught up 🎉</div>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                className="notif-item"
                role="menuitem"
                type="button"
                onClick={() => openItem(it)}
              >
                <span className="notif-dot" style={{ background: KIND_DOT[it.kind] }} />
                <span className="notif-body">
                  <span className="notif-title">{it.title}</span>
                  <span className="notif-text">{it.body}</span>
                  <span className="notif-time">{fmtDateTime(it.time)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
