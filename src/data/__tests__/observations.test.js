import { describe, expect, it } from 'vitest';
import {
  assembleObservations,
  computeSummaryStats,
  filterData,
  finalDateRowsWithValue,
  getSiteComparisonData,
  getSiteGeographicSummaries,
  getTimeSeriesData,
  getTreatmentComparisonData,
  summarizeValues,
} from '../observations';
import { fixtureBundles } from './fixtures';

const dataset = assembleObservations(fixtureBundles());
const { records } = dataset;

const fieldRows = records.filter((r) => r.id.startsWith('FIELD-'));
const fieldRow = (site, treatment, date) =>
  fieldRows.find((r) => r.site === site && r.treatment === treatment && r.date === date);

describe('assembleObservations', () => {
  it('concatenates field, growth, and survival records with generated ids', () => {
    expect(records).toHaveLength(6 + 8 + 6);
    expect(records.filter((r) => r.id.startsWith('GROW-'))).toHaveLength(8);
    expect(records.filter((r) => r.id.startsWith('SURV-'))).toHaveLength(6);
  });

  it('drops field survival only where a per-bag row shares site, treatment, and date', () => {
    // Westcott Control has per-bag rows on both dates: field survival removed.
    expect(fieldRow('Westcott', 'Control', '2024-06-20').survival_percent).toBeNull();
    expect(fieldRow('Westcott', 'Control', '2024-08-20').survival_percent).toBeNull();
    expect(fieldRow('Westcott', 'Control', '2024-08-20').survival_source).toBe('none');

    // Sequim Bay Control has per-bag rows on 2025-10-06 only.
    expect(fieldRow('Sequim Bay', 'Control', '2025-10-06').survival_percent).toBeNull();
    expect(fieldRow('Sequim Bay', 'Control', '2025-05-28').survival_percent).toBe(95.1);

    // Sequim Bay Heat primed has no per-bag rows at all: fully retained.
    expect(fieldRow('Sequim Bay', 'Heat primed', '2025-05-28').survival_percent).toBe(99.2);
    expect(fieldRow('Sequim Bay', 'Heat primed', '2025-10-06').survival_percent).toBe(97.7);
  });

  it('keeps field temperature and nulls growth volume on field rows', () => {
    const row = fieldRow('Westcott', 'Control', '2024-08-20');
    expect(row.temperature_C).toBe(16);
    expect(row.growth_volume).toBeNull();
    expect(row.tag).toBeNull();
    expect(row.oyster_number).toBeNull();
  });

  it('derives vocabularies in display order', () => {
    expect(dataset.sites).toEqual(['Sequim Bay', 'Westcott']);
    expect(dataset.treatments).toEqual(['Control', 'Heat primed']);
    expect(dataset.years).toEqual(['2024', '2025']);
    expect(dataset.meta.growth.source).toBe('growth');
  });
});

