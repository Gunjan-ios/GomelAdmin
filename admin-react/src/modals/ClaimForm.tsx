import { useState } from 'react';
import { api } from '../lib/api';
import type { Claim, ClaimStatus } from '../lib/types';
import { closeModal } from '../components/Modal';
import { toast } from '../components/Toast';

const STATUSES: ClaimStatus[] = ['submitted', 'underReview', 'resolved'];

export function ClaimForm({ claim, onSaved }: { claim: Claim; onSaved: () => void }) {
  const [status, setStatus] = useState<ClaimStatus>(claim.status ?? 'submitted');
  const [insurer, setInsurer] = useState(claim.insurer || '');
  const [fee, setFee] = useState(String(claim.processingFee ?? 0));

  const save = async () => {
    try {
      await api(`/admin/claims/${claim.id}`, {
        method: 'PATCH',
        body: { status, insurer, processingFee: +fee },
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
          <select value={status} onChange={(e) => setStatus(e.target.value as ClaimStatus)}>
            {STATUSES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Insurer</label>
          <input type="text" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
        </div>
        <div>
          <label>Processing fee</label>
          <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
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
