import type { ReactNode } from 'react';
import { smoothPath, type Pt } from '../lib/chart-helpers';
import { money } from '../lib/format';

// ---------------- Dashboard charts (themeable SVG) ----------------
// Ported 1:1 from the vanilla panel's chart builders.

export function AreaChart({
  values,
  labels,
  color,
  id,
}: {
  values: number[];
  labels: string[];
  color: string;
  id: string;
}) {
  const W = 620;
  const H = 210;
  const pl = 12;
  const pr = 12;
  const pt = 18;
  const pb = 30;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const n = values.length;
  const max = Math.max(...values, 1);
  const X = (i: number) => (n <= 1 ? pl + iw / 2 : pl + (i / (n - 1)) * iw);
  const Y = (v: number) => pt + ih - (v / max) * ih;
  const pts: Pt[] = values.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L${X(n - 1)},${pt + ih} L${X(0)},${pt + ih} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="area-chart">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.26 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = pt + ih - f * ih;
        return <line key={i} className="grid" x1={pl} y1={y} x2={W - pr} y2={y} />;
      })}
      <path className="area-fill" d={area} fill={`url(#${id})`} />
      <path
        className="area-line"
        d={line}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={3}
        pathLength={1}
      />
      {pts.map((p, i) => (
        <circle
          key={`dot${i}`}
          className="dot"
          cx={p.x}
          cy={p.y}
          r={3.6}
          style={{ animationDelay: `${(0.6 + i * 0.08).toFixed(2)}s` }}
        >
          <title>
            {labels[i]}: {money(values[i])}
          </title>
        </circle>
      ))}
      {pts.map((p, i) => {
        const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        const lx = i === 0 ? pl : i === n - 1 ? W - pr : p.x;
        return (
          <text
            key={`vlab${i}`}
            className="vlab"
            x={lx}
            y={Math.max(pt + 9, p.y - 9)}
            textAnchor={anchor}
            style={{ animationDelay: `${(0.7 + i * 0.08).toFixed(2)}s` }}
          >
            {money(values[i])}
          </text>
        );
      })}
      {labels.map((l, i) => (
        <text key={`xlab${i}`} className="xlab" x={X(i)} y={H - 8}>
          {l}
        </text>
      ))}
    </svg>
  );
}

export function Sparkline({ values, color, id }: { values: number[]; color: string; id: string }) {
  const W = 200;
  const H = 46;
  const n = values.length;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const X = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const Y = (v: number) => H - 4 - ((v - min) / (max - min || 1)) * (H - 9);
  const pts: Pt[] = values.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L${X(n - 1)},${H} L${X(0)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.32 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path className="spark-fill" d={area} fill={`url(#${id})`} />
      <path
        className="spark-line"
        d={line}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={2.5}
        pathLength={1}
      />
    </svg>
  );
}

export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

export function Donut({ segments, id }: { segments: DonutSeg[]; id: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 54;
  const C = 2 * Math.PI * r;
  let off = 0;
  const rings = segments.map((seg, i) => {
    const frac = total ? seg.value / total : 0;
    const len = Math.max(0, frac * C - (frac > 0 && frac < 1 ? 3 : 0));
    const ring = (
      <circle
        key={`${id}-seg${i}`}
        className="donut-seg"
        cx={64}
        cy={64}
        r={r}
        fill="none"
        style={{ stroke: seg.color }}
        strokeWidth={18}
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={-off}
        transform="rotate(-90 64 64)"
      >
        <title>
          {seg.label}: {seg.value}
        </title>
      </circle>
    );
    off += frac * C;
    return ring;
  });
  return (
    <svg viewBox="0 0 128 128" className="donut">
      <circle cx={64} cy={64} r={r} fill="none" style={{ stroke: 'var(--line)' }} strokeWidth={18} />
      {rings}
      <text className="donut-c" x={64} y={60}>
        {total}
      </text>
      <text className="donut-cs" x={64} y={80}>
        total
      </text>
    </svg>
  );
}

export interface BarItem {
  label: string;
  value: number;
  color: string;
}

export function HBars({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bars">
      {items.map((it, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-l">{it.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={
                {
                  '--w': `${Math.round((it.value / max) * 100)}%`,
                  background: it.color,
                } as React.CSSProperties
              }
            />
          </div>
          <span className="bar-v">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  cVar,
  iconVar,
  deltaPct,
  extra,
}: {
  label: string;
  value: ReactNode;
  cVar: string; // e.g. '--c-green'
  iconVar: string; // e.g. '--ic-rupee'
  deltaPct?: number | null;
  extra?: ReactNode;
}) {
  return (
    <div className="kpi" style={{ '--c': `var(${cVar})` } as React.CSSProperties}>
      <div className="kpi-top">
        <span className="kpi-ic">
          <i style={{ '--icon': `var(${iconVar})` } as React.CSSProperties} />
        </span>
        {deltaPct == null ? null : (
          <span className={`kpi-trend ${deltaPct >= 0 ? 'up' : 'down'}`}>
            {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct)}%
          </span>
        )}
      </div>
      <div className="kpi-n">{value}</div>
      <div className="kpi-l">{label}</div>
      <div className="kpi-extra">{extra}</div>
    </div>
  );
}

export function AttnRow({
  iconVar,
  cVar,
  title,
  sub,
  n,
  onGo,
}: {
  iconVar: string;
  cVar: string;
  title: string;
  sub: string;
  n: number | null | undefined;
  onGo: () => void;
}) {
  return (
    <button className="attn" type="button" style={{ '--c': `var(${cVar})` } as React.CSSProperties} onClick={onGo}>
      <span className="attn-ic">
        <i style={{ '--icon': `var(${iconVar})` } as React.CSSProperties} />
      </span>
      <span className="attn-tx">
        <span className="attn-t">{title}</span>
        <span className="attn-s">{sub}</span>
      </span>
      <span className="attn-n">{n == null ? 0 : n}</span>
    </button>
  );
}

// Star rating badge, e.g. "★★★★☆ 4.5".
export function Stars({ rating }: { rating: number | string | undefined }) {
  const n = Math.round(Number(rating) || 0);
  const filled = '★'.repeat(Math.max(0, Math.min(5, n)));
  const empty = '☆'.repeat(Math.max(0, 5 - n));
  return (
    <span className="stars-val">
      <span className="stars" style={{ color: 'var(--c-amber, #f5a623)' }}>
        {filled}
        {empty}
      </span>{' '}
      {String(rating)}
    </span>
  );
}
