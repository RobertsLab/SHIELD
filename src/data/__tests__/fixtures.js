/**
 * Small hand-built dataset for the aggregation tests. Values are chosen so
 * expected means and standard errors can be checked by hand.
 *
 * Two sites, two treatments, several dates. Field rows carry temperature and,
 * for Sequim Bay, aggregated survival. Per-bag survival exists for Westcott on
 * both dates and for Sequim Bay Control on the second date only.
 */
import { BUNDLE_FORMAT } from '../bundleFormat';

/** Encode expanded records into the compact bundle format (mirrors shield_data.py). */
export function encodeBundle(records, columns, lookupColumns, constants, meta = {}) {
  const lookups = Object.fromEntries(lookupColumns.map((c) => [c, []]));
  const rows = records.map((record) =>
    columns.map((column) => {
      let value = record[column] ?? null;
      if (lookups[column] && value != null) {
        let index = lookups[column].indexOf(value);
        if (index < 0) {
          lookups[column].push(value);
          index = lookups[column].length - 1;
        }
        value = index;
      }
      return value;
    })
  );
  const treatmentOrder = [
    'Control',
    'Heat primed',
    'Freshwater primed',
    'Immune primed',
    'Combined stress primed',
    'Treated',
  ];
  const present = new Set(records.map((r) => r.treatment));
  return {
    format: BUNDLE_FORMAT,
    meta: { ...meta, recordCount: records.length },
    sites: [...new Set(records.map((r) => r.site))].sort(),
    treatments: treatmentOrder.filter((t) => present.has(t)),
    years: [...new Set(records.map((r) => r.date.slice(0, 4)))].sort(),
    columns,
    lookups,
    constants,
    rows,
  };
}

export const FIELD_RECORDS = [
  // Sequim Bay: aggregated survival on two dates, both treatments
  { date: '2025-05-28', site: 'Sequim Bay', treatment: 'Control', effort: 'Effort A', growth_mm: 74.5, temperature_C: 12.0, survival_percent: 95.1, survival_source: 'measured', growth_source: 'measured' },
  { date: '2025-10-06', site: 'Sequim Bay', treatment: 'Control', effort: 'Effort A', growth_mm: 117.0, temperature_C: 14.0, survival_percent: 94.2, survival_source: 'measured', growth_source: 'measured' },
  { date: '2025-05-28', site: 'Sequim Bay', treatment: 'Heat primed', effort: 'Effort A', growth_mm: 72.8, temperature_C: 12.0, survival_percent: 99.2, survival_source: 'measured', growth_source: 'measured' },
  { date: '2025-10-06', site: 'Sequim Bay', treatment: 'Heat primed', effort: 'Effort A', growth_mm: 98.0, temperature_C: 14.0, survival_percent: 97.7, survival_source: 'measured', growth_source: 'measured' },
  // Westcott: field rows carry temperature only (survival replaced per-bag)
  { date: '2024-06-20', site: 'Westcott', treatment: 'Control', effort: 'Effort B', growth_mm: null, temperature_C: 10.0, survival_percent: 100.0, survival_source: 'measured', growth_source: 'none' },
  { date: '2024-08-20', site: 'Westcott', treatment: 'Control', effort: 'Effort B', growth_mm: null, temperature_C: 16.0, survival_percent: 99.0, survival_source: 'measured', growth_source: 'none' },
];

export const FIELD_COLUMNS = ['date', 'site', 'treatment', 'effort', 'growth_mm', 'temperature_C', 'survival_percent', 'survival_source', 'growth_source'];
export const FIELD_LOOKUPS = ['site', 'treatment', 'effort', 'survival_source', 'growth_source'];
export const FIELD_CONSTANTS = { temperature_source: 'logger-monthly-mean' };

