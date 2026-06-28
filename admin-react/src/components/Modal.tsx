import { useSyncExternalStore, type ReactNode } from 'react';

// Imperative modal manager mirroring the original `openModal(title, node)` /
// `closeModal()`. Ported modal forms are React components passed as `content`.

interface ModalState {
  title: string;
  content: ReactNode;
}

let current: ModalState | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openModal(title: string, content: ReactNode): void {
  current = { title, content };
  emit();
}

export function closeModal(): void {
  current = null;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function ModalHost() {
  const state = useSyncExternalStore(subscribe, () => current);
  return (
    <div
      id="modal"
      className={`modal ${state ? '' : 'hidden'}`}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).id === 'modal') closeModal();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <h3 id="modalTitle">{state?.title ?? 'Edit'}</h3>
          <button className="icon-btn" onClick={closeModal}>
            ✕
          </button>
        </div>
        <div id="modalBody">{state?.content}</div>
      </div>
    </div>
  );
}
