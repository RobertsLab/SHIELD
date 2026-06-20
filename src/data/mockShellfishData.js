/**
 * Real observation data for the Shellfish Farm Outplant Dashboard.
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

export const realDataMeta = realData.meta;

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
export const SITES = Object.keys(SITE_LOCATIONS).filter((s) =>
  realData.sites.includes(s)
);
export const TREATMENTS = realData.treatments;
export const YEARS = realData.years;
export const METRICS = ['Growth', 'Temperature', 'Survival'];

export const mockShellfishData = realData.observations;

const METRIC_KEYS = {
  Growth: 'growth_mm',
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

  const meanGrowth = meanOf(filtered, 'growth_mm');
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
    meanGrowth: round1(meanGrowth),
    meanTemp: round1(meanTemp),
    finalSurvival: round1(finalSurvival),
    bestTreatment: finalRows.length ? topKey(byTreatment) : '—',
    highestSurvivalSite: finalRows.length ? topKey(bySite) : '—',
  };
}

export function getTimeSeriesData(filtered, metric) {
  const metricKey = METRIC_KEYS[metric] ?? 'survival_percent';
  const unit = metric === 'Growth' ? 'mm' : metric === 'Temperature' ? '°C' : '%';

  const grouped = new Map();
  for (const row of filtered) {
    if (row[metricKey] == null) continue;
    const key = row.date;
    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        label: `${row.month} ${row.year.replace('Year ', 'Y')}`,
        values: [],
      });
    }
    grouped.get(key).values.push(row[metricKey]);
  }

  const series = [...grouped.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((g) => ({
      date: g.date,
      label: g.label,
      value: round1(g.values.reduce((s, v) => s + v, 0) / g.values.length),
    }));

  return { series, unit, metricKey };
}

export function getTreatmentComparisonData(filtered, metric = 'survival') {
  const isSurvival = metric === 'survival';
  const key = isSurvival ? 'survival_percent' : 'growth_mm';

  const rows = isSurvival
    ? latestWithValue(filtered, key)
    : aggregateMean(filtered, key);

  const bySite = {};
  for (const row of rows) {
    if (!bySite[row.site]) bySite[row.site] = { site: row.site };
    bySite[row.site][row.treatment] = round1(row[key]);
  }
  return Object.values(bySite);
}

/** Mean per site|treatment for `key`, returned as flat rows with that key set. */
function aggregateMean(filtered, key) {
  const grouped = {};
  for (const row of filtered) {
    if (row[key] == null) continue;
    const k = `${row.site}|${row.treatment}`;
    (grouped[k] ??= { site: row.site, treatment: row.treatment, sum: 0, count: 0 });
    grouped[k].sum += row[key];
    grouped[k].count += 1;
  }
  return Object.values(grouped).map((g) => ({
    site: g.site,
    treatment: g.treatment,
    [key]: g.sum / g.count,
  }));
}

export function getSiteComparisonData(filtered, metric = 'growth') {
  const configs = {
    growth: { key: 'growth_mm', useFinal: false },
    survival: { key: 'survival_percent', useFinal: true },
    temperature: { key: 'temperature_C', useFinal: false },
  };
  const { key, useFinal } = configs[metric];

  const rows = useFinal ? latestWithValue(filtered, key) : filtered;
  const bySite = {};
  for (const row of rows) {
    if (row[key] == null) continue;
    (bySite[row.site] ??= { sum: 0, count: 0 });
    bySite[row.site].sum += row[key];
    bySite[row.site].count += 1;
  }

  return SITES.map((site) => ({
    site,
    value: bySite[site] ? round1(bySite[site].sum / bySite[site].count) : null,
  }));
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
      meanGrowth: round1(meanOf(siteRows, 'growth_mm')),
      meanTemp: round1(meanOf(siteRows, 'temperature_C')),
      finalSurvival: round1(meanOf(siteFinal, 'survival_percent')),
      recordCount: siteRows.length,
    };
  });
}
