import { api } from '../lib/api';
import type { LicenseStatus, User } from '../lib/types';
import { fmtDate, fmtPhone, imgSrc, money } from '../lib/format';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { StatusPill } from '../components/StatusPill';

// PATCH the user's KYC/licence status, toast, then refresh the caller's list.
export async function setKyc(user: User, status: LicenseStatus, onSaved: () => void) {
  try {
    await api(`/admin/users/${user.id}/kyc`, { method: 'PATCH', body: { status } });
    toast(status === 'verified' ? 'KYC approved' : 'KYC rejected');
    onSaved();
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Update failed');
  }
}

// Read-only user view — shows the uploaded licence photos so the admin can
// verify the user/host before approving KYC.
export function UserDetail({ user: u, onSaved }: { user: User; onSaved: () => void }) {
  const k = u.kyc || {};
  const initials = (u.name || u.phone || '?').trim().charAt(0).toUpperCase();
  const avatar = imgSrc(u.avatarUrl);
  const docs: [string, string][] = [
    ['Front of licence', imgSrc(k.frontImage)],
    ['Back of licence', imgSrc(k.backImage)],
  ];

  const act = async (status: LicenseStatus) => {
    await setKyc(u, status, onSaved);
    closeModal();
  };

  return (
    <div className="udetail">
      <div className="ud-head">
        <div className="ud-avatar">{avatar ? <img src={avatar} alt="" /> : initials}</div>
        <div className="ud-id">
          <div className="ud-name">
            {u.name || 'Unnamed user'} <StatusPill status={u.role} />
          </div>
          <div className="ud-sub">
            {fmtPhone(u.phone)}
            {u.email ? ' · ' + u.email : ''}
          </div>
        </div>
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Driving licence</span>
          <StatusPill status={u.licenseStatus} />
        </div>
        <div className="ud-kv">
          <span>Licence number</span>
          <b>{k.licenseNumber || '—'}</b>
        </div>
        <div className="ud-docs">
          {docs.map(([label, src]) =>
            src ? (
              <a className="ud-doc" key={label} href={src} target="_blank" rel="noopener">
                <img src={src} alt={label} loading="lazy" />
                <span className="ud-doc-l">
                  {label} <em>View ↗</em>
                </span>
              </a>
            ) : (
              <div className="ud-doc empty" key={label}>
                <span className="ud-doc-ph">No photo uploaded</span>
                <span className="ud-doc-l">{label}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Account</span>
        </div>
        <div className="ud-meta">
          <div className="ud-kv">
            <span>Wallet</span>
            <b>{money(u.walletBalance)}</b>
          </div>
          <div className="ud-kv">
            <span>UPI ID</span>
            <b>{u.upiId || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Referral code</span>
            <b>{u.referralCode || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Joined</span>
            <b>{fmtDate(u.createdAt)}</b>
          </div>
        </div>
      </div>

      <div className="form-actions">
        {u.licenseStatus === 'pending' && (
          <button className="btn danger" onClick={() => act('notSubmitted')}>
            Reject licence
          </button>
        )}
        {u.licenseStatus === 'verified' ? (
          <button className="btn danger" onClick={() => act('notSubmitted')}>
            Revoke verification
          </button>
        ) : (
          <button className="btn" onClick={() => act('verified')}>
            Approve licence
          </button>
        )}
      </div>
    </div>
  );
}