export const GROWTH_RECORDS = [
  // Westcott Control: two dates, two oysters each. Final date mean = 250.
  { date: '2024-06-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '1', oyster_number: null, growth_volume: 100, growth_metric: 'vol', source_repo: 'r', source_url: 'u1' },
  { date: '2024-06-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '1', oyster_number: null, growth_volume: 120, growth_metric: 'vol', source_repo: 'r', source_url: 'u1' },
  { date: '2024-08-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '1', oyster_number: null, growth_volume: 200, growth_metric: 'vol', source_repo: 'r', source_url: 'u1' },
  { date: '2024-08-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '1', oyster_number: null, growth_volume: 300, growth_metric: 'vol', source_repo: 'r', source_url: 'u1' },
  // Westcott Heat primed: one date, mean 400.
  { date: '2024-08-20', site: 'Westcott', treatment: 'Heat primed', raw_treatment: 'Treated', effort: 'Daily Temperature', tag: '2', oyster_number: null, growth_volume: 350, growth_metric: 'vol', source_repo: 'r', source_url: 'u1' },
  { date: '2024-08-20', site: 'Westcott', treatment: 'Heat primed', raw_treatment: 'Treated', effort: 'Daily Temperature', tag: '2', oyster_number: null, growth_volume: 450, growth_metric: 'vol', source_repo: 'r', source_url: 'u1' },
  // Sequim Bay Control on a date no other site was sampled: mean 1000.
  { date: '2025-10-06', site: 'Sequim Bay', treatment: 'Control', raw_treatment: 'Control', effort: 'Temperature', tag: '9', oyster_number: '1', growth_volume: 900, growth_metric: 'Predicted_Volume_Poly', source_repo: 'r', source_url: 'u2' },
  { date: '2025-10-06', site: 'Sequim Bay', treatment: 'Control', raw_treatment: 'Control', effort: 'Temperature', tag: '9', oyster_number: '2', growth_volume: 1100, growth_metric: 'Predicted_Volume_Poly', source_repo: 'r', source_url: 'u2' },
];

export const GROWTH_COLUMNS = ['date', 'site', 'treatment', 'raw_treatment', 'effort', 'tag', 'oyster_number', 'growth_volume', 'growth_metric', 'source_repo', 'source_url'];
export const GROWTH_LOOKUPS = ['site', 'treatment', 'raw_treatment', 'effort', 'growth_metric', 'source_repo', 'source_url'];
export const GROWTH_CONSTANTS = { growth_mm: null, temperature_C: null, survival_percent: null, survival_source: 'none', growth_source: 'measured-volume', temperature_source: 'none' };

export const SURVIVAL_RECORDS = [
  // Westcott Control per-bag survival on both field dates: replaces field rows.
  { date: '2024-06-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '1', survival_percent: 100, survival_metric: 'survival', source_repo: 'r', source_url: 'u3' },
  { date: '2024-06-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '2', survival_percent: 100, survival_metric: 'survival', source_repo: 'r', source_url: 'u3' },
  { date: '2024-08-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '1', survival_percent: 90, survival_metric: 'survival', source_repo: 'r', source_url: 'u3' },
  { date: '2024-08-20', site: 'Westcott', treatment: 'Control', raw_treatment: 'Control', effort: 'Daily Temperature', tag: '2', survival_percent: 80, survival_metric: 'survival', source_repo: 'r', source_url: 'u3' },
  // Sequim Bay Control per-bag on the second date only: replaces one field row.
  { date: '2025-10-06', site: 'Sequim Bay', treatment: 'Control', raw_treatment: 'Control', effort: 'PolyIC', tag: 'A', survival_percent: 70, survival_metric: 'survival', source_repo: 'r', source_url: 'u4' },
  { date: '2025-10-06', site: 'Sequim Bay', treatment: 'Control', raw_treatment: 'Control', effort: 'PolyIC', tag: 'B', survival_percent: 80, survival_metric: 'survival', source_repo: 'r', source_url: 'u4' },
];

export const SURVIVAL_COLUMNS = ['date', 'site', 'treatment', 'raw_treatment', 'effort', 'tag', 'survival_percent', 'survival_metric', 'source_repo', 'source_url'];
export const SURVIVAL_LOOKUPS = ['site', 'treatment', 'raw_treatment', 'effort', 'survival_metric', 'source_repo', 'source_url'];
export const SURVIVAL_CONSTANTS = { oyster_number: null, growth_mm: null, growth_volume: null, growth_metric: null, temperature_C: null, survival_source: 'measured', growth_source: 'none', temperature_source: 'none' };

export function fixtureBundles() {
  return {
    field: encodeBundle(FIELD_RECORDS, FIELD_COLUMNS, FIELD_LOOKUPS, FIELD_CONSTANTS, { source: 'field' }),
    growth: encodeBundle(GROWTH_RECORDS, GROWTH_COLUMNS, GROWTH_LOOKUPS, GROWTH_CONSTANTS, { source: 'growth' }),
    survival: encodeBundle(SURVIVAL_RECORDS, SURVIVAL_COLUMNS, SURVIVAL_LOOKUPS, SURVIVAL_CONSTANTS, { source: 'survival' }),
  };
}
