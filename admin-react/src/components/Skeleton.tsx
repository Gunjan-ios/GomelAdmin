import type { CSSProperties } from 'react';

// Shimmering placeholder primitives used as the loading state on every admin
// page (replacing the old plain "Loading…" text). They mirror the real layout
// of each page so the content doesn't jump when the data arrives.

interface SkeletonProps {
  /** width — number (px) or CSS string. Defaults to 100%. */
  w?: number | string;
  /** height — number (px) or CSS string. Defaults to 14px. */
  h?: number | string;
  /** border radius in px. Defaults to 8. */
  r?: number;
  className?: string;
  style?: CSSProperties;
}

/** A single shimmer block. Compose these to build page-specific skeletons. */
export function Skeleton({ w, h = 14, r = 8, className = '', style }: SkeletonProps) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }}
      aria-hidden="true"
    />
  );
}

// Repeats with a stable, render-deterministic width so rows look varied but
// don't reshuffle between renders.
const CELL_W = [82, 54, 66, 46, 72, 38, 60];

interface TableSkeletonProps {
  cols: number;
  rows?: number;
  /** Show the filter/search toolbar above the card (FilterableList pages). */
  toolbar?: boolean;
  /** Show a count title in the card head. */
  title?: boolean;
  /** Show an action button (e.g. "+ Add") in the card head. */
  headBtn?: boolean;
}

/** Loading placeholder for the list/table pages. */
export function TableSkeleton({
  cols,
  rows = 8,
  toolbar = true,
  title = true,
  headBtn = false,
}: TableSkeletonProps) {
  return (
    <div>
      {toolbar && (
        <div className="toolbar skel-toolbar">
          <Skeleton w={170} h={38} r={10} />
          <Skeleton w={230} h={38} r={10} />
          <Skeleton w={66} h={32} r={8} style={{ marginLeft: 'auto' }} />
        </div>
      )}
      <div className="card list-card">
        <div className="card-head">
          {title ? <Skeleton w={150} h={18} /> : <span />}
          {headBtn && <Skeleton w={110} h={34} r={8} />}
        </div>
        <div className="table-wrap">
          <table className="skel-table">
            <thead>
              <tr>
                {Array.from({ length: cols }).map((_, i) => (
                  <th key={i}>
                    <Skeleton w={i === cols - 1 ? 24 : '62%'} h={11} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, r) => (
                <tr key={r}>
                  {Array.from({ length: cols }).map((_, c) => (
                    <td key={c}>
                      <Skeleton w={`${CELL_W[c % CELL_W.length]}%`} h={12} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <Skeleton w={120} h={12} />
          <Skeleton w={90} h={30} r={8} style={{ marginLeft: 'auto' }} />
        </div>
      </div>
    </div>
  );
}

/** Loading placeholder for the dashboard (KPI cards + chart cards). */
export function DashboardSkeleton() {
  return (
    <div className="dash">
      <div className="kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="card" key={i} style={{ padding: 18 }}>
            <Skeleton w={90} h={12} />
            <Skeleton w={120} h={26} style={{ marginTop: 12 }} />
            <Skeleton h={34} style={{ marginTop: 18 }} />
          </div>
        ))}
      </div>
      <div className="chart-grid wide">
        {Array.from({ length: 2 }).map((_, i) => (
          <div className="card chart-card" key={i}>
            <div className="card-head">
              <Skeleton w={150} h={16} />
            </div>
            <div className="chart-body">
              <Skeleton h={190} r={12} />
            </div>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        {Array.from({ length: 2 }).map((_, i) => (
          <div className="card chart-card" key={i}>
            <div className="card-head">
              <Skeleton w={130} h={16} />
            </div>
            <div className="chart-body">
              <Skeleton h={160} r={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading placeholder for the Subscriptions page (plan cards + subscribers). */
export function SubscriptionsSkeleton() {
  return (
    <div>
      <div className="card">
        <div className="card-head">
          <Skeleton w={170} h={18} />
          <Skeleton w={110} h={34} r={8} />
        </div>
        <div className="plan-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="card" key={i} style={{ padding: 20 }}>
              <Skeleton w={100} h={16} />
              <Skeleton w={130} h={30} style={{ marginTop: 14 }} />
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} h={12} style={{ marginTop: 12 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <TableSkeleton cols={6} rows={5} toolbar={false} />
      </div>
    </div>
  );
}

/** Loading placeholder for the Support chat panel. */
export function ChatSkeleton() {
  const widths = [52, 38, 60, 30, 46];
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {widths.map((w, i) => (
        <div
          key={i}
          style={{ display: 'flex', justifyContent: i % 2 ? 'flex-end' : 'flex-start' }}
        >
          <Skeleton w={`${w}%`} h={i % 2 ? 38 : 52} r={14} />
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder for a key/value form (e.g. Settings → Application config). */
export function FormSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '6px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-row" style={{ justifyContent: 'space-between' }}>
          <Skeleton w={140} h={14} />
          <Skeleton w={80} h={14} />
        </div>
      ))}
    </div>
  );
}
