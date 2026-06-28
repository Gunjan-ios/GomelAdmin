export interface RowAction {
  label: string;
  cls?: string; // '', 'ghost', 'danger'
  onClick: () => void;
}

// Inline row action buttons, ported from the original rowBtns().
export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="row-actions">
      {actions.map((a, i) => (
        <button key={i} className={`btn sm ${a.cls || ''}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  );
}
