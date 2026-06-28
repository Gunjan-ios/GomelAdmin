import { useState } from 'react';
import { api } from '../lib/api';
import type { Car } from '../lib/types';
import { FEATURE_CATALOG } from '../lib/constants';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';
import { PhotoGrid } from '../components/PhotoGrid';

const PHOTO_SLOTS = ['Front', 'Rear', 'Left', 'Right', 'Interior', 'Dashboard'];
const RC_SLOTS = ['RC front', 'RC back'];
const ALL_CATALOG = ([] as string[]).concat(...Object.values(FEATURE_CATALOG));

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

  return (
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
    </div>
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
  const [seats, setSeats] = useState(String(c.seats ?? 5));
  const [pph, setPph] = useState(String(c.pricePerHour ?? 0));
  const [ppd, setPpd] = useState(String(c.pricePerDay ?? 0));
  const [addr, setAddr] = useState(c.pickupAddress || '');
  const [slots, setSlots] = useState<(string | null)[]>(PHOTO_SLOTS.map((_, i) => existing[i] || null));
  const [rcSlots, setRcSlots] = useState<(string | null)[]>(RC_SLOTS.map((_, i) => existingRc[i] || null));
  const [features, setFeatures] = useState<string[]>(
    (Array.isArray(c.features) ? c.features : []).filter(Boolean),
  );
  const [hostName, setHostName] = useState(c.host?.name || '');
  const [active, setActive] = useState(c.active === false ? 'no' : 'yes');
  const [sheetOpen, setSheetOpen] = useState(false);

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
      active: active === 'yes',
    };
    try {
      if (car) await api(`/admin/cars/${car.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/cars', { method: 'POST', body: payload });
      closeModal();
      toast('Car saved');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <div>
      <div className="form">
        <div className="full">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {['SUV', 'Sedan', 'Hatchback', 'Luxury'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Transmission</label>
          <select value={trans} onChange={(e) => setTrans(e.target.value)}>
            {['manual', 'automatic'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Fuel</label>
          <select value={fuel} onChange={(e) => setFuel(e.target.value)}>
            {['petrol', 'diesel', 'electric', 'hybrid'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Seats</label>
          <input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} />
        </div>
        <div>
          <label>Price / hour</label>
          <input type="number" value={pph} onChange={(e) => setPph(e.target.value)} />
        </div>
        <div>
          <label>Price / day</label>
          <input type="number" value={ppd} onChange={(e) => setPpd(e.target.value)} />
        </div>
        <div className="full">
          <label>Pickup address</label>
          <input type="text" value={addr} onChange={(e) => setAddr(e.target.value)} />
        </div>
        <div className="full">
          <label>
            Car photos <span className="lbl-hint">(max 6)</span>
          </label>
          <PhotoGrid names={PHOTO_SLOTS} slots={slots} onChange={setSlots} />
        </div>
        <div className="full">
          <label>
            RC book <span className="lbl-hint">(ownership proof)</span>
          </label>
          <PhotoGrid names={RC_SLOTS} slots={rcSlots} onChange={setRcSlots} />
        </div>
        <div className="full">
          <label>Features</label>
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
        </div>
        <div>
          <label>Host name</label>
          <input type="text" value={hostName} onChange={(e) => setHostName(e.target.value)} />
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
      {sheetOpen && (
        <FeatureSheet selected={features} onChange={setFeatures} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  );
}
