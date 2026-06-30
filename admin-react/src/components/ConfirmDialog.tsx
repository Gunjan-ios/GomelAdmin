import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

// Imperative, promise-based confirm dialog — a styled replacement for the native
// window.confirm(). Call `await confirmDialog({...})` from anywhere; it resolves
// true on confirm and false on cancel / Escape / backdrop click. A single
// <ConfirmHost /> mounted at the app root renders the active dialog.

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Destructive actions (delete, reject) get a red icon and a solid red button.
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let current: ConfirmState | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  // If one is somehow already open, treat it as cancelled before replacing it.
  current?.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { ...opts, resolve };
    emit();
  });
}

function settle(ok: boolean) {
  const req = current;
  if (!req) return;
  current = null;
  emit();
  req.resolve(ok);
}

const AlertIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const QueryIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function ConfirmHost() {
  const state = useSyncExternalStore(subscribe, () => current);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      else if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  if (!state) return null;

  const { title, message, confirmLabel, cancelLabel, danger } = state;

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).classList.contains('confirm-overlay')) settle(false);
      }}
    >
      <div
        className={`confirm-card${danger ? ' danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="confirm-icon">{danger ? AlertIcon : QueryIcon}</div>
        <h3 className="confirm-title">{title}</h3>
        {message != null && <div className="confirm-msg">{message}</div>}
        <div className="confirm-actions">
          <button className="btn ghost" onClick={() => settle(false)}>
            {cancelLabel || 'Cancel'}
          </button>
          <button
            className={`btn${danger ? ' danger-solid' : ''}`}
            autoFocus
            onClick={() => settle(true)}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
