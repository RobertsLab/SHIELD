/**
 * Real observation data for SHIELD.
 *
 * Records are produced by `scripts/build_real_observations.py` from the
 * RobertsLab `project-gigas-conditioning` repo (+ Baywater 10K-Seed survival
 * anchors) and committed as `realObservations.json`. Each record is one
 * site × treatment × assessment-date measurement; a metric is present only where
 * it was actually measured, otherwise `null` (aggregations below are null-safe).
 *
 * The module keeps its historical name/exports so consuming components are
 * unchanged. See docs/DATA_FORMAT.md for the schema and provenance.
 */
import realData from './realObservations.json';
import growthData from './growthObservations.json';
import survivalData from './survivalObservations.json';

export const realDataMeta = {
  ...realData.meta,
  growth: growthData.meta,
  survival: survivalData.meta,
};

/** Geographic metadata for the real C. gigas outplant sites. */
export const SITE_LOCATIONS = {
  Baywater: {
    lat: 47.808,
    lng: -122.738,
    region: 'Thorndyke Bay, Hood Canal, WA',
    description:
      'Baywater Shellfish. 10K-Seed + PolyIC outplants; protected inlet with warmer water and highly variable survival.',
    color: '#2563eb',
  },
  'Sequim Bay': {
    lat: 48.07,
    lng: -123.03,
    region: 'Sequim Bay, WA',
    description:
      'Effort A thermal-hardening + PolyIC outplants. Moderate temperatures with low background mortality.',
    color: '#0891b2',
  },
  'Goose Point': {
    lat: 46.62,
    lng: -123.86,
    region: 'Palix River, Willapa Bay, WA',
    description:
      'Goose Point Oysters (Palix River). Multi-year Effort E hardening outplants; estuary site with variable temperature.',
    color: '#d97706',
  },
  Westcott: {
    lat: 48.582,
    lng: -123.167,
    region: 'Westcott Bay, San Juan Island, WA',
    description:
      'Westcott Shellfish. Effort B (daily) & D (weekly) thermal-hardening outplants; cooler San Juan Island water.',
    color: '#6366f1',
  },
};

export const MAP_CENTER = { lat: 47.6, lng: -123.1 };
export const MAP_ZOOM = 7;

/** Controlled vocabularies — derived from the real dataset. */
export const SITES = Object.keys(SITE_LOCATIONS).filter(
  (s) =>
    realData.sites.includes(s) ||
    growthData.sites.includes(s) ||
    survivalData.sites.includes(s)
);

const TREATMENT_ORDER = [
  'Control',
  'Heat primed',
  'Freshwater primed',
  'Immune primed',
  'Combined stress primed',
  'Treated',
];
const treatmentsPresent = new Set([
  ...realData.treatments,
  ...growthData.treatments,
  ...survivalData.treatments,
]);
export const TREATMENTS = TREATMENT_ORDER.filter((t) => treatmentsPresent.has(t));

export const YEARS = [
  ...new Set([...realData.years, ...growthData.years, ...survivalData.years]),
].sort();
export const METRICS = ['Growth Volume', 'Temperature', 'Survival'];

export const mockShellfishData = [
  // realObservations still supplies in-situ temperature (and legacy growth_mm).
  // Survival now comes from survivalObservations.json (per-bag published CSVs),
  // so the aggregated survival anchors here are dropped to avoid double-counting.
  ...realData.observations.map((row) => ({
    ...row,
    tag: row.tag ?? null,
    oyster_number: row.oyster_number ?? null,
    growth_volume: null,
    survival_percent: null,
    survival_source: 'none',
  })),
  ...growthData.observations,
  ...survivalData.observations,
];

const METRIC_KEYS = {
  Growth: 'growth_volume',
  'Growth Volume': 'growth_volume',
  Temperature: 'temperature_C',
  Survival: 'survival_percent',
};

