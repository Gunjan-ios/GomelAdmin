import { api } from '../lib/api';
import type { Host, Payout } from '../lib/types';
import { fmtDateTime, fmtPhone, money } from '../lib/format';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { StatusPill } from '../components/StatusPill';

// Resolve a human-readable host name whether `host` is a populated object or a raw id.
export function payoutHostName(p: Payout): string {
  return (
    p.hostName ||
    (p.host && typeof p.host === 'object' && p.host.name) ||
    (typeof p.host === 'string' ? p.host : '') ||
    '—'
  );
}

// Display status: anything other than paid/rejected is shown as "requested".
function displayStatus(status: string): 'paid' | 'rejected' | 'requested' {
  return status === 'paid' ? 'paid' : status === 'rejected' ? 'rejected' : 'requested';
}

// PATCH /admin/payouts/{id} {status}, confirm with the exact verb, toast, refresh.
export async function setPayout(payout: Payout, status: 'paid' | 'rejected', onSaved: () => void) {
  const verb = status === 'paid' ? 'Mark this payout as PAID' : 'Reject this payout';
  if (!confirm(`${verb}?`)) return;
  try {
    await api(`/admin/payouts/${payout.id}`, { method: 'PATCH', body: { status } });
    toast(status === 'paid' ? 'Marked paid' : 'Rejected');
    onSaved();
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Update failed');
  }
}

// Read-only detail view for a single payout — host contact, UPI target and the
// full status timeline, plus the same paid/reject actions while it is pending.
export function PayoutDetail({ payout: p, onSaved }: { payout: Payout; onSaved: () => void }) {
  const h: Host = p.host && typeof p.host === 'object' ? p.host : {};
  const upi = p.upiId || h.upiId || '—';

  const act = (status: 'paid' | 'rejected') => {
    closeModal();
    setPayout(p, status, onSaved);
  };

  const status = displayStatus(p.status);

  return (
    <div className="udetail">
      {/* ---------------- Hero ---------------- */}
      <div className="ud-hero">
        <span className="ud-hero-glow" />
        <div className="ud-hero-inner">
          <div className="ud-avatar ud-avatar-ico">
            <i className="bd-ic ic-wallet" />
          </div>
          <div className="ud-id">
            <div className="ud-name">{payoutHostName(p)}</div>
            <div className="ud-chips">
              <StatusPill status={status} />
            </div>
            <div className="ud-contacts">
              <span className="ud-contact">
                <i className="bd-ic ic-id" />
                <span className="ud-code">Payout {p.id}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Quick stats ---------------- */}
      <div className="ud-stats">
        <div className="ud-stat accent">
          <i className="bd-ic ic-rupee" />
          <div>
            <span className="ud-stat-l">Amount</span>
            <span className="ud-stat-v">{money(p.amount)}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-shield" />
          <div>
            <span className="ud-stat-l">Status</span>
            <span className="ud-stat-v">{status}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-cal" />
          <div>
            <span className="ud-stat-l">Requested</span>
            <span className="ud-stat-v">{fmtDateTime(p.createdAt)}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-clock" />
          <div>
            <span className="ud-stat-l">Paid</span>
            <span className="ud-stat-v">{p.paidAt ? fmtDateTime(p.paidAt) : '—'}</span>
          </div>
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      <div className="ud-body">
        <section className="ud-card">
          <div className="ud-card-h">
            <i className="bd-ic ic-user" />
            <h4>Host</h4>
          </div>
          <div className="ud-kv-list">
            <div className="ud-kv">
              <span>Name</span>
              <b>{payoutHostName(p)}</b>
            </div>
            <div className="ud-kv">
              <span>Phone</span>
              <b>{fmtPhone(h.phone)}</b>
            </div>
            <div className="ud-kv">
              <span>Email</span>
              <b>{h.email || '—'}</b>
            </div>
          </div>
        </section>

        <section className="ud-card">
          <div className="ud-card-h">
            <i className="bd-ic ic-wallet" />
            <h4>Payout</h4>
            <StatusPill status={status} />
          </div>
          <div className="ud-kv-list">
            <div className="ud-kv">
              <span>Amount</span>
              <b>{money(p.amount)}</b>
            </div>
            <div className="ud-kv">
              <span>UPI ID</span>
              <b className="mono">{upi}</b>
            </div>
            <div className="ud-kv">
              <span>Requested on</span>
              <b>{fmtDateTime(p.createdAt)}</b>
            </div>
            <div className="ud-kv">
              <span>Paid on</span>
              <b>{p.paidAt ? fmtDateTime(p.paidAt) : '—'}</b>
            </div>
          </div>
        </section>
      </div>

      {p.status === 'requested' && (
        <div className="ud-actions">
          <button className="btn danger" onClick={() => act('rejected')}>
            Reject
          </button>
          <button className="btn" onClick={() => act('paid')}>
            Mark paid
          </button>
        </div>
      )}
    </div>
  );
}
