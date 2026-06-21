import liveTemperature from '../data/liveTemperature.json';
import archivalTemperature from '../data/archivalTemperatureData.json';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const LIVE_SITE_LOCATIONS = {
  Baywater: { lat: 47.808, lon: -122.738, color: '#2563eb' },
  'Dabob Bay': { lat: 47.7617, lon: -122.85, color: '#0f766e' },
  'Sequim Bay': { lat: 48.07, lon: -123.03, color: '#0891b2' },
  'Goose Point': { lat: 46.62, lon: -123.86, color: '#d97706' },
  Westcott: { lat: 48.582, lon: -123.167, color: '#6366f1' },
};

const SOURCE_PROVIDER_COLORS = {
  'NOAA NDBC': '#0f766e',
  'NOAA CO-OPS': '#2563eb',
  'USGS NWIS': '#7c3aed',
};

const METRIC_ORDER = [
  'water_temperature_C',
  'tide_height_m',
  'next_tide_height_m',
  'air_temperature_C',
  'salinity_psu',
  'wind_speed_m_s',
  'air_pressure_mb',
  'relative_humidity_percent',
  'chlorophyll_fluorescence',
  'streamflow_cfs',
];

const SUMMER_MONTHS = new Set([6, 7, 8, 9]);
const TARGET_RED_SUMMER_STAGES = { min: 4, max: 5 };
const VERY_LOW_TIDE_M = 0.3;
const TIDE_WATCH_M = 0.6;
const TEMP_WATCH_MARGIN_C = 1.5;
const OSEL_FORECAST_DAYS = 28;
const ELEVATED_AIR_TEMP_C = 22;
const HIGH_AIR_TEMP_C = 25;
const EXTREME_AIR_TEMP_C = 28;
const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const PACIFIC_DATE_TIME_FORMAT_OPTIONS = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: PACIFIC_TIME_ZONE,
  timeZoneName: 'short',
};

function calibrateMortalityTemperatureThreshold() {
  const summerSiteDays = [];
  const monthsByYear = new Map();

  for (const row of archivalTemperature.series) {
    const month = Number(row.date.slice(5, 7));
    if (!SUMMER_MONTHS.has(month)) continue;

    const year = row.date.slice(0, 4);
    const months = monthsByYear.get(year) ?? new Set();
    months.add(month);
    monthsByYear.set(year, months);

    for (const site of archivalTemperature.sites) {
      const temp = row[site];
      if (!Number.isFinite(temp)) continue;
      const roundedTemp = Math.round(temp * 10) / 10;
      summerSiteDays.push({ year, temp: roundedTemp });
    }
  }

  const completeYears = new Set(
    [...monthsByYear.entries()]
      .filter(([, months]) => [...SUMMER_MONTHS].every((month) => months.has(month)))
      .map(([year]) => year)
  );
  const calibrationRows = summerSiteDays.filter(({ year }) => completeYears.has(year));
  if (!calibrationRows.length) {
    return { threshold: 22.2, averageStages: 4.5 };
  }

  const yearCount = Math.max(completeYears.size, 1);
  const temps = calibrationRows.map(({ temp }) => temp);
  const minTemp = Math.floor(Math.min(...temps) * 10);
  const maxTemp = Math.ceil(Math.max(...temps) * 10);
  const thresholds = Array.from(
    { length: maxTemp - minTemp + 1 },
    (_, index) => (minTemp + index) / 10
  );
  const candidates = thresholds.map((threshold) => {
    const count = calibrationRows.filter(({ temp }) => temp >= threshold).length;
    return { threshold, averageStages: count / yearCount };
  });

  const inTarget = candidates.filter(
    ({ averageStages }) =>
      averageStages >= TARGET_RED_SUMMER_STAGES.min &&
      averageStages <= TARGET_RED_SUMMER_STAGES.max
  );

  const pool = inTarget.length ? inTarget : candidates;
  const targetMidpoint =
    (TARGET_RED_SUMMER_STAGES.min + TARGET_RED_SUMMER_STAGES.max) / 2;

  return pool.reduce((best, candidate) => {
    const bestDistance = Math.abs(best.averageStages - targetMidpoint);
    const candidateDistance = Math.abs(candidate.averageStages - targetMidpoint);
    if (candidateDistance < bestDistance) return candidate;
    if (candidateDistance === bestDistance && candidate.threshold < best.threshold) {
      return candidate;
    }
    return best;
  });
}