/** Mean of a numeric field, skipping null/undefined. Returns null if none. */
function meanOf(rows, key) {
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const v = r[key];
    if (v != null && !Number.isNaN(v)) {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? null : sum / n;
}

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

function summarizeValues(values) {
  const cleanValues = values.filter((v) => v != null && !Number.isNaN(v));
  const count = cleanValues.length;
  if (count === 0) return { mean: null, error: null, count: 0 };

  const mean = cleanValues.reduce((sum, value) => sum + value, 0) / count;
  if (count < 2) return { mean, error: null, count };

  const variance =
    cleanValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (count - 1);
  const standardError = Math.sqrt(variance) / Math.sqrt(count);

  return { mean, error: standardError, count };
}

function formatMean(value, key) {
  if (value == null) return null;
  return key === 'growth_volume' ? Math.round(value) : round1(value);
}

/** Latest row per site|treatment that has a non-null value for `key`. */
function latestWithValue(rows, key) {
  const latest = new Map();
  for (const row of rows) {
    if (row[key] == null) continue;
    const mapKey = `${row.site}|${row.treatment}`;
    const existing = latest.get(mapKey);
    if (!existing || row.date > existing.date) latest.set(mapKey, row);
  }
  return [...latest.values()];
}

export function filterData(data, filters) {
  const { site, treatment, year } = filters;
  return data.filter((row) => {
    if (site !== 'All Sites' && row.site !== site) return false;
    if (treatment !== 'All Treatments' && row.treatment !== treatment) return false;
    if (year !== 'All Years' && row.year !== year) return false;
    return true;
  });
}

export function computeSummaryStats(filtered) {
  if (filtered.length === 0) {
    return {
      meanGrowth: null,
      meanTemp: null,
      finalSurvival: null,
      bestTreatment: '—',
      highestSurvivalSite: '—',
    };
  }

  const meanGrowth = meanOf(filtered, 'growth_volume');
  const meanTemp = meanOf(filtered, 'temperature_C');

  const finalRows = latestWithValue(filtered, 'survival_percent');
  const finalSurvival = meanOf(finalRows, 'survival_percent');

  const byTreatment = {};
  const bySite = {};
  for (const row of finalRows) {
    (byTreatment[row.treatment] ??= []).push(row.survival_percent);
    (bySite[row.site] ??= []).push(row.survival_percent);
  }
  const topKey = (obj) =>
    Object.entries(obj)
      .map(([k, vals]) => [k, vals.reduce((s, v) => s + v, 0) / vals.length])
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return {
    meanGrowth: formatMean(meanGrowth, 'growth_volume'),
    meanTemp: round1(meanTemp),
    finalSurvival: round1(finalSurvival),
    bestTreatment: finalRows.length ? topKey(byTreatment) : '—',
    highestSurvivalSite: finalRows.length ? topKey(bySite) : '—',
  };
}

export function getTimeSeriesData(filtered, metric) {
  const metricKey = METRIC_KEYS[metric] ?? 'survival_percent';
  const unit =
    metric === 'Growth' || metric === 'Growth Volume'
      ? 'predicted volume'
      : metric === 'Temperature'
        ? '°C'
        : '%';

  const grouped = new Map();
  for (const row of filtered) {
    if (row[metricKey] == null) continue;
    const key = row.date;
    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        label: `${row.month} ${row.year}`,
        values: [],
      });
    }
    grouped.get(key).values.push(row[metricKey]);
  }

  const series = [...grouped.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((g) => {
      const summary = summarizeValues(g.values);
      return {
        date: g.date,
        label: g.label,
        value: formatMean(summary.mean, metricKey),
        error: formatMean(summary.error, metricKey),
        count: summary.count,
      };
    });

  return { series, unit, metricKey };
}

export function getTreatmentComparisonData(filtered, metric = 'survival') {
  const isSurvival = metric === 'survival';
  const key = isSurvival ? 'survival_percent' : 'growth_volume';

  const rows = isSurvival
    ? latestWithValue(filtered, key)
    : aggregateMean(filtered, key);

  const bySite = {};
  for (const row of rows) {
    if (!bySite[row.site]) bySite[row.site] = { site: row.site };
    const values = row.values ?? [row[key]];
    const summary = summarizeValues(values);
    bySite[row.site][row.treatment] = formatMean(summary.mean, key);
    bySite[row.site][`${row.treatment}Error`] = formatMean(summary.error, key);
    bySite[row.site][`${row.treatment}Count`] = summary.count;
  }
  return Object.values(bySite);
}

/** Mean per site|treatment for `key`, returned as flat rows with that key set. */
function aggregateMean(filtered, key) {
  const grouped = {};
  for (const row of filtered) {
    if (row[key] == null) continue;
    const k = `${row.site}|${row.treatment}`;
    (grouped[k] ??= {
      site: row.site,
      treatment: row.treatment,
      sum: 0,
      count: 0,
      values: [],
    });
    grouped[k].sum += row[key];
    grouped[k].count += 1;
    grouped[k].values.push(row[key]);
  }
  return Object.values(grouped).map((g) => ({
    site: g.site,
    treatment: g.treatment,
    [key]: g.sum / g.count,
    values: g.values,
  }));
}

export function getSiteComparisonData(filtered, metric = 'growth') {
  const configs = {
    growth: { key: 'growth_volume', useFinal: false },
    survival: { key: 'survival_percent', useFinal: true },
    temperature: { key: 'temperature_C', useFinal: false },
  };
  const { key, useFinal } = configs[metric];

  const rows = useFinal ? latestWithValue(filtered, key) : filtered;
  const bySite = {};
  for (const row of rows) {
    if (row[key] == null) continue;
    (bySite[row.site] ??= { values: [] });
    bySite[row.site].values.push(row[key]);
  }

  return SITES.map((site) => {
    const summary = bySite[site]
      ? summarizeValues(bySite[site].values)
      : { mean: null, error: null, count: 0 };

    return {
      site,
      value: formatMean(summary.mean, key),
      error: formatMean(summary.error, key),
      count: summary.count,
    };
  });
}

export function getSiteGeographicSummaries(data) {
  const finalRows = latestWithValue(data, 'survival_percent');

  return SITES.map((site) => {
    const siteRows = data.filter((r) => r.site === site);
    const siteFinal = finalRows.filter((r) => r.site === site);
    const location = SITE_LOCATIONS[site];

    return {
      site,
      ...location,
      meanGrowth: formatMean(meanOf(siteRows, 'growth_volume'), 'growth_volume'),
      meanTemp: round1(meanOf(siteRows, 'temperature_C')),
      finalSurvival: round1(meanOf(siteFinal, 'survival_percent')),
      recordCount: siteRows.length,
    };
  });
}