describe('summarizeValues', () => {
  it('returns mean, standard error, and count', () => {
    const summary = summarizeValues([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(summary.mean).toBe(5);
    expect(summary.count).toBe(8);
    // sample sd = sqrt(32/7); se = sd / sqrt(8)
    expect(summary.error).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 10);
  });

  it('skips nulls and reports no error for a single value', () => {
    expect(summarizeValues([null, 3, undefined, NaN])).toEqual({ mean: 3, error: null, count: 1 });
    expect(summarizeValues([])).toEqual({ mean: null, error: null, count: 0 });
  });
});

describe('finalDateRowsWithValue', () => {
  it('keeps only rows on the latest date per site and treatment', () => {
    const rows = finalDateRowsWithValue(records, 'growth_volume');
    const keys = new Set(rows.map((r) => `${r.site}|${r.treatment}|${r.date}`));
    expect(keys).toEqual(
      new Set([
        'Westcott|Control|2024-08-20',
        'Westcott|Heat primed|2024-08-20',
        'Sequim Bay|Control|2025-10-06',
      ])
    );
    expect(rows.every((r) => r.growth_volume != null)).toBe(true);
  });
});

describe('filterData', () => {
  it('filters by site, treatment, and year, treating "All" as no filter', () => {
    const all = filterData(records, { site: 'All Sites', treatment: 'All Treatments', year: 'All Years' });
    expect(all).toHaveLength(records.length);

    const westcott2024 = filterData(records, { site: 'Westcott', treatment: 'All Treatments', year: '2024' });
    expect(westcott2024.every((r) => r.site === 'Westcott' && r.year === '2024')).toBe(true);
    expect(westcott2024).toHaveLength(2 + 6 + 4);

    const heat = filterData(records, { site: 'All Sites', treatment: 'Heat primed', year: 'All Years' });
    expect(heat.every((r) => r.treatment === 'Heat primed')).toBe(true);
  });
});

describe('computeSummaryStats', () => {
  it('uses the final assessment for growth and survival', () => {
    const stats = computeSummaryStats(records);
    // Final growth rows: Westcott Control 200,300; Westcott Heat 350,450; Sequim Control 900,1100.
    expect(stats.finalGrowth).toBe(Math.round((200 + 300 + 350 + 450 + 900 + 1100) / 6));
    // Final survival rows: Westcott Control per-bag 90,80 (2024-08-20);
    // Sequim Control per-bag 70,80 (2025-10-06); Sequim Heat field 97.7 (2025-10-06).
    expect(stats.finalSurvival).toBe(Math.round(((90 + 80 + 70 + 80 + 97.7) / 5) * 10) / 10);
    expect(stats.bestTreatment).toBe('Heat primed');
    // Westcott final per-bag mean 85 vs Sequim (70, 80, 97.7) mean 82.6
    expect(stats.highestSurvivalSite).toBe('Westcott');
    // Temperatures: 12,14,12,14,10,16
    expect(stats.meanTemp).toBe(13);
  });

  it('returns placeholders for an empty selection', () => {
    expect(computeSummaryStats([])).toEqual({
      finalGrowth: null,
      meanTemp: null,
      finalSurvival: null,
      bestTreatment: '—',
      highestSurvivalSite: '—',
    });
  });
});

describe('getTimeSeriesData', () => {
  it('produces one series per site with day-level labels in date order', () => {
    const { series, sites, unit, metricKey } = getTimeSeriesData(records, 'Growth Volume');
    expect(metricKey).toBe('growth_volume');
    expect(unit).toBe('predicted volume');
    expect(sites).toEqual(['Sequim Bay', 'Westcott']);
    expect(series.map((p) => p.date)).toEqual(['2024-06-20', '2024-08-20', '2025-10-06']);
    expect(series.map((p) => p.label)).toEqual(['Jun 20, 2024', 'Aug 20, 2024', 'Oct 6, 2025']);
  });

  it('does not pool sites sampled on different dates', () => {
    const { series } = getTimeSeriesData(records, 'Growth Volume');
    const aug = series.find((p) => p.date === '2024-08-20');
    // Westcott only: (200+300+350+450)/4 = 325
    expect(aug.Westcott).toBe(325);
    expect(aug.WestcottCount).toBe(4);
    expect(aug['Sequim Bay']).toBeUndefined();

    const oct = series.find((p) => p.date === '2025-10-06');
    expect(oct['Sequim Bay']).toBe(1000);
    expect(oct.Westcott).toBeUndefined();
  });

  it('reports survival with retained field rows and per-bag rows together', () => {
    const { series } = getTimeSeriesData(records, 'Survival');
    const oct = series.find((p) => p.date === '2025-10-06');
    // Sequim: per-bag Control 70, 80 plus field Heat primed 97.7
    expect(oct['Sequim Bay']).toBe(Math.round(((70 + 80 + 97.7) / 3) * 10) / 10);
    expect(oct['Sequim BayCount']).toBe(3);
  });
});

describe('getTreatmentComparisonData', () => {
  it('uses the final assessment for growth as well as survival', () => {
    const growth = getTreatmentComparisonData(records, 'growth');
    const westcott = growth.find((row) => row.site === 'Westcott');
    expect(westcott.Control).toBe(250); // 200, 300 only; June rows excluded
    expect(westcott.ControlCount).toBe(2);
    expect(westcott['Heat primed']).toBe(400);

    const survival = getTreatmentComparisonData(records, 'survival');
    const sequim = survival.find((row) => row.site === 'Sequim Bay');
    expect(sequim.Control).toBe(75);
    expect(sequim.ControlError).toBe(5);
    expect(sequim['Heat primed']).toBe(97.7);
    expect(sequim['Heat primedError']).toBeNull();
  });
});

describe('getSiteComparisonData', () => {
  it('returns a row for every requested site, with nulls when unmeasured', () => {
    const growth = getSiteComparisonData(records, 'growth', ['Sequim Bay', 'Westcott', 'Thorndyke Bay']);
    expect(growth).toEqual([
      { site: 'Sequim Bay', value: 1000, error: 100, count: 2 },
      { site: 'Westcott', value: 325, error: expect.any(Number), count: 4 },
      { site: 'Thorndyke Bay', value: null, error: null, count: 0 },
    ]);
  });

  it('pools temperature across the filtered period', () => {
    const temp = getSiteComparisonData(records, 'temperature', ['Westcott']);
    expect(temp[0]).toEqual({ site: 'Westcott', value: 13, error: 3, count: 2 });
  });
});

describe('getSiteGeographicSummaries', () => {
  it('summarizes each site with final growth and survival plus metadata', () => {
    const summaries = getSiteGeographicSummaries(records, dataset.sites);
    const westcott = summaries.find((s) => s.site === 'Westcott');
    expect(westcott.lat).toBeCloseTo(48.582);
    expect(westcott.finalGrowth).toBe(325);
    expect(westcott.finalSurvival).toBe(85);
    expect(westcott.meanTemp).toBe(13);
    expect(westcott.recordCount).toBe(2 + 6 + 4);
  });
});
