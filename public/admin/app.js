'use strict';

// API base — same origin as the panel (served from /admin-panel).
const API = `${location.origin}/api`;

// Curated car features grouped into categories, shown in the feature picker
// popup. Admins tick what the car has; anything not here can be added custom.
const FEATURE_CATALOG = {
  'Comfort & Convenience': [
    'Air Conditioning', 'Power Windows', 'Keyless Entry', 'Push Button Start',
    'Cruise Control',
  ],
  'Safety': [
    'Airbags', 'ABS', 'Parking Sensors', 'Reverse Camera',
  ],
  'Technology & Entertainment': [
    'Touchscreen Infotainment', 'Apple CarPlay / Android Auto', 'Bluetooth',
    'USB Charging',
  ],
  'Exterior & Other': [
    'Sunroof', 'Alloy Wheels', 'LED Headlights',
  ],
};
let TOKEN = localStorage.getItem('gomel_admin_token') || '';

// The signed-in admin, cached so the name in the top-right survives a refresh.
let ADMIN = (() => { try { return JSON.parse(localStorage.getItem('gomel_admin_user') || 'null'); } catch (e) { return null; } })();

// ---------------- HTTP helper ----------------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// Upload a single image file to /uploads (multipart) and return its URL.
// Note: no Content-Type header — the browser sets the multipart boundary.
async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(API + '/uploads', {
    method: 'POST',
    headers: { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.url;
}

// ---------------- Tiny helpers ----------------
const $ = (sel) => document.querySelector(sel);
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Only treat a stored image as web-loadable if it's an absolute http(s) URL,
// a data URI, or a server-relative path. Older records can hold a phone's local
// file path (e.g. /private/var/mobile/.../image_picker_*.jpg) that was saved
// before the upload completed — loading those just 404s, so we render the
// placeholder instead.
const imgSrc = (s) => {
  s = String(s ?? '');
  // Uploaded assets are served by this same backend under /uploads. The stored
  // URL can carry a host that isn't reachable from where the admin is opened
  // (e.g. the phone saved a LAN IP, but the admin runs on the public domain).
  // Rewrite any /uploads/ URL to a path on the admin's own origin so it loads
  // regardless of the host it was saved with.
  const up = s.match(/\/uploads\/[^?#]+(?:[?#].*)?$/);
  if (up && /^https?:\/\//.test(s)) return up[0];
  return /^(https?:|data:|\/uploads\/)/.test(s) ? s : '';
};
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
// Pretty Indian phone "+91 98765 43210" from any stored form. Mirrors backend src/utils/phone.js.
const fmtPhone = (raw) => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (!d) return '—';
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : `+91 ${d}`;
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(window.__t); window.__t = setTimeout(() => t.classList.add('hidden'), 2200);
}
function openModal(title, bodyNode) {
  $('#modalTitle').textContent = title;
  const b = $('#modalBody'); b.innerHTML = ''; b.appendChild(bodyNode);
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }

function statusPill(s) {
  const map = {
    upcoming: 'blue', ongoing: 'warn', completed: 'ok', cancelled: 'bad',
    verified: 'ok', pending: 'warn', notSubmitted: 'gray',
    submitted: 'blue', underReview: 'warn', resolved: 'ok',
    user: 'gray', host: 'blue', admin: 'bad',
    active: 'ok', cancelled: 'bad', expired: 'gray', none: 'gray',
  };
  return `<span class="pill ${map[s] || 'gray'}">${esc(s)}</span>`;
}

// ---------------- Auth ----------------

// Cache the signed-in admin and render their name in the top-right. Persisting
// it means a page refresh (which boots from the stored token) can show the name
// immediately instead of leaving the corner blank.
function setWho(user) {
  ADMIN = user || null;
  if (ADMIN) localStorage.setItem('gomel_admin_user', JSON.stringify(ADMIN));
  else localStorage.removeItem('gomel_admin_user');
  const who = $('#who');
  if (!who) return;
  who.textContent = (ADMIN && (ADMIN.name || ADMIN.email)) || 'Admin';
  if (ADMIN && ADMIN.avatarUrl) {
    who.classList.add('has-avatar');
    who.style.setProperty('--who-avatar', `url("${ADMIN.avatarUrl}")`);
  } else {
    who.classList.remove('has-avatar');
    who.style.removeProperty('--who-avatar');
  }
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    const { token, user } = await api('/admin/login', {
      method: 'POST',
      body: { email: $('#email').value, password: $('#password').value },
    });
    TOKEN = token; localStorage.setItem('gomel_admin_token', token);
    setWho(user);
    showApp();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logout').addEventListener('click', () => {
  TOKEN = ''; localStorage.removeItem('gomel_admin_token');
  setWho(null);
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
});

$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// Read the active tab from the URL hash (e.g. "#users"), falling back to
// dashboard. Keeping the tab in the hash means a browser refresh restores the
// same tab instead of jumping back to the dashboard.
function currentTab() {
  const tab = (location.hash || '').replace(/^#/, '');
  return routes[tab] ? tab : 'dashboard';
}

// Apply the active sidebar highlight and render the tab's view.
function activateTab(tab) {
  if (!routes[tab]) tab = 'dashboard';
  // Tear down the support real-time/poll when navigating to any other tab (the
  // support view re-establishes it). Without this it would keep a socket open
  // and/or hit the API in the background. Safe no-op when not on Support.
  if (tab !== 'support') teardownSupportRealtime();
  document.querySelectorAll('.sidebar nav a').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
  routes[tab]();
}

// Navigate to a tab. Updating the hash fires `hashchange` (which renders the
// view); if the hash is already on that tab we render directly.
function goTab(tab) {
  if (!routes[tab]) tab = 'dashboard';
  if (currentTab() === tab) activateTab(tab);
  else location.hash = tab;
}

// Mobile slide-in sidebar: the topbar hamburger toggles `nav-open` on #app,
// which the stylesheet animates into a drawer with a dim scrim behind it.
function setNav(open) {
  $('#app').classList.toggle('nav-open', open);
  $('#menuToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}
$('#menuToggle').addEventListener('click', () => setNav(!$('#app').classList.contains('nav-open')));
$('#sidebarScrim').addEventListener('click', () => setNav(false));
// Esc closes the drawer too.
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

document.querySelectorAll('.sidebar nav a').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    goTab(a.dataset.tab);
    setNav(false); // Picking a tab dismisses the mobile drawer.
  });
});

// Browser back/forward or a manual hash edit re-renders the matching tab.
window.addEventListener('hashchange', () => activateTab(currentTab()));

function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  // Show the cached name straight away, then refresh it from the server (this
  // also corrects a stale name if the admin profile changed since last login).
  setWho(ADMIN);
  api('/admin/me').then((r) => setWho(r.data)).catch(() => {});
  // Honour the tab in the URL hash so a refresh keeps the user where they were.
  activateTab(currentTab());
}

// ---------------- Views ----------------
function setTitle(t) { $('#pageTitle').textContent = t; }
function render(node) { const v = $('#view'); v.innerHTML = ''; v.appendChild(node); }
function loading() { render(el('<div class="empty">Loading…</div>')); }

const routes = {
  async dashboard() {
    setTitle('Dashboard'); loading();
    try {
      const safe = (p) => p.then((r) => r.data || []).catch(() => []);
      const [s, bookings, cars] = await Promise.all([
        api('/admin/stats').then((r) => r.data),
        safe(api('/admin/bookings')),
        safe(api('/admin/cars')),
      ]);

      const months = monthSeries(6);
      const monthLabels = months.map((m) => m.label);
      const revSeries = revByMonth(bookings, months);
      const bkSeries = countByMonth(bookings, months);

      const order = ['upcoming', 'ongoing', 'completed', 'cancelled'];
      const stColor = { upcoming: 'var(--c-blue)', ongoing: 'var(--c-amber)', completed: 'var(--c-green)', cancelled: 'var(--c-red)' };
      const legend = order.map((st) => ({ label: st, value: bookings.filter((b) => b.status === st).length, color: stColor[st] }));
      const segs = legend.filter((x) => x.value > 0);

      const typeMap = {};
      cars.forEach((c) => { const t = c.type || 'Other'; typeMap[t] = (typeMap[t] || 0) + 1; });
      const palette = ['var(--c-indigo)', 'var(--c-blue)', 'var(--c-violet)', 'var(--c-cyan)', 'var(--c-amber)', 'var(--c-green)'];
      const carItems = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));

      const wrap = el(`<div class="dash">
        <div class="kpi-grid">
          ${kpiCard('Revenue', money(s.revenue), '--c-green', '--ic-rupee', delta(revSeries), sparkline(revSeries, 'var(--c-green)', 'spRev'))}
          ${kpiCard('Bookings', s.bookings, '--c-blue', '--ic-calendar', delta(bkSeries), sparkline(bkSeries, 'var(--c-blue)', 'spBk'))}
          ${kpiCard('Cars listed', s.cars, '--c-indigo', '--ic-car', null, '<div class="kpi-cap">Live fleet</div>')}
          ${kpiCard('Customers', s.users, '--c-violet', '--ic-users', null, `<div class="kpi-cap">+ ${s.hosts} hosts</div>`)}
        </div>

        <div class="chart-grid wide">
          <div class="card chart-card">
            <div class="card-head"><h2>Revenue trend</h2><span class="muted">Last 6 months · base fares</span></div>
            <div class="chart-body">${areaChart(revSeries, monthLabels, 'var(--c-green)', 'gRev')}</div>
          </div>
          <div class="card chart-card">
            <div class="card-head"><h2>Bookings by status</h2></div>
            <div class="chart-body donut-wrap">
              ${donut(segs.length ? segs : [{ label: 'none', value: 1, color: 'var(--line)' }], 'dBk')}
              <div class="legend">${legend.map((seg) => `<div class="lg"><span class="lg-dot" style="background:${seg.color}"></span><span class="lg-l">${esc(seg.label)}</span><span class="lg-v">${seg.value}</span></div>`).join('')}</div>
            </div>
          </div>
        </div>

        <div class="chart-grid">
          <div class="card chart-card">
            <div class="card-head"><h2>Fleet by type</h2></div>
            <div class="chart-body">${carItems.length ? hbars(carItems) : '<div class="empty">No cars yet.</div>'}</div>
          </div>
          <div class="card chart-card">
            <div class="card-head"><h2>Needs attention</h2></div>
            <div class="attn-list">
              ${attnRow('--ic-id', '--c-amber', 'Pending KYC', 'Verify licences', s.pendingKyc, 'users')}
              ${attnRow('--ic-alert', '--c-red', 'Open claims', 'Damage reports', s.openClaims, 'claims')}
              ${attnRow('--ic-wallet', '--c-blue', 'Payouts to pay', 'Host withdrawals', s.pendingPayouts, 'payouts')}
              ${attnRow('--ic-briefcase', '--c-cyan', 'Active hosts', 'Listing partners', s.hosts, 'users')}
            </div>
          </div>
        </div>
      </div>`);
      render(wrap);
      wrap.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.go)));
    } catch (e) { render(el(`<div class="empty">${esc(e.message)}</div>`)); }
  },

  async cars() {
    setTitle('Cars'); loading();
    const { data } = await api('/admin/cars');
    const types = [...new Set(data.map((c) => c.type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const addBtn = el('<button class="btn" id="addCar">+ Add car</button>');
    addBtn.addEventListener('click', () => carForm(null));
    filterableList({
      data, noun: 'car', headBtn: addBtn,
      controls: [
        { id: 'car_type', type: 'select',
          options: [{ value: '', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))],
          test: (c, v) => c.type === v },
        { id: 'car_active', type: 'select',
          options: [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'off', label: 'Inactive' }],
          test: (c, v) => (v === 'active' ? !!c.active : !c.active) },
        { id: 'car_q', type: 'search', placeholder: 'Search name or location…',
          test: (c, v) => `${c.name || ''} ${c.pickupAddress || ''}`.toLowerCase().includes(v) },
      ],
      columns: ['', 'Name', 'Type', 'Price/day', 'Rating', 'Active', ''],
      row: (c) => [
        c.images && c.images[0] ? `<img class="thumb" src="${esc(c.images[0])}" />` : '',
        `<b>${esc(c.name)}</b><div class="muted">${esc(c.pickupAddress || '')}</div>`,
        esc(c.type), money(c.pricePerDay), `⭐ ${c.rating}`,
        c.active ? statusPill('verified').replace('verified', 'active') : '<span class="pill gray">off</span>',
        rowBtns([
          ['Edit', 'ghost', () => carForm(c)],
          ['Delete', 'danger', () => delCar(c)],
        ]),
      ],
    });
  },

  async bookings() {
    setTitle('Bookings'); loading();
    const { data } = await api('/admin/bookings');
    filterableList({
      data, noun: 'booking',
      controls: [
        { id: 'bk_status', type: 'select',
          options: [{ value: '', label: 'All statuses' },
            ...['upcoming', 'ongoing', 'completed', 'cancelled'].map((s) => ({ value: s, label: s }))],
          test: (b, v) => b.status === v },
        { id: 'bk_q', type: 'search', placeholder: 'Search booking ID or car…',
          test: (b, v) => `${b.id || ''} ${b.car?.name || ''}`.toLowerCase().includes(v) },
      ],
      columns: ['ID', 'Car', 'Dates', 'Payable', 'Status', ''],
      row: (b) => [
        esc(b.id),
        esc(b.car?.name || '—'),
        `${fmtDate(b.start)} → ${fmtDate(b.end)}`,
        money((b.fare?.base || 0) + (b.fare?.taxes || 0) + (b.fare?.deposit || 0)),
        statusPill(b.status),
        rowBtns([
          ['View', 'ghost', () => bookingDetail(b)],
          ['Change status', 'ghost', () => bookingForm(b)],
        ]),
      ],
    });
  },

  async users() {
    setTitle('Users'); loading();
    const { data } = await api('/admin/users');
    filterableList({
      data, noun: 'user',
      controls: [
        { id: 'us_role', type: 'select',
          options: [{ value: '', label: 'All roles' },
            ...['user', 'host', 'admin'].map((r) => ({ value: r, label: r }))],
          test: (u, v) => u.role === v },
        { id: 'us_kyc', type: 'select',
          options: [{ value: '', label: 'All KYC' },
            { value: 'verified', label: 'verified' }, { value: 'pending', label: 'pending' },
            { value: 'notSubmitted', label: 'notSubmitted' }],
          test: (u, v) => u.licenseStatus === v },
        { id: 'us_q', type: 'search', placeholder: 'Search name, phone or email…',
          test: (u, v) => `${u.name || ''} ${u.phone || ''} ${fmtPhone(u.phone)} ${u.email || ''}`.toLowerCase().includes(v) },
      ],
      columns: ['Name', 'Phone', 'Email', 'Role', 'KYC', 'Wallet', ''],
      row: (u) => [
        esc(u.name || '—'), fmtPhone(u.phone), esc(u.email || '—'),
        statusPill(u.role), statusPill(u.licenseStatus), money(u.walletBalance),
        rowBtns([
          ['View', 'ghost', () => userDetail(u)],
          ...(u.licenseStatus === 'pending'
            ? [
                ['Approve', '', () => setKyc(u, 'verified')],
                ['Reject', 'danger', () => setKyc(u, 'notSubmitted')],
              ]
            : []),
        ]),
      ],
    });
  },

  async claims() {
    setTitle('Damage claims'); loading();
    const { data } = await api('/admin/claims');
    const severities = [...new Set(data.map((c) => c.severity).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    filterableList({
      data, noun: 'claim',
      controls: [
        { id: 'cl_status', type: 'select',
          options: [{ value: '', label: 'All statuses' },
            ...['submitted', 'underReview', 'resolved'].map((s) => ({ value: s, label: s }))],
          test: (c, v) => c.status === v },
        { id: 'cl_sev', type: 'select',
          options: [{ value: '', label: 'All severities' }, ...severities.map((s) => ({ value: s, label: s }))],
          test: (c, v) => c.severity === v },
        { id: 'cl_q', type: 'search', placeholder: 'Search ID, car or description…',
          test: (c, v) => `${c.id || ''} ${c.carName || ''} ${c.description || ''}`.toLowerCase().includes(v) },
      ],
      columns: ['ID', 'Car', 'Severity', 'Description', 'Status', ''],
      row: (c) => [
        esc(c.id), esc(c.carName || '—'), esc(c.severity),
        `<span class="muted">${esc((c.description || '').slice(0, 50))}</span>`,
        statusPill(c.status),
        rowBtns([['View', 'ghost', () => claimDetail(c)], ['Update', 'ghost', () => claimForm(c)]]),
      ],
    });
  },

  async offers() {
    setTitle('Promo codes'); loading();
    const { data } = await api('/admin/offers');
    const card = el(`<div class="card list-card"></div>`);
    card.appendChild(el(`<div class="card-head"><h2>${data.length} codes</h2>
      <button class="btn" id="addOffer">+ Add code</button></div>`));
    card.appendChild(paginatedTable(
      ['Code', 'Discount', 'Title', 'Min fare', 'Active', ''],
      data.map((o) => [
        `<b>${esc(o.id)}</b>`,
        `${Math.round((o.discountPct || 0) * 100)}%`,
        esc(o.title || '—'),
        o.minFare ? money(o.minFare) : '—',
        o.active ? '<span class="pill ok">on</span>' : '<span class="pill gray">off</span>',
        rowBtns([
          ['Edit', 'ghost', () => offerForm(o)],
          ['Delete', 'danger', () => delOffer(o)],
        ]),
      ])
    ));
    render(card);
    $('#addOffer').addEventListener('click', () => offerForm(null));
  },

  async rewards() {
    setTitle('Reward redeem options'); loading();
    const { data } = await api('/admin/rewards');
    const card = el(`<div class="card list-card"></div>`);
    card.appendChild(el(`<div class="card-head"><h2>${data.length} options</h2>
      <button class="btn" id="addReward">+ Add option</button></div>`));
    card.appendChild(paginatedTable(
      ['ID', 'Title', 'Cost', 'Value', 'Active', ''],
      data.map((o) => [
        `<b>${esc(o.id)}</b>`,
        esc(o.title || '—'),
        `${o.cost} pts`,
        o.value ? money(o.value) : '<span class="muted">perk</span>',
        o.active ? '<span class="pill ok">on</span>' : '<span class="pill gray">off</span>',
        rowBtns([
          ['Edit', 'ghost', () => rewardForm(o)],
          ['Delete', 'danger', () => delReward(o)],
        ]),
      ])
    ));
    render(card);
    $('#addReward').addEventListener('click', () => rewardForm(null));
  },

  async subscriptions() {
    setTitle('Membership'); loading();
    const [{ data: plans }, { data: subs }] = await Promise.all([
      api('/admin/plans'),
      api('/admin/subscribers').catch(() => ({ data: [] })),
    ]);

    const wrap = el('<div></div>');

    // Plans — attractive card grid with CRUD.
    const plansCard = el('<div class="card"></div>');
    plansCard.appendChild(el(`<div class="card-head"><h2>${plans.length} membership plan${plans.length === 1 ? '' : 's'}</h2>
      <button class="btn" id="addPlan">+ Add plan</button></div>`));
    if (!plans.length) {
      plansCard.appendChild(el('<div class="empty-plans">No plans yet — create your first membership plan.</div>'));
    } else {
      const grid = el('<div class="plan-grid"></div>');
      // Show the popular plan first so the featured card leads the grid.
      [...plans].sort((a, b) => (b.highlighted ? 1 : 0) - (a.highlighted ? 1 : 0))
        .forEach((p) => grid.appendChild(planCard(p)));
      plansCard.appendChild(grid);
    }
    wrap.appendChild(plansCard);

    // Subscribers card (read-only).
    const subsCard = el('<div class="card list-card" style="margin-top:16px"></div>');
    subsCard.appendChild(el(`<div class="card-head"><h2>${subs.length} subscribers</h2></div>`));
    subsCard.appendChild(paginatedTable(
      ['Name', 'Phone', 'Plan', 'Status', 'Started', 'Expires'],
      subs.map((u) => [
        esc(u.name || '—'),
        fmtPhone(u.phone),
        `<b>${esc(u.subscription?.planId || '—')}</b>`,
        statusPill(u.subscription?.status || 'none'),
        u.subscription?.startedAt ? fmtDate(u.subscription.startedAt) : '—',
        u.subscription?.expiresAt ? fmtDate(u.subscription.expiresAt) : '—',
      ])
    ));
    wrap.appendChild(subsCard);

    render(wrap);
    $('#addPlan').addEventListener('click', () => planForm(null));
  },

  async payouts() {
    setTitle('Host payouts'); loading();
    const { data } = await api('/admin/payouts');
    filterableList({
      data, noun: 'payout',
      controls: [
        { id: 'po_status', type: 'select',
          options: [{ value: '', label: 'All statuses' },
            { value: 'requested', label: 'requested' }, { value: 'paid', label: 'paid' },
            { value: 'rejected', label: 'rejected' }],
          // Treat anything that isn't paid/rejected as "requested" (matches the pill logic).
          test: (p, v) => (v === 'requested' ? (p.status !== 'paid' && p.status !== 'rejected') : p.status === v) },
        { id: 'po_q', type: 'search', placeholder: 'Search host or UPI…',
          test: (p, v) => `${payoutHostName(p)} ${p.upiId || ''}`.toLowerCase().includes(v) },
      ],
      columns: ['Host', 'Amount', 'UPI', 'Status', 'Requested', ''],
      row: (p) => [
        esc(payoutHostName(p)),
        money(p.amount),
        esc(p.upiId || '—'),
        statusPill(p.status === 'paid' ? 'completed' : p.status === 'rejected' ? 'cancelled' : 'pending')
          .replace('completed', 'paid').replace('cancelled', 'rejected').replace('pending', 'requested'),
        fmtDate(p.createdAt),
        rowBtns([
          ['View', 'ghost', () => payoutDetail(p)],
          ...(p.status === 'requested'
            ? [
                ['Mark paid', 'ghost', () => setPayout(p, 'paid')],
                ['Reject', 'danger', () => setPayout(p, 'rejected')],
              ]
            : []),
        ]),
      ],
    });
  },

  async support() {
    setTitle('Support'); loading();
    const { data } = await api('/admin/support');
    supportState.convos = data;
    supportState.activeId = null;
    supportState.lastAt = null;

    const wrap = el(`<div class="card support-wrap">
      <div class="support-list" id="supList"></div>
      <div class="support-chat" id="supChat"><div class="empty">Select a conversation</div></div>
    </div>`);
    render(wrap);
    renderSupportList();
    if (data.length) openSupportConvo(data[0]);
    else $('#supChat').innerHTML = '<div class="empty">No support conversations yet.</div>';
  },

  async reviews() {
    setTitle('Reviews & ratings'); loading();
    const { data } = await api('/admin/reviews');

    // Distinct car names for the car dropdown.
    const carNames = [...new Set(data.map((r) => r.carName || r.carId).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    const wrap = el('<div></div>');
    const toolbar = el(`<div class="toolbar">
      <select id="rv_car">
        <option value="">All cars</option>
        ${carNames.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
      </select>
      <select id="rv_rating">
        <option value="">All ratings</option>
        <option value="5">★★★★★ (5)</option>
        <option value="4">★★★★ (4)</option>
        <option value="3">★★★ (3)</option>
        <option value="2">★★ (2)</option>
        <option value="1">★ (1)</option>
      </select>
      <input id="rv_author" type="search" placeholder="Search author…" />
      <button class="btn ghost sm" id="rv_clear">Clear</button>
    </div>`);
    const card = el('<div class="card list-card"></div>');
    const head = el(`<div class="card-head"><h2></h2></div>`);
    const mount = el('<div></div>');
    card.appendChild(head);
    card.appendChild(mount);
    wrap.appendChild(toolbar);
    wrap.appendChild(card);
    render(wrap);

    const carSel = wrap.querySelector('#rv_car');
    const ratingSel = wrap.querySelector('#rv_rating');
    const authorInput = wrap.querySelector('#rv_author');

    const apply = () => {
      const carV = carSel.value;
      const ratingV = ratingSel.value;
      const authorV = authorInput.value.trim().toLowerCase();
      const rows = data.filter((r) => {
        if (carV && (r.carName || r.carId) !== carV) return false;
        if (ratingV && Math.round(Number(r.rating) || 0) !== Number(ratingV)) return false;
        if (authorV && !String(r.author || 'Guest').toLowerCase().includes(authorV)) return false;
        return true;
      });
      head.querySelector('h2').textContent =
        `${rows.length} of ${data.length} review${data.length === 1 ? '' : 's'}`;
      mount.innerHTML = '';
      mount.appendChild(paginatedTable(
        ['Car', 'Author', 'Rating', 'Comment', 'Date'],
        rows.map((r) => [
          esc(r.carName || r.carId),
          esc(r.author || 'Guest'),
          stars(r.rating),
          esc(r.comment || '—'),
          fmtDate(r.date),
        ])
      ));
    };

    carSel.addEventListener('change', apply);
    ratingSel.addEventListener('change', apply);
    authorInput.addEventListener('input', apply);
    wrap.querySelector('#rv_clear').addEventListener('click', () => {
      carSel.value = ''; ratingSel.value = ''; authorInput.value = ''; apply();
    });
    apply();
  },

  broadcast() {
    setTitle('Send notification');
    const f = el(`<div class="card"><div class="form">
      <div class="full"><label>Title</label><input id="b_title" placeholder="Weekend offer 🚗" /></div>
      <div class="full"><label>Body</label><textarea id="b_body" rows="3" placeholder="Use SAVE15 for 15% off"></textarea></div>
      <div><label>Type</label><select id="b_type">
        <option value="offer">offer</option><option value="system">system</option>
        <option value="reminder">reminder</option><option value="booking">booking</option>
      </select></div>
    </div><div class="form-actions"><button class="btn" id="b_send">Send to all users</button></div></div>`);
    render(f);
    $('#b_send').addEventListener('click', async () => {
      await api('/admin/broadcast', { method: 'POST', body: {
        title: $('#b_title').value, body: $('#b_body').value, type: $('#b_type').value,
      }});
      toast('Notification sent'); $('#b_title').value = ''; $('#b_body').value = '';
    });
  },

  settings() {
    setTitle('Settings');
    const a = ADMIN || {};
    const initials = (a.name || a.email || 'A').trim().charAt(0).toUpperCase();
    const memberSince = a.createdAt ? fmtDate(a.createdAt) : null;

    const wrap = el(`<div class="set-wrap">
      <!-- Profile hero -->
      <div class="set-hero">
        <div class="set-hero-cover"></div>
        <div class="set-hero-body">
          <div class="set-avatar">${a.avatarUrl ? `<img src="${esc(a.avatarUrl)}" alt="" />` : esc(initials)}</div>
          <div class="set-hero-info">
            <div class="set-hero-name">${esc(a.name || 'Administrator')}</div>
            <div class="set-hero-mail">${esc(a.email || '—')}</div>
          </div>
          <div class="set-hero-badge"><span class="set-role"><i style="--icon:var(--ic-shield)"></i>Administrator</span></div>
        </div>
        <div class="set-hero-meta">
          <div class="set-chip"><span class="set-chip-l">Role</span><span class="set-chip-v">Full access</span></div>
          <div class="set-chip"><span class="set-chip-l">Status</span><span class="set-chip-v ok">● Active</span></div>
          <div class="set-chip"><span class="set-chip-l">Member since</span><span class="set-chip-v">${esc(memberSince || '—')}</span></div>
        </div>
      </div>

      <div class="set-grid">
        <div class="set-main">
        <!-- Edit profile -->
        <div class="card set-card">
          <div class="set-card-head">
            <span class="set-card-ic" style="--c:var(--c-indigo)"><i style="--icon:var(--ic-users)"></i></span>
            <div><h2>Profile</h2><p>Update your photo, name and email.</p></div>
          </div>
          <div class="set-profile">
            <div class="set-pic" id="p_pic">
              <div class="set-pic-img" id="p_avatar"></div>
              <button type="button" class="set-pic-cam" id="p_pick" aria-label="Change photo"></button>
              <input type="file" accept="image/*" hidden id="p_file" />
            </div>
            <div class="set-pic-side">
              <div class="set-pic-actions">
                <button type="button" class="btn ghost sm" id="p_change">Change photo</button>
                <button type="button" class="btn danger sm" id="p_remove">Remove</button>
              </div>
              <p class="set-pic-hint">JPG or PNG. A square image looks best.</p>
            </div>
          </div>
          <div class="set-fields">
            <div class="set-field">
              <label>Full name</label>
              <div class="set-input"><input id="p_name" type="text" placeholder="Your name" value="${esc(a.name || '')}" /></div>
            </div>
            <div class="set-field">
              <label>Email</label>
              <div class="set-input"><input id="p_email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(a.email || '')}" /></div>
            </div>
            <div class="error set-err" id="p_err"></div>
            <div class="set-actions"><button class="btn" id="p_save" disabled>Save changes</button></div>
          </div>
        </div>

        <!-- Security / change password -->
        <div class="card set-card">
          <div class="set-card-head">
            <span class="set-card-ic" style="--c:var(--c-blue)"><i style="--icon:var(--ic-lock)"></i></span>
            <div><h2>Password &amp; security</h2><p>Use a strong, unique password for the admin account.</p></div>
          </div>
          <div class="set-sec">
            <div class="set-field">
              <label>Current password</label>
              <div class="set-input">
                <input id="s_cur" type="password" autocomplete="current-password" placeholder="Enter current password" />
                <button type="button" class="set-eye" data-for="s_cur" aria-label="Show password"></button>
              </div>
            </div>
            <div class="set-field">
              <label>New password</label>
              <div class="set-input">
                <input id="s_new" type="password" autocomplete="new-password" placeholder="Create a new password" />
                <button type="button" class="set-eye" data-for="s_new" aria-label="Show password"></button>
              </div>
              <div class="set-meter"><span id="s_meter_bar" class="set-meter-bar"></span></div>
              <div class="set-meter-label" id="s_meter_label">Password strength</div>
            </div>
            <div class="set-field">
              <label>Confirm new password</label>
              <div class="set-input">
                <input id="s_new2" type="password" autocomplete="new-password" placeholder="Re-enter new password" />
                <button type="button" class="set-eye" data-for="s_new2" aria-label="Show password"></button>
              </div>
            </div>
            <ul class="set-reqs">
              <li data-req="len">At least 8 characters</li>
              <li data-req="case">Upper &amp; lowercase letters</li>
              <li data-req="num">Contains a number</li>
              <li data-req="match">Both passwords match</li>
            </ul>
            <div class="error set-err" id="s_err"></div>
            <div class="set-actions"><button class="btn" id="s_save" disabled>Update password</button></div>
          </div>
        </div>
        </div><!-- /.set-main -->

        <div class="set-side">
          <!-- Appearance -->
          <div class="card set-card">
            <div class="set-card-head">
              <span class="set-card-ic" style="--c:var(--c-violet)"><i style="--icon:var(--ic-palette)"></i></span>
              <div><h2>Appearance</h2><p>Choose how the panel looks.</p></div>
            </div>
            <div class="set-themes" id="s_themes"></div>
          </div>

          <!-- Maintenance mode -->
          <div class="card set-card">
            <div class="set-card-head">
              <span class="set-card-ic" style="--c:var(--c-red)"><i style="--icon:var(--ic-alert)"></i></span>
              <div><h2>Maintenance mode</h2><p>Take the customer &amp; host apps offline.</p></div>
            </div>
            <div class="set-maint">
              <div class="set-maint-row">
                <div class="set-maint-state">
                  <span class="pill gray" id="m_pill">Loading…</span>
                  <span class="set-maint-hint" id="m_hint"></span>
                </div>
                <button type="button" class="btn ghost sm" id="m_toggle" disabled>—</button>
              </div>
              <div class="set-field">
                <label>Message shown to users</label>
                <textarea id="m_msg" rows="3" placeholder="We'll be back shortly…"></textarea>
              </div>
              <div class="error set-err" id="m_err"></div>
              <div class="set-actions"><button class="btn" id="m_save" disabled>Save message</button></div>
            </div>
          </div>

          <!-- Application config -->
          <div class="card set-card">
            <div class="set-card-head">
              <span class="set-card-ic" style="--c:var(--c-amber)"><i style="--icon:var(--ic-sliders)"></i></span>
              <div><h2>Application config</h2><p>Business rules locked with the client.</p></div>
            </div>
            <div class="set-config" id="s_config"><div class="set-config-loading">Loading…</div></div>
          </div>
        </div>
      </div>
    </div>`);
    render(wrap);

    // ---- Maintenance mode (live toggle + message) ----
    const mPill = wrap.querySelector('#m_pill');
    const mHint = wrap.querySelector('#m_hint');
    const mToggle = wrap.querySelector('#m_toggle');
    const mMsg = wrap.querySelector('#m_msg');
    const mErr = wrap.querySelector('#m_err');
    const mSave = wrap.querySelector('#m_save');
    let maintOn = false;
    let savedMsg = '';

    const paintMaint = () => {
      mPill.className = `pill ${maintOn ? 'bad' : 'ok'}`;
      mPill.textContent = maintOn ? '● On' : '● Off';
      mHint.textContent = maintOn
        ? 'Customer & host apps are offline.'
        : 'Apps are live for everyone.';
      mToggle.textContent = maintOn ? 'Turn off' : 'Turn on';
      mToggle.className = `btn sm ${maintOn ? '' : 'danger'}`;
      mToggle.disabled = false;
      mSave.disabled = mMsg.value.trim() === savedMsg;
    };

    api('/admin/maintenance').then(({ data }) => {
      maintOn = !!data.maintenanceMode;
      savedMsg = data.maintenanceMessage || '';
      mMsg.value = savedMsg;
      paintMaint();
    }).catch((e) => { mErr.textContent = e.message; });

    mMsg.addEventListener('input', () => { mSave.disabled = mMsg.value.trim() === savedMsg; });

    mToggle.addEventListener('click', async () => {
      mErr.textContent = '';
      mToggle.disabled = true;
      try {
        const { data } = await api('/admin/maintenance', {
          method: 'PATCH', body: { maintenanceMode: !maintOn },
        });
        maintOn = !!data.maintenanceMode;
        paintMaint();
        toast(maintOn ? 'Maintenance mode ON' : 'Maintenance mode OFF');
      } catch (e) { mErr.textContent = e.message; mToggle.disabled = false; }
    });

    mSave.addEventListener('click', async () => {
      mErr.textContent = '';
      mSave.disabled = true;
      try {
        const { data } = await api('/admin/maintenance', {
          method: 'PATCH', body: { maintenanceMessage: mMsg.value.trim() },
        });
        savedMsg = data.maintenanceMessage || '';
        mMsg.value = savedMsg;
        paintMaint();
        toast('Maintenance message saved');
      } catch (e) { mErr.textContent = e.message; mSave.disabled = false; }
    });

    // ---- Edit profile (avatar upload + name/email) ----
    let pic = a.avatarUrl || '';
    const avatarBox = wrap.querySelector('#p_avatar');
    const picBox = wrap.querySelector('#p_pic');
    const fileInput = wrap.querySelector('#p_file');
    const removeBtn = wrap.querySelector('#p_remove');
    const nameEl = wrap.querySelector('#p_name');
    const emailEl = wrap.querySelector('#p_email');
    const pSave = wrap.querySelector('#p_save');
    const pErr = wrap.querySelector('#p_err');

    const renderAvatar = () => {
      avatarBox.innerHTML = pic ? `<img src="${esc(pic)}" alt="" />` : esc(initials);
      removeBtn.style.display = pic ? '' : 'none';
    };
    const profileDirty = () =>
      (nameEl.value.trim() !== (a.name || '')) ||
      (emailEl.value.trim() !== (a.email || '')) ||
      (pic !== (a.avatarUrl || ''));
    const refreshSave = () => { pSave.disabled = !profileDirty(); };
    renderAvatar(); refreshSave();

    const pickFile = () => fileInput.click();
    wrap.querySelector('#p_pick').addEventListener('click', pickFile);
    wrap.querySelector('#p_change').addEventListener('click', pickFile);
    removeBtn.addEventListener('click', () => { pic = ''; renderAvatar(); refreshSave(); });
    fileInput.addEventListener('change', async () => {
      const file = (fileInput.files || [])[0];
      fileInput.value = '';
      if (!file) return;
      picBox.classList.add('busy');
      pErr.textContent = '';
      try { pic = await uploadFile(file); renderAvatar(); refreshSave(); }
      catch (e) { pErr.textContent = e.message; }
      finally { picBox.classList.remove('busy'); }
    });
    [nameEl, emailEl].forEach((i) => i.addEventListener('input', refreshSave));

    pSave.addEventListener('click', async () => {
      pErr.textContent = '';
      pSave.disabled = true;
      try {
        const { data } = await api('/admin/profile', { method: 'PATCH', body: {
          name: nameEl.value.trim(), email: emailEl.value.trim(), avatarUrl: pic,
        }});
        setWho(data);
        toast('Profile updated');
        routes.settings(); // repaint hero + form with the saved values
      } catch (e) { pErr.textContent = e.message; refreshSave(); }
    });

    // ---- Appearance tiles (reuse the shared theme helpers) ----
    const themesEl = wrap.querySelector('#s_themes');
    const paintThemes = () => {
      const pref = getThemePref();
      themesEl.innerHTML = THEMES.map((t) => `
        <button type="button" class="set-theme ${t.id === pref ? 'active' : ''}" data-theme="${t.id}">
          ${swatch(t.sw)}
          <span class="set-theme-l">${t.label}</span>
          <span class="set-theme-d">${t.desc}</span>
          <span class="set-theme-check"></span>
        </button>`).join('');
      themesEl.querySelectorAll('.set-theme').forEach((b) => b.addEventListener('click', () => {
        localStorage.setItem(THEME_KEY, b.dataset.theme);
        applyTheme(b.dataset.theme);
        window.dispatchEvent(new Event('themechange'));
        paintThemes();
      }));
    };
    paintThemes();

    // ---- Application config (live values from the server) ----
    const cfgEl = wrap.querySelector('#s_config');
    api('/admin/config').then(({ data }) => {
      const tiers = (data.loyaltyTiers || []).slice().sort((x, y) => x.min - y.min);
      const tierColors = { bronze: '#b08d57', silver: '#9aa6c4', gold: 'var(--c-amber)', platinum: 'var(--c-cyan)' };
      cfgEl.innerHTML = `
        <div class="set-cfg-row"><span class="set-cfg-l">Platform commission</span><span class="set-cfg-v">${Math.round((data.platformCommissionRate || 0) * 100)}%</span></div>
        <div class="set-cfg-row"><span class="set-cfg-l">Referral reward</span><span class="set-cfg-v">${money(data.referralReward)}</span></div>
        <div class="set-cfg-row"><span class="set-cfg-l">Loyalty earn rate</span><span class="set-cfg-v">${(data.loyaltyEarnRate || 0)} pt / ₹</span></div>
        <div class="set-cfg-tiers">
          <span class="set-cfg-l">Loyalty tiers</span>
          <div class="set-tier-row">${tiers.map((t) =>
            `<span class="set-tier" style="--tc:${tierColors[t.tier] || 'var(--text-3)'}">${esc(t.tier)} <em>${t.min}+</em></span>`).join('')}</div>
        </div>
        <p class="set-cfg-note">Read-only · edit in <code>config/business.js</code></p>`;
    }).catch((e) => { cfgEl.innerHTML = `<div class="set-config-loading">${esc(e.message)}</div>`; });

    // ---- Change-password logic: live strength, requirement checks, gated save ----
    const curEl = wrap.querySelector('#s_cur');
    const newEl = wrap.querySelector('#s_new');
    const new2El = wrap.querySelector('#s_new2');
    const saveBtn = wrap.querySelector('#s_save');
    const errEl = wrap.querySelector('#s_err');
    const meterBar = wrap.querySelector('#s_meter_bar');
    const meterLabel = wrap.querySelector('#s_meter_label');
    const reqEls = {};
    wrap.querySelectorAll('.set-reqs li').forEach((li) => { reqEls[li.dataset.req] = li; });

    const STRENGTH = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const STR_COLOR = ['var(--c-red)', 'var(--c-red)', 'var(--c-amber)', 'var(--c-blue)', 'var(--c-green)'];

    // Eye toggles
    wrap.querySelectorAll('.set-eye').forEach((btn) => btn.addEventListener('click', () => {
      const input = wrap.querySelector('#' + btn.dataset.for);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('on', show);
    }));

    const recompute = () => {
      const np = newEl.value;
      const checks = {
        len: np.length >= 8,
        case: /[a-z]/.test(np) && /[A-Z]/.test(np),
        num: /\d/.test(np),
        match: np.length > 0 && np === new2El.value,
      };
      Object.entries(checks).forEach(([k, ok]) => reqEls[k] && reqEls[k].classList.toggle('met', ok));

      // Strength score (0–4)
      let score = 0;
      if (np.length >= 8) score++;
      if (np.length >= 12) score++;
      if (/[a-z]/.test(np) && /[A-Z]/.test(np)) score++;
      if (/\d/.test(np)) score++;
      if (/[^A-Za-z0-9]/.test(np)) score++;
      score = Math.min(4, score);
      const pct = np ? Math.max(12, (score / 4) * 100) : 0;
      meterBar.style.width = pct + '%';
      meterBar.style.background = np ? STR_COLOR[score] : 'transparent';
      meterLabel.textContent = np ? STRENGTH[score] : 'Password strength';
      meterLabel.style.color = np ? STR_COLOR[score] : 'var(--text-3)';

      saveBtn.disabled = !(curEl.value && checks.len && checks.match);
    };
    [curEl, newEl, new2El].forEach((i) => i.addEventListener('input', recompute));
    recompute();

    saveBtn.addEventListener('click', async () => {
      errEl.textContent = '';
      const cur = curEl.value, next = newEl.value;
      if (!cur || !next) { errEl.textContent = 'Fill in all fields.'; return; }
      if (next.length < 8) { errEl.textContent = 'New password must be at least 8 characters.'; return; }
      if (next !== new2El.value) { errEl.textContent = 'New passwords do not match.'; return; }
      saveBtn.disabled = true;
      try {
        await api('/admin/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: next } });
        toast('Password updated');
        curEl.value = ''; newEl.value = ''; new2El.value = '';
        recompute();
      } catch (e) { errEl.textContent = e.message; recompute(); }
    });
  },
};

// ---------------- Support inbox ----------------
// A lightweight two-pane chat: conversation list on the left, the active thread
// on the right. The open thread updates in real time over Socket.IO; if the
// socket isn't available it falls back to polling
// /admin/support/:id/messages?after=<lastSeen> every 4s.
const supportState = { convos: [], activeId: null, lastAt: null, seen: new Set() };

function renderSupportList() {
  const list = $('#supList');
  if (!list) return;
  if (!supportState.convos.length) { list.innerHTML = '<div class="empty">No conversations</div>'; return; }
  list.innerHTML = '';
  supportState.convos.forEach((c) => {
    const initial = esc((c.customerName || '?').charAt(0).toUpperCase());
    const item = el(`<div class="sup-item ${c.id === supportState.activeId ? 'active' : ''}" data-id="${esc(c.id)}">
      <div class="sup-avatar">${initial}</div>
      <div class="sup-meta">
        <div class="sup-name">${esc(c.customerName)}</div>
        <div class="sup-last">${esc((c.lastMessage || '').slice(0, 42))}</div>
      </div>
      <div class="sup-time">${c.lastAt ? fmtTime(c.lastAt) : ''}</div>
    </div>`);
    item.addEventListener('click', () => {
      // On mobile this swaps the list out for the full-screen chat pane.
      document.querySelector('.support-wrap')?.classList.add('show-chat');
      openSupportConvo(c);
    });
    list.appendChild(item);
  });
}

async function openSupportConvo(c) {
  // Leave the previous conversation's room before switching.
  if (supportState.activeId && supportState.activeId !== c.id) {
    leaveSupportRoom(supportState.activeId);
  }
  supportState.activeId = c.id;
  supportState.lastAt = null;
  supportState.seen = new Set();
  renderSupportList();

  const chat = $('#supChat');
  if (!chat) return;
  chat.innerHTML = `
    <div class="sup-head">
      <button type="button" class="sup-back" id="supBack" aria-label="Back to conversations">←</button>
      <div class="sup-head-meta">
        <div class="sup-head-name">${esc(c.customerName)}</div>
        <div class="sup-head-sub">${esc(c.customerPhone || c.customerEmail || '')}</div>
      </div>
    </div>
    <div class="sup-msgs" id="supMsgs"></div>
    <form class="sup-input" id="supForm">
      <input id="supText" placeholder="Type a reply…" autocomplete="off" />
      <button type="submit" class="btn">Send</button>
    </form>`;

  // Mobile single-pane: the back button returns to the conversation list.
  $('#supBack').addEventListener('click', () => {
    document.querySelector('.support-wrap')?.classList.remove('show-chat');
  });

  $('#supForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#supText');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await api(`/admin/support/${c.id}/messages`, { method: 'POST', body: { text } });
      await loadSupportMessages(c.id); // pulls the just-sent message via ?after
      c.lastMessage = text;
      renderSupportList();
    } catch (err) { toast(err.message); input.value = text; }
  });

  await loadSupportMessages(c.id, true);
  // Real-time first; poll is a fallback that the socket pauses on connect.
  joinSupportRoom(c.id);
  startSupportPoll();
}

// Append one message to the open thread, de-duplicated by id so a socket push
// and a poll (or the just-sent echo) can't render the same message twice.
// Returns true if it was actually added.
function appendSupportMessage(box, m) {
  if (!box || supportState.seen.has(m.id)) return false;
  supportState.seen.add(m.id);
  const images = Array.isArray(m.images) ? m.images.filter(Boolean) : [];
  const imgHtml = images.length
    ? `<div class="sup-imgs">${images.map((src) => `
        <a href="${esc(src)}" target="_blank" rel="noopener" class="sup-img">
          <img src="${esc(src)}" alt="attachment" loading="lazy" />
        </a>`).join('')}</div>`
    : '';
  const textHtml = m.text ? `<div class="sup-bubble">${esc(m.text)}</div>` : '';
  box.appendChild(el(`<div class="sup-msg ${m.fromMe ? 'out' : 'in'}">
    ${imgHtml}${textHtml}
    <div class="sup-msg-time">${fmtTime(m.time)}</div>
  </div>`));
  supportState.lastAt = m.time;
  return true;
}

async function loadSupportMessages(id, replace) {
  if (supportState.activeId !== id) return;
  const q = (!replace && supportState.lastAt) ? `?after=${encodeURIComponent(supportState.lastAt)}` : '';
  let data;
  try { ({ data } = await api(`/admin/support/${id}/messages${q}`)); }
  catch (e) { return; }
  const box = $('#supMsgs');
  if (!box || supportState.activeId !== id) return;
  if (replace) { box.innerHTML = ''; supportState.seen = new Set(); }
  let added = 0;
  data.forEach((m) => { if (appendSupportMessage(box, m)) added++; });
  if (added) box.scrollTop = box.scrollHeight;
}

function startSupportPoll() {
  if (window.__supportPoll) clearInterval(window.__supportPoll);
  window.__supportPoll = setInterval(() => {
    if (supportState.activeId) loadSupportMessages(supportState.activeId);
  }, 4000);
}

function stopSupportPoll() {
  if (window.__supportPoll) { clearInterval(window.__supportPoll); window.__supportPoll = null; }
}

// ---------------- Support real-time (Socket.IO) ----------------
// Lazily opens one authenticated socket while the Support tab is in use. New
// messages for the open conversation are pushed instantly; the 4s poll is
// paused while connected and resumes if the socket drops.
function adminSocket() {
  if (typeof io === 'undefined') return null; // client script failed to load
  if (window.__adminSocket) return window.__adminSocket;

  const socket = io({
    auth: { token: TOKEN },
    transports: ['websocket', 'polling'],
  });
  window.__adminSocket = socket;

  socket.on('connect', () => {
    // (Re)join the open room and rely on push instead of polling.
    if (supportState.activeId) {
      socket.emit('conversation:join', supportState.activeId);
      stopSupportPoll();
      loadSupportMessages(supportState.activeId); // catch up on the gap
    }
  });

  socket.on('chat:message', (payload) => {
    if (!payload || payload.conversationId !== supportState.activeId) return;
    const box = $('#supMsgs');
    if (appendSupportMessage(box, payload.message)) box.scrollTop = box.scrollHeight;
  });

  // Lost the socket — fall back to polling until it reconnects.
  socket.on('disconnect', () => { if (supportState.activeId) startSupportPoll(); });

  return socket;
}

function joinSupportRoom(id) {
  const socket = adminSocket();
  if (!socket) return; // no socket support — polling already covers it
  if (socket.connected) {
    socket.emit('conversation:join', id);
    stopSupportPoll(); // socket is live; drop the poll
  }
  // If not yet connected, the 'connect' handler joins and stops the poll.
}

function leaveSupportRoom(id) {
  const socket = window.__adminSocket;
  if (socket && socket.connected) socket.emit('conversation:leave', id);
}

// Disconnect the socket and stop polling when the admin leaves the Support tab.
function teardownSupportRealtime() {
  if (supportState.activeId) leaveSupportRoom(supportState.activeId);
  supportState.activeId = null;
  stopSupportPoll();
  if (window.__adminSocket) { window.__adminSocket.disconnect(); window.__adminSocket = null; }
}

// ---------------- View builders ----------------
function statCard(n, label, isMoney) {
  return `<div class="stat"><div class="n">${isMoney ? money(n) : (n ?? 0)}</div><div class="l">${label}</div></div>`;
}
function buildTable(headers, rows) {
  if (!rows.length) return el('<div class="empty">Nothing here yet.</div>');
  const t = el('<table></table>');
  t.appendChild(el(`<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`));
  const tb = el('<tbody></tbody>');
  rows.forEach((cells) => {
    const tr = el('<tr></tr>');
    cells.forEach((c, i) => {
      const td = el('<td></td>');
      // Stamp the column header onto each cell so the mobile card layout
      // (see styles.css "table → cards" media query) can show it as a label.
      td.setAttribute('data-label', headers[i] || '');
      if (c instanceof Node) td.appendChild(c); else td.innerHTML = c;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  const wrap = el('<div class="table-wrap"></div>');
  wrap.appendChild(t);
  return wrap;
}

// Default rows per page for every admin list table, and the choices offered in
// the "rows per page" selector.
const PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [15, 50, 100];

// Wrap buildTable with client-side pagination. `rows` is the full array of
// already-mapped cell arrays (same shape buildTable expects). Slices into pages
// and renders a pager (rows-per-page selector + prev/next) below whenever the
// list is longer than the smallest page size. Page state lives in this closure,
// so callers that rebuild the table (e.g. on filter change) get a fresh instance
// that starts back on page 1.
function paginatedTable(headers, rows, pageSize = PAGE_SIZE) {
  const wrap = el('<div></div>');
  const tableMount = el('<div></div>');
  const pager = el('<div class="pager"></div>');
  wrap.appendChild(tableMount);
  wrap.appendChild(pager);
  let size = pageSize;
  let page = 1;
  const draw = () => {
    const pageCount = Math.max(1, Math.ceil(rows.length / size));
    page = Math.min(Math.max(1, page), pageCount);
    const start = (page - 1) * size;
    const end = Math.min(start + size, rows.length);
    tableMount.innerHTML = '';
    tableMount.appendChild(buildTable(headers, rows.slice(start, end)));
    pager.innerHTML = '';

    const sizeSel = el(`<select class="pager-size">${PAGE_SIZE_OPTIONS
      .map((n) => `<option value="${n}"${n === size ? ' selected' : ''}>${n} / page</option>`)
      .join('')}</select>`);
    sizeSel.addEventListener('change', () => { size = Number(sizeSel.value); page = 1; draw(); });

    const prev = el(`<button class="btn ghost sm"${page <= 1 ? ' disabled' : ''}>‹ Prev</button>`);
    const next = el(`<button class="btn ghost sm"${page >= pageCount ? ' disabled' : ''}>Next ›</button>`);
    prev.addEventListener('click', () => { page--; draw(); });
    next.addEventListener('click', () => { page++; draw(); });

    pager.appendChild(el(`<span class="pager-info">${start + 1}–${end} of ${rows.length}</span>`));
    pager.appendChild(sizeSel);
    pager.appendChild(prev);
    pager.appendChild(el(`<span class="pager-page">Page ${page} / ${pageCount}</span>`));
    pager.appendChild(next);
  };
  draw();
  return wrap;
}
function rowBtns(defs) {
  const wrap = el('<div class="row-actions"></div>');
  defs.forEach(([label, cls, fn]) => {
    const b = el(`<button class="btn sm ${cls}">${label}</button>`);
    b.addEventListener('click', fn); wrap.appendChild(b);
  });
  return wrap;
}

// Render a list page with a filter/search toolbar above a live-updating table.
// Re-filters and rebuilds the table on every control change (no server round-trip).
//   data     : the full array of records
//   noun     : singular label for the count ("car" → "3 of 12 cars")
//   controls : [{ id, type:'select'|'search', placeholder?, options?:[{value,label}], test(item, value) }]
//              `test` is only called when the control has a non-empty value.
//   columns  : table header array
//   row      : (item) => array of cells for buildTable
//   headBtn  : optional element (e.g. an "+ Add" button) placed in the card head
function filterableList({ data, noun, controls, columns, row, headBtn }) {
  const wrap = el('<div></div>');
  const toolbar = el('<div class="toolbar"></div>');
  controls.forEach((c) => {
    if (c.type === 'select') {
      const opts = c.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
      toolbar.appendChild(el(`<select id="${c.id}">${opts}</select>`));
    } else {
      toolbar.appendChild(el(`<input id="${c.id}" type="search" placeholder="${esc(c.placeholder || 'Search…')}" />`));
    }
  });
  const clearBtn = el('<button class="btn ghost sm">Clear</button>');
  toolbar.appendChild(clearBtn);

  const card = el('<div class="card list-card"></div>');
  const head = el('<div class="card-head"><h2></h2></div>');
  if (headBtn) head.appendChild(headBtn);
  const mount = el('<div></div>');
  card.appendChild(head); card.appendChild(mount);
  wrap.appendChild(toolbar); wrap.appendChild(card);
  render(wrap);

  const inputs = controls.map((c) => wrap.querySelector('#' + c.id));
  const apply = () => {
    const rows = data.filter((item) => controls.every((c, i) => {
      const raw = inputs[i].value;
      const v = c.type === 'search' ? raw.trim().toLowerCase() : raw;
      return !v || c.test(item, v);
    }));
    head.querySelector('h2').textContent =
      `${rows.length} of ${data.length} ${noun}${data.length === 1 ? '' : 's'}`;
    mount.innerHTML = '';
    mount.appendChild(paginatedTable(columns, rows.map(row)));
  };
  controls.forEach((c, i) => inputs[i].addEventListener(c.type === 'search' ? 'input' : 'change', apply));
  clearBtn.addEventListener('click', () => { inputs.forEach((inp) => { inp.value = ''; }); apply(); });
  apply();
}

// ---------------- Dashboard charts (dependency-free, themeable SVG) ----------------
function monthSeries(n) {
  const out = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }) });
  }
  return out;
}
function bucketKey(dateLike) { const d = new Date(dateLike); return `${d.getFullYear()}-${d.getMonth()}`; }
function revByMonth(bookings, months) {
  const map = {}; months.forEach((m) => { map[m.key] = 0; });
  bookings.forEach((b) => {
    if (!['ongoing', 'completed'].includes(b.status)) return;
    const k = bucketKey(b.createdAt || b.start);
    if (k in map) map[k] += (b.fare && b.fare.base) || 0;
  });
  return months.map((m) => map[m.key]);
}
function countByMonth(bookings, months) {
  const map = {}; months.forEach((m) => { map[m.key] = 0; });
  bookings.forEach((b) => { const k = bucketKey(b.createdAt || b.start); if (k in map) map[k] += 1; });
  return months.map((m) => map[m.key]);
}
function delta(series) {
  if (series.length < 2) return null;
  const last = series[series.length - 1], prev = series[series.length - 2];
  if (!prev) return last ? 100 : 0;
  return Math.round(((last - prev) / prev) * 100);
}
function smoothPath(pts) {
  if (!pts.length) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1], cx = (p0.x + p1.x) / 2;
    d += ` C${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}
function areaChart(values, labels, color, id) {
  const W = 620, H = 210, pl = 12, pr = 12, pt = 18, pb = 30;
  const iw = W - pl - pr, ih = H - pt - pb, n = values.length, max = Math.max(...values, 1);
  const X = (i) => (n <= 1 ? pl + iw / 2 : pl + (i / (n - 1)) * iw);
  const Y = (v) => pt + ih - (v / max) * ih;
  const pts = values.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L${X(n - 1)},${pt + ih} L${X(0)},${pt + ih} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const y = pt + ih - f * ih; return `<line class="grid" x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}"/>`; }).join('');
  const dots = pts.map((p, i) => `<circle class="dot" cx="${p.x}" cy="${p.y}" r="3.6" style="animation-delay:${(0.6 + i * 0.08).toFixed(2)}s"><title>${esc(labels[i])}: ${money(values[i])}</title></circle>`).join('');
  const vlabels = pts.map((p, i) => {
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    const lx = i === 0 ? pl : i === n - 1 ? W - pr : p.x;
    return `<text class="vlab" x="${lx}" y="${Math.max(pt + 9, p.y - 9)}" text-anchor="${anchor}" style="animation-delay:${(0.7 + i * 0.08).toFixed(2)}s">${esc(money(values[i]))}</text>`;
  }).join('');
  const xlabels = labels.map((l, i) => `<text class="xlab" x="${X(i)}" y="${H - 8}">${esc(l)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="area-chart">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:${color};stop-opacity:.26"/>
      <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
    </linearGradient></defs>
    ${grid}
    <path class="area-fill" d="${area}" fill="url(#${id})"/>
    <path class="area-line" d="${line}" fill="none" style="stroke:${color}" stroke-width="3" pathLength="1"/>
    ${dots}${vlabels}${xlabels}
  </svg>`;
}
function sparkline(values, color, id) {
  const W = 200, H = 46, n = values.length, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const X = (i) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const Y = (v) => H - 4 - ((v - min) / ((max - min) || 1)) * (H - 9);
  const pts = values.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L${X(n - 1)},${H} L${X(0)},${H} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" class="spark" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:${color};stop-opacity:.32"/>
      <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
    </linearGradient></defs>
    <path class="spark-fill" d="${area}" fill="url(#${id})"/>
    <path class="spark-line" d="${line}" fill="none" style="stroke:${color}" stroke-width="2.5" pathLength="1"/>
  </svg>`;
}
function donut(segments, id) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 54, C = 2 * Math.PI * r;
  let off = 0;
  const segs = segments.map((seg) => {
    const frac = total ? seg.value / total : 0;
    const len = Math.max(0, frac * C - (frac > 0 && frac < 1 ? 3 : 0));
    const ring = `<circle class="donut-seg" cx="64" cy="64" r="${r}" fill="none" style="stroke:${seg.color}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 64 64)"><title>${esc(seg.label)}: ${seg.value}</title></circle>`;
    off += frac * C;
    return ring;
  }).join('');
  return `<svg viewBox="0 0 128 128" class="donut">
    <circle cx="64" cy="64" r="${r}" fill="none" style="stroke:var(--line)" stroke-width="18"/>
    ${segs}
    <text class="donut-c" x="64" y="60">${total}</text>
    <text class="donut-cs" x="64" y="80">total</text>
  </svg>`;
}
function hbars(items) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return `<div class="bars">${items.map((it) => `
    <div class="bar-row">
      <span class="bar-l">${esc(it.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="--w:${Math.round((it.value / max) * 100)}%;background:${it.color}"></div></div>
      <span class="bar-v">${it.value}</span>
    </div>`).join('')}</div>`;
}
function kpiCard(label, value, cVar, iconVar, deltaPct, extraHtml) {
  const trend = deltaPct == null ? ''
    : `<span class="kpi-trend ${deltaPct >= 0 ? 'up' : 'down'}">${deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct)}%</span>`;
  return `<div class="kpi" style="--c:var(${cVar})">
    <div class="kpi-top"><span class="kpi-ic"><i style="--icon:var(${iconVar})"></i></span>${trend}</div>
    <div class="kpi-n">${value}</div>
    <div class="kpi-l">${esc(label)}</div>
    <div class="kpi-extra">${extraHtml}</div>
  </div>`;
}
function attnRow(iconVar, cVar, title, sub, n, tab) {
  return `<button class="attn" data-go="${tab}" type="button" style="--c:var(${cVar})">
    <span class="attn-ic"><i style="--icon:var(${iconVar})"></i></span>
    <span class="attn-tx"><span class="attn-t">${esc(title)}</span><span class="attn-s">${esc(sub)}</span></span>
    <span class="attn-n">${n == null ? 0 : n}</span>
  </button>`;
}

// ---------------- Forms / actions ----------------
function field(label, id, value = '', type = 'text', full = false) {
  return `<div class="${full ? 'full' : ''}"><label>${label}</label>
    <input id="${id}" type="${type}" value="${esc(value)}" /></div>`;
}
function selectField(label, id, value, options) {
  return `<div><label>${label}</label><select id="${id}">
    ${options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}
  </select></div>`;
}

// Multi-section feature picker. Opens a stacked popup (above the car-form
// modal), mutates the passed `selected` Set live, and calls onChange after
// every change so the form summary stays in sync.
function openFeatureSheet(selected, onChange) {
  const allCatalog = [].concat(...Object.values(FEATURE_CATALOG));
  const overlay = el(`<div class="sheet-overlay">
    <div class="sheet-card">
      <div class="sheet-head">
        <h3>Select features</h3>
        <button type="button" class="icon-btn" id="fs_close">✕</button>
      </div>
      <div class="sheet-body" id="fs_body"></div>
      <div class="sheet-foot">
        <div class="feat-addrow">
          <input id="fs_input" type="text" placeholder="Add a custom feature…" />
          <button type="button" class="btn ghost" id="fs_add">Add</button>
        </div>
        <button type="button" class="btn" id="fs_done">Done</button>
      </div>
    </div>
  </div>`);
  document.body.appendChild(overlay);

  const bodyEl = overlay.querySelector('#fs_body');
  const input = overlay.querySelector('#fs_input');
  const render = () => {
    let html = '';
    for (const [group, items] of Object.entries(FEATURE_CATALOG)) {
      const n = items.filter((f) => selected.has(f)).length;
      html += `<div class="feat-group">
        <span class="feat-group-h">${esc(group)}${n ? ` <em>(${n})</em>` : ''}</span>
        <div class="feat-wrap">${items.map((f) =>
          `<button type="button" class="feat-chip ${selected.has(f) ? 'on' : ''}" data-f="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      </div>`;
    }
    const custom = [...selected].filter((f) => !allCatalog.includes(f));
    if (custom.length) {
      html += `<div class="feat-group">
        <span class="feat-group-h">Custom <em>(${custom.length})</em></span>
        <div class="feat-wrap">${custom.map((f) =>
          `<button type="button" class="feat-chip on custom" data-f="${esc(f)}">${esc(f)} <span class="x">✕</span></button>`).join('')}</div>
      </div>`;
    }
    bodyEl.innerHTML = html;
    bodyEl.querySelectorAll('.feat-chip').forEach((btn) => btn.addEventListener('click', () => {
      const f = btn.dataset.f;
      if (selected.has(f)) selected.delete(f); else selected.add(f);
      render(); onChange();
    }));
    overlay.querySelector('#fs_done').textContent = `Done${selected.size ? ` (${selected.size})` : ''}`;
  };
  const addCustom = () => {
    (input.value || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((f) => {
      const match = allCatalog.find((x) => x.toLowerCase() === f.toLowerCase());
      selected.add(match || f);
    });
    input.value = ''; render(); onChange();
  };
  const close = () => overlay.remove();

  overlay.querySelector('#fs_add').addEventListener('click', addCustom);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCustom(); }
  });
  overlay.querySelector('#fs_close').addEventListener('click', close);
  overlay.querySelector('#fs_done').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  render();
}

