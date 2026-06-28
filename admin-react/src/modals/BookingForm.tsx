import { useState } from 'react';
import { api } from '../lib/api';
import type { Booking, BookingStatus } from '../lib/types';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

const STATUSES: BookingStatus[] = ['upcoming', 'ongoing', 'completed', 'cancelled'];
const YESNO = ['no', 'yes'];

export function BookingForm({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const b = booking;
  const [status, setStatus] = useState<string>(b.status);
  const [trip, setTrip] = useState(b.tripStarted ? 'yes' : 'no');
  const [ver, setVer] = useState(b.isVerifiedByHost ? 'yes' : 'no');

  const save = async () => {
    try {
      await api(`/admin/bookings/${b.id}`, {
        method: 'PATCH',
        body: {
          status,
          tripStarted: trip === 'yes',
          isVerifiedByHost: ver === 'yes',
        },
      });
      closeModal();
      toast('Updated');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <div>
      <div className="form">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Trip started</label>
          <select value={trip} onChange={(e) => setTrip(e.target.value)}>
            {YESNO.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Verified by host</label>
          <select value={ver} onChange={(e) => setVer(e.target.value)}>
            {YESNO.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn ghost" onClick={closeModal}>
          Cancel
        </button>
        <button className="btn" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
