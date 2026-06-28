import { useState } from 'react';
import { api } from '../lib/api';
import type { Plan } from '../lib/types';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

// Membership plan form modal. Ported 1:1 from planForm(). Plan ID is disabled
// when editing; perks are edited one-per-line and split on save.
export function PlanForm({ plan, onSaved }: { plan: Plan | null; onSaved: () => void }) {
  const p = plan || ({} as Plan);

  const [id, setId] = useState(p.id || '');
  const [name, setName] = useState(p.name || '');
  const [price, setPrice] = useState(String(p.monthlyPrice ?? 0));
  const [tagline, setTagline] = useState(p.tagline || '');
  const [disc, setDisc] = useState(String(p.discountPct != null ? Math.round(p.discountPct * 100) : 0));
  const [mult, setMult] = useState(String(p.loyaltyMultiplier ?? 1));
  const [dep, setDep] = useState(p.waiveDeposit ? 'yes' : 'no');
  const [perksText, setPerksText] = useState((p.perks || []).join('\n'));
  const [hl, setHl] = useState(p.highlighted ? 'yes' : 'no');

  const save = async () => {
    const perks = perksText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name,
      monthlyPrice: +price || 0,
      tagline,
      perks,
      highlighted: hl === 'yes',
      discountPct: (+disc || 0) / 100,
      loyaltyMultiplier: +mult || 1,
      waiveDeposit: dep === 'yes',
    };
    try {
      if (plan) await api(`/admin/plans/${plan.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/plans', { method: 'POST', body: { id: id.trim().toLowerCase(), ...payload } });
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
          <label>Plan ID</label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={!!plan}
            placeholder="basic / plus / pro"
          />
        </div>
        <div>
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label>Price / month (₹)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="full">
          <label>Tagline</label>
          <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <div>
          <label>Trip discount %</label>
          <input type="number" value={disc} onChange={(e) => setDisc(e.target.value)} />
        </div>
        <div>
          <label>Loyalty points multiplier</label>
          <input type="number" value={mult} onChange={(e) => setMult(e.target.value)} />
        </div>
        <div>
          <label>Waive deposit</label>
          <select value={dep} onChange={(e) => setDep(e.target.value)}>
            {['yes', 'no'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="full">
          <label>Perks (one per line)</label>
          <textarea rows={5} value={perksText} onChange={(e) => setPerksText(e.target.value)} />
        </div>
        <div>
          <label>Mark as popular</label>
          <select value={hl} onChange={(e) => setHl(e.target.value)}>
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
