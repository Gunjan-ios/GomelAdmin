import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import type { Car } from '../lib/types';
import { FEATURE_CATALOG } from '../lib/constants';
import { imgSrc, money } from '../lib/format';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { PhotoGrid } from '../components/PhotoGrid';

const PHOTO_SLOTS = ['Front', 'Rear', 'Left', 'Right', 'Interior', 'Dashboard'];
const RC_SLOTS = ['RC front', 'RC back'];
const ALL_CATALOG = ([] as string[]).concat(...Object.values(FEATURE_CATALOG));

const TYPES = ['SUV', 'Sedan', 'Hatchback', 'Luxury'];
const TRANSMISSIONS = ['manual', 'automatic'];
const FUELS = ['petrol', 'diesel', 'electric', 'hybrid'];

// Small reusable segmented control — replaces a <select> with tappable chips.
function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          className={`seg-opt ${value === o ? 'on' : ''}`}
          aria-pressed={value === o}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// Plus/minus stepper for small integer counts (seats).
function Stepper({
  value,
  min = 1,
  max = 12,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min}>
        −
      </button>
      <span className="stepper-val">{value}</span>
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

// Multi-section feature picker. Stacked popup above the car-form modal.
function FeatureSheet({
  selected,
  onChange,
  onClose,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const sel = new Set(selected);

  const toggle = (f: string) => {
    const next = new Set(sel);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    onChange([...next]);
  };

  const addCustom = () => {
    const next = new Set(sel);
    input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((f) => {
        const match = ALL_CATALOG.find((x) => x.toLowerCase() === f.toLowerCase());
        next.add(match || f);
      });
    setInput('');
    onChange([...next]);
  };

  const custom = selected.filter((f) => !ALL_CATALOG.includes(f));

  // Portal to <body> so the overlay escapes the modal card's containing block
  // (the modal's backdrop-filter/animation makes position:fixed resolve against
  // the scrolling card instead of the viewport).
  return createPortal(
    <div className="sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet-card">
        <div className="sheet-head">
          <h3>Select features</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-body">
          {Object.entries(FEATURE_CATALOG).map(([group, items]) => {
            const n = items.filter((f) => sel.has(f)).length;
            return (
              <div className="feat-group" key={group}>
                <span className="feat-group-h">
                  {group}
                  {n ? <em> ({n})</em> : null}
                </span>
                <div className="feat-wrap">
                  {items.map((f) => (
                    <button
                      type="button"
                      key={f}
                      className={`feat-chip ${sel.has(f) ? 'on' : ''}`}
                      onClick={() => toggle(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {custom.length > 0 && (
            <div className="feat-group">
              <span className="feat-group-h">
                Custom <em>({custom.length})</em>
              </span>
              <div className="feat-wrap">
                {custom.map((f) => (
                  <button type="button" key={f} className="feat-chip on custom" onClick={() => toggle(f)}>
                    {f} <span className="x">✕</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="sheet-foot">
          <div className="feat-addrow">
            <input
              type="text"
              placeholder="Add a custom feature…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" className="btn ghost" onClick={addCustom}>
              Add
            </button>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Done{selected.length ? ` (${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CarForm({ car, onSaved }: { car: Car | null; onSaved: () => void }) {
  const c = car || ({} as Car);
  const existing = Array.isArray(c.images) ? c.images.filter(Boolean) : [];
  const existingRc = Array.isArray(c.rcBook) ? c.rcBook.filter(Boolean) : [];

  const [name, setName] = useState(c.name || '');
  const [type, setType] = useState(c.type || 'SUV');
  const [trans, setTrans] = useState(c.transmission || 'manual');
  const [fuel, setFuel] = useState(c.fuel || 'petrol');
  const [seats, setSeats] = useState(c.seats ?? 5);
  const [pph, setPph] = useState(String(c.pricePerHour ?? 0));
  const [ppd, setPpd] = useState(String(c.pricePerDay ?? 0));
  const [addr, setAddr] = useState(c.pickupAddress || '');
  const [slots, setSlots] = useState<(string | null)[]>(PHOTO_SLOTS.map((_, i) => existing[i] || null));
  const [rcSlots, setRcSlots] = useState<(string | null)[]>(RC_SLOTS.map((_, i) => existingRc[i] || null));
  const [features, setFeatures] = useState<string[]>(
    (Array.isArray(c.features) ? c.features : []).filter(Boolean),
  );
  const [hostName, setHostName] = useState(c.host?.name || '');
  const [active, setActive] = useState(c.active !== false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const hero = slots.find(Boolean);
  const photoCount = slots.filter(Boolean).length;

  const save = async () => {
    const payload = {
      name,
      type,
      transmission: trans,
      fuel,
      seats: +seats,
      pricePerHour: +pph,
      pricePerDay: +ppd,
      pickupAddress: addr,
      images: slots.filter(Boolean),
      features,
      host: { name: hostName },
      active,
    };
    setSaving(true);
    try {
      if (car) await api(`/admin/cars/${car.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/cars', { method: 'POST', body: payload });
      closeModal();
      toast('Car saved');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="car-form">
      {/* Live preview banner */}
      <div className="cf-hero">
        <div className="cf-hero-thumb">
          {hero && imgSrc(hero) ? (
            <img src={imgSrc(hero)} alt="" />
          ) : (
            <span className="cf-hero-ph i-car" aria-hidden />
          )}
        </div>
        <div className="cf-hero-info">
          <div className="cf-hero-name">{name || 'Untitled car'}</div>
          <div className="cf-hero-pills">
            <span className="cf-pill">{type}</span>
            <span className="cf-pill">{seats} seats</span>
            <span className="cf-pill accent">{money(+ppd || 0)}/day</span>
            <span className={`cf-pill ${active ? 'ok' : 'off'}`}>{active ? 'Active' : 'Hidden'}</span>
          </div>
        </div>
      </div>

      <div className="cf-body">
        {/* ---------------- Details ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-car" aria-hidden />
            <div>
              <h4>Vehicle details</h4>
              <p>Identity & specifications shown to renters.</p>
            </div>
          </header>
          <div className="cf-grid">
            <div className="full">
              <label>Car name</label>
              <input
                type="text"
                placeholder="e.g. Toyota Fortuner"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="full">
              <label>Body type</label>
              <Segmented value={type} options={TYPES} onChange={setType} />
            </div>
            <div>
              <label>Transmission</label>
              <Segmented value={trans} options={TRANSMISSIONS} onChange={setTrans} />
            </div>
            <div>
              <label>Seats</label>
              <Stepper value={seats} onChange={setSeats} />
            </div>
            <div className="full">
              <label>Fuel type</label>
              <Segmented value={fuel} options={FUELS} onChange={setFuel} />
            </div>
          </div>
        </section>

        {/* ---------------- Pricing ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-rupee" aria-hidden />
            <div>
              <h4>Pricing</h4>
              <p>Rates charged to the customer.</p>
            </div>
          </header>
          <div className="cf-grid">
            <div>
              <label>Price / hour</label>
              <div className="cf-money">
                <span className="cf-money-pre">₹</span>
                <input type="number" min="0" value={pph} onChange={(e) => setPph(e.target.value)} />
                <span className="cf-money-suf">/hr</span>
              </div>
            </div>
            <div>
              <label>Price / day</label>
              <div className="cf-money">
                <span className="cf-money-pre">₹</span>
                <input type="number" min="0" value={ppd} onChange={(e) => setPpd(e.target.value)} />
                <span className="cf-money-suf">/day</span>
              </div>
            </div>
            <div className="full">
              <label>Pickup address</label>
              <input
                type="text"
                placeholder="Where renters collect the car"
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------------- Photos ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-image" aria-hidden />
            <div>
              <h4>Car photos</h4>
              <p>Up to 6 angles.</p>
            </div>
            <span className="cf-count">{photoCount}/6</span>
          </header>
          <PhotoGrid names={PHOTO_SLOTS} slots={slots} onChange={setSlots} />
        </section>

        {/* ---------------- Documents ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-id" aria-hidden />
            <div>
              <h4>RC book</h4>
              <p>Registration certificate — ownership proof.</p>
            </div>
          </header>
          <PhotoGrid names={RC_SLOTS} slots={rcSlots} onChange={setRcSlots} />
        </section>

        {/* ---------------- Features ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-sliders" aria-hidden />
            <div>
              <h4>Features</h4>
              <p>Highlights & amenities.</p>
            </div>
            {features.length > 0 && <span className="cf-count">{features.length}</span>}
          </header>
          <div className="feat-summary">
            {features.length === 0 ? (
              <span className="feat-empty">No features selected yet.</span>
            ) : (
              features.map((f) => (
                <span className="feat-tag" key={f}>
                  {f}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => setFeatures(features.filter((x) => x !== f))}
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
          <button type="button" className="btn ghost feat-open" onClick={() => setSheetOpen(true)}>
            ＋ Select features
          </button>
        </section>

        {/* ---------------- Host & visibility ---------------- */}
        <section className="cf-section">
          <header className="cf-sec-head">
            <span className="cf-sec-ic i-user" aria-hidden />
            <div>
              <h4>Host & visibility</h4>
              <p>Owner and listing status.</p>
            </div>
          </header>
          <div className="cf-grid">
            <div className="full">
              <label>Host name</label>
              <input type="text" value={hostName} onChange={(e) => setHostName(e.target.value)} />
            </div>
            <div className="full">
              <label>Listing status</label>
              <button
                type="button"
                className={`cf-switch ${active ? 'on' : ''}`}
                role="switch"
                aria-checked={active}
                onClick={() => setActive(!active)}
              >
                <span className="cf-switch-knob" />
                <span className="cf-switch-txt">{active ? 'Active — visible to renters' : 'Hidden from app'}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="form-actions cf-actions">
        <button className="btn ghost" onClick={closeModal} disabled={saving}>
          Cancel
        </button>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : car ? 'Save changes' : 'Add car'}
        </button>
      </div>

      {sheetOpen && (
        <FeatureSheet selected={features} onChange={setFeatures} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  );
}