function carForm(car) {
  const c = car || {};
  // Six fixed photo slots, in this order. Existing images fill them in order.
  const PHOTO_SLOTS = ['Front', 'Rear', 'Left', 'Right', 'Interior', 'Dashboard'];
  const existing = Array.isArray(c.images) ? c.images.filter(Boolean) : [];
  const slots = PHOTO_SLOTS.map((_, i) => existing[i] || null);
  // RC (Registration Certificate) book photos — ownership proof. [front, back].
  const RC_SLOTS = ['RC front', 'RC back'];
  const existingRc = Array.isArray(c.rcBook) ? c.rcBook.filter(Boolean) : [];
  const rcSlots = RC_SLOTS.map((_, i) => existingRc[i] || null);
  const body = el(`<div>
    <div class="form">
      ${field('Name', 'c_name', c.name, 'text', true)}
      ${selectField('Type', 'c_type', c.type || 'SUV', ['SUV', 'Sedan', 'Hatchback', 'Luxury'])}
      ${selectField('Transmission', 'c_trans', c.transmission || 'manual', ['manual', 'automatic'])}
      ${selectField('Fuel', 'c_fuel', c.fuel || 'petrol', ['petrol', 'diesel', 'electric', 'hybrid'])}
      ${field('Seats', 'c_seats', c.seats ?? 5, 'number')}
      ${field('Price / hour', 'c_pph', c.pricePerHour ?? 0, 'number')}
      ${field('Price / day', 'c_ppd', c.pricePerDay ?? 0, 'number')}
      ${field('Pickup address', 'c_addr', c.pickupAddress, 'text', true)}
      <div class="full">
        <label>Car photos <span class="lbl-hint">(max 6)</span></label>
        <div class="photo-grid" id="c_photo_grid"></div>
      </div>
      <div class="full">
        <label>RC book <span class="lbl-hint">(ownership proof)</span></label>
        <div class="photo-grid" id="c_rc_grid"></div>
      </div>
      <div class="full">
        <label>Features</label>
        <div class="feat-summary" id="c_feat_summary"></div>
        <button type="button" class="btn ghost feat-open" id="c_feat_open">＋ Select features</button>
      </div>
      ${field('Host name', 'c_host', c.host?.name || '', 'text')}
      ${selectField('Active', 'c_active', c.active === false ? 'no' : 'yes', ['yes', 'no'])}
    </div>
    <div class="form-actions">
      <button class="btn ghost" id="c_cancel">Cancel</button>
      <button class="btn" id="c_save">Save</button>
    </div>
  </div>`);
  openModal(car ? 'Edit car' : 'Add car', body);

  // Renders a labelled grid of photo slots backed by `slotArr`; each filled
  // slot shows a thumbnail with a remove button, each empty slot an upload tile.
  const renderGrid = (gridEl, names, slotArr, render) => {
    gridEl.innerHTML = names.map((name, i) => slotArr[i]
      ? `<div class="photo-slot">
           <div class="photo-thumb"><img src="${esc(slotArr[i])}" alt="" />
             <button type="button" class="photo-rm" data-i="${i}" title="Remove">✕</button></div>
           <span class="photo-cap">${esc(name)}</span>
         </div>`
      : `<div class="photo-slot">
           <label class="photo-add" data-i="${i}">
             <input type="file" accept="image/*" hidden data-i="${i}" />
             <span>＋</span></label>
           <span class="photo-cap">${esc(name)}</span>
         </div>`
    ).join('');
    gridEl.querySelectorAll('.photo-rm').forEach((btn) =>
      btn.addEventListener('click', () => { slotArr[+btn.dataset.i] = null; render(); }));
    gridEl.querySelectorAll('input[type=file]').forEach((input) =>
      input.addEventListener('change', async () => {
        const file = (input.files || [])[0];
        input.value = '';
        if (!file) return;
        const tile = input.closest('.photo-add');
        tile.classList.add('busy');
        try { slotArr[+input.dataset.i] = await uploadFile(file); render(); }
        catch (e) { toast(e.message); tile.classList.remove('busy'); }
      }));
  };

  const grid = body.querySelector('#c_photo_grid');
  const renderPhotos = () => renderGrid(grid, PHOTO_SLOTS, slots, renderPhotos);
  renderPhotos();

  const rcGrid = body.querySelector('#c_rc_grid');
  const renderRc = () => renderGrid(rcGrid, RC_SLOTS, rcSlots, renderRc);
  renderRc();

  // Features: selection lives in a Set, edited via the multi-section popup.
  const selected = new Set((Array.isArray(c.features) ? c.features : []).filter(Boolean));
  const summary = body.querySelector('#c_feat_summary');
  const renderSummary = () => {
    if (!selected.size) {
      summary.innerHTML = '<span class="feat-empty">No features selected yet.</span>';
      return;
    }
    summary.innerHTML = [...selected].map((f) =>
      `<span class="feat-tag">${esc(f)}<button type="button" data-f="${esc(f)}" title="Remove">✕</button></span>`).join('');
    summary.querySelectorAll('button').forEach((btn) =>
      btn.addEventListener('click', () => { selected.delete(btn.dataset.f); renderSummary(); }));
  };
  body.querySelector('#c_feat_open').addEventListener('click', () =>
    openFeatureSheet(selected, renderSummary));
  renderSummary();

  body.querySelector('#c_cancel').addEventListener('click', closeModal);
  body.querySelector('#c_save').addEventListener('click', async () => {
    const payload = {
      name: val('c_name'), type: val('c_type'),
      transmission: val('c_trans'), fuel: val('c_fuel'),
      seats: +val('c_seats'), pricePerHour: +val('c_pph'), pricePerDay: +val('c_ppd'),
      pickupAddress: val('c_addr'),
      images: slots.filter(Boolean),
      features: [...selected],
      host: { name: val('c_host') },
      active: val('c_active') === 'yes',
    };
    try {
      if (car) await api(`/admin/cars/${car.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/cars', { method: 'POST', body: payload });
      closeModal(); toast('Car saved'); routes.cars();
    } catch (e) { toast(e.message); }
  });
}

async function delCar(car) {
  if (!confirm(`Delete "${car.name}"?`)) return;
  try { await api(`/admin/cars/${car.id}`, { method: 'DELETE' }); toast('Deleted'); routes.cars(); }
  catch (e) { toast(e.message); }
}

// Read-only detail view for a single booking — shows the car, trip window,
// full fare breakdown and the operational flags so the admin can see exactly
// what the app recorded (status, trip started, host verification).
function bookingDetail(b) {
  const c = b.car || {};
  const f = b.fare || {};
  const img = (c.images && c.images[0]) || '';
  const durationMs = new Date(b.end) - new Date(b.start);
  const days = durationMs > 0 ? Math.ceil(durationMs / 86400000) : 0;
  const payable = (f.base || 0) + (f.taxes || 0) + (f.addOns || 0) +
    (f.deposit || 0) - (f.discount || 0) - (f.rewardDiscount || 0);

  const fareRow = (label, amount, sign = '') =>
    `<div class="ud-kv"><span>${label}</span><b>${sign}${money(amount)}</b></div>`;

  const body = el(`<div class="udetail">
    <div class="ud-head">
      <div class="ud-avatar">${img ? `<img src="${esc(img)}" alt="" />` : '🚗'}</div>
      <div class="ud-id">
        <div class="ud-name">${esc(c.name || 'Car')} ${statusPill(b.status)}</div>
        <div class="ud-sub">Booking ${esc(b.id)}${c.type ? ' · ' + esc(c.type) : ''}</div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Customer</span></div>
      <div class="ud-meta">
        <div class="ud-kv"><span>Name</span><b>${esc((b.user && b.user.name) || '—')}</b></div>
        <div class="ud-kv"><span>Phone</span><b>${fmtPhone(b.user && b.user.phone)}</b></div>
        <div class="ud-kv"><span>Email</span><b>${esc((b.user && b.user.email) || '—')}</b></div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Trip</span><span class="pill ${b.tripStarted ? 'ok' : 'gray'}">${b.tripStarted ? 'trip started' : 'not started'}</span></div>
      <div class="ud-meta">
        <div class="ud-kv"><span>Pickup</span><b>${fmtDateTime(b.start)}</b></div>
        <div class="ud-kv"><span>Return</span><b>${fmtDateTime(b.end)}</b></div>
        <div class="ud-kv"><span>Package</span><b>${esc(b.package || '—')}</b></div>
        <div class="ud-kv"><span>Duration</span><b>${days} day${days === 1 ? '' : 's'}</b></div>
        <div class="ud-kv"><span>Pickup address</span><b>${esc(c.pickupAddress || '—')}</b></div>
        <div class="ud-kv"><span>Host</span><b>${esc((c.host && c.host.name) || '—')}</b></div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Fare</span></div>
      <div class="ud-meta">
        ${fareRow('Base', f.base || 0)}
        ${fareRow('Taxes', f.taxes || 0)}
        ${fareRow('Add-ons', f.addOns || 0)}
        ${fareRow('Discount', f.discount || 0, '−')}
        ${fareRow('Reward discount', f.rewardDiscount || 0, '−')}
        ${fareRow('Security deposit', f.deposit || 0)}
        <div class="ud-kv"><span>Payable</span><b>${money(payable)}</b></div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Operational</span></div>
      <div class="ud-meta">
        <div class="ud-kv"><span>Status</span><b>${statusPill(b.status)}</b></div>
        <div class="ud-kv"><span>Trip started</span><b>${b.tripStarted ? 'Yes' : 'No'}</b></div>
        <div class="ud-kv"><span>Verified by host</span><b>${b.isVerifiedByHost ? 'Yes' : 'No'}</b></div>
        <div class="ud-kv"><span>Unlock OTP</span><b>${esc(b.unlockOtp || '—')}</b></div>
        <div class="ud-kv"><span>Booked on</span><b>${fmtDateTime(b.createdAt)}</b></div>
      </div>
    </div>

    <div class="ud-section" id="bd_inspections">
      <div class="ud-section-h"><span>Inspection photos</span></div>
      <div class="ud-meta"><div class="ud-kv"><span>Loading…</span></div></div>
    </div>

    <div class="form-actions">
      <button class="btn" id="bd_edit">Change status</button>
    </div>
  </div>`);
  openModal(`Booking ${b.id}`, body);
  body.querySelector('#bd_edit').addEventListener('click', () => bookingForm(b));

  // Lazily load the pre/post-trip inspections so the modal opens instantly and
  // the (potentially heavy) photos stream in after.
  loadBookingInspections(b.id, body.querySelector('#bd_inspections'));
}

// Render one inspection's meta + captured photos. `type` is preTrip | postTrip.
function inspectionBlock(insp) {
  const label = insp.type === 'postTrip' ? 'Post-trip inspection' : 'Pre-trip inspection';
  const photos = Array.isArray(insp.photos) ? insp.photos.filter(Boolean) : [];
  const fuelPct = Math.round((Number(insp.fuelLevel) || 0) * 100);
  const photoHtml = photos.length
    ? photos.map((src, i) => `
        <a class="ud-doc" href="${esc(src)}" target="_blank" rel="noopener">
          <img src="${esc(src)}" alt="${esc(label)} photo ${i + 1}" loading="lazy" />
          <span class="ud-doc-l">Photo ${i + 1} <em>View ↗</em></span>
        </a>`).join('')
    : `<div class="ud-doc empty">
         <span class="ud-doc-ph">No photos uploaded</span>
         <span class="ud-doc-l">${esc(label)}</span>
       </div>`;

  return `
    <div class="ud-section-h" style="margin-top:14px">
      <span>${esc(label)}</span>
      <span class="pill ${insp.type === 'postTrip' ? 'ok' : 'blue'}">${photos.length} photo${photos.length === 1 ? '' : 's'}</span>
    </div>
    <div class="ud-meta">
      <div class="ud-kv"><span>Fuel level</span><b>${fuelPct}%</b></div>
      <div class="ud-kv"><span>Odometer</span><b>${(Number(insp.odometer) || 0).toLocaleString('en-IN')} km</b></div>
      <div class="ud-kv"><span>Captured on</span><b>${fmtDateTime(insp.at)}</b></div>
      <div class="ud-kv"><span>Notes</span><b>${esc(insp.notes || '—')}</b></div>
    </div>
    <div class="ud-docs">${photoHtml}</div>`;
}

async function loadBookingInspections(bookingId, section) {
  try {
    const { data } = await api(`/admin/bookings/${bookingId}/inspections`);
    const list = Array.isArray(data) ? data : [];
    if (!list.length) {
      section.innerHTML = `<div class="ud-section-h"><span>Inspection photos</span></div>
        <div class="ud-meta"><div class="ud-kv"><span>No inspection recorded for this booking.</span></div></div>`;
      return;
    }
    // preTrip first, then postTrip (the API already sorts by capture time).
    section.innerHTML = `<div class="ud-section-h"><span>Inspection photos</span></div>
      ${list.map(inspectionBlock).join('')}`;
  } catch (e) {
    section.innerHTML = `<div class="ud-section-h"><span>Inspection photos</span></div>
      <div class="ud-meta"><div class="ud-kv"><span>Couldn't load inspections: ${esc(e.message)}</span></div></div>`;
  }
}

function bookingForm(b) {
  const body = el(`<div>
    <div class="form">
      ${selectField('Status', 'bk_status', b.status, ['upcoming', 'ongoing', 'completed', 'cancelled'])}
      ${selectField('Trip started', 'bk_trip', b.tripStarted ? 'yes' : 'no', ['no', 'yes'])}
      ${selectField('Verified by host', 'bk_ver', b.isVerifiedByHost ? 'yes' : 'no', ['no', 'yes'])}
    </div>
    <div class="form-actions"><button class="btn ghost" id="bk_cancel">Cancel</button>
      <button class="btn" id="bk_save">Save</button></div>
  </div>`);
  openModal(`Booking ${b.id}`, body);
  body.querySelector('#bk_cancel').addEventListener('click', closeModal);
  body.querySelector('#bk_save').addEventListener('click', async () => {
    try {
      await api(`/admin/bookings/${b.id}`, { method: 'PATCH', body: {
        status: val('bk_status'),
        tripStarted: val('bk_trip') === 'yes',
        isVerifiedByHost: val('bk_ver') === 'yes',
      }});
      closeModal(); toast('Updated'); routes.bookings();
    } catch (e) { toast(e.message); }
  });
}

// Detailed claim view — shows the damage photos the user captured so the
// admin can assess the report before updating its status.
function claimDetail(c) {
  const photos = Array.isArray(c.photos) ? c.photos.filter(Boolean) : [];
  const photoHtml = photos.length
    ? photos.map((src, i) => `
        <a class="ud-doc" href="${esc(src)}" target="_blank" rel="noopener">
          <img src="${esc(src)}" alt="Damage photo ${i + 1}" loading="lazy" />
          <span class="ud-doc-l">Photo ${i + 1} <em>View ↗</em></span>
        </a>`).join('')
    : `<div class="ud-doc empty">
         <span class="ud-doc-ph">No photos uploaded</span>
         <span class="ud-doc-l">Damage photos</span>
       </div>`;

  const body = el(`<div class="udetail">
    <div class="ud-section">
      <div class="ud-section-h"><span>Damage report</span>${statusPill(c.status)}</div>
      <div class="ud-meta">
        <div class="ud-kv"><span>Claim ID</span><b>${esc(c.id)}</b></div>
        <div class="ud-kv"><span>Car</span><b>${esc(c.carName || '—')}</b></div>
        <div class="ud-kv"><span>Severity</span><b>${esc(c.severity || '—')}</b></div>
        <div class="ud-kv"><span>Booking</span><b>${esc(c.bookingId || '—')}</b></div>
        <div class="ud-kv"><span>Insurer</span><b>${esc(c.insurer || '—')}</b></div>
        <div class="ud-kv"><span>Processing fee</span><b>${money(c.processingFee)}</b></div>
        <div class="ud-kv"><span>Reported</span><b>${fmtDate(c.createdAt)}</b></div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Description</span></div>
      <p class="ud-text">${esc(c.description || 'No description provided.')}</p>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Damage photos</span><span class="muted">${photos.length} captured</span></div>
      <div class="ud-docs">${photoHtml}</div>
    </div>

    <div class="form-actions">
      <button class="btn ghost" id="cd_close">Close</button>
      <button class="btn" id="cd_update">Update status</button>
    </div>
  </div>`);
  openModal(`Claim ${c.id}`, body);
  body.querySelector('#cd_close').addEventListener('click', closeModal);
  body.querySelector('#cd_update').addEventListener('click', () => { closeModal(); claimForm(c); });
}

function claimForm(c) {
  const body = el(`<div>
    <div class="form">
      ${selectField('Status', 'cl_status', c.status, ['submitted', 'underReview', 'resolved'])}
      ${field('Insurer', 'cl_insurer', c.insurer)}
      ${field('Processing fee', 'cl_fee', c.processingFee ?? 0, 'number')}
    </div>
    <div class="form-actions"><button class="btn ghost" id="cl_cancel">Cancel</button>
      <button class="btn" id="cl_save">Save</button></div>
  </div>`);
  openModal(`Claim ${c.id}`, body);
  body.querySelector('#cl_cancel').addEventListener('click', closeModal);
  body.querySelector('#cl_save').addEventListener('click', async () => {
    try {
      await api(`/admin/claims/${c.id}`, { method: 'PATCH', body: {
        status: val('cl_status'), insurer: val('cl_insurer'), processingFee: +val('cl_fee'),
      }});
      closeModal(); toast('Updated'); routes.claims();
    } catch (e) { toast(e.message); }
  });
}

async function setKyc(user, status) {
  try {
    await api(`/admin/users/${user.id}/kyc`, { method: 'PATCH', body: { status } });
    toast(status === 'verified' ? 'KYC approved' : 'KYC rejected'); routes.users();
  } catch (e) { toast(e.message); }
}

// Detailed user view — shows the uploaded licence photos so the admin can
// verify the user/host before approving KYC.
function userDetail(u) {
  const k = u.kyc || {};
  const initials = (u.name || u.phone || '?').trim().charAt(0).toUpperCase();
  const docs = [['Front of licence', imgSrc(k.frontImage)], ['Back of licence', imgSrc(k.backImage)]];
  const docHtml = docs.map(([label, src]) => src
    ? `<a class="ud-doc" href="${esc(src)}" target="_blank" rel="noopener">
         <img src="${esc(src)}" alt="${esc(label)}" loading="lazy" />
         <span class="ud-doc-l">${esc(label)} <em>View ↗</em></span>
       </a>`
    : `<div class="ud-doc empty">
         <span class="ud-doc-ph">No photo uploaded</span>
         <span class="ud-doc-l">${esc(label)}</span>
       </div>`).join('');

  const body = el(`<div class="udetail">
    <div class="ud-head">
      <div class="ud-avatar">${imgSrc(u.avatarUrl) ? `<img src="${esc(imgSrc(u.avatarUrl))}" alt="" />` : esc(initials)}</div>
      <div class="ud-id">
        <div class="ud-name">${esc(u.name || 'Unnamed user')} ${statusPill(u.role)}</div>
        <div class="ud-sub">${fmtPhone(u.phone)}${u.email ? ' · ' + esc(u.email) : ''}</div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Driving licence</span>${statusPill(u.licenseStatus)}</div>
      <div class="ud-kv"><span>Licence number</span><b>${esc(k.licenseNumber || '—')}</b></div>
      <div class="ud-docs">${docHtml}</div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Account</span></div>
      <div class="ud-meta">
        <div class="ud-kv"><span>Wallet</span><b>${money(u.walletBalance)}</b></div>
        <div class="ud-kv"><span>UPI ID</span><b>${esc(u.upiId || '—')}</b></div>
        <div class="ud-kv"><span>Referral code</span><b>${esc(u.referralCode || '—')}</b></div>
        <div class="ud-kv"><span>Joined</span><b>${fmtDate(u.createdAt)}</b></div>
      </div>
    </div>

    <div class="form-actions">
      ${u.licenseStatus === 'pending' ? `<button class="btn danger" id="ud_reject">Reject licence</button>` : ''}
      ${u.licenseStatus === 'verified'
        ? `<button class="btn danger" id="ud_revoke">Revoke verification</button>`
        : `<button class="btn" id="ud_approve">Approve licence</button>`}
    </div>
  </div>`);
  openModal('User details', body);

  const onAction = (sel, status) => {
    const b = body.querySelector(sel);
    if (b) b.addEventListener('click', async () => { await setKyc(u, status); closeModal(); });
  };
  onAction('#ud_approve', 'verified');
  onAction('#ud_reject', 'notSubmitted');
  onAction('#ud_revoke', 'notSubmitted');
}

function offerForm(promo) {
  const p = promo || {};
  const pctValue = p.discountPct != null ? Math.round(p.discountPct * 100) : 10;
  const body = el(`<div>
    <div class="form">
      <div><label>Code</label><input id="o_code" value="${esc(p.id || '')}" ${promo ? 'disabled' : ''} placeholder="FIRST20" /></div>
      ${field('Discount %', 'o_pct', pctValue, 'number')}
      ${field('Title', 'o_title', p.title || '', 'text', true)}
      ${field('Description', 'o_desc', p.description || '', 'text', true)}
      ${field('Min fare (₹)', 'o_min', p.minFare ?? 0, 'number')}
      ${field('Max discount (₹, 0 = none)', 'o_max', p.maxDiscount ?? 0, 'number')}
      ${selectField('Active', 'o_active', p.active === false ? 'no' : 'yes', ['yes', 'no'])}
    </div>
    <div class="form-actions"><button class="btn ghost" id="o_cancel">Cancel</button>
      <button class="btn" id="o_save">Save</button></div>
  </div>`);
  openModal(promo ? 'Edit code' : 'Add code', body);
  body.querySelector('#o_cancel').addEventListener('click', closeModal);
  body.querySelector('#o_save').addEventListener('click', async () => {
    const payload = {
      discountPct: (+val('o_pct') || 0) / 100,
      title: val('o_title'), description: val('o_desc'),
      minFare: +val('o_min'), maxDiscount: +val('o_max'),
      active: val('o_active') === 'yes',
    };
    try {
      if (promo) await api(`/admin/offers/${promo.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/offers', { method: 'POST', body: { code: val('o_code'), ...payload } });
      closeModal(); toast('Saved'); routes.offers();
    } catch (e) { toast(e.message); }
  });
}

async function delOffer(promo) {
  if (!confirm(`Delete code "${promo.id}"?`)) return;
  try { await api(`/admin/offers/${promo.id}`, { method: 'DELETE' }); toast('Deleted'); routes.offers(); }
  catch (e) { toast(e.message); }
}

function rewardForm(reward) {
  const r = reward || {};
  const body = el(`<div>
    <div class="form">
      <div><label>ID</label><input id="r_id" value="${esc(r.id || '')}" ${reward ? 'disabled' : ''} placeholder="r1" /></div>
      ${field('Title', 'r_title', r.title || '', 'text', true)}
      ${field('Description', 'r_desc', r.description || '', 'text', true)}
      ${field('Cost (points)', 'r_cost', r.cost ?? 100, 'number')}
      ${field('Value (₹ off, 0 = perk)', 'r_value', r.value ?? 0, 'number')}
      ${selectField('Active', 'r_active', r.active === false ? 'no' : 'yes', ['yes', 'no'])}
    </div>
    <div class="form-actions"><button class="btn ghost" id="r_cancel">Cancel</button>
      <button class="btn" id="r_save">Save</button></div>
  </div>`);
  openModal(reward ? 'Edit reward' : 'Add reward', body);
  body.querySelector('#r_cancel').addEventListener('click', closeModal);
  body.querySelector('#r_save').addEventListener('click', async () => {
    const payload = {
      title: val('r_title'), description: val('r_desc'),
      cost: +val('r_cost'), value: +val('r_value'),
      active: val('r_active') === 'yes',
    };
    try {
      if (reward) await api(`/admin/rewards/${reward.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/rewards', { method: 'POST', body: { id: val('r_id').trim(), ...payload } });
      closeModal(); toast('Saved'); routes.rewards();
    } catch (e) { toast(e.message); }
  });
}

async function delReward(reward) {
  if (!confirm(`Delete reward "${reward.title}"?`)) return;
  try { await api(`/admin/rewards/${reward.id}`, { method: 'DELETE' }); toast('Deleted'); routes.rewards(); }
  catch (e) { toast(e.message); }
}

// Attractive membership plan card (replaces the old table row). The "popular"
// plan gets a featured navy treatment with light-on-dark content.
function planCard(p) {
  const featured = !!p.highlighted;
  const disc = Math.round((p.discountPct || 0) * 100);
  const mult = p.loyaltyMultiplier || 1;
  const perks = p.perks || [];
  const card = el(`<div class="plan-card${featured ? ' featured' : ''}">
    ${featured ? '<div class="plan-ribbon">★ Popular</div>' : ''}
    <div class="plan-top">
      <div class="plan-headings">
        <div class="plan-name">${esc(p.name || p.id)}</div>
        ${p.tagline ? `<div class="plan-tag">${esc(p.tagline)}</div>` : ''}
      </div>
      <span class="plan-id">${esc(p.id)}</span>
    </div>
    <div class="plan-price"><span class="amt">${money(p.monthlyPrice)}</span><span class="per">/mo</span></div>
    <div class="plan-stats">
      <div class="ps"><div class="ps-n">${disc}%</div><div class="ps-l">off trips</div></div>
      <div class="ps"><div class="ps-n">${p.waiveDeposit ? 'Zero' : 'Std'}</div><div class="ps-l">deposit</div></div>
      <div class="ps"><div class="ps-n">${mult}x</div><div class="ps-l">points</div></div>
    </div>
    ${perks.length ? `<ul class="plan-perks">${perks.map((pk) => `<li>${esc(pk)}</li>`).join('')}</ul>` : ''}
    <div class="plan-actions">
      <button class="btn ghost sm" data-act="edit">Edit</button>
      <button class="btn danger sm" data-act="del">Delete</button>
    </div>
  </div>`);
  card.querySelector('[data-act="edit"]').addEventListener('click', () => planForm(p));
  card.querySelector('[data-act="del"]').addEventListener('click', () => delPlan(p));
  return card;
}

function planForm(plan) {
  const p = plan || {};
  // Perks are edited one-per-line in a textarea, then split on save.
  const perksText = (p.perks || []).join('\n');
  const body = el(`<div>
    <div class="form">
      <div><label>Plan ID</label><input id="p_id" value="${esc(p.id || '')}" ${plan ? 'disabled' : ''} placeholder="basic / plus / pro" /></div>
      ${field('Name', 'p_name', p.name || '', 'text')}
      ${field('Price / month (₹)', 'p_price', p.monthlyPrice ?? 0, 'number')}
      ${field('Tagline', 'p_tagline', p.tagline || '', 'text', true)}
      ${field('Trip discount %', 'p_disc', p.discountPct != null ? Math.round(p.discountPct * 100) : 0, 'number')}
      ${field('Loyalty points multiplier', 'p_mult', p.loyaltyMultiplier ?? 1, 'number')}
      ${selectField('Waive deposit', 'p_dep', p.waiveDeposit ? 'yes' : 'no', ['yes', 'no'])}
      <div class="full"><label>Perks (one per line)</label><textarea id="p_perks" rows="5">${esc(perksText)}</textarea></div>
      ${selectField('Mark as popular', 'p_hl', p.highlighted ? 'yes' : 'no', ['yes', 'no'])}
    </div>
    <div class="form-actions"><button class="btn ghost" id="p_cancel">Cancel</button>
      <button class="btn" id="p_save">Save</button></div>
  </div>`);
  openModal(plan ? 'Edit plan' : 'Add plan', body);
  body.querySelector('#p_cancel').addEventListener('click', closeModal);
  body.querySelector('#p_save').addEventListener('click', async () => {
    const perks = val('p_perks').split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = {
      name: val('p_name'),
      monthlyPrice: +val('p_price') || 0,
      tagline: val('p_tagline'),
      perks,
      highlighted: val('p_hl') === 'yes',
      discountPct: (+val('p_disc') || 0) / 100,
      loyaltyMultiplier: +val('p_mult') || 1,
      waiveDeposit: val('p_dep') === 'yes',
    };
    try {
      if (plan) await api(`/admin/plans/${plan.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/plans', { method: 'POST', body: { id: val('p_id').trim().toLowerCase(), ...payload } });
      closeModal(); toast('Saved'); routes.subscriptions();
    } catch (e) { toast(e.message); }
  });
}

async function delPlan(plan) {
  if (!confirm(`Delete plan "${plan.id}"?`)) return;
  try { await api(`/admin/plans/${plan.id}`, { method: 'DELETE' }); toast('Deleted'); routes.subscriptions(); }
  catch (e) { toast(e.message); }
}

// Star rating badge, e.g. "★★★★☆ 4.5".
function stars(rating) {
  const n = Math.round(Number(rating) || 0);
  const filled = '★'.repeat(Math.max(0, Math.min(5, n)));
  const empty = '☆'.repeat(Math.max(0, 5 - n));
  // Wrap stars + count in one inline-flex unit so they stay glued together
  // (otherwise the mobile card's space-between flex scatters them apart).
  return `<span class="stars-val"><span class="stars" style="color:var(--c-amber,#f5a623)">${filled}${empty}</span> ${esc(String(rating))}</span>`;
}

// Resolve a human-readable host name whether `host` is a populated object or a raw id.
function payoutHostName(p) {
  return p.hostName || (p.host && p.host.name) || (typeof p.host === 'string' ? p.host : '—');
}

// Status pill reusing the table's completed/cancelled/pending → paid/rejected/requested mapping.
function payoutPill(status) {
  return statusPill(status === 'paid' ? 'completed' : status === 'rejected' ? 'cancelled' : 'pending')
    .replace('completed', 'paid').replace('cancelled', 'rejected').replace('pending', 'requested');
}

// Read-only detail view for a single payout — host contact, UPI target and the
// full status timeline, plus the same paid/reject actions while it is pending.
function payoutDetail(p) {
  const h = (p.host && typeof p.host === 'object') ? p.host : {};
  const upi = p.upiId || h.upiId || '—';

  const body = el(`<div class="udetail">
    <div class="ud-head">
      <div class="ud-avatar">💸</div>
      <div class="ud-id">
        <div class="ud-name">${esc(payoutHostName(p))} ${payoutPill(p.status)}</div>
        <div class="ud-sub">Payout ${esc(p.id)}</div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Host</span></div>
      <div class="ud-meta">
        <div class="ud-kv"><span>Name</span><b>${esc(payoutHostName(p))}</b></div>
        <div class="ud-kv"><span>Phone</span><b>${fmtPhone(h.phone)}</b></div>
        <div class="ud-kv"><span>Email</span><b>${esc(h.email || '—')}</b></div>
      </div>
    </div>

    <div class="ud-section">
      <div class="ud-section-h"><span>Payout</span></div>
      <div class="ud-meta">
        <div class="ud-kv"><span>Amount</span><b>${money(p.amount)}</b></div>
        <div class="ud-kv"><span>UPI ID</span><b>${esc(upi)}</b></div>
        <div class="ud-kv"><span>Status</span><b>${payoutPill(p.status)}</b></div>
        <div class="ud-kv"><span>Requested on</span><b>${fmtDateTime(p.createdAt)}</b></div>
        <div class="ud-kv"><span>Paid on</span><b>${p.paidAt ? fmtDateTime(p.paidAt) : '—'}</b></div>
      </div>
    </div>

    ${p.status === 'requested' ? `<div class="form-actions">
      <button class="btn danger" id="pd_reject">Reject</button>
      <button class="btn" id="pd_paid">Mark paid</button>
    </div>` : ''}
  </div>`);
  openModal(`Payout ${p.id}`, body);
  if (p.status === 'requested') {
    body.querySelector('#pd_paid').addEventListener('click', () => { closeModal(); setPayout(p, 'paid'); });
    body.querySelector('#pd_reject').addEventListener('click', () => { closeModal(); setPayout(p, 'rejected'); });
  }
}

async function setPayout(payout, status) {
  const verb = status === 'paid' ? 'Mark this payout as PAID' : 'Reject this payout';
  if (!confirm(`${verb}?`)) return;
  try {
    await api(`/admin/payouts/${payout.id}`, { method: 'PATCH', body: { status } });
    toast(status === 'paid' ? 'Marked paid' : 'Rejected'); routes.payouts();
  } catch (e) { toast(e.message); }
}

function val(id) { return document.getElementById(id).value; }

// ---------------- Theme picker ----------------
const THEME_KEY = 'gomel_admin_theme';
const SVG = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  chev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
};
// Mini app-preview swatch markup (styled in CSS by the .sw-* class).
const swatch = (kind) =>
  `<span class="sw ${kind}"><span class="sw-rail"></span><span class="sw-line l1"></span><span class="sw-line l2"></span><span class="sw-dot"></span></span>`;
const THEMES = [
  { id: 'light', label: 'Light', desc: 'Always light', icon: SVG.sun, sw: 'sw-light' },
  { id: 'dark', label: 'Dark', desc: 'Always dark', icon: SVG.moon, sw: 'sw-dark' },
  { id: 'system', label: 'System', desc: 'Match your device', icon: SVG.system, sw: 'sw-system' },
];
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
function getThemePref() { return localStorage.getItem(THEME_KEY) || 'system'; }
function resolveTheme(pref) { return pref === 'dark' || (pref === 'system' && prefersDark.matches) ? 'dark' : 'light'; }
function applyTheme(pref) { document.documentElement.setAttribute('data-theme', resolveTheme(pref)); }

function initThemePicker() {
  const mount = $('#themePicker');
  if (!mount) return;
  let pref = getThemePref();
  applyTheme(pref);

  const dd = el(`<div class="theme-dd">
    <button class="theme-trigger" type="button" aria-haspopup="menu" aria-expanded="false" title="Appearance">
      <span class="ti"></span><span class="tl"></span><span class="chev">${SVG.chev}</span>
    </button>
    <div class="theme-menu" role="menu"></div>
  </div>`);
  const trigger = dd.querySelector('.theme-trigger');
  const menu = dd.querySelector('.theme-menu');
  const close = () => { dd.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); };
  const open = () => { dd.classList.add('open'); trigger.setAttribute('aria-expanded', 'true'); };

  function paint() {
    const cur = THEMES.find((t) => t.id === pref) || THEMES[2];
    dd.querySelector('.ti').innerHTML = cur.icon;
    dd.querySelector('.tl').textContent = cur.label;
    menu.innerHTML = '';
    menu.appendChild(el(`<div class="theme-menu-h">Appearance</div>`));
    THEMES.forEach((t) => {
      const active = t.id === pref;
      const opt = el(`<button class="theme-opt ${active ? 'active' : ''}" role="menuitemradio" aria-checked="${active}" type="button">
        ${swatch(t.sw)}
        <span class="ot"><span class="ol">${t.label}</span><span class="od">${t.desc}</span></span>
        <span class="radio"></span>
      </button>`);
      opt.addEventListener('click', () => {
        pref = t.id; localStorage.setItem(THEME_KEY, pref);
        applyTheme(pref); paint(); close();
      });
      menu.appendChild(opt);
    });
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dd.classList.contains('open') ? close() : open();
  });
  document.addEventListener('click', (e) => { if (!dd.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  prefersDark.addEventListener('change', () => { if (pref === 'system') applyTheme('system'); });
  // Keep this trigger in sync when the theme is changed elsewhere (e.g. the
  // Settings page appearance tiles).
  window.addEventListener('themechange', () => { pref = getThemePref(); applyTheme(pref); paint(); });

  paint();
  mount.appendChild(dd);
}

// ---------------- Boot ----------------
initThemePicker();
if (TOKEN) {
  api('/admin/stats').then(showApp).catch(() => {
    localStorage.removeItem('gomel_admin_token'); TOKEN = '';
  });
}
