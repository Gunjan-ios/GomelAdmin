# GoMel Cars — Admin Panel (React + TypeScript)

A 1:1 React + TypeScript + Vite port of the original vanilla-JS admin panel
(`backend/public/admin`). Same API, same stylesheet, same behaviour.

## Develop

```bash
cd backend/admin-react
npm install
npm run dev          # Vite dev server (proxy the API yourself, or run the backend)
```

The panel talks to the API at `${location.origin}/api` and loads the Socket.IO
client from `/socket.io/socket.io.js`, so for a full local run, serve it behind
the backend (see build below) rather than the bare dev server.

## Build

```bash
npm run build        # tsc --noEmit && vite build
```

Output goes to `backend/public/admin-react/`. The Express backend serves it at
**`/admin-react`** (see `backend/src/app.js`), side by side with the original
panel at `/admin-panel`. Open `http://<host>/admin-react/`.

## Promote to the primary panel

Once validated, to make this the panel served at `/admin-panel`:

1. In `vite.config.ts` set `base: '/admin-panel/'` and `outDir: '../public/admin'`.
2. `npm run build` (this overwrites `public/admin` — the old vanilla files remain
   in git history).
3. Optionally remove the temporary `/admin-react` mount in `backend/src/app.js`.

## Structure

- `src/lib/` — `api.ts` (HTTP + token + uploads), `format.ts` (money/date/phone),
  `types.ts` (domain types), `useFetch.ts`, `chart-helpers.ts`, `constants.ts`
- `src/context/AuthContext.tsx` — login/logout, cached admin, boot token check
- `src/theme/` — theme core + topbar `ThemePicker`
- `src/components/` — `Layout`, `Modal`, `Toast`, `StatusPill`, `Table`,
  `FilterableList`, `RowActions`, `Charts` (SVG), `PhotoGrid`, `PlanCard`
- `src/pages/` — one component per tab (Dashboard, Cars, Bookings, Users, Claims,
  Reviews, Offers, Rewards, Subscriptions, Payouts, Support, Broadcast, Settings)
- `src/modals/` — form/detail modals (CarForm, BookingForm/Detail, UserDetail,
  ClaimForm/Detail, OfferForm, RewardForm, PlanForm, PayoutDetail)

`styles.css` is copied verbatim from the original panel — keep class names in sync
if you edit either copy.
