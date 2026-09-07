/**
 * Observation dataset assembly and aggregation for SHIELD.
 *
 * Records come from three compact bundles in public/data/, produced by the
 * scripts in scripts/ and decoded by bundleFormat.js:
 *
 *   realObservations.json      field rows: one site x treatment x assessment
 *                              date, carrying in-situ logger temperature and,
 *                              where no per-bag data exists, aggregated survival
 *   growthObservations.json    one row per individual oyster volume estimate
 *   survivalObservations.json  one row per bag/replicate percent survival
 *
 * Each record carries only the metrics it measured; everything else is null and
 * every aggregation here is null-safe. This module is pure so it can be unit
 * tested without a browser; fetching lives in resources.js.
 */
import { hydrateBundle } from './bundleFormat';
import { SITE_LOCATIONS, TREATMENT_ORDER } from './siteMetadata';

const METRIC_KEYS = {
  Growth: 'growth_volume',
  'Growth Volume': 'growth_volume',
  Temperature: 'temperature_C',
  Survival: 'survival_percent',
};

const survivalKey = (row) => `${row.site}|${row.treatment}|${row.date}`;

/**
 * Merge the three bundles into one record array plus the controlled
 * vocabularies present in the data.
 */
export function assembleObservations({ field, growth, survival }) {
  const fieldRows = hydrateBundle(field, 'FIELD');
  const growthRows = hydrateBundle(growth, 'GROW');
  const survivalRows = hydrateBundle(survival, 'SURV');

  // Site x treatment x date combinations with per-bag survival rows. Field
  // survival is dropped only for these exact keys so aggregated and per-bag
  // values are never both counted, while field survival with no per-bag
  // counterpart is kept.
  const replicateSurvivalKeys = new Set(survivalRows.map(survivalKey));

  const records = [
    ...fieldRows.map((row) => {
      const replaced = replicateSurvivalKeys.has(survivalKey(row));
      return {
        ...row,
        tag: row.tag ?? null,
        oyster_number: row.oyster_number ?? null,
        growth_volume: null,
        survival_percent: replaced ? null : row.survival_percent,
        survival_source: replaced ? 'none' : row.survival_source,
      };
    }),
    ...growthRows,
    ...survivalRows,
  ];

  const bundles = [field, growth, survival];
  const sites = Object.keys(SITE_LOCATIONS).filter((site) =>
    bundles.some((bundle) => bundle.sites.includes(site))
  );
  const treatmentsPresent = new Set(bundles.flatMap((bundle) => bundle.treatments));
  const treatments = TREATMENT_ORDER.filter((t) => treatmentsPresent.has(t));
  const years = [...new Set(bundles.flatMap((bundle) => bundle.years))].sort();

  return {
    records,
    sites,
    treatments,
    years,
    meta: { field: field.meta, growth: growth.meta, survival: survival.meta },
  };
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

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

/** Mean, standard error, and count of the non-null values. */
export function summarizeValues(values) {
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

/**
 * All rows on the latest date per site|treatment with a non-null `key`.
 * This is the "final assessment" rule used for survival and growth alike.
 */
export function finalDateRowsWithValue(rows, key) {
  const latestDates = new Map();
  for (const row of rows) {
    if (row[key] == null) continue;
    const mapKey = `${row.site}|${row.treatment}`;
    const existingDate = latestDates.get(mapKey);
    if (!existingDate || row.date > existingDate) latestDates.set(mapKey, row.date);
  }
  return rows.filter(
    (row) =>
      row[key] != null &&
      row.date === latestDates.get(`${row.site}|${row.treatment}`)
  );
}

function orderedSites(siteSet) {
  const known = Object.keys(SITE_LOCATIONS).filter((site) => siteSet.has(site));
  const unknown = [...siteSet].filter((site) => !(site in SITE_LOCATIONS)).sort();
  return [...known, ...unknown];
}

// ---------------------------------------------------------------------------
// Filtering and aggregation
// ---------------------------------------------------------------------------

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
      finalGrowth: null,
      meanTemp: null,
      finalSurvival: null,
      bestTreatment: '—',
      highestSurvivalSite: '—',
    };
  }

  const finalGrowthRows = finalDateRowsWithValue(filtered, 'growth_volume');
  const finalGrowth = meanOf(finalGrowthRows, 'growth_volume');
  const meanTemp = meanOf(filtered, 'temperature_C');

  const finalRows = finalDateRowsWithValue(filtered, 'survival_percent');
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
    finalGrowth: formatMean(finalGrowth, 'growth_volume'),
    meanTemp: round1(meanTemp),
    finalSurvival: round1(finalSurvival),
    bestTreatment: finalRows.length ? topKey(byTreatment) : '—',
    highestSurvivalSite: finalRows.length ? topKey(bySite) : '—',
  };
}

