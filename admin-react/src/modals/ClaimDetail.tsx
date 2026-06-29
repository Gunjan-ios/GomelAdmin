import type { Claim } from '../lib/types';
import { money, fmtDate, imgSrc } from '../lib/format';
import { openModal, closeModal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { ClaimForm } from './ClaimForm';

// Friendly label for a claim status (camelCase → readable).
const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  underReview: 'Under review',
  resolved: 'Resolved',
};
function statusLabel(s: string): string {
  return STATUS_LABEL[s] || s || '—';
}

// Map a free-text severity to a pill colour by keyword (minor→ok, major→bad).
function severityColor(s: string | undefined): string {
  const v = (s || '').toLowerCase();
  if (/minor|low|light/.test(v)) return 'ok';
  if (/moderate|medium/.test(v)) return 'warn';
  if (/major|severe|high|total|critical/.test(v)) return 'bad';
  return 'gray';
}

export function ClaimDetail({ claim, onSaved }: { claim: Claim; onSaved: () => void }) {
  const photos = (Array.isArray(claim.photos) ? claim.photos : [])
    .map((p) => imgSrc(p))
    .filter(Boolean);
  const sevColor = severityColor(claim.severity);

  const openForm = () => {
    closeModal();
    openModal(`Claim ${claim.id}`, <ClaimForm claim={claim} onSaved={onSaved} />);
  };

  return (
    <div className="udetail">
      {/* ---------------- Hero ---------------- */}
      <div className="ud-hero">
        <span className="ud-hero-glow" />
        <div className="ud-hero-inner">
          <div className="ud-avatar ud-avatar-ico">
            <i className="bd-ic ic-alert" />
          </div>
          <div className="ud-id">
            <div className="ud-name">{claim.carName || 'Damage claim'}</div>
            <div className="ud-chips">
              <StatusPill status={claim.status} label={statusLabel(claim.status)} />
              {claim.severity && (
                <span className={`pill ${sevColor}`}>{claim.severity} severity</span>
              )}
            </div>
            <div className="ud-contacts">
              <span className="ud-contact">
                <i className="bd-ic ic-id" />
                <span className="ud-code">{claim.id}</span>
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
            <span className="ud-stat-l">Processing fee</span>
            <span className="ud-stat-v">{money(claim.processingFee)}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-alert" />
          <div>
            <span className="ud-stat-l">Severity</span>
            <span className="ud-stat-v">{claim.severity || '—'}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-cam" />
          <div>
            <span className="ud-stat-l">Photos</span>
            <span className="ud-stat-v">{photos.length}</span>
          </div>
        </div>
        <div className="ud-stat">
          <i className="bd-ic ic-cal" />
          <div>
            <span className="ud-stat-l">Reported</span>
            <span className="ud-stat-v">{fmtDate(claim.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      <div className="ud-body">
        <section className="ud-card">
          <div className="ud-card-h">
            <i className="bd-ic ic-shield" />
            <h4>Claim details</h4>
            <StatusPill status={claim.status} label={statusLabel(claim.status)} />
          </div>
          <div className="ud-kv-list">
            <div className="ud-kv">
              <span>Claim ID</span>
              <b className="mono">{claim.id}</b>
            </div>
            <div className="ud-kv">
              <span>Car</span>
              <b>{claim.carName || '—'}</b>
            </div>
            <div className="ud-kv">
              <span>Booking</span>
              <b className="mono">{claim.bookingId || '—'}</b>
            </div>
            <div className="ud-kv">
              <span>Insurer</span>
              <b>{claim.insurer || '—'}</b>
            </div>
            <div className="ud-kv">
              <span>Processing fee</span>
              <b>{money(claim.processingFee)}</b>
            </div>
            <div className="ud-kv">
              <span>Reported</span>
              <b>{fmtDate(claim.createdAt)}</b>
            </div>
          </div>
        </section>

        <section className="ud-card">
          <div className="ud-card-h">
            <i className="bd-ic ic-id" />
            <h4>Description</h4>
          </div>
          <p className="ud-desc">{claim.description || 'No description provided.'}</p>
        </section>

        <section className="ud-card">
          <div className="ud-card-h">
            <i className="bd-ic ic-cam" />
            <h4>Damage photos</h4>
            <span className="ud-count">{photos.length} captured</span>
          </div>
          <div className="ud-docs">
            {photos.length ? (
              photos.map((src, i) => (
                <a className="ud-doc" key={i} href={src} target="_blank" rel="noopener">
                  <img src={src} alt={`Damage photo ${i + 1}`} loading="lazy" />
                  <span className="ud-doc-l">
                    Photo {i + 1} <em>View ↗</em>
                  </span>
                </a>
              ))
            ) : (
              <div className="ud-doc empty">
                <span className="ud-doc-ph">No photos uploaded</span>
                <span className="ud-doc-l">Damage photos</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ---------------- Actions ---------------- */}
      <div className="ud-actions">
        <button className="btn ghost" onClick={closeModal}>
          Close
        </button>
        <button className="btn" onClick={openForm}>
          Update status
        </button>
      </div>
    </div>
  );
}