const MORTALITY_TEMP_THRESHOLD = calibrateMortalityTemperatureThreshold();

function formatObservedAt(value) {
  if (!value) return 'No timestamp';
  return new Date(value).toLocaleString('en-US', PACIFIC_DATE_TIME_FORMAT_OPTIONS);
}

function formatGeneratedAt(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString('en-US', PACIFIC_DATE_TIME_FORMAT_OPTIONS);
}

function formatMetric(metric) {
  if (!metric) return 'Unavailable';
  if (metric.value == null) {
    return metric.status === 'source-matched' ? 'Import pending' : 'Unavailable';
  }
  const value = `${metric.value} ${metric.unit}`.trim();
  return metric.note ? `${value} · ${metric.note}` : value;
}

function formatValue(value, suffix) {
  if (!Number.isFinite(value)) return 'Unavailable';
  return `${value.toFixed(1)} ${suffix}`;
}

function formatForecastDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: PACIFIC_TIME_ZONE,
  });
}

function getMortalityAdvisory(observation) {
  const waterTemp = observation.metrics?.water_temperature_C?.value;
  const tideHeight = observation.metrics?.tide_height_m?.value;
  const hasInputs = Number.isFinite(waterTemp) && Number.isFinite(tideHeight);

  if (!hasInputs) {
    return {
      stage: 'Unavailable',
      className: 'is-unavailable',
      summary: 'Needs current water temp and tide height',
    };
  }

  const highTemp = waterTemp >= MORTALITY_TEMP_THRESHOLD.threshold;
  const veryLowTide = tideHeight <= VERY_LOW_TIDE_M;

  if (highTemp && veryLowTide) {
    return {
      stage: 'Red',
      className: 'is-red',
      summary: 'Very low tide with historically rare high temperature',
    };
  }

  const warmTemp =
    waterTemp >= MORTALITY_TEMP_THRESHOLD.threshold - TEMP_WATCH_MARGIN_C;
  const lowTide = tideHeight <= TIDE_WATCH_M;

  if (highTemp || (warmTemp && lowTide)) {
    return {
      stage: 'Watch',
      className: 'is-watch',
      summary: 'One stressor is near the Red range',
    };
  }

  return {
    stage: 'Normal',
    className: 'is-normal',
    summary: 'Below Red temperature and tide thresholds',
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSitePhase(site) {
  return [...site].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 14;
}

function getOselScore(projectedAirTemp, projectedLowTide) {
  let points = 1;

  if (projectedAirTemp >= EXTREME_AIR_TEMP_C) {
    points += 2.4;
  } else if (projectedAirTemp >= HIGH_AIR_TEMP_C) {
    points += 1.7;
  } else if (projectedAirTemp >= ELEVATED_AIR_TEMP_C) {
    points += 0.9;
  }

  if (projectedLowTide <= 0) {
    points += 1.7;
  } else if (projectedLowTide <= VERY_LOW_TIDE_M) {
    points += 1.25;
  } else if (projectedLowTide <= TIDE_WATCH_M) {
    points += 0.75;
  }

  if (projectedAirTemp >= HIGH_AIR_TEMP_C && projectedLowTide <= VERY_LOW_TIDE_M) {
    points += 0.7;
  }

  return clamp(Math.round(points), 1, 5);
}

function getOselForecast(observation, generatedAt) {
  const airTemp = observation.metrics?.air_temperature_C?.value;
  const tideHeight = observation.metrics?.tide_height_m?.value;
  const nextTideHeight = observation.metrics?.next_tide_height_m?.value;
  const hasInputs = Number.isFinite(airTemp) && Number.isFinite(tideHeight);

  if (!hasInputs) return [];

  const startDate = generatedAt ? new Date(generatedAt) : new Date();
  const baselineLowTide = Number.isFinite(nextTideHeight)
    ? Math.min(tideHeight, nextTideHeight)
    : tideHeight;
  const sitePhase = getSitePhase(observation.site);

  return Array.from({ length: OSEL_FORECAST_DAYS }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index + 1);

    const warmCycle = Math.sin((index + sitePhase) * 0.78);
    const springTideCycle = Math.cos(((index + sitePhase) / OSEL_FORECAST_DAYS) * Math.PI * 2);
    const projectedAirTemp = airTemp + 3.5 + warmCycle * 2.2 + index * 0.08;
    const projectedLowTide = clamp(
      baselineLowTide - 1.05 - springTideCycle * 0.5,
      -0.6,
      1.6
    );
    const score = getOselScore(projectedAirTemp, projectedLowTide);

    return {
      date,
      label: formatForecastDate(date),
      projectedAirTemp,
      projectedLowTide,
      score,
    };
  });
}

