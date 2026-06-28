import type { Plan } from '../lib/types';
import { money } from '../lib/format';

// Presentational membership-plan card with featured ribbon, price, stats grid
// and perks. The page wires onEdit/onDelete. Ported 1:1 from planCard().
export function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: Plan;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const featured = !!plan.highlighted;
  const disc = Math.round((plan.discountPct || 0) * 100);
  const mult = plan.loyaltyMultiplier || 1;
  const perks = plan.perks || [];

  return (
    <div className={`plan-card${featured ? ' featured' : ''}`}>
      {featured && <div className="plan-ribbon">★ Popular</div>}
      <div className="plan-top">
        <div className="plan-headings">
          <div className="plan-name">{plan.name || plan.id}</div>
          {plan.tagline && <div className="plan-tag">{plan.tagline}</div>}
        </div>
        <span className="plan-id">{plan.id}</span>
      </div>
      <div className="plan-price">
        <span className="amt">{money(plan.monthlyPrice)}</span>
        <span className="per">/mo</span>
      </div>
      <div className="plan-stats">
        <div className="ps">
          <div className="ps-n">{disc}%</div>
          <div className="ps-l">off trips</div>
        </div>
        <div className="ps">
          <div className="ps-n">{plan.waiveDeposit ? 'Zero' : 'Std'}</div>
          <div className="ps-l">deposit</div>
        </div>
        <div className="ps">
          <div className="ps-n">{mult}x</div>
          <div className="ps-l">points</div>
        </div>
      </div>
      {perks.length > 0 && (
        <ul className="plan-perks">
          {perks.map((pk, i) => (
            <li key={i}>{pk}</li>
          ))}
        </ul>
      )}
      <div className="plan-actions">
        <button className="btn ghost sm" onClick={onEdit}>
          Edit
        </button>
        <button className="btn danger sm" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
