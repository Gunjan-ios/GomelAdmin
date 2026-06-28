import { api } from '../lib/api';
import type { Reward, Envelope } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { money } from '../lib/format';
import { PaginatedTable } from '../components/Table';
import { RowActions } from '../components/RowActions';
import { openModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { RewardForm } from '../modals/RewardForm';

export function Rewards() {
  const { data, loading, error, reload } = useFetch(() => api<Envelope<Reward[]>>('/admin/rewards'));

  if (loading) return <div className="empty">Loading…</div>;
  if (error) return <div className="empty">{error}</div>;

  const rewards = data?.data || [];

  const openForm = (reward: Reward | null) =>
    openModal(reward ? 'Edit reward' : 'Add reward', <RewardForm reward={reward} onSaved={reload} />);

  const delReward = async (reward: Reward) => {
    if (!confirm(`Delete reward "${reward.title}"?`)) return;
    try {
      await api(`/admin/rewards/${reward.id}`, { method: 'DELETE' });
      toast('Deleted');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const rows = rewards.map((o) => [
    <b>{o.id}</b>,
    o.title || '—',
    `${o.cost} pts`,
    o.value ? money(o.value) : <span className="muted">perk</span>,
    o.active ? <span className="pill ok">on</span> : <span className="pill gray">off</span>,
    <RowActions
      actions={[
        { label: 'Edit', cls: 'ghost', onClick: () => openForm(o) },
        { label: 'Delete', cls: 'danger', onClick: () => delReward(o) },
      ]}
    />,
  ]);

  return (
    <div className="card list-card">
      <div className="card-head">
        <h2>{rewards.length} options</h2>
        <button className="btn" onClick={() => openForm(null)}>
          + Add option
        </button>
      </div>
      <PaginatedTable
        headers={['ID', 'Title', 'Cost', 'Value', 'Active', '']}
        rows={rows}
      />
    </div>
  );
}
