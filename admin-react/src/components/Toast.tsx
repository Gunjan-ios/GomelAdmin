import { useSyncExternalStore } from 'react';

// Imperative toast, callable from anywhere (forms, actions) exactly like the
// original vanilla `toast(msg)`. A tiny external store backs a single host.

let current: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function toast(msg: string): void {
  current = msg;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 2200);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function ToastHost() {
  const msg = useSyncExternalStore(subscribe, () => current);
  return (
    <div id="toast" className={`toast ${msg ? '' : 'hidden'}`}>
      {msg}
    </div>
  );
}
