import { describe, expect, it } from 'vitest';
import { BUNDLE_FORMAT, dateFields, hydrateBundle } from '../bundleFormat';
import {
  GROWTH_COLUMNS,
  GROWTH_CONSTANTS,
  GROWTH_LOOKUPS,
  GROWTH_RECORDS,
  encodeBundle,
} from './fixtures';

describe('dateFields', () => {
  it('derives year, month, and quarter from an ISO date', () => {
    expect(dateFields('2024-08-20')).toEqual({ year: '2024', month: 'Aug', quarter: 'Q3' });
    expect(dateFields('2025-01-05')).toEqual({ year: '2025', month: 'Jan', quarter: 'Q1' });
    expect(dateFields('2025-12-31')).toEqual({ year: '2025', month: 'Dec', quarter: 'Q4' });
  });
});

describe('hydrateBundle', () => {
  const bundle = encodeBundle(GROWTH_RECORDS, GROWTH_COLUMNS, GROWTH_LOOKUPS, GROWTH_CONSTANTS);

  it('round-trips every stored column and re-attaches constants', () => {
    const records = hydrateBundle(bundle, 'GROW');
    expect(records).toHaveLength(GROWTH_RECORDS.length);
    records.forEach((record, i) => {
      for (const column of GROWTH_COLUMNS) {
        expect(record[column]).toEqual(GROWTH_RECORDS[i][column] ?? null);
      }
      for (const [key, value] of Object.entries(GROWTH_CONSTANTS)) {
        expect(record[key]).toEqual(value);
      }
    });
  });

  it('derives id, year, month, and quarter', () => {
    const [first] = hydrateBundle(bundle, 'GROW');
    expect(first.id).toBe('GROW-0');
    expect(first.year).toBe('2024');
    expect(first.month).toBe('Jun');
    expect(first.quarter).toBe('Q2');
  });

  it('decodes null lookup values as null', () => {
    const withNull = encodeBundle(
      [{ date: '2024-01-01', site: 'Westcott', treatment: 'Control', effort: null }],
      ['date', 'site', 'treatment', 'effort'],
      ['site', 'treatment', 'effort'],
      {}
    );
    expect(hydrateBundle(withNull, 'X')[0].effort).toBeNull();
  });

  it('accepts a legacy expanded bundle unchanged', () => {
    const legacy = { observations: [{ id: 'a', date: '2024-01-01' }] };
    expect(hydrateBundle(legacy, 'X')).toBe(legacy.observations);
  });

  it('rejects unknown formats', () => {
    expect(() => hydrateBundle({ format: 'other/9', columns: [], rows: [] }, 'X')).toThrow(
      BUNDLE_FORMAT
    );
  });
});