/**
 * Per-site time series for `metric`. Each point holds `<site>`,
 * `<site>Error`, and `<site>Count` for every site measured on that date, so
 * a line per site can be drawn and no line mixes sites sampled on different
 * dates.
 */
export function getTimeSeriesData(filtered, metric) {
  const metricKey = METRIC_KEYS[metric] ?? 'survival_percent';
  const unit =
    metricKey === 'growth_volume'
      ? 'predicted volume'
      : metricKey === 'temperature_C'
        ? '°C'
        : '%';

  const grouped = new Map();
  const sitesSeen = new Set();
  for (const row of filtered) {
    if (row[metricKey] == null) continue;
    let group = grouped.get(row.date);
    if (!group) {
      group = {
        date: row.date,
        // Day-level label: several assessments can fall in one month.
        label: `${row.month} ${Number(row.date.slice(8, 10))}, ${row.year}`,
        bySite: new Map(),
      };
      grouped.set(row.date, group);
    }
    let values = group.bySite.get(row.site);
    if (!values) {
      values = [];
      group.bySite.set(row.site, values);
    }
    values.push(row[metricKey]);
    sitesSeen.add(row.site);
  }

  const series = [...grouped.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((group) => {
      const point = { date: group.date, label: group.label };
      for (const [site, values] of group.bySite) {
        const summary = summarizeValues(values);
        point[site] = formatMean(summary.mean, metricKey);
        point[`${site}Error`] = formatMean(summary.error, metricKey);
        point[`${site}Count`] = summary.count;
      }
      return point;
    });

  return { series, sites: orderedSites(sitesSeen), unit, metricKey };
}

/**
 * Mean per site and treatment at the final assessment, shaped for a grouped
 * bar chart: one row per site with `<treatment>`, `<treatment>Error`, and
 * `<treatment>Count` keys.
 */
export function getTreatmentComparisonData(filtered, metric = 'survival') {
  const key = metric === 'survival' ? 'survival_percent' : 'growth_volume';
  const finalRows = finalDateRowsWithValue(filtered, key);

  const grouped = new Map();
  for (const row of finalRows) {
    const groupKey = `${row.site}|${row.treatment}`;
    let group = grouped.get(groupKey);
    if (!group) {
      group = { site: row.site, treatment: row.treatment, values: [] };
      grouped.set(groupKey, group);
    }
    group.values.push(row[key]);
  }

  const bySite = {};
  for (const { site, treatment, values } of grouped.values()) {
    bySite[site] ??= { site };
    const summary = summarizeValues(values);
    bySite[site][treatment] = formatMean(summary.mean, key);
    bySite[site][`${treatment}Error`] = formatMean(summary.error, key);
    bySite[site][`${treatment}Count`] = summary.count;
  }
  return Object.values(bySite);
}

const SITE_COMPARISON_CONFIG = {
  growth: { key: 'growth_volume', useFinal: true },
  survival: { key: 'survival_percent', useFinal: true },
  temperature: { key: 'temperature_C', useFinal: false },
};

/** One row per site in `sites` with mean, error, and count for `metric`. */
export function getSiteComparisonData(filtered, metric = 'growth', sites) {
  const { key, useFinal } = SITE_COMPARISON_CONFIG[metric];

  const rows = useFinal ? finalDateRowsWithValue(filtered, key) : filtered;
  const bySite = {};
  for (const row of rows) {
    if (row[key] == null) continue;
    (bySite[row.site] ??= []).push(row[key]);
  }

  return sites.map((site) => {
    const summary = bySite[site]
      ? summarizeValues(bySite[site])
      : { mean: null, error: null, count: 0 };

    return {
      site,
      value: formatMean(summary.mean, key),
      error: formatMean(summary.error, key),
      count: summary.count,
    };
  });
}

/** Site metadata plus final growth, mean temperature, final survival, count. */
export function getSiteGeographicSummaries(data, sites) {
  const finalSurvivalRows = finalDateRowsWithValue(data, 'survival_percent');
  const finalGrowthRows = finalDateRowsWithValue(data, 'growth_volume');

  return sites.map((site) => {
    const siteRows = data.filter((r) => r.site === site);
    const location = SITE_LOCATIONS[site] ?? {};

    return {
      site,
      ...location,
      finalGrowth: formatMean(
        meanOf(finalGrowthRows.filter((r) => r.site === site), 'growth_volume'),
        'growth_volume'
      ),
      meanTemp: round1(meanOf(siteRows, 'temperature_C')),
      finalSurvival: round1(
        meanOf(finalSurvivalRows.filter((r) => r.site === site), 'survival_percent')
      ),
      recordCount: siteRows.length,
    };
  });
}
