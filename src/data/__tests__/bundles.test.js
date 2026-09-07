/**
 * Validates the committed data bundles in public/data/ against the schema the
 * app expects. Catches regressions in the build scripts before they reach the
 * deployed site.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLE_FORMAT, hydrateBundle } from '../bundleFormat';
import { assembleObservations } from '../observations';
import { SITE_LOCATIONS, TREATMENT_ORDER } from '../siteMetadata';

const DATA_DIR = join(process.cwd(), 'public', 'data');
const load = (name) => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe.each([
  ['realObservations.json', 'FIELD'],
  ['growthObservations.json', 'GROW'],
  ['survivalObservations.json', 'SURV'],
])('%s', (name, prefix) => {
  const bundle = load(name);

  it('declares the compact format with consistent columns and rows', () => {
    expect(bundle.format).toBe(BUNDLE_FORMAT);
    expect(bundle.columns).toContain('date');
    expect(bundle.columns).toContain('site');
    expect(bundle.columns).toContain('treatment');
    for (const column of Object.keys(bundle.lookups)) {
      expect(bundle.columns).toContain(column);
    }
    expect(bundle.rows).toHaveLength(bundle.meta.recordCount);
    for (const row of bundle.rows) {
      expect(row).toHaveLength(bundle.columns.length);
    }
  });

  it('uses only known sites and treatments', () => {
    for (const site of bundle.sites) expect(SITE_LOCATIONS).toHaveProperty(site);
    for (const treatment of bundle.treatments) expect(TREATMENT_ORDER).toContain(treatment);
  });

  it('hydrates to records with valid dates and vocabularies', () => {
    const records = hydrateBundle(bundle, prefix);
    expect(records).toHaveLength(bundle.meta.recordCount);
    const sites = new Set();
    const treatments = new Set();
    const years = new Set();
    for (const record of records) {
      expect(record.date).toMatch(ISO_DATE);
      sites.add(record.site);
      treatments.add(record.treatment);
      years.add(record.year);
    }
    expect([...sites].sort()).toEqual([...bundle.sites].sort());
    expect([...treatments].sort()).toEqual([...bundle.treatments].sort());
    expect([...years].sort()).toEqual([...bundle.years].sort());
  });
});

describe('assembled dataset', () => {
  const dataset = assembleObservations({
    field: load('realObservations.json'),
    growth: load('growthObservations.json'),
    survival: load('survivalObservations.json'),
  });

  it('carries every metric on at least one record', () => {
    for (const key of ['growth_volume', 'temperature_C', 'survival_percent']) {
      expect(dataset.records.some((r) => r[key] != null)).toBe(true);
    }
  });

  it('never counts field survival where per-bag survival exists on the same key', () => {
    const perBag = new Set(
      dataset.records
        .filter((r) => r.id.startsWith('SURV-'))
        .map((r) => `${r.site}|${r.treatment}|${r.date}`)
    );
    const doubleCounted = dataset.records.filter(
      (r) =>
        r.id.startsWith('FIELD-') &&
        r.survival_percent != null &&
        perBag.has(`${r.site}|${r.treatment}|${r.date}`)
    );
    expect(doubleCounted).toEqual([]);
  });
});

describe('archivalTemperatureData.json', () => {
  const bundle = load('archivalTemperatureData.json');

  it('has a date-sorted series covering the declared sites', () => {
    const dates = bundle.series.map((row) => row.date);
    expect([...dates].sort()).toEqual(dates);
    for (const site of bundle.sites) {
      expect(SITE_LOCATIONS).toHaveProperty(site);
      expect(bundle.series.some((row) => row[site] != null)).toBe(true);
    }
    expect(bundle.meta.map((m) => m.site).sort()).toEqual([...bundle.sites].sort());
  });
});

describe('liveTemperature.json', () => {
  const bundle = load('liveTemperature.json');

  it('has one observation per declared site', () => {
    expect(bundle.observations.map((o) => o.site)).toEqual(bundle.sites);
    for (const observation of bundle.observations) {
      expect(observation).toHaveProperty('metrics');
    }
  });
});
