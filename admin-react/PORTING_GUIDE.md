# Admin panel React port — porting guide (read this first)

You are porting ONE slice of a vanilla-JS admin panel into this already-scaffolded
React + TypeScript app. The foundation is built and type-checks cleanly. **Do not
modify shared files** — only create/overwrite the page + modal files assigned to
you. Import everything else.

- **Project root:** `/Users/samaj70/Desktop/Flutter/GoMel Cars/backend/admin-react`
- **Original panel to port from:** `/Users/samaj70/Desktop/Flutter/GoMel Cars/backend/public/admin/app.js`
  (port the cited line ranges 1:1 — same behaviour, same CSS classes)
- **Stylesheet is reused verbatim** (`src/styles.css`) — match class names EXACTLY.

## Read these first (learn the conventions + available APIs)

- `src/pages/Cars.tsx`, `src/pages/Dashboard.tsx` — reference page patterns
- `src/modals/CarForm.tsx` — reference modal/form pattern (incl. nested popup)
- `src/lib/api.ts`, `src/lib/format.ts`, `src/lib/types.ts`, `src/lib/useFetch.ts`
- `src/components/` — `Modal.tsx`, `Toast.tsx`, `StatusPill.tsx`, `Table.tsx`,
  `FilterableList.tsx`, `RowActions.tsx`, `Charts.tsx`, `PhotoGrid.tsx`

## Shared APIs (import — never reimplement)

- `api<T>(path, { method, body })`, `uploadFile(file)` — from `../lib/api`
- `money, fmtDate, fmtDateTime, fmtTime, fmtPhone, imgSrc` — from `../lib/format`
- domain types (`Booking, User, Claim, Offer, Reward, Plan, Payout, Review,
  Subscriber, Inspection, Envelope<T>`, …) — from `../lib/types`
- `useFetch(fetcher)` → `{ data, loading, error, reload }` — from `../lib/useFetch`
- `openModal(title, node)`, `closeModal()` — from `../components/Modal`
- `toast(msg)` — from `../components/Toast`
- `StatusPill({ status, label? })`, `pillColor(s)` — from `../components/StatusPill`
  (replaces the original `statusPill(s)`. For the original "active" pill render
  `<StatusPill status="active" />`.)
- `FilterableList<T>({ data, noun, controls, columns, row, headBtn })`, `Control<T>`
  — from `../components/FilterableList`
- `RowActions({ actions: [{ label, cls, onClick }] })` — from `../components/RowActions`
- `PaginatedTable({ headers, rows })`, `BasicTable` — from `../components/Table`
- `Stars({ rating })` — from `../components/Charts` (only if you need the stars badge)

## Porting rules

- Most endpoints return `{ data: T }` → type as `Envelope<T>`. List page pattern:
  `const { data, loading, error, reload } = useFetch(() => api<Envelope<X[]>>('/admin/x'));`
  then `const rows = data?.data || [];`
- **`esc()` is unnecessary** — JSX escapes text. Render `{value}` directly. Where
  the original built raw HTML strings, reproduce the same elements/classes as JSX.
- A **list page** exports `export function <Name>()` and uses `FilterableList` /
  `PaginatedTable` exactly like `Cars.tsx`.
- A **form modal** is a component `function XForm({ entity, onSaved }: {...})`. On a
  successful save: `closeModal(); toast(...); onSaved();`. Open it from the page with
  `openModal('Title', <XForm entity={e} onSaved={reload} />)`.
- A **read-only detail modal** is a component opened via `openModal`. Its "edit"
  button calls `closeModal()` then opens the form (pass `onSaved` through so the list
  refreshes).
- Detail modals that lazily fetch (e.g. booking inspections) should fetch inside the
  component with `useFetch`/`useEffect`.
- Delete/confirm actions: use `window.confirm(...)` exactly as the original.
- While loading, render `<div className="empty">Loading…</div>`; on error render
  `<div className="empty">{error}</div>`.
- **Page title + routing are handled by the Layout** — do NOT add `setTitle` or nav.
- TypeScript is strict with `noUnusedLocals` + `noUnusedParameters` — no unused
  symbols, avoid `any`. Prefer the shared types.
- **Do NOT modify** `App.tsx`, shared components/lib, the theme, or other pages.
  Keep the exact `export function <Name>()` name so the existing `App.tsx` import
  resolves. If you genuinely need a tiny helper, inline it in your own file.

## After writing

Re-read your own files once and self-review for strict-mode TypeScript correctness.
You may run `npx tsc --noEmit` from the project root, but IGNORE errors in files you
don't own (sibling ports may be in progress). Report the files you created.
