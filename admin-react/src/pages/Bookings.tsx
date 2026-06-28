import { api } from '../lib/api';
import type { Booking, Envelope } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { money, fmtDate } from '../lib/format';
import { FilterableList, type Control } from '../components/FilterableList';
import { StatusPill } from '../components/StatusPill';
import { RowActions } from '../components/RowActions';
import { openModal } from '../components/Modal';
import { BookingDetail } from '../modals/BookingDetail';
import { BookingForm } from '../modals/BookingForm';

const STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

export function Bookings() {
  const { data, loading, error, reload } = useFetch(() =>
    api<Envelope<Booking[]>>('/admin/bookings'),
  );

  if (loading) return <div className="empty">Loading…</div>;
  if (error) return <div className="empty">{error}</div>;

  const bookings = data?.data || [];

  const controls: Control<Booking>[] = [
    {
      id: 'bk_status',
      type: 'select',
      options: [
        { value: '', label: 'All statuses' },
        ...STATUSES.map((s) => ({ value: s, label: s })),
      ],
      test: (b, v) => b.status === v,
    },
    {
      id: 'bk_q',
      type: 'search',
      placeholder: 'Search booking ID or car…',
      test: (b, v) => `${b.id || ''} ${b.car?.name || ''}`.toLowerCase().includes(v),
    },
  ];

  return (
    <FilterableList
      data={bookings}
      noun="booking"
      controls={controls}
      columns={['ID', 'Car', 'Dates', 'Payable', 'Status', '']}
      row={(b) => [
        b.id,
        b.car?.name || '—',
        `${fmtDate(b.start)} → ${fmtDate(b.end)}`,
        money((b.fare?.base || 0) + (b.fare?.taxes || 0) + (b.fare?.deposit || 0)),
        <StatusPill status={b.status} />,
        <RowActions
          actions={[
            {
              label: 'View',
              cls: 'ghost',
              onClick: () =>
                openModal(`Booking ${b.id}`, <BookingDetail booking={b} onSaved={reload} />),
            },
            {
              label: 'Change status',
              cls: 'ghost',
              onClick: () =>
                openModal(`Booking ${b.id}`, <BookingForm booking={b} onSaved={reload} />),
            },
          ]}
        />,
      ]}
    />
  );
}
