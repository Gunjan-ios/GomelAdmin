import { api } from '../lib/api';
import type { Envelope, Payout } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { TableSkeleton } from '../components/Skeleton';
import { fmtDate, money } from '../lib/format';
import { FilterableList, type Control } from '../components/FilterableList';
import { StatusPill } from '../components/StatusPill';
import { RowActions } from '../components/RowActions';
import { openModal } from '../components/Modal';
import { PayoutDetail, payoutHostName, setPayout } from '../modals/PayoutDetail';

export function Payouts() {
  const { data, loading, error, reload } = useFetch(() =>
    api<Envelope<Payout[]>>('/admin/payouts'),
  );

  if (loading) return <TableSkeleton cols={6} />;
  if (error) return <div className="empty">{error}</div>;

  const payouts = data?.data || [];

  const openDetail = (p: Payout) =>
    openModal(`Payout ${p.id}`, <PayoutDetail payout={p} onSaved={reload} />);

  const controls: Control<Payout>[] = [
    {
      id: 'po_status',
      type: 'select',
      options: [
        { value: '', label: 'All statuses' },
        { value: 'requested', label: 'requested' },
        { value: 'paid', label: 'paid' },
        { value: 'rejected', label: 'rejected' },
      ],
      // Treat anything that isn't paid/rejected as "requested" (matches the pill logic).
      test: (p, v) =>
        v === 'requested' ? p.status !== 'paid' && p.status !== 'rejected' : p.status === v,
    },
    {
      id: 'po_q',
      type: 'search',
      placeholder: 'Search host or UPI…',
      test: (p, v) => `${payoutHostName(p)} ${p.upiId || ''}`.toLowerCase().includes(v),
    },
  ];

  return (
    <FilterableList
      data={payouts}
      noun="payout"
      controls={controls}
      columns={['Host', 'Amount', 'UPI', 'Status', 'Requested', '']}
      row={(p) => [
        payoutHostName(p),
        money(p.amount),
        p.upiId || '—',
        <StatusPill
          status={p.status === 'paid' ? 'paid' : p.status === 'rejected' ? 'rejected' : 'requested'}
        />,
        fmtDate(p.createdAt),
        <RowActions
          actions={[
            { label: 'View', cls: 'ghost', onClick: () => openDetail(p) },
            ...(p.status === 'requested'
              ? [
                  { label: 'Mark paid', cls: 'ghost', onClick: () => setPayout(p, 'paid', reload) },
                  {
                    label: 'Reject',
                    cls: 'danger',
                    onClick: () => setPayout(p, 'rejected', reload),
                  },
                ]
              : []),
          ]}
        />,
      ]}
    />
  );
}
