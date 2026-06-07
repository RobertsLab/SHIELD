import { SITES, TREATMENTS, METRICS, YEARS } from '../data/mockShellfishData';

export default function Filters({ filters, onChange }) {
  const handleChange = (field) => (e) => {
    onChange({ ...filters, [field]: e.target.value });
  };

  return (
    <section className="filters card" aria-label="Dashboard filters">
      <h2 className="section-title">Filters</h2>
      <div className="filters-grid">
        <label className="filter-group">
          <span className="filter-label">Site</span>
          <select value={filters.site} onChange={handleChange('site')}>
            <option value="All Sites">All Sites</option>
            {SITES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-label">Treatment</span>
          <select value={filters.treatment} onChange={handleChange('treatment')}>
            <option value="All Treatments">All Treatments</option>
            {TREATMENTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-label">Metric</span>
          <select value={filters.metric} onChange={handleChange('metric')}>
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-label">Year</span>
          <select value={filters.year} onChange={handleChange('year')}>
            <option value="All Years">All Years</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