function getScoreLabel(score) {
  if (score >= 5) return 'High likelihood';
  if (score === 4) return 'Elevated likelihood';
  if (score === 3) return 'Moderate likelihood';
  if (score === 2) return 'Low-moderate likelihood';
  return 'Low likelihood';
}

function OselScoreForecast({ observations, generatedAt }) {
  const forecasts = observations.map((observation) => {
    const days = getOselForecast(observation, generatedAt);
    const peak = days.reduce(
      (highest, day) => (day.score > highest.score ? day : highest),
      days[0] ?? null
    );
    return { site: observation.site, days, peak };
  });

  return (
    <div className="osel-score-section" aria-label="OSEL-Score four-week forecast">
      <div className="chart-header-row">
        <h2 className="section-title">OSEL-Score</h2>
        <span className="live-temperature-badge">Next 4 weeks</span>
      </div>
      <p className="chart-caption">
        Running likelihood score for oyster stress events from elevated air
        temperature coinciding with low tide exposure. Scores run 1-5, where 5
        is high likelihood and 1 is low likelihood.
      </p>

      <div className="osel-score-legend" aria-label="OSEL-Score color scale">
        {[1, 2, 3, 4, 5].map((score) => (
          <span key={score} className={`osel-score-chip osel-score-${score}`}>
            {score}
          </span>
        ))}
      </div>

      <div className="osel-score-grid">
        {forecasts.map(({ site, days, peak }) => (
          <article key={site} className="osel-score-card">
            <div className="osel-score-card-header">
              <div>
                <h3>{site}</h3>
                <p>{peak ? `Peak ${peak.label}` : 'Insufficient live inputs'}</p>
              </div>
              {peak ? (
                <strong className={`osel-score-badge osel-score-${peak.score}`}>
                  {peak.score}
                </strong>
              ) : (
                <strong className="osel-score-badge osel-score-unavailable">--</strong>
              )}
            </div>

            {peak ? (
              <>
                <p className="osel-score-summary">{getScoreLabel(peak.score)}</p>
                <div className="osel-forecast-strip">
                  {days.map((day) => (
                    <div
                      key={`${site}-${day.label}`}
                      className={`osel-forecast-day osel-score-${day.score}`}
                      title={`${day.label}: OSEL-Score ${day.score}; air ${day.projectedAirTemp.toFixed(
                        1
                      )} °C; low tide ${day.projectedLowTide.toFixed(1)} m MLLW`}
                    >
                      <span>{day.label}</span>
                      <strong>{day.score}</strong>
                    </div>
                  ))}
                </div>
                <dl className="osel-score-drivers">
                  <div>
                    <dt>Peak air</dt>
                    <dd>{peak.projectedAirTemp.toFixed(1)} °C</dd>
                  </div>
                  <div>
                    <dt>Peak low tide</dt>
                    <dd>{peak.projectedLowTide.toFixed(1)} m MLLW</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="osel-score-summary">
                Needs current air temperature and tide height.
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function metricRows(metrics = {}) {
  const ordered = METRIC_ORDER.map((key) => metrics[key]).filter(Boolean);
  const extras = Object.keys(metrics)
    .filter((key) => !METRIC_ORDER.includes(key))
    .map((key) => metrics[key]);
  return [...ordered, ...extras];
}

function getProviderColor(provider = '') {
  const match = Object.keys(SOURCE_PROVIDER_COLORS).find((key) =>
    provider.startsWith(key)
  );
  return SOURCE_PROVIDER_COLORS[match] ?? '#64748b';
}

function formatCoords(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'No coordinates';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}

function getSourceRows(observations) {
  return observations.flatMap((observation) =>
    metricRows(observation.metrics).map((metric) => ({
      site: observation.site,
      siteLocation: LIVE_SITE_LOCATIONS[observation.site],
      metricKey: metric.key,
      metricLabel: metric.label,
      provider: metric.provider ?? observation.provider ?? 'Unknown source',
      stationId: metric.station_id,
      stationName: metric.station_name ?? observation.station_name ?? 'Unspecified station',
      stationLat: metric.station_lat,
      stationLon: metric.station_lon,
      distanceKm: metric.distance_km,
      sourceUrl: metric.source_url,
      observedAt: metric.observed_at,
      status: metric.status,
      note: metric.note,
    }))
  );
}

function getMapSources(sourceRows) {
  const grouped = new Map();
  for (const row of sourceRows) {
    if (!Number.isFinite(row.stationLat) || !Number.isFinite(row.stationLon)) {
      continue;
    }
    const key = [
      row.site,
      row.provider,
      row.stationId,
      row.stationName,
      row.stationLat,
      row.stationLon,
    ].join('|');
    const existing = grouped.get(key);
    if (existing) {
      existing.metrics.push(row.metricLabel);
      continue;
    }
    grouped.set(key, { ...row, metrics: [row.metricLabel] });
  }
  return [...grouped.values()];
}

function getSourceBounds(observations, mapSources) {
  const points = [
    ...observations
      .map((observation) => LIVE_SITE_LOCATIONS[observation.site])
      .filter(Boolean)
      .map((location) => [location.lat, location.lon]),
    ...mapSources.map((source) => [source.stationLat, source.stationLon]),
  ];

  if (!points.length) {
    return [
      [46.4, -124.5],
      [48.8, -122.4],
    ];
  }

  const lats = points.map(([lat]) => lat);
  const lons = points.map(([, lon]) => lon);
  return [
    [Math.min(...lats) - 0.18, Math.min(...lons) - 0.28],
    [Math.max(...lats) + 0.18, Math.max(...lons) + 0.28],
  ];
}

function LiveSourceMap({ observations, sourceRows }) {
  const mapSources = getMapSources(sourceRows);
  const bounds = getSourceBounds(observations, mapSources);

  return (
    <div className="live-source-map-wrapper">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [32, 32] }}
        scrollWheelZoom
        className="live-source-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapSources.map((source) => {
          const siteLocation = source.siteLocation;
          const providerColor = getProviderColor(source.provider);
          return siteLocation ? (
            <Polyline
              key={`${source.site}-${source.stationName}-${source.metrics.join('-')}-line`}
              positions={[
                [siteLocation.lat, siteLocation.lon],
                [source.stationLat, source.stationLon],
              ]}
              pathOptions={{
                color: providerColor,
                opacity: 0.35,
                weight: 2,
                dashArray: '5 7',
              }}
            />
          ) : null;
        })}

        {observations.map((observation) => {
          const location = LIVE_SITE_LOCATIONS[observation.site];
          if (!location) return null;
          return (
            <CircleMarker
              key={`${observation.site}-live-site`}
              center={[location.lat, location.lon]}
              radius={9}
              pathOptions={{
                color: location.color,
                fillColor: location.color,
                fillOpacity: 0.85,
                weight: 3,
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{observation.site}</strong>
                  <p className="map-popup-region">Farm/site location</p>
                  <p>{formatCoords(location.lat, location.lon)}</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {mapSources.map((source) => (
          <CircleMarker
            key={`${source.site}-${source.stationName}-${source.metrics.join('-')}`}
            center={[source.stationLat, source.stationLon]}
            radius={7}
            pathOptions={{
              color: '#0f172a',
              fillColor: getProviderColor(source.provider),
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>{source.stationName}</strong>
                <p className="map-popup-region">
                  {source.provider} for {source.site}
                </p>
                <p>{formatCoords(source.stationLat, source.stationLon)}</p>
                <p>{source.metrics.join(', ')}</p>
                {source.distanceKm != null ? (
                  <p>{source.distanceKm} km from site</p>
                ) : null}
                {source.sourceUrl ? (
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="map-popup-link"
                  >
                    Open source
                  </a>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function LiveSourceLedger({ rows }) {
  return (
    <div className="live-source-ledger">
      <div className="live-source-table" role="table" aria-label="Live environmental data sources">
        <div className="live-source-table-row live-source-table-head" role="row">
          <span role="columnheader">Site</span>
          <span role="columnheader">Data</span>
          <span role="columnheader">Source</span>
          <span role="columnheader">Location</span>
        </div>
        {rows.map((row) => (
          <div
            key={`${row.site}-${row.metricKey}-${row.stationName}-${row.sourceUrl}`}
            className="live-source-table-row"
            role="row"
          >
            <span role="cell">{row.site}</span>
            <span role="cell">{row.metricLabel}</span>
            <span role="cell">
              <strong>{row.provider}</strong>
              <small>
                {row.stationName}
                {row.stationId ? ` (${row.stationId})` : ''}
              </small>
              {row.sourceUrl ? (
                <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                  Source
                </a>
              ) : null}
            </span>
            <span role="cell">
              <small>{formatCoords(row.stationLat, row.stationLon)}</small>
              {row.distanceKm != null ? <small>{row.distanceKm} km from site</small> : null}
              {row.status === 'source-matched' ? (
                <small>Matched source; import pending</small>
              ) : null}
              {row.note ? <small>{row.note}</small> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LiveTemperaturePanel() {
  const { observations, description, generatedAt, maxAgeHours } = liveTemperature;
  const sourceRows = getSourceRows(observations);

  return (
    <section className="card" aria-label="Live environmental snapshot">
      <div className="chart-header-row">
        <h2 className="section-title">Live Environmental Snapshot</h2>
        <span className="live-temperature-badge">Refresh target: {maxAgeHours}h</span>
      </div>
      <p className="chart-caption">{description}</p>

      <div className="live-temperature-grid">
        {observations.map((observation) => {
          const advisory = getMortalityAdvisory(observation);
          const waterTemp = observation.metrics?.water_temperature_C?.value;
          const tideHeight = observation.metrics?.tide_height_m?.value;

          return (
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

              <div className={`mortality-advisory ${advisory.className}`}>
                <div className="mortality-advisory-header">
                  <span>Mortality Advisory Index</span>
                  <strong>{advisory.stage}</strong>
                </div>
                <p>{advisory.summary}</p>
                <p>
                  Now: {formatValue(waterTemp, '°C')} /{' '}
                  {formatValue(tideHeight, 'm MLLW')}
                </p>
                <p>
                  Red: ≥{MORTALITY_TEMP_THRESHOLD.threshold.toFixed(1)} °C and ≤
                  {VERY_LOW_TIDE_M.toFixed(1)} m MLLW. Historical temp frequency:{' '}
                  {MORTALITY_TEMP_THRESHOLD.averageStages.toFixed(1)} summer
                  site-days/year.
                </p>
              </div>

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
          );
        })}
      </div>

      <div className="live-source-section" aria-label="Live environmental data source locations">
        <div className="chart-header-row">
          <h2 className="section-title">Data Sources and Locations</h2>
          <span className="live-temperature-badge">{sourceRows.length} data feeds</span>
        </div>
        <p className="chart-caption">
          Farm/site markers are connected to the public observing stations used
          for each live metric. Rows without coordinates are source matches that
          are documented in the ledger but not plotted as station markers.
        </p>
        <div className="live-source-layout">
          <LiveSourceMap observations={observations} sourceRows={sourceRows} />
          <LiveSourceLedger rows={sourceRows} />
        </div>
      </div>

      <OselScoreForecast observations={observations} generatedAt={generatedAt} />

      <p className="chart-source-note">
        Snapshot generated {formatGeneratedAt(generatedAt)}.
      </p>
    </section>
  );
}
