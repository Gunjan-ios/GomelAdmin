import { api } from '../lib/api';
import type { LicenseStatus, User } from '../lib/types';
import { fmtDate, fmtPhone, imgSrc, money } from '../lib/format';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
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

// Human label for a licence status (camelCase → readable).
const LICENCE_LABEL: Record<string, string> = {
  verified: 'Verified',
  pending: 'Pending review',
  submitted: 'Submitted',
  notSubmitted: 'Not submitted',
};
function licenceLabel(s: string): string {
  return LICENCE_LABEL[s] || s || '—';
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
    // Confirm the destructive demotions (revoke a verified licence / reject a
    // pending one) before applying; approving is low-risk and goes straight through.
    if (status === 'notSubmitted') {
      const revoking = u.licenseStatus === 'verified';
      const name = u.name || 'this user';
      const ok = await confirmDialog({
        title: revoking ? 'Revoke licence verification?' : 'Reject licence?',
        message: revoking ? (
          <>
            <b>{name}</b>’s licence will be marked unverified. They won’t be able to book cars until
            they re-submit and get approved again.
          </>
        ) : (
          <>
            <b>{name}</b>’s submitted licence will be rejected. They’ll need to upload it again for
            review.
          </>
        ),
        confirmLabel: revoking ? 'Revoke' : 'Reject',
        danger: true,
      });
      if (!ok) return;
    }
    await setKyc(u, status, onSaved);
    closeModal();
  };

  return (
    <div className="udetail">
      {/* ---------------- Hero ---------------- */}
      <div className="ud-hero">
        <span className="ud-hero-glow" />
        <div className="ud-hero-inner">
          <div className="ud-avatar">{avatar ? <img src={avatar} alt="" /> : initials}</div>
          <div className="ud-id">
            <div className="ud-name">{u.name || 'Unnamed user'}</div>
            <div className="ud-chips">
              <StatusPill status={u.role} />
              <StatusPill status={u.licenseStatus} label={licenceLabel(u.licenseStatus)} />
            </div>
            <div className="ud-contacts">
              <a className="ud-contact" href={`tel:${u.phone || ''}`}>
                <i className="bd-ic ic-phone" />
                {fmtPhone(u.phone)}
              </a>
              {u.email && (
                <a className="ud-contact" href={`mailto:${u.email}`}>
                  <i className="bd-ic ic-mail" />
                  {u.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Quick stats ---------------- */}
      <div className="ud-stats">
        <div className="ud-stat accent">
          <i className="bd-ic ic-wallet" />
          <div>
            <span className="ud-stat-l">Wallet</span>
            <span className="ud-stat-v">{money(u.walletBalance)}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-shield" />
          <div>
            <span className="ud-stat-l">KYC</span>
            <span className="ud-stat-v">{licenceLabel(u.licenseStatus)}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-user" />
          <div>
            <span className="ud-stat-l">Role</span>
            <span className="ud-stat-v">{u.role}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-cal" />
          <div>
            <span className="ud-stat-l">Joined</span>
            <span className="ud-stat-v">{fmtDate(u.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      <div className="ud-body">
        <section className="ud-card">
          <div className="ud-card-h">
            <i className="bd-ic ic-id" />
            <h4>Driving licence</h4>
            <StatusPill status={u.licenseStatus} label={licenceLabel(u.licenseStatus)} />
          </div>
          <div className="ud-kv-list">
            <div className="ud-kv">
              <span>Licence number</span>
              <b className="mono">{k.licenseNumber || '—'}</b>
            </div>
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
        </section>

        <section className="ud-card">
          <div className="ud-card-h">
            <i className="bd-ic ic-wallet" />
            <h4>Account</h4>
          </div>
          <div className="ud-kv-list">
            <div className="ud-kv">
              <span>Wallet balance</span>
              <b>{money(u.walletBalance)}</b>
            </div>
            <div className="ud-kv">
              <span>UPI ID</span>
              <b>{u.upiId || '—'}</b>
            </div>
            <div className="ud-kv">
              <span>Referral code</span>
              <b className="mono">{u.referralCode || '—'}</b>
            </div>
            <div className="ud-kv">
              <span>Joined</span>
              <b>{fmtDate(u.createdAt)}</b>
            </div>
          </div>
        </section>
      </div>

      {/* ---------------- Actions ---------------- */}
      <div className="ud-actions">
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
