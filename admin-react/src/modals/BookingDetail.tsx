import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type { Booking, Car, Envelope, Fare, Inspection } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { money, fmtDateTime, fmtPhone, imgSrc } from '../lib/format';
import { StatusPill } from '../components/StatusPill';
import { openModal, closeModal } from '../components/Modal';
import { BookingForm } from './BookingForm';

// First letters of up to two name words, for the customer avatar.
function initials(name?: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '👤';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function receiptRow(label: string, amount: number, sign: '' | '−' = '') {
  return (
    <div className={`bd-rcpt-row ${sign ? 'minus' : ''}`}>
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
    <div className="bd-insp" key={key}>
      <div className="bd-insp-h">
        <span className={`bd-dot ${insp.type === 'postTrip' ? 'ok' : 'blue'}`} />
        <strong>{label}</strong>
        <span className={`pill ${insp.type === 'postTrip' ? 'ok' : 'blue'}`}>
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="bd-insp-meta">
        <span>
          Fuel <b>{fuelPct}%</b>
        </span>
        <span>
          Odometer <b>{(Number(insp.odometer) || 0).toLocaleString('en-IN')} km</b>
        </span>
        <span>
          Captured <b>{fmtDateTime(insp.at)}</b>
        </span>
        {insp.notes ? (
          <span>
            Notes <b>{insp.notes}</b>
          </span>
        ) : null}
      </div>
      {photos.length ? (
        <div className="bd-photos">
          {photos.map((src, i) => (
            <a className="bd-photo" href={imgSrc(src)} target="_blank" rel="noopener" key={i}>
              <img src={imgSrc(src)} alt={`${label} photo ${i + 1}`} loading="lazy" />
              <span className="bd-photo-l">View ↗</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="bd-photos-empty">No photos uploaded</div>
      )}
    </div>
  );
}

// Lazily-loaded inspections section. Fetches inside the component so the modal
// opens instantly and the (potentially heavy) photos stream in after.
function InspectionSection({ bookingId }: { bookingId: string }) {
  const { data, loading, error } = useFetch(() =>
    api<Envelope<Inspection[]>>(`/admin/bookings/${bookingId}/inspections`),
  );

  const head = (
    <div className="bd-card-h">
      <span className="bd-ic ic-cam" />
      <h4>Inspection photos</h4>
    </div>
  );

  let inner: ReactNode;
  if (loading) inner = <div className="bd-note">Loading…</div>;
  else if (error) inner = <div className="bd-note">Couldn't load inspections: {error}</div>;
  else {
    const list = Array.isArray(data?.data) ? data!.data : [];
    inner = list.length ? (
      list.map((insp, i) => inspectionBlock(insp, i))
    ) : (
      <div className="bd-note">No inspection recorded for this booking.</div>
    );
  }

  return (
    <div className="bd-card bd-full" id="bd_inspections">
      {head}
      {inner}
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

  const cust = b.user || {};

  return (
    <div className="bdetail">
      {/* ---------------- Hero ---------------- */}
      <div className={`bd-hero ${img && imgSrc(img) ? 'has-img' : ''}`}>
        {img && imgSrc(img) ? <img className="bd-hero-bg" src={imgSrc(img)} alt="" /> : null}
        <div className="bd-hero-overlay">
          <div className="bd-hero-top">
            <StatusPill status={b.status} />
            <span className={`bd-trip-chip ${b.tripStarted ? 'on' : ''}`}>
              {b.tripStarted ? '● Trip started' : '○ Not started'}
            </span>
          </div>
          <div className="bd-hero-name">{c.name || 'Car'}</div>
          <div className="bd-hero-sub">
            <span className="bd-code">{b.id}</span>
            {c.type ? <span>{c.type}</span> : null}
          </div>
        </div>
      </div>

      {/* ---------------- Quick stats ---------------- */}
      <div className="bd-stats">
        <div className="bd-stat accent">
          <span className="bd-ic ic-rupee" />
          <div>
            <span className="bd-stat-l">Payable</span>
            <span className="bd-stat-v">{money(payable)}</span>
          </div>
        </div>
        <div className="bd-stat">
          <span className="bd-ic ic-clock" />
          <div>
            <span className="bd-stat-l">Duration</span>
            <span className="bd-stat-v">
              {days} day{days === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="bd-stat">
          <span className="bd-ic ic-cal" />
          <div>
            <span className="bd-stat-l">Package</span>
            <span className="bd-stat-v">{b.package || '—'}</span>
          </div>
        </div>
        <div className="bd-stat">
          <span className="bd-ic ic-key" />
          <div>
            <span className="bd-stat-l">Unlock OTP</span>
            <span className="bd-stat-v mono">{b.unlockOtp || '—'}</span>
          </div>
        </div>
      </div>

      {/* ---------------- Main grid ---------------- */}
      <div className="bd-grid">
        <div className="bd-col">
          {/* Customer */}
          <div className="bd-card">
            <div className="bd-card-h">
              <span className="bd-ic ic-user" />
              <h4>Customer</h4>
            </div>
            <div className="bd-person">
              <div className="bd-person-av">{initials(cust.name)}</div>
              <div className="bd-person-info">
                <div className="bd-person-name">{cust.name || '—'}</div>
                <div className="bd-person-contacts">
                  {cust.phone ? (
                    <a className="bd-contact" href={`tel:${cust.phone}`}>
                      <span className="bd-ic ic-phone" />
                      {fmtPhone(cust.phone)}
                    </a>
                  ) : null}
                  {cust.email ? (
                    <a className="bd-contact" href={`mailto:${cust.email}`}>
                      <span className="bd-ic ic-mail" />
                      {cust.email}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Trip timeline */}
          <div className="bd-card">
            <div className="bd-card-h">
              <span className="bd-ic ic-car" />
              <h4>Trip</h4>
            </div>
            <div className="bd-timeline">
              <div className="bd-tl-node">
                <span className="bd-tl-mark start" />
                <div>
                  <span className="bd-tl-l">Pickup</span>
                  <span className="bd-tl-v">{fmtDateTime(b.start)}</span>
                </div>
              </div>
              <div className="bd-tl-mid">
                {days} day{days === 1 ? '' : 's'}
              </div>
              <div className="bd-tl-node">
                <span className="bd-tl-mark end" />
                <div>
                  <span className="bd-tl-l">Return</span>
                  <span className="bd-tl-v">{fmtDateTime(b.end)}</span>
                </div>
              </div>
            </div>
            <div className="bd-kv-list">
              <div className="bd-kv">
                <span>Pickup address</span>
                <b>{c.pickupAddress || '—'}</b>
              </div>
              <div className="bd-kv">
                <span>Host</span>
                <b>{(c.host && c.host.name) || '—'}</b>
              </div>
            </div>
          </div>

          {/* Operational */}
          <div className="bd-card">
            <div className="bd-card-h">
              <span className="bd-ic ic-gear" />
              <h4>Operational</h4>
            </div>
            <div className="bd-kv-list">
              <div className="bd-kv">
                <span>Status</span>
                <b>
                  <StatusPill status={b.status} />
                </b>
              </div>
              <div className="bd-kv">
                <span>Trip started</span>
                <b>
                  <span className={`bd-yn ${b.tripStarted ? 'yes' : 'no'}`}>
                    {b.tripStarted ? 'Yes' : 'No'}
                  </span>
                </b>
              </div>
              <div className="bd-kv">
                <span>Verified by host</span>
                <b>
                  <span className={`bd-yn ${b.isVerifiedByHost ? 'yes' : 'no'}`}>
                    {b.isVerifiedByHost ? 'Yes' : 'No'}
                  </span>
                </b>
              </div>
              <div className="bd-kv">
                <span>Booked on</span>
                <b>{fmtDateTime(b.createdAt)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* Fare receipt */}
        <div className="bd-col">
          <div className="bd-card bd-receipt">
            <div className="bd-card-h">
              <span className="bd-ic ic-rupee" />
              <h4>Fare breakdown</h4>
            </div>
            <div className="bd-rcpt">
              {receiptRow('Base', f.base || 0)}
              {receiptRow('Taxes', f.taxes || 0)}
              {receiptRow('Add-ons', f.addOns || 0)}
              {receiptRow('Discount', f.discount || 0, '−')}
              {receiptRow('Reward discount', f.rewardDiscount || 0, '−')}
              {receiptRow('Security deposit', f.deposit || 0)}
            </div>
            <div className="bd-rcpt-total">
              <span>Payable</span>
              <b>{money(payable)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Inspections ---------------- */}
      <InspectionSection bookingId={b.id} />

      <div className="form-actions bd-actions">
        <button className="btn" onClick={openForm}>
          Change status
        </button>
      </div>
    </div>
  );
}
