import type { Claim } from '../lib/types';
import { money, fmtDate } from '../lib/format';
import { openModal, closeModal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { ClaimForm } from './ClaimForm';

export function ClaimDetail({ claim, onSaved }: { claim: Claim; onSaved: () => void }) {
  const photos = Array.isArray(claim.photos) ? claim.photos.filter(Boolean) : [];

  const openForm = () => {
    closeModal();
    openModal(`Claim ${claim.id}`, <ClaimForm claim={claim} onSaved={onSaved} />);
  };

  return (
    <div className="udetail">
      <div className="ud-section">
        <div className="ud-section-h">
          <span>Damage report</span>
          <StatusPill status={claim.status} />
        </div>
        <div className="ud-meta">
          <div className="ud-kv">
            <span>Claim ID</span>
            <b>{claim.id}</b>
          </div>
          <div className="ud-kv">
            <span>Car</span>
            <b>{claim.carName || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Severity</span>
            <b>{claim.severity || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Booking</span>
            <b>{claim.bookingId || '—'}</b>
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
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Description</span>
        </div>
        <p className="ud-text">{claim.description || 'No description provided.'}</p>
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Damage photos</span>
          <span className="muted">{photos.length} captured</span>
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
      </div>

      <div className="form-actions">
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
