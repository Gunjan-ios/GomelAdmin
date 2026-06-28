import type { ReactNode } from 'react';

// Maps a status string to a pill colour. Ported from the original statusPill().
const COLOR: Record<string, string> = {
  upcoming: 'blue',
  ongoing: 'warn',
  completed: 'ok',
  cancelled: 'bad',
  verified: 'ok',
  pending: 'warn',
  notSubmitted: 'gray',
  submitted: 'blue',
  underReview: 'warn',
  resolved: 'ok',
  user: 'gray',
  host: 'blue',
  admin: 'bad',
  active: 'ok',
  expired: 'gray',
  none: 'gray',
  // Payout aliases (the original re-labelled completed/cancelled/pending).
  paid: 'ok',
  rejected: 'bad',
  requested: 'warn',
};

export function pillColor(s: string): string {
  return COLOR[s] || 'gray';
}

/** A status pill. `label` overrides the displayed text (e.g. payout relabelling). */
export function StatusPill({ status, label }: { status: string; label?: ReactNode }) {
  return <span className={`pill ${pillColor(status)}`}>{label ?? status}</span>;
}

// Payout status uses paid/rejected/requested directly (same colours).
export function PayoutPill({ status }: { status: string }) {
  return <StatusPill status={status} />;
}
