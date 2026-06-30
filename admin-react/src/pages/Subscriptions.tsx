import { api } from '../lib/api';
import type { Plan, Subscriber, Envelope } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { fmtDate, fmtPhone } from '../lib/format';
import { StatusPill } from '../components/StatusPill';
import { PaginatedTable } from '../components/Table';
import { PlanCard } from '../components/PlanCard';
import { openModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { PlanForm } from '../modals/PlanForm';
import { SubscriptionsSkeleton } from '../components/Skeleton';

export function Subscriptions() {
  const {
    data: plansData,
    loading: plansLoading,
    error: plansError,
    reload,
  } = useFetch(() => api<Envelope<Plan[]>>('/admin/plans'));
  // Subscribers are non-critical: tolerate a failed fetch like the original.
  const { data: subsData } = useFetch(() =>
    api<Envelope<Subscriber[]>>('/admin/subscribers').catch(() => ({ data: [] as Subscriber[] })),
  );

  if (plansLoading) return <SubscriptionsSkeleton />;
  if (plansError) return <div className="empty">{plansError}</div>;

  const plans = plansData?.data || [];
  const subs = subsData?.data || [];

  const openForm = (plan: Plan | null) =>
    openModal(plan ? 'Edit plan' : 'Add plan', <PlanForm plan={plan} onSaved={reload} />);

  const delPlan = async (plan: Plan) => {
    const ok = await confirmDialog({
      title: 'Delete plan?',
      message: (
        <>
          The plan <b>{plan.name || plan.id}</b> will be removed. Existing subscribers keep their
          current plan until it expires.
        </>
      ),
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/plans/${plan.id}`, { method: 'DELETE' });
      toast('Deleted');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  // Show the popular plan first so the featured card leads the grid.
  const sortedPlans = [...plans].sort(
    (a, b) => (b.highlighted ? 1 : 0) - (a.highlighted ? 1 : 0),
  );

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h2>
            {plans.length} membership plan{plans.length === 1 ? '' : 's'}
          </h2>
          <button className="btn" onClick={() => openForm(null)}>
            + Add plan
          </button>
        </div>
        {plans.length === 0 ? (
          <div className="empty-plans">No plans yet — create your first membership plan.</div>
        ) : (
          <div className="plan-grid">
            {sortedPlans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onEdit={() => openForm(p)}
                onDelete={() => delPlan(p)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card list-card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>{subs.length} subscribers</h2>
        </div>
        <PaginatedTable
          headers={['Name', 'Phone', 'Plan', 'Status', 'Started', 'Expires']}
          rows={subs.map((u) => [
            u.name || '—',
            fmtPhone(u.phone),
            <b>{u.subscription?.planId || '—'}</b>,
            <StatusPill status={u.subscription?.status || 'none'} />,
            u.subscription?.startedAt ? fmtDate(u.subscription.startedAt) : '—',
            u.subscription?.expiresAt ? fmtDate(u.subscription.expiresAt) : '—',
          ])}
        />
      </div>
    </div>
  );
}
