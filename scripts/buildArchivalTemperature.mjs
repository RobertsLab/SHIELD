/**
 * Build archival water-temperature data for the dashboard.
 *
 * Source CSVs are high-frequency (≈15 min) HOBO logger records in the form
 * `logger,DateTime,temp.C`. This script downloads each site's CSV, aggregates
 * to a daily mean / min / max per site, and writes a compact JSON bundle that
 * the app imports directly (no raw 850k-row payload shipped to the browser).
 *
 * Run with:  node scripts/buildArchivalTemperature.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Display name -> source CSV. Names match SITE_LOCATIONS in mockShellfishData.js. */
const SOURCES = {
  Baywater:
    'https://raw.githubusercontent.com/RobertsLab/10K-seed-Cgigas/main/output/baywater_temperature_20250822.csv',
  'Sequim Bay':
    'https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/environmental/sequim-temperature-data.csv',
  'Goose Point':
    'https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/environmental/goose-point-temperature-data.csv',
  Westcott:
    'https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/environmental/westcott-temperature-data.csv',
};

const round1 = (n) => Math.round(n * 10) / 10;

async function fetchDailyMeans(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n');

  // day (YYYY-MM-DD) -> { sum, count, min, max }
  const byDay = new Map();
  let logger = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const firstComma = line.indexOf(',');
    const secondComma = line.indexOf(',', firstComma + 1);
    if (firstComma < 0 || secondComma < 0) continue;

    if (logger === null) logger = line.slice(0, firstComma);
    const dateTime = line.slice(firstComma + 1, secondComma);
    const temp = Number(line.slice(secondComma + 1));
    if (!Number.isFinite(temp)) continue;

    const day = dateTime.slice(0, 10); // YYYY-MM-DD (UTC)
    let agg = byDay.get(day);
    if (!agg) {
      agg = { sum: 0, count: 0, min: Infinity, max: -Infinity };
      byDay.set(day, agg);
    }
    agg.sum += temp;
    agg.count += 1;
    if (temp < agg.min) agg.min = temp;
    if (temp > agg.max) agg.max = temp;
  }

  const days = [...byDay.entries()]
    .map(([date, a]) => ({
      date,
      mean: round1(a.sum / a.count),
      min: round1(a.min),
      max: round1(a.max),
      n: a.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { logger, days };
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
function labelFor(date) {
  const [y, m, d] = date.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

async function main() {
  const siteNames = Object.keys(SOURCES);
  const perSite = {};
  const meta = [];

  for (const site of siteNames) {
    process.stderr.write(`Fetching ${site}…\n`);
    const { logger, days } = await fetchDailyMeans(SOURCES[site]);
    perSite[site] = days;
    meta.push({
      site,
      logger,
      start: days[0]?.date ?? null,
      end: days.at(-1)?.date ?? null,
      days: days.length,
      observations: days.reduce((s, d) => s + d.n, 0),
      source: SOURCES[site],
    });
  }

  // Merge into one row per date with one column per site (chart-ready shape).
  const allDates = new Set();
  for (const site of siteNames) {
    for (const d of perSite[site]) allDates.add(d.date);
  }

  const byDateSite = {};
  for (const site of siteNames) {
    for (const d of perSite[site]) {
      (byDateSite[d.date] ||= {})[site] = d.mean;
    }
  }

  const series = [...allDates]
    .sort()
    .map((date) => ({ date, label: labelFor(date), ...byDateSite[date] }));

  const bundle = {
    generatedAt: new Date().toISOString().slice(0, 10),
    description:
      'Daily mean water temperature (°C) from HOBO loggers at four Pacific Northwest shellfish sites. Aggregated from ~15-min source records.',
    sites: siteNames,
    meta,
    series,
  };

  const outPath = join(__dirname, '..', 'src', 'data', 'archivalTemperatureData.json');
  writeFileSync(outPath, JSON.stringify(bundle));
  process.stderr.write(
    `Wrote ${series.length} daily rows for ${siteNames.length} sites to ${outPath}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
