import { useState, type ReactNode } from 'react';
import { PaginatedTable, type Row } from './Table';

interface SelectOption {
  value: string;
  label: string;
}

interface BaseControl<T> {
  id: string;
  // `test` is only called when the control has a non-empty value.
  test: (item: T, value: string) => boolean;
}

interface SelectControl<T> extends BaseControl<T> {
  type: 'select';
  options: SelectOption[];
}

interface SearchControl<T> extends BaseControl<T> {
  type: 'search';
  placeholder?: string;
}

export type Control<T> = SelectControl<T> | SearchControl<T>;

interface Props<T> {
  data: T[];
  noun: string; // singular label for the count ("car" → "3 of 12 cars")
  controls: Control<T>[];
  columns: string[];
  row: (item: T) => Row;
  headBtn?: ReactNode;
}

// Render a list page with a filter/search toolbar above a live-updating table.
// Re-filters and rebuilds on every control change (no server round-trip).
export function FilterableList<T>({ data, noun, controls, columns, row, headBtn }: Props<T>) {
  const [values, setValues] = useState<Record<string, string>>({});

  const setVal = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));
  const clear = () => setValues({});

  const rows = data.filter((item) =>
    controls.every((c) => {
      const raw = values[c.id] || '';
      const v = c.type === 'search' ? raw.trim().toLowerCase() : raw;
      return !v || c.test(item, v);
    }),
  );

  // Key the table on the active filter so it resets to page 1 (and default page
  // size) whenever the filter changes — matching the original behaviour.
  const filterKey = JSON.stringify(values);

  return (
    <div>
      <div className="toolbar">
        {controls.map((c) =>
          c.type === 'select' ? (
            <select key={c.id} value={values[c.id] || ''} onChange={(e) => setVal(c.id, e.target.value)}>
              {c.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={c.id}
              type="search"
              placeholder={c.placeholder || 'Search…'}
              value={values[c.id] || ''}
              onChange={(e) => setVal(c.id, e.target.value)}
            />
          ),
        )}
        <button className="btn ghost sm" onClick={clear}>
          Clear
        </button>
      </div>
      <div className="card list-card">
        <div className="card-head">
          <h2>
            {rows.length} of {data.length} {noun}
            {data.length === 1 ? '' : 's'}
          </h2>
          {headBtn}
        </div>
        <PaginatedTable key={filterKey} headers={columns} rows={rows.map(row)} />
      </div>
    </div>
  );
}
