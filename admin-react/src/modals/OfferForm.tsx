import { useState } from 'react';
import { api } from '../lib/api';
import type { Offer } from '../lib/types';
import { money } from '../lib/format';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

// Promo code form modal. Ported 1:1 from offerForm(). Code is disabled when
// editing; discount stored as a fraction (pct / 100). A live coupon preview at
// the top reflects the field values as the admin types.
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

  const isOn = active === 'yes';
  const pctNum = Math.max(0, Math.round(+pct || 0));

  return (
    <div className="offer-form">
      {/* ---------------- Live coupon preview ---------------- */}
      <div className="offer-preview">
        <div className={`coupon ${isOn ? 'on' : 'off'}`}>
          <div className="coupon-stub">
            <div className="coupon-pct">
              {pctNum}
              <span>%</span>
            </div>
            <div className="coupon-off">OFF</div>
          </div>
          <div className="coupon-body">
            <div className="coupon-top">
              <span className="coupon-code">{code || 'CODE'}</span>
              <span className={`pill ${isOn ? 'ok' : 'gray'}`}>{isOn ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="coupon-title">{title || 'Offer title'}</div>
            <div className="coupon-desc">{desc || 'Add a short description shown to customers.'}</div>
            <div className="coupon-meta">
              <span>
                <i className="bd-ic ic-rupee" />
                Min fare {money(+min)}
              </span>
              <span>
                <i className="bd-ic ic-tag" />
                {+max > 0 ? `Up to ${money(+max)} off` : 'No cap'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Fields ---------------- */}
      <div className="form">
        <div>
          <label>Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={!!offer} placeholder="FIRST20" />
        </div>
        <div>
          <label>Discount %</label>
          <input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div className="full">
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Flat 20% off your first trip" />
        </div>
        <div className="full">
          <label>Description</label>
          <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Shown under the code at checkout" />
        </div>
        <div>
          <label>Min fare (₹)</label>
          <input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div>
          <label>Max discount (₹, 0 = none)</label>
          <input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div className="full">
          <label>Status</label>
          <div className="seg" role="tablist">
            <button type="button" className={isOn ? 'on' : ''} onClick={() => setActive('yes')}>
              Active
            </button>
            <button type="button" className={!isOn ? 'on' : ''} onClick={() => setActive('no')}>
              Inactive
            </button>
          </div>
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
