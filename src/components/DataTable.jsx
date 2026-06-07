import { useState, useMemo } from 'react';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'year', label: 'Year' },
  { key: 'month', label: 'Month' },
  { key: 'site', label: 'Site' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'growth_mm', label: 'Growth (mm)' },
  { key: 'temperature_C', label: 'Temperature (°C)' },
  { key: 'survival_percent', label: 'Survival (%)' },
];

export default function DataTable({ data }) {
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return data;
    return data.filter((row) =>
      COLUMNS.some((col) =>
        String(row[col.key]).toLowerCase().includes(q)
      )
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize
  );

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <section className="data-table-section card">
      <div className="table-header-row">
        <h2 className="section-title">Data Records</h2>
        <div className="table-controls">
          <input
            type="search"
            className="table-search"
            placeholder="Filter records…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            aria-label="Filter table records"
          />
          <span className="record-count">
            {filtered.length.toLocaleString()} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <p className="chart-caption">
        Underlying mock monitoring records. Click column headers to sort.
      </p>

      {sorted.length === 0 ? (
        <p className="empty-state">No records match the current filters.</p>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key}>
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        {sortIndicator(col.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((row) => (
                  <tr key={row.id}>
                    {COLUMNS.map((col) => (
                      <td key={col.key}>{row[col.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
