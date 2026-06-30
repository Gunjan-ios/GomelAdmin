import { api } from '../lib/api';
import type { Offer, Envelope } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { TableSkeleton } from '../components/Skeleton';
import { money } from '../lib/format';
import { PaginatedTable } from '../components/Table';
import { RowActions } from '../components/RowActions';
import { openModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { OfferForm } from '../modals/OfferForm';

export function Offers() {
  const { data, loading, error, reload } = useFetch(() => api<Envelope<Offer[]>>('/admin/offers'));

  if (loading) return <TableSkeleton cols={6} toolbar={false} headBtn />;
  if (error) return <div className="empty">{error}</div>;

  const offers = data?.data || [];

  const openForm = (offer: Offer | null) =>
    openModal(offer ? 'Edit code' : 'Add code', <OfferForm offer={offer} onSaved={reload} />);

  const delOffer = async (offer: Offer) => {
    const ok = await confirmDialog({
      title: 'Delete promo code?',
      message: (
        <>
          The code <b>{offer.id}</b> will stop working immediately and customers won’t be able to
          apply it.
        </>
      ),
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/offers/${offer.id}`, { method: 'DELETE' });
      toast('Deleted');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const rows = offers.map((o) => [
    <b>{o.id}</b>,
    `${Math.round((o.discountPct || 0) * 100)}%`,
    o.title || '—',
    o.minFare ? money(o.minFare) : '—',
    o.active ? <span className="pill ok">on</span> : <span className="pill gray">off</span>,
    <RowActions
      actions={[
        { label: 'Edit', cls: 'ghost', onClick: () => openForm(o) },
        { label: 'Delete', cls: 'danger', onClick: () => delOffer(o) },
      ]}
    />,
  ]);

  return (
    <div className="card list-card">
      <div className="card-head">
        <h2>{offers.length} codes</h2>
        <button className="btn" onClick={() => openForm(null)}>
          + Add code
        </button>
      </div>
      <PaginatedTable
        headers={['Code', 'Discount', 'Title', 'Min fare', 'Active', '']}
        rows={rows}
      />
    </div>
  );
}
