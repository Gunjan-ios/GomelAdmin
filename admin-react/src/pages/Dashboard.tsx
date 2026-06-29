import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking, Car, Envelope, Stats } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { money } from '../lib/format';
import {
  countByMonth,
  delta,
  monthSeries,
  revByMonth,
} from '../lib/chart-helpers';
import { AreaChart, AttnRow, Donut, HBars, KpiCard, Sparkline, type DonutSeg } from '../components/Charts';
import { DashboardSkeleton } from '../components/Skeleton';

interface DashData {
  s: Stats;
  bookings: Booking[];
  cars: Car[];
}

async function loadDashboard(): Promise<DashData> {
  const safe = <T,>(p: Promise<Envelope<T[]>>) => p.then((r) => r.data || []).catch(() => [] as T[]);
  const [s, bookings, cars] = await Promise.all([
    api<Envelope<Stats>>('/admin/stats').then((r) => r.data),
    safe(api<Envelope<Booking[]>>('/admin/bookings')),
    safe(api<Envelope<Car[]>>('/admin/cars')),
  ]);
  return { s, bookings, cars };
}

const STATUS_ORDER: Booking['status'][] = ['upcoming', 'ongoing', 'completed', 'cancelled'];
const STATUS_COLOR: Record<string, string> = {
  upcoming: 'var(--c-blue)',
  ongoing: 'var(--c-amber)',
  completed: 'var(--c-green)',
  cancelled: 'var(--c-red)',
};
const PALETTE = [
  'var(--c-indigo)',
  'var(--c-blue)',
  'var(--c-violet)',
  'var(--c-cyan)',
  'var(--c-amber)',
  'var(--c-green)',
];

export function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(loadDashboard);

  if (loading) return <DashboardSkeleton />;
  if (error) return <div className="empty">{error}</div>;
  if (!data) return <div className="empty">No data.</div>;

  const { s, bookings, cars } = data;

  const months = monthSeries(6);
  const monthLabels = months.map((m) => m.label);
  const revSeries = revByMonth(bookings, months);
  const bkSeries = countByMonth(bookings, months);

  const legend: DonutSeg[] = STATUS_ORDER.map((st) => ({
    label: st,
    value: bookings.filter((b) => b.status === st).length,
    color: STATUS_COLOR[st],
  }));
  const segs = legend.filter((x) => x.value > 0);

  const typeMap: Record<string, number> = {};
  cars.forEach((c) => {
    const t = c.type || 'Other';
    typeMap[t] = (typeMap[t] || 0) + 1;
  });
  const carItems = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

  return (
    <div className="dash">
      <div className="kpi-grid">
        <KpiCard
          label="Revenue"
          value={money(s.revenue)}
          cVar="--c-green"
          iconVar="--ic-rupee"
          deltaPct={delta(revSeries)}
          extra={<Sparkline values={revSeries} color="var(--c-green)" id="spRev" />}
        />
        <KpiCard
          label="Bookings"
          value={s.bookings}
          cVar="--c-blue"
          iconVar="--ic-calendar"
          deltaPct={delta(bkSeries)}
          extra={<Sparkline values={bkSeries} color="var(--c-blue)" id="spBk" />}
        />
        <KpiCard
          label="Cars listed"
          value={s.cars}
          cVar="--c-indigo"
          iconVar="--ic-car"
          extra={<div className="kpi-cap">Live fleet</div>}
        />
        <KpiCard
          label="Customers"
          value={s.users}
          cVar="--c-violet"
          iconVar="--ic-users"
          extra={<div className="kpi-cap">+ {s.hosts} hosts</div>}
        />
      </div>

      <div className="chart-grid wide">
        <div className="card chart-card">
          <div className="card-head">
            <h2>Revenue trend</h2>
            <span className="muted">Last 6 months · base fares</span>
          </div>
          <div className="chart-body">
            <AreaChart values={revSeries} labels={monthLabels} color="var(--c-green)" id="gRev" />
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-head">
            <h2>Bookings by status</h2>
          </div>
          <div className="chart-body donut-wrap">
            <Donut
              segments={segs.length ? segs : [{ label: 'none', value: 1, color: 'var(--line)' }]}
              id="dBk"
            />
            <div className="legend">
              {legend.map((seg) => (
                <div className="lg" key={seg.label}>
                  <span className="lg-dot" style={{ background: seg.color }} />
                  <span className="lg-l">{seg.label}</span>
                  <span className="lg-v">{seg.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <div className="card-head">
            <h2>Fleet by type</h2>
          </div>
          <div className="chart-body">
            {carItems.length ? <HBars items={carItems} /> : <div className="empty">No cars yet.</div>}
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-head">
            <h2>Needs attention</h2>
          </div>
          <div className="attn-list">
            <AttnRow
              iconVar="--ic-id"
              cVar="--c-amber"
              title="Pending KYC"
              sub="Verify licences"
              n={s.pendingKyc}
              onGo={() => navigate('/users')}
            />
            <AttnRow
              iconVar="--ic-alert"
              cVar="--c-red"
              title="Open claims"
              sub="Damage reports"
              n={s.openClaims}
              onGo={() => navigate('/claims')}
            />
            <AttnRow
              iconVar="--ic-wallet"
              cVar="--c-blue"
              title="Payouts to pay"
              sub="Host withdrawals"
              n={s.pendingPayouts}
              onGo={() => navigate('/payouts')}
            />
            <AttnRow
              iconVar="--ic-briefcase"
              cVar="--c-cyan"
              title="Active hosts"
              sub="Listing partners"
              n={s.hosts}
              onGo={() => navigate('/users')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
