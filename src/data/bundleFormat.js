/**
 * Decoder for the compact observation bundles written by scripts/shield_data.py.
 *
 * A bundle stores rows as positional arrays. `columns` names each position,
 * columns listed in `lookups` hold an index into that column's value list, and
 * `constants` are fields identical on every record. `year`, `month`, `quarter`,
 * and `id` are derived here rather than shipped.
 */
export const BUNDLE_FORMAT = 'shield-observations/1';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `{ year, month, quarter }` for an ISO `YYYY-MM-DD` date string. */
export function dateFields(date) {
  const monthIndex = Number(date.slice(5, 7)) - 1;
  return {
    year: date.slice(0, 4),
    month: MONTHS[monthIndex] ?? '',
    quarter: `Q${Math.floor(monthIndex / 3) + 1}`,
  };
}

/**
 * Expand a compact bundle into full observation records.
 *
 * @param {object} bundle  parsed JSON bundle
 * @param {string} idPrefix  prefix for generated record ids, e.g. `GROW`
 * @returns {object[]} records
 */
export function hydrateBundle(bundle, idPrefix) {
  if (Array.isArray(bundle.observations)) {
    // Legacy expanded bundle; nothing to decode.
    return bundle.observations;
  }
  if (bundle.format !== BUNDLE_FORMAT) {
    throw new Error(
      `Unsupported bundle format "${bundle.format}" (expected ${BUNDLE_FORMAT})`
    );
  }

  const { columns, lookups = {}, constants = {}, rows } = bundle;
  const decoders = columns.map((column) => {
    const values = lookups[column];
    return values
      ? (value) => (value == null ? null : values[value])
      : (value) => (value === undefined ? null : value);
  });

  return rows.map((row, index) => {
    const record = { ...constants };
    for (let j = 0; j < columns.length; j += 1) {
      record[columns[j]] = decoders[j](row[j]);
    }
    Object.assign(record, dateFields(record.date));
    record.id = `${idPrefix}-${index}`;
    return record;
  });
}
