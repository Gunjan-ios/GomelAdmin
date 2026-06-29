import { useState } from 'react';
import { api } from '../lib/api';
import type { Reward } from '../lib/types';
import { money } from '../lib/format';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

// Small reusable segmented control (same look as CarForm's).
function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          type="button"
          key={o.id}
          className={`seg-opt ${value === o.id ? 'on' : ''}`}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Reward redeem option form. Redesigned with a live reward-card preview, grouped
// sections and a discount/perk toggle. ID is disabled when editing; a "perk"
// reward stores value 0 (no money discount).
export function RewardForm({ reward, onSaved }: { reward: Reward | null; onSaved: () => void }) {
  const r = reward || ({} as Reward);

  const [id, setId] = useState(r.id || '');
  const [title, setTitle] = useState(r.title || '');
  const [desc, setDesc] = useState(r.description || '');
  const [cost, setCost] = useState(String(r.cost ?? 100));
  const [value, setValue] = useState(String(r.value ?? 0));
  const [kind, setKind] = useState<'discount' | 'perk'>(
    reward ? (r.value && r.value > 0 ? 'discount' : 'perk') : 'discount',
  );
  const [active, setActive] = useState(r.active !== false);
  const [saving, setSaving] = useState(false);

  const numCost = +cost || 0;
  const numValue = kind === 'perk' ? 0 : +value || 0;
  const canSave = title.trim().length > 0 && (reward ? true : id.trim().length > 0);

  const save = async () => {
    const payload = {
      title: title.trim(),
      description: desc.trim(),
      cost: numCost,
      value: numValue,
      active,
    };
    setSaving(true);
    try {
      if (reward) await api(`/admin/rewards/${reward.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/rewards', { method: 'POST', body: { id: id.trim(), ...payload } });
      closeModal();
      toast('Reward saved');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="car-form reward-form">
      {/* ---------------- Live reward-card preview ---------------- */}
      <div className="cf-hero rf-hero">
        <div className="cf-hero-thumb rf-thumb">
          <span className="cf-hero-ph i-gift" aria-hidden />
        </div>
        <div className="cf-hero-info">
          <div className="cf-hero-name">{title || 'Untitled reward'}</div>
          <div className="cf-hero-pills">
            <span className="cf-pill accent">{numCost.toLocaleString()} pts</span>
            <span className="cf-pill">{kind === 'perk' ? 'Perk' : `${money(numValue)} off`}</span>
            <span className={`cf-pill ${active ? 'ok' : 'off'}`}>{active ? 'Active' : 'Hidden'}</span>
          </div>
        </div>
      </div>

      <div className="cf-body">
        {/* ---------------- Details ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-gift" aria-hidden />
            <div>
              <h4>Reward details</h4>
              <p>What the customer sees in the rewards catalog.</p>
            </div>
          </header>
          <div className="cf-grid">
            <div className="full">
              <label>ID {reward ? '' : '(unique, e.g. r1)'}</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={!!reward}
                placeholder="r1"
              />
            </div>
            <div className="full">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. ₹200 off your next trip"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="full">
              <label>Description</label>
              <textarea
                placeholder="Short line explaining the reward…"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------------- Redemption ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-award" aria-hidden />
            <div>
              <h4>Redemption</h4>
              <p>Points to spend and what the customer gets back.</p>
            </div>
          </header>
          <div className="cf-grid">
            <div className="full">
              <label>Reward type</label>
              <Segmented
                value={kind}
                options={[
                  { id: 'discount', label: '₹ Discount' },
                  { id: 'perk', label: 'Perk / freebie' },
                ]}
                onChange={(v) => setKind(v as 'discount' | 'perk')}
              />
            </div>
            <div>
              <label>Cost (points)</label>
              <div className="cf-money">
                <span className="cf-money-pre">★</span>
                <input
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
                <span className="cf-money-suf">pts</span>
              </div>
            </div>
            <div>
              <label>Discount value</label>
              {kind === 'discount' ? (
                <div className="cf-money">
                  <span className="cf-money-pre">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                  <span className="cf-money-suf">off</span>
                </div>
              ) : (
                <div className="rf-perk-note">No money value — a non-cash perk.</div>
              )}
            </div>
          </div>
        </section>

        {/* ---------------- Status ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-sliders" aria-hidden />
            <div>
              <h4>Visibility</h4>
              <p>Whether customers can redeem this right now.</p>
            </div>
          </header>
          <button
            type="button"
            className={`cf-switch ${active ? 'on' : ''}`}
            role="switch"
            aria-checked={active}
            onClick={() => setActive(!active)}
          >
            <span className="cf-switch-knob" />
            <span className="cf-switch-txt">
              {active ? 'Active — shown in the rewards catalog' : 'Hidden from the app'}
            </span>
          </button>
        </section>
      </div>

      <div className="form-actions cf-actions">
        <button className="btn ghost" onClick={closeModal} disabled={saving}>
          Cancel
        </button>
        <button className="btn" onClick={save} disabled={saving || !canSave}>
          {saving ? 'Saving…' : reward ? 'Save changes' : 'Add reward'}
        </button>
      </div>
    </div>
  );
}
