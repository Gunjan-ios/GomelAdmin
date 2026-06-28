import { useState } from 'react';
import { api } from '../lib/api';
import type { Reward } from '../lib/types';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

// Reward redeem option form modal. Ported 1:1 from rewardForm(). ID is disabled
// when editing; value 0 means a perk rather than a money discount.
export function RewardForm({ reward, onSaved }: { reward: Reward | null; onSaved: () => void }) {
  const r = reward || ({} as Reward);

  const [id, setId] = useState(r.id || '');
  const [title, setTitle] = useState(r.title || '');
  const [desc, setDesc] = useState(r.description || '');
  const [cost, setCost] = useState(String(r.cost ?? 100));
  const [value, setValue] = useState(String(r.value ?? 0));
  const [active, setActive] = useState(r.active === false ? 'no' : 'yes');

  const save = async () => {
    const payload = {
      title,
      description: desc,
      cost: +cost,
      value: +value,
      active: active === 'yes',
    };
    try {
      if (reward) await api(`/admin/rewards/${reward.id}`, { method: 'PATCH', body: payload });
      else await api('/admin/rewards', { method: 'POST', body: { id: id.trim(), ...payload } });
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
          <label>ID</label>
          <input value={id} onChange={(e) => setId(e.target.value)} disabled={!!reward} placeholder="r1" />
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
          <label>Cost (points)</label>
          <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div>
          <label>Value (₹ off, 0 = perk)</label>
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
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
