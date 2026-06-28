import { useState } from 'react';
import { api } from '../lib/api';
import type { Offer } from '../lib/types';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

// Promo code form modal. Ported 1:1 from offerForm(). Code is disabled when
// editing; discount stored as a fraction (pct / 100).
export function OfferForm({ offer, onSaved }: { offer: Offer | null; onSaved: () => void }) {
  const p = offer || ({} as Offer);

  const [code, setCode] = useState(p.id || '');
  const [pct, setPct] = useState(String(p.discountPct != null ? Math.round(p.discountPct * 100) : 10));
  const [title, setTitle] = useState(p.title || '');
  const [desc, setDesc] = useState(p.description || '');
  const [min, setMin] = useState(String(p.minFare ?? 0));
  const [max, setMax] = useState(String(p.maxDiscount ?? 0));
  const [active, setActive] = useState(p.active === false ? 'no' : 'yes');

  const save = async () => {
    const payload = {
      discountPct: (+pct || 0) / 100,
      title,
      description: desc,
      minFare: +min,
      maxDiscount: +max,
      active: active === 'yes',
    };
    try {
      if (offer) await api(`/admin/offers/${offer.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/offers', { method: 'POST', body: { code, ...payload } });
      closeModal();
      toast('Saved');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <div>
      <div className="form">
        <div>
          <label>Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} disabled={!!offer} placeholder="FIRST20" />
        </div>
        <div>
          <label>Discount %</label>
          <input type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div className="full">
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="full">
          <label>Description</label>
          <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <label>Min fare (₹)</label>
          <input type="number" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div>
          <label>Max discount (₹, 0 = none)</label>
          <input type="number" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div>
          <label>Active</label>
          <select value={active} onChange={(e) => setActive(e.target.value)}>
            {['yes', 'no'].map((o) => (
              <option key={o}>{o}</option>
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
