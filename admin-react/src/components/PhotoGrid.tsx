import { useState } from 'react';
import { uploadFile } from '../lib/api';
import { toast } from './Toast';

// A labelled grid of photo slots backed by `slots`. Each filled slot shows a
// thumbnail with a remove button; each empty slot an upload tile. Ported from
// the car form's renderGrid().
export function PhotoGrid({
  names,
  slots,
  onChange,
}: {
  names: string[];
  slots: (string | null)[];
  onChange: (next: (string | null)[]) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);

  const setSlot = (i: number, url: string | null) => {
    const next = slots.slice();
    next[i] = url;
    onChange(next);
  };

  const onPick = async (i: number, file: File | undefined) => {
    if (!file) return;
    setBusy(i);
    try {
      const url = await uploadFile(file);
      setSlot(i, url);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="photo-grid">
      {names.map((name, i) =>
        slots[i] ? (
          <div className="photo-slot" key={i}>
            <div className="photo-thumb">
              <img src={slots[i] as string} alt="" />
              <button type="button" className="photo-rm" title="Remove" onClick={() => setSlot(i, null)}>
                ✕
              </button>
            </div>
            <span className="photo-cap">{name}</span>
          </div>
        ) : (
          <div className="photo-slot" key={i}>
            <label className={`photo-add ${busy === i ? 'busy' : ''}`}>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  onPick(i, file);
                }}
              />
              <span>＋</span>
            </label>
            <span className="photo-cap">{name}</span>
          </div>
        ),
      )}
    </div>
  );
}
