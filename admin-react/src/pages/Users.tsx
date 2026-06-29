import { api } from '../lib/api';
import type { Envelope, User } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { TableSkeleton } from '../components/Skeleton';
import { fmtPhone, money } from '../lib/format';
import { FilterableList, type Control } from '../components/FilterableList';
import { StatusPill } from '../components/StatusPill';
import { RowActions } from '../components/RowActions';
import { openModal } from '../components/Modal';
import { UserDetail, setKyc } from '../modals/UserDetail';

export function Users() {
  const { data, loading, error, reload } = useFetch(() => api<Envelope<User[]>>('/admin/users'));

  if (loading) return <TableSkeleton cols={7} />;
  if (error) return <div className="empty">{error}</div>;

  const users = data?.data || [];

  const controls: Control<User>[] = [
    {
      id: 'us_role',
      type: 'select',
      options: [
        { value: '', label: 'All roles' },
        ...['user', 'host', 'admin'].map((r) => ({ value: r, label: r })),
      ],
      test: (u, v) => u.role === v,
    },
    {
      id: 'us_kyc',
      type: 'select',
      options: [
        { value: '', label: 'All KYC' },
        { value: 'verified', label: 'verified' },
        { value: 'pending', label: 'pending' },
        { value: 'notSubmitted', label: 'notSubmitted' },
      ],
      test: (u, v) => u.licenseStatus === v,
    },
    {
      id: 'us_q',
      type: 'search',
      placeholder: 'Search name, phone or email…',
      test: (u, v) =>
        `${u.name || ''} ${u.phone || ''} ${fmtPhone(u.phone)} ${u.email || ''}`
          .toLowerCase()
          .includes(v),
    },
  ];

  return (
    <FilterableList
      data={users}
      noun="user"
      controls={controls}
      columns={['Name', 'Phone', 'Email', 'Role', 'KYC', 'Wallet', '']}
      row={(u) => [
        u.name || '—',
        fmtPhone(u.phone),
        u.email || '—',
        <StatusPill status={u.role} />,
        <StatusPill status={u.licenseStatus} />,
        money(u.walletBalance),
        <RowActions
          actions={[
            {
              label: 'View',
              cls: 'ghost',
              onClick: () => openModal('User details', <UserDetail user={u} onSaved={reload} />),
            },
            ...(u.licenseStatus === 'pending'
              ? [
                  { label: 'Approve', cls: '', onClick: () => setKyc(u, 'verified', reload) },
                  {
                    label: 'Reject',
                    cls: 'danger',
                    onClick: () => setKyc(u, 'notSubmitted', reload),
                  },
                ]
              : []),
          ]}
        />,
      ]}
    />
  );
}
