import { api } from '../lib/api';
import type { Claim, Envelope } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { FilterableList, type Control } from '../components/FilterableList';
import { StatusPill } from '../components/StatusPill';
import { RowActions } from '../components/RowActions';
import { openModal } from '../components/Modal';
import { ClaimDetail } from '../modals/ClaimDetail';
import { ClaimForm } from '../modals/ClaimForm';

export function Claims() {
  const { data, loading, error, reload } = useFetch(() => api<Envelope<Claim[]>>('/admin/claims'));

  if (loading) return <div className="empty">Loading…</div>;
  if (error) return <div className="empty">{error}</div>;

  const claims = data?.data || [];
  const severities = [...new Set(claims.map((c) => c.severity).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  ) as string[];

  const openDetail = (c: Claim) =>
    openModal(`Claim ${c.id}`, <ClaimDetail claim={c} onSaved={reload} />);
  const openForm = (c: Claim) =>
    openModal(`Claim ${c.id}`, <ClaimForm claim={c} onSaved={reload} />);

  const controls: Control<Claim>[] = [
    {
      id: 'cl_status',
      type: 'select',
      options: [
        { value: '', label: 'All statuses' },
        ...['submitted', 'underReview', 'resolved'].map((s) => ({ value: s, label: s })),
      ],
      test: (c, v) => c.status === v,
    },
    {
      id: 'cl_sev',
      type: 'select',
      options: [
        { value: '', label: 'All severities' },
        ...severities.map((s) => ({ value: s, label: s })),
      ],
      test: (c, v) => c.severity === v,
    },
    {
      id: 'cl_q',
      type: 'search',
      placeholder: 'Search ID, car or description…',
      test: (c, v) =>
        `${c.id || ''} ${c.carName || ''} ${c.description || ''}`.toLowerCase().includes(v),
    },
  ];

  return (
    <FilterableList
      data={claims}
      noun="claim"
      controls={controls}
      columns={['ID', 'Car', 'Severity', 'Description', 'Status', '']}
      row={(c) => [
        c.id,
        c.carName || '—',
        c.severity,
        <span className="muted">{(c.description || '').slice(0, 50)}</span>,
        <StatusPill status={c.status} />,
        <RowActions
          actions={[
            { label: 'View', cls: 'ghost', onClick: () => openDetail(c) },
            { label: 'Update', cls: 'ghost', onClick: () => openForm(c) },
          ]}
        />,
      ]}
    />
  );
}
