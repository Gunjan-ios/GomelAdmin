import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type { Booking, Car, Envelope, Fare, Inspection } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { money, fmtDateTime, fmtPhone, imgSrc } from '../lib/format';
import { StatusPill } from '../components/StatusPill';
import { openModal, closeModal } from '../components/Modal';
import { BookingForm } from './BookingForm';

function fareRow(label: string, amount: number, sign = '') {
  return (
    <div className="ud-kv">
      <span>{label}</span>
      <b>
        {sign}
        {money(amount)}
      </b>
    </div>
  );
}

// Render one inspection's meta + captured photos. `type` is preTrip | postTrip.
function inspectionBlock(insp: Inspection, key: number): ReactNode {
  const label = insp.type === 'postTrip' ? 'Post-trip inspection' : 'Pre-trip inspection';
  const photos = Array.isArray(insp.photos) ? insp.photos.filter(Boolean) : [];
  const fuelPct = Math.round((Number(insp.fuelLevel) || 0) * 100);

  return (
    <div key={key}>
      <div className="ud-section-h" style={{ marginTop: 14 }}>
        <span>{label}</span>
        <span className={`pill ${insp.type === 'postTrip' ? 'ok' : 'blue'}`}>
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="ud-meta">
        <div className="ud-kv">
          <span>Fuel level</span>
          <b>{fuelPct}%</b>
        </div>
        <div className="ud-kv">
          <span>Odometer</span>
          <b>{(Number(insp.odometer) || 0).toLocaleString('en-IN')} km</b>
        </div>
        <div className="ud-kv">
          <span>Captured on</span>
          <b>{fmtDateTime(insp.at)}</b>
        </div>
        <div className="ud-kv">
          <span>Notes</span>
          <b>{insp.notes || '—'}</b>
        </div>
      </div>
      <div className="ud-docs">
        {photos.length ? (
          photos.map((src, i) => (
            <a className="ud-doc" href={imgSrc(src)} target="_blank" rel="noopener" key={i}>
              <img src={imgSrc(src)} alt={`${label} photo ${i + 1}`} loading="lazy" />
              <span className="ud-doc-l">
                Photo {i + 1} <em>View ↗</em>
              </span>
            </a>
          ))
        ) : (
          <div className="ud-doc empty">
            <span className="ud-doc-ph">No photos uploaded</span>
            <span className="ud-doc-l">{label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Lazily-loaded inspections section. Fetches inside the component so the modal
// opens instantly and the (potentially heavy) photos stream in after.
function InspectionSection({ bookingId }: { bookingId: string }) {
  const { data, loading, error } = useFetch(() =>
    api<Envelope<Inspection[]>>(`/admin/bookings/${bookingId}/inspections`),
  );

  const header = (
    <div className="ud-section-h">
      <span>Inspection photos</span>
    </div>
  );

  if (loading) {
    return (
      <div className="ud-section" id="bd_inspections">
        {header}
        <div className="ud-meta">
          <div className="ud-kv">
            <span>Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ud-section" id="bd_inspections">
        {header}
        <div className="ud-meta">
          <div className="ud-kv">
            <span>Couldn't load inspections: {error}</span>
          </div>
        </div>
      </div>
    );
  }

  const list = Array.isArray(data?.data) ? data!.data : [];

  if (!list.length) {
    return (
      <div className="ud-section" id="bd_inspections">
        {header}
        <div className="ud-meta">
          <div className="ud-kv">
            <span>No inspection recorded for this booking.</span>
          </div>
        </div>
      </div>
    );
  }

  // preTrip first, then postTrip (the API already sorts by capture time).
  return (
    <div className="ud-section" id="bd_inspections">
      {header}
      {list.map((insp, i) => inspectionBlock(insp, i))}
    </div>
  );
}

export function BookingDetail({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const b = booking;
  const c: Car = b.car || ({} as Car);
  const f: Fare = b.fare || {};
  const img = (c.images && c.images[0]) || '';
  const durationMs = new Date(b.end ?? 0).getTime() - new Date(b.start ?? 0).getTime();
  const days = durationMs > 0 ? Math.ceil(durationMs / 86400000) : 0;
  const payable =
    (f.base || 0) +
    (f.taxes || 0) +
    (f.addOns || 0) +
    (f.deposit || 0) -
    (f.discount || 0) -
    (f.rewardDiscount || 0);

  const openForm = () => {
    closeModal();
    openModal(`Booking ${b.id}`, <BookingForm booking={b} onSaved={onSaved} />);
  };

  return (
    <div className="udetail">
      <div className="ud-head">
        <div className="ud-avatar">{img ? <img src={imgSrc(img)} alt="" /> : '🚗'}</div>
        <div className="ud-id">
          <div className="ud-name">
            {c.name || 'Car'} <StatusPill status={b.status} />
          </div>
          <div className="ud-sub">
            Booking {b.id}
            {c.type ? ' · ' + c.type : ''}
          </div>
        </div>
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Customer</span>
        </div>
        <div className="ud-meta">
          <div className="ud-kv">
            <span>Name</span>
            <b>{(b.user && b.user.name) || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Phone</span>
            <b>{fmtPhone(b.user && b.user.phone)}</b>
          </div>
          <div className="ud-kv">
            <span>Email</span>
            <b>{(b.user && b.user.email) || '—'}</b>
          </div>
        </div>
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Trip</span>
          <span className={`pill ${b.tripStarted ? 'ok' : 'gray'}`}>
            {b.tripStarted ? 'trip started' : 'not started'}
          </span>
        </div>
        <div className="ud-meta">
          <div className="ud-kv">
            <span>Pickup</span>
            <b>{fmtDateTime(b.start)}</b>
          </div>
          <div className="ud-kv">
            <span>Return</span>
            <b>{fmtDateTime(b.end)}</b>
          </div>
          <div className="ud-kv">
            <span>Package</span>
            <b>{b.package || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Duration</span>
            <b>
              {days} day{days === 1 ? '' : 's'}
            </b>
          </div>
          <div className="ud-kv">
            <span>Pickup address</span>
            <b>{c.pickupAddress || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Host</span>
            <b>{(c.host && c.host.name) || '—'}</b>
          </div>
        </div>
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Fare</span>
        </div>
        <div className="ud-meta">
          {fareRow('Base', f.base || 0)}
          {fareRow('Taxes', f.taxes || 0)}
          {fareRow('Add-ons', f.addOns || 0)}
          {fareRow('Discount', f.discount || 0, '−')}
          {fareRow('Reward discount', f.rewardDiscount || 0, '−')}
          {fareRow('Security deposit', f.deposit || 0)}
          <div className="ud-kv">
            <span>Payable</span>
            <b>{money(payable)}</b>
          </div>
        </div>
      </div>

      <div className="ud-section">
        <div className="ud-section-h">
          <span>Operational</span>
        </div>
        <div className="ud-meta">
          <div className="ud-kv">
            <span>Status</span>
            <b>
              <StatusPill status={b.status} />
            </b>
          </div>
          <div className="ud-kv">
            <span>Trip started</span>
            <b>{b.tripStarted ? 'Yes' : 'No'}</b>
          </div>
          <div className="ud-kv">
            <span>Verified by host</span>
            <b>{b.isVerifiedByHost ? 'Yes' : 'No'}</b>
          </div>
          <div className="ud-kv">
            <span>Unlock OTP</span>
            <b>{b.unlockOtp || '—'}</b>
          </div>
          <div className="ud-kv">
            <span>Booked on</span>
            <b>{fmtDateTime(b.createdAt)}</b>
          </div>
        </div>
      </div>

      <InspectionSection bookingId={b.id} />

      <div className="form-actions">
        <button className="btn" onClick={openForm}>
          Change status
        </button>
      </div>
    </div>
  );
}
