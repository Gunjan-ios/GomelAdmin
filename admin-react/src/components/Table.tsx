import { useState, type ReactNode } from 'react';

export type Cell = ReactNode;
export type Row = Cell[];

// Default rows per page for every admin list table, and the choices offered in
// the "rows per page" selector.
export const PAGE_SIZE = 15;
export const PAGE_SIZE_OPTIONS = [15, 50, 100];

// Basic table. Each <td> is stamped with data-label so the mobile card layout
// (see styles.css "table → cards" media query) can show the column header.
export function BasicTable({ headers, rows }: { headers: string[]; rows: Row[] }) {
  if (!rows.length) return <div className="empty">Nothing here yet.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((c, i) => (
                <td key={i} data-label={headers[i] || ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Client-side paginated table. `rows` is the full array of already-mapped cell
// arrays. Resets to page 1 whenever the row identity changes (callers pass a
// fresh array on filter change, matching the original closure behaviour).
export function PaginatedTable({
  headers,
  rows,
  pageSize = PAGE_SIZE,
}: {
  headers: string[];
  rows: Row[];
  pageSize?: number;
}) {
  const [size, setSize] = useState(pageSize);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const clampedPage = Math.min(Math.max(1, page), pageCount);
  const start = (clampedPage - 1) * size;
  const end = Math.min(start + size, rows.length);

  return (
    <div>
      <BasicTable headers={headers} rows={rows.slice(start, end)} />
      <div className="pager">
        <span className="pager-info">
          {rows.length ? start + 1 : 0}–{end} of {rows.length}
        </span>
        <select
          className="pager-size"
          value={size}
          onChange={(e) => {
            setSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <button
          className="btn ghost sm"
          disabled={clampedPage <= 1}
          onClick={() => setPage(clampedPage - 1)}
        >
          ‹ Prev
        </button>
        <span className="pager-page">
          Page {clampedPage} / {pageCount}
        </span>
        <button
          className="btn ghost sm"
          disabled={clampedPage >= pageCount}
          onClick={() => setPage(clampedPage + 1)}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
