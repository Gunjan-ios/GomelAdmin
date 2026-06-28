import { useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemePicker } from '../theme/ThemePicker';

// Sidebar nav — [path, label]. Order and labels match the original panel.
const NAV: [string, string][] = [
  ['dashboard', 'Dashboard'],
  ['cars', 'Cars'],
  ['bookings', 'Bookings'],
  ['users', 'Users'],
  ['claims', 'Claims'],
  ['reviews', 'Reviews'],
  ['offers', 'Offers'],
  ['rewards', 'Rewards'],
  ['subscriptions', 'Membership'],
  ['payouts', 'Payouts'],
  ['support', 'Support'],
  ['broadcast', 'Notify'],
  ['settings', 'Settings'],
];

// Page titles shown in the topbar (some differ from the nav label).
export const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  cars: 'Cars',
  bookings: 'Bookings',
  users: 'Users',
  claims: 'Damage claims',
  reviews: 'Reviews & ratings',
  offers: 'Promo codes',
  rewards: 'Reward redeem options',
  subscriptions: 'Membership',
  payouts: 'Host payouts',
  support: 'Support',
  broadcast: 'Send notification',
  settings: 'Settings',
};

export function Layout() {
  const { admin, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const tab = location.pathname.replace(/^\//, '') || 'dashboard';
  const title = TITLES[tab] || 'Dashboard';

  const whoName = (admin && (admin.name || admin.email)) || 'Admin';
  const whoStyle = admin?.avatarUrl
    ? ({ '--who-avatar': `url("${admin.avatarUrl}")` } as CSSProperties)
    : undefined;

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`} id="app">
      <div className="sidebar-scrim" onClick={() => setNavOpen(false)} />
      <aside className="sidebar">
        <div className="brand">
          <img src="logo.png" alt="GoMel" className="brand-logo" /> GoMel
        </div>
        <nav>
          {NAV.map(([path, label]) => (
            <NavLink
              key={path}
              to={`/${path}`}
              data-tab={path}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setNavOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button className="logout" onClick={logout}>
          Sign out
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((o) => !o)}
            />
            <h1 id="pageTitle">{title}</h1>
          </div>
          <div className="topbar-right">
            <ThemePicker />
            <span className={`who ${admin?.avatarUrl ? 'has-avatar' : ''}`} style={whoStyle}>
              {whoName}
            </span>
          </div>
        </header>
        <section className="view">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
