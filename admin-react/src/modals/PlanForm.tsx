import { useState } from 'react';
import { api } from '../lib/api';
import type { Plan } from '../lib/types';
import { money } from '../lib/format';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

// Membership plan form. Redesigned with a live plan-card preview, grouped
// sections, money inputs, toggle switches and an editable perks list. Plan ID
// is disabled when editing.
export function PlanForm({ plan, onSaved }: { plan: Plan | null; onSaved: () => void }) {
  const p = plan || ({} as Plan);

  const [id, setId] = useState(p.id || '');
  const [name, setName] = useState(p.name || '');
  const [price, setPrice] = useState(String(p.monthlyPrice ?? 0));
  const [tagline, setTagline] = useState(p.tagline || '');
  const [disc, setDisc] = useState(String(p.discountPct != null ? Math.round(p.discountPct * 100) : 0));
  const [mult, setMult] = useState(String(p.loyaltyMultiplier ?? 1));
  const [waiveDep, setWaiveDep] = useState(!!p.waiveDeposit);
  const [perks, setPerks] = useState<string[]>(p.perks && p.perks.length ? [...p.perks] : ['']);
  const [highlighted, setHighlighted] = useState(!!p.highlighted);
  const [saving, setSaving] = useState(false);

  const numPrice = +price || 0;
  const numDisc = Math.round(+disc || 0);
  const numMult = +mult || 1;
  const canSave = name.trim().length > 0 && (plan ? true : id.trim().length > 0);

  const setPerk = (i: number, v: string) => setPerks(perks.map((x, j) => (j === i ? v : x)));
  const addPerk = () => setPerks([...perks, '']);
  const removePerk = (i: number) => {
    const next = perks.filter((_, j) => j !== i);
    setPerks(next.length ? next : ['']);
  };

  const save = async () => {
    const cleanPerks = perks.map((s) => s.trim()).filter(Boolean);
    const payload = {
      name: name.trim(),
      monthlyPrice: numPrice,
      tagline: tagline.trim(),
      perks: cleanPerks,
      highlighted,
      discountPct: numDisc / 100,
      loyaltyMultiplier: numMult,
      waiveDeposit: waiveDep,
    };
    setSaving(true);
    try {
      if (plan) await api(`/admin/plans/${plan.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/plans', { method: 'POST', body: { id: id.trim().toLowerCase(), ...payload } });
      closeModal();
      toast('Plan saved');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="car-form plan-form">
      {/* ---------------- Live plan preview ---------------- */}
      <div className="cf-hero pf-hero">
        {highlighted && <span className="pf-hero-pop">★ Popular</span>}
        <div className="cf-hero-thumb pf-thumb">
          <span className="cf-hero-ph i-award" aria-hidden />
        </div>
        <div className="cf-hero-info">
          <div className="cf-hero-name">
            {name || 'Untitled plan'}
            <span className="pf-price">
              {money(numPrice)}<span className="pf-per">/mo</span>
            </span>
          </div>
          <div className="cf-hero-pills">
            <span className="cf-pill accent">{numDisc}% off trips</span>
            <span className="cf-pill">{numMult}× points</span>
            <span className={`cf-pill ${waiveDep ? 'ok' : ''}`}>
              {waiveDep ? 'Zero deposit' : 'Std deposit'}
            </span>
          </div>
        </div>
      </div>

      <div className="cf-body">
        {/* ---------------- Basics ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-award" aria-hidden />
            <div>
              <h4>Plan basics</h4>
              <p>Name and tagline shown on the membership card.</p>
            </div>
          </header>
          <div className="cf-grid">
            <div className="full">
              <label>Plan ID</label>
              {plan ? (
                <div className="pf-idlock">
                  <span className="pf-idlock-ic" aria-hidden />
                  <span className="pf-idlock-val">{id}</span>
                  <span className="pf-idlock-tag">Locked</span>
                </div>
              ) : (
                <>
                  <div className="pf-idedit">
                    <span className="pf-idedit-pre" aria-hidden />
                    <input
                      type="text"
                      value={id}
                      onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="plus"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="pf-hint">Lowercase, no spaces. Permanent — can’t be changed later.</p>
                </>
              )}
            </div>
            <div className="full">
              <label>Name</label>
              <input
                type="text"
                placeholder="e.g. GoMel Plus"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="full">
              <label>Tagline</label>
              <input
                type="text"
                placeholder="e.g. Best for frequent renters"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------------- Pricing & benefits ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-rupee" aria-hidden />
            <div>
              <h4>Pricing & benefits</h4>
              <p>What members pay and the perks they unlock.</p>
            </div>
          </header>
          <div className="cf-grid">
            <div>
              <label>Price / month</label>
              <div className="cf-money">
                <span className="cf-money-pre">₹</span>
                <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                <span className="cf-money-suf">/mo</span>
              </div>
            </div>
            <div>
              <label>Trip discount</label>
              <div className="cf-money no-pre">
                <input type="number" min="0" max="100" value={disc} onChange={(e) => setDisc(e.target.value)} />
                <span className="cf-money-suf">% off</span>
              </div>
            </div>
            <div>
              <label>Loyalty multiplier</label>
              <div className="cf-money no-pre">
                <input type="number" min="1" step="0.5" value={mult} onChange={(e) => setMult(e.target.value)} />
                <span className="cf-money-suf">× points</span>
              </div>
            </div>
            <div>
              <label>Security deposit</label>
              <button
                type="button"
                className={`cf-switch ${waiveDep ? 'on' : ''}`}
                role="switch"
                aria-checked={waiveDep}
                onClick={() => setWaiveDep(!waiveDep)}
              >
                <span className="cf-switch-knob" />
                <span className="cf-switch-txt">{waiveDep ? 'Waived for members' : 'Standard deposit'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ---------------- Perks ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-gift" aria-hidden />
            <div>
              <h4>Perks</h4>
              <p>Bullet points listed on the plan card.</p>
            </div>
            {perks.filter((x) => x.trim()).length > 0 && (
              <span className="cf-count">{perks.filter((x) => x.trim()).length}</span>
            )}
          </header>
          <div className="pf-perks">
            {perks.map((perk, i) => (
              <div className="pf-perk" key={i}>
                <span className="pf-perk-dot" aria-hidden />
                <input
                  type="text"
                  placeholder="e.g. Free cancellation any time"
                  value={perk}
                  onChange={(e) => setPerk(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPerk();
                    }
                  }}
                />
                <button
                  type="button"
                  className="icon-btn pf-perk-del"
                  title="Remove perk"
                  onClick={() => removePerk(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn ghost pf-add" onClick={addPerk}>
            ＋ Add perk
          </button>
        </section>

        {/* ---------------- Visibility ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-sliders" aria-hidden />
            <div>
              <h4>Visibility</h4>
              <p>Highlight this as the recommended plan.</p>
            </div>
          </header>
          <button
            type="button"
            className={`cf-switch ${highlighted ? 'on' : ''}`}
            role="switch"
            aria-checked={highlighted}
            onClick={() => setHighlighted(!highlighted)}
          >
            <span className="cf-switch-knob" />
            <span className="cf-switch-txt">
              {highlighted ? 'Marked as “Popular” — featured to users' : 'Not featured'}
            </span>
          </button>
        </section>
      </div>

      <div className="form-actions cf-actions">
        <button className="btn ghost" onClick={closeModal} disabled={saving}>
          Cancel
        </button>
        <button className="btn" onClick={save} disabled={saving || !canSave}>
          {saving ? 'Saving…' : plan ? 'Save changes' : 'Add plan'}
        </button>
      </div>
    </div>
  );
}
