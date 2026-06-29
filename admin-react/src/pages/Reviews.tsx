import { useState } from 'react';
import { api } from '../lib/api';
import type { Review, Envelope } from '../lib/types';
import { useFetch } from '../lib/useFetch';
import { TableSkeleton } from '../components/Skeleton';
import { fmtDate } from '../lib/format';
import { Stars } from '../components/Charts';
import { PaginatedTable } from '../components/Table';

export function Reviews() {
  const { data, loading, error } = useFetch(() => api<Envelope<Review[]>>('/admin/reviews'));

  const [car, setCar] = useState('');
  const [rating, setRating] = useState('');
  const [author, setAuthor] = useState('');

  if (loading) return <TableSkeleton cols={5} />;
  if (error) return <div className="empty">{error}</div>;

  const rows = data?.data || [];

  // Distinct car names for the car dropdown.
  const carNames = [...new Set(rows.map((r) => r.carName || r.carId).filter(Boolean))].sort(
    (a, b) => String(a).localeCompare(String(b)),
  ) as string[];

  const authorV = author.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (car && (r.carName || r.carId) !== car) return false;
    if (rating && Math.round(Number(r.rating) || 0) !== Number(rating)) return false;
    if (authorV && !String(r.author || 'Guest').toLowerCase().includes(authorV)) return false;
    return true;
  });

  // Key the table on the active filter so it resets to page 1 on any change.
  const tableKey = `${car}|${rating}|${authorV}`;

  return (
    <div>
      <div className="toolbar">
        <select id="rv_car" value={car} onChange={(e) => setCar(e.target.value)}>
          <option value="">All cars</option>
          {carNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select id="rv_rating" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">All ratings</option>
          <option value="5">★★★★★ (5)</option>
          <option value="4">★★★★ (4)</option>
          <option value="3">★★★ (3)</option>
          <option value="2">★★ (2)</option>
          <option value="1">★ (1)</option>
        </select>
        <input
          id="rv_author"
          type="search"
          placeholder="Search author…"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <button
          className="btn ghost sm"
          id="rv_clear"
          onClick={() => {
            setCar('');
            setRating('');
            setAuthor('');
          }}
        >
          Clear
        </button>
      </div>
      <div className="card list-card">
        <div className="card-head">
          <h2>
            {filtered.length} of {rows.length} review{rows.length === 1 ? '' : 's'}
          </h2>
        </div>
        <div>
          <PaginatedTable
            key={tableKey}
            headers={['Car', 'Author', 'Rating', 'Comment', 'Date']}
            rows={filtered.map((r) => [
              r.carName || r.carId,
              r.author || 'Guest',
              <Stars rating={r.rating} />,
              r.comment || '—',
              fmtDate(r.date),
            ])}
          />
        </div>
      </div>
    </div>
  );
}
