import liveTemperature from '../data/liveTemperature.json';

const METRIC_ORDER = [
  'water_temperature_C',
  'air_temperature_C',
  'salinity_psu',
  'wind_speed_m_s',
  'air_pressure_mb',
  'relative_humidity_percent',
  'chlorophyll_fluorescence',
];

function formatObservedAt(value) {
  if (!value) return 'No timestamp';
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

function formatGeneratedAt(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

function formatMetric(metric) {
  if (!metric) return 'Unavailable';
  if (metric.value == null) {
    return metric.status === 'source-matched' ? 'Import pending' : 'Unavailable';
  }
  return `${metric.value} ${metric.unit}`.trim();
}

function metricRows(metrics = {}) {
  const ordered = METRIC_ORDER.map((key) => metrics[key]).filter(Boolean);
  const extras = Object.keys(metrics)
    .filter((key) => !METRIC_ORDER.includes(key))
    .map((key) => metrics[key]);
  return [...ordered, ...extras];
}

export default function LiveTemperaturePanel() {
  const { observations, description, generatedAt, maxAgeHours } = liveTemperature;

  return (
    <section className="card" aria-label="Live environmental snapshot">
      <div className="chart-header-row">
        <h2 className="section-title">Live Environmental Snapshot</h2>
        <span className="live-temperature-badge">Refresh target: {maxAgeHours}h</span>
      </div>
      <p className="chart-caption">{description}</p>

      <div className="live-temperature-grid">
        {observations.map((observation) => (
          <article key={observation.site} className="live-temperature-card">
            <div className="live-temperature-card-header">
              <h3>{observation.site}</h3>
              <strong>
                {observation.temperature_C != null
                  ? `${observation.temperature_C} °C`
                  : 'Unavailable'}
              </strong>
            </div>
            <p className="live-temperature-meta">
              Observed {formatObservedAt(observation.observed_at)}
            </p>
            {observation.station_name ? (
              <p className="live-temperature-meta">
                {observation.provider} via {observation.station_name}
                {observation.distance_km != null
                  ? ` (${observation.distance_km} km away)`
                  : ''}
              </p>
            ) : (
              <p className="live-temperature-meta">
                {observation.note ?? 'No fresh reading available'}
              </p>
            )}

            <dl className="live-environment-metrics">
              {metricRows(observation.metrics).map((metric) => (
                <div key={metric.key} className="live-environment-metric">
                  <dt>{metric.label}</dt>
                  <dd>{formatMetric(metric)}</dd>
                </div>
              ))}
            </dl>

            {observation.metrics?.chlorophyll_fluorescence?.note ? (
              <p className="live-temperature-meta">
                {observation.metrics.chlorophyll_fluorescence.note}
              </p>
            ) : null}

            {observation.source_url ? (
              <a href={observation.source_url} target="_blank" rel="noreferrer">
                View NOAA source
              </a>
            ) : null}
            {observation.metrics?.chlorophyll_fluorescence?.source_url ? (
              <a
                href={observation.metrics.chlorophyll_fluorescence.source_url}
                target="_blank"
                rel="noreferrer"
              >
                View chlorophyll source
              </a>
            ) : null}
          </article>
        ))}
      </div>

      <p className="chart-source-note">
        Snapshot generated {formatGeneratedAt(generatedAt)} UTC.
      </p>
    </section>
  );
}
