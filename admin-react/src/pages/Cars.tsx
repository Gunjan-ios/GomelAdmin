import { api } from '../lib/api';
import type { Car, Envelope } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { TableSkeleton } from '../components/Skeleton';
import { money } from '../lib/format';
import { FilterableList, type Control } from '../components/FilterableList';
import { StatusPill } from '../components/StatusPill';
import { RowActions } from '../components/RowActions';
import { openModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { CarForm } from '../modals/CarForm';

export function Cars() {
  const { data, loading, error, reload } = useFetch(() => api<Envelope<Car[]>>('/admin/cars'));

  if (loading) return <TableSkeleton cols={7} />;
  if (error) return <div className="empty">{error}</div>;

  const cars = data?.data || [];
  const types = [...new Set(cars.map((c) => c.type).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  ) as string[];

  const openForm = (car: Car | null) =>
    openModal(car ? 'Edit car' : 'Add car', <CarForm car={car} onSaved={reload} />);

  const delCar = async (car: Car) => {
    const ok = await confirmDialog({
      title: 'Delete car?',
      message: (
        <>
          <b>{car.name}</b> will be permanently removed from the fleet. This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/cars/${car.id}`, { method: 'DELETE' });
      toast('Deleted');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const controls: Control<Car>[] = [
    {
      id: 'car_type',
      type: 'select',
      options: [{ value: '', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))],
      test: (c, v) => c.type === v,
    },
    {
      id: 'car_active',
      type: 'select',
      options: [
        { value: '', label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'off', label: 'Inactive' },
      ],
      test: (c, v) => (v === 'active' ? !!c.active : !c.active),
    },
    {
      id: 'car_q',
      type: 'search',
      placeholder: 'Search name or location…',
      test: (c, v) => `${c.name || ''} ${c.pickupAddress || ''}`.toLowerCase().includes(v),
    },
  ];

  const addBtn = (
    <button className="btn" onClick={() => openForm(null)}>
      + Add car
    </button>
  );

  return (
    <FilterableList
      data={cars}
      noun="car"
      headBtn={addBtn}
      controls={controls}
      columns={['', 'Name', 'Type', 'Price/day', 'Rating', 'Active', '']}
      row={(c) => [
        c.images && c.images[0] ? <img className="thumb" src={c.images[0]} alt="" /> : '',
        <>
          <b>{c.name}</b>
          <div className="muted">{c.pickupAddress || ''}</div>
        </>,
        c.type,
        money(c.pricePerDay),
        `⭐ ${c.rating}`,
        c.active ? <StatusPill status="active" /> : <span className="pill gray">off</span>,
        <RowActions
          actions={[
            { label: 'Edit', cls: 'ghost', onClick: () => openForm(c) },
            { label: 'Delete', cls: 'danger', onClick: () => delCar(c) },
          ]}
        />,
      ]}
    />
  );
}
