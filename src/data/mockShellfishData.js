export const SITES = ['Baywater', 'Sequim Bay', 'Goose Point', 'Westcott'];

/** Mock geographic coordinates for demonstration (Pacific Northwest shellfish region) */
export const SITE_LOCATIONS = {
  Baywater: {
    lat: 47.768,
    lng: -122.834,
    region: 'Hood Canal, WA',
    description: 'Protected inlet site with warmer seasonal water and strong growth.',
    color: '#2563eb',
  },
  'Sequim Bay': {
    lat: 48.079,
    lng: -123.102,
    region: 'Strait of Juan de Fuca, WA',
    description: 'Moderate temperatures with relatively stable survival performance.',
    color: '#0891b2',
  },
  'Goose Point': {
    lat: 46.585,
    lng: -123.938,
    region: 'Willapa Bay, WA',
    description: 'Exposed estuary site with variable temperature and survival.',
    color: '#d97706',
  },
  Westcott: {
    lat: 48.321,
    lng: -124.482,
    region: 'Olympic Coast, WA',
    description: 'Cooler outer-coast site with moderate growth rates.',
    color: '#6366f1',
  },
};

export const MAP_CENTER = { lat: 47.85, lng: -123.35 };
export const MAP_ZOOM = 8;

export const TREATMENTS = [
  'Control',
  'Heat primed',
  'Freshwater primed',
  'Immune primed',
  'Combined stress primed',
];

export const METRICS = ['Growth', 'Temperature', 'Survival'];

export const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4'];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/** Site-specific environmental and performance profiles */
const SITE_PROFILES = {
  Baywater: {
    baseTemp: 13.5,
    tempAmplitude: 4.5,
    growthRate: 1.35,
    baseSurvival: 92,
    survivalDecline: 0.55,
    noise: 0.8,
  },
  'Sequim Bay': {
    baseTemp: 11.8,
    tempAmplitude: 3.2,
    growthRate: 1.1,
    baseSurvival: 94,
    survivalDecline: 0.42,
    noise: 0.5,
  },
  'Goose Point': {
    baseTemp: 12.2,
    tempAmplitude: 5.8,
    growthRate: 1.05,
    baseSurvival: 88,
    survivalDecline: 0.65,
    noise: 1.2,
  },
  Westcott: {
    baseTemp: 10.4,
    tempAmplitude: 2.8,
    growthRate: 0.95,
    baseSurvival: 90,
    survivalDecline: 0.48,
    noise: 0.6,
  },
};

/** Treatment modifiers applied on top of site baselines */
const TREATMENT_MODIFIERS = {
  Control: { growthMult: 1.0, survivalBonus: 0, tempEffect: 0 },
  'Heat primed': { growthMult: 1.05, survivalBonus: 4, tempEffect: 0.3 },
  'Freshwater primed': { growthMult: 1.02, survivalBonus: 2.5, tempEffect: 0 },
  'Immune primed': { growthMult: 0.94, survivalBonus: 6, tempEffect: 0 },
  'Combined stress primed': { growthMult: 0.9, survivalBonus: 8, tempEffect: 0.15 },
};

function seasonalTemp(base, amplitude, monthIndex) {
  const phase = (monthIndex / 12) * 2 * Math.PI - Math.PI / 2;
  return base + amplitude * Math.sin(phase);
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generateRecords() {
  const records = [];
  let id = 0;

  for (const site of SITES) {
    const profile = SITE_PROFILES[site];

    for (const treatment of TREATMENTS) {
      const mod = TREATMENT_MODIFIERS[treatment];
      let cumulativeGrowth = 8 + pseudoRandom(id * 3) * 4;

      for (let yearIdx = 0; yearIdx < 4; yearIdx++) {
        const year = YEARS[yearIdx];

        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const month = MONTHS[monthIdx];
          const quarter = QUARTERS[Math.floor(monthIdx / 3)];
          const globalMonth = yearIdx * 12 + monthIdx;

          const temp = seasonalTemp(
            profile.baseTemp + mod.tempEffect,
            profile.tempAmplitude,
            monthIdx
          ) + (pseudoRandom(id + globalMonth) - 0.5) * profile.noise;

          const growthIncrement =
            profile.growthRate *
            mod.growthMult *
            (0.85 + pseudoRandom(id + globalMonth * 2) * 0.3) *
            (1 + yearIdx * 0.04);

          cumulativeGrowth += growthIncrement;

          const survivalBase =
            profile.baseSurvival +
            mod.survivalBonus -
            profile.survivalDecline * globalMonth;

          const warmPenalty =
            treatment === 'Control' && temp > 15 ? (temp - 15) * 1.2 : 0;
          const heatBonus =
            treatment === 'Heat primed' && temp > 14 ? (temp - 14) * 0.4 : 0;

          const survival = Math.min(
            100,
            Math.max(
              35,
              survivalBase -
                warmPenalty +
                heatBonus +
                (pseudoRandom(id + globalMonth * 5) - 0.5) * profile.noise * 2
            )
          );

          const date = new Date(2022 + yearIdx, monthIdx, 15);

          records.push({
            id: id++,
            date: date.toISOString().split('T')[0],
            year,
            month,
            quarter,
            site,
            treatment,
            growth_mm: Math.round(cumulativeGrowth * 10) / 10,
            temperature_C: Math.round(temp * 10) / 10,
            survival_percent: Math.round(survival * 10) / 10,
          });
        }
      }
    }
  }

  return records;
}

export const mockShellfishData = generateRecords();

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

  const meanGrowth =
    filtered.reduce((s, r) => s + r.growth_mm, 0) / filtered.length;
  const meanTemp =
    filtered.reduce((s, r) => s + r.temperature_C, 0) / filtered.length;

  const lastByGroup = new Map();
  for (const row of filtered) {
    const key = `${row.site}|${row.treatment}`;
    const existing = lastByGroup.get(key);
    if (!existing || row.date > existing.date) {
      lastByGroup.set(key, row);
    }
  }
  const finalRows = [...lastByGroup.values()];
  const finalSurvival =
    finalRows.reduce((s, r) => s + r.survival_percent, 0) / finalRows.length;

  const treatmentSurvival = {};
  for (const row of finalRows) {
    if (!treatmentSurvival[row.treatment]) {
      treatmentSurvival[row.treatment] = { sum: 0, count: 0 };
    }
    treatmentSurvival[row.treatment].sum += row.survival_percent;
    treatmentSurvival[row.treatment].count += 1;
  }
  const bestTreatment =
    Object.entries(treatmentSurvival).sort(
      ([, a], [, b]) => b.sum / b.count - a.sum / a.count
    )[0]?.[0] ?? '—';

  const siteSurvival = {};
  for (const row of finalRows) {
    if (!siteSurvival[row.site]) {
      siteSurvival[row.site] = { sum: 0, count: 0 };
    }
    siteSurvival[row.site].sum += row.survival_percent;
    siteSurvival[row.site].count += 1;
  }
  const highestSurvivalSite =
    Object.entries(siteSurvival).sort(
      ([, a], [, b]) => b.sum / b.count - a.sum / a.count
    )[0]?.[0] ?? '—';

  return {
    meanGrowth: Math.round(meanGrowth * 10) / 10,
    meanTemp: Math.round(meanTemp * 10) / 10,
    finalSurvival: Math.round(finalSurvival * 10) / 10,
    bestTreatment,
    highestSurvivalSite,
  };
}

export function getTimeSeriesData(filtered, metric) {
  const metricKey =
    metric === 'Growth'
      ? 'growth_mm'
      : metric === 'Temperature'
        ? 'temperature_C'
        : 'survival_percent';

  const unit =
    metric === 'Growth' ? 'mm' : metric === 'Temperature' ? '°C' : '%';

  const grouped = new Map();
  for (const row of filtered) {
    const key = row.date;
    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        label: `${row.month} ${row.year.replace('Year ', 'Y')}`,
        year: row.year,
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
      value: Math.round(
        (g.values.reduce((s, v) => s + v, 0) / g.values.length) * 10
      ) / 10,
    }));

  return { series, unit, metricKey };
}

export function getTemperatureBySiteSeries(filtered) {
  const byDateSite = new Map();

  for (const row of filtered) {
    const key = `${row.date}|${row.site}`;
    if (!byDateSite.has(key)) {
      byDateSite.set(key, {
        date: row.date,
        label: `${row.month} ${row.year.replace('Year ', 'Y')}`,
        site: row.site,
        values: [],
      });
    }
    byDateSite.get(key).values.push(row.temperature_C);
  }

  const activeSites = [
    ...new Set(filtered.map((r) => r.site)),
  ].sort((a, b) => SITES.indexOf(a) - SITES.indexOf(b));

  const byDate = new Map();
  for (const entry of byDateSite.values()) {
    if (!byDate.has(entry.date)) {
      byDate.set(entry.date, { date: entry.date, label: entry.label });
    }
    const mean =
      Math.round(
        (entry.values.reduce((s, v) => s + v, 0) / entry.values.length) * 10
      ) / 10;
    byDate.get(entry.date)[entry.site] = mean;
  }

  const series = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return { series, sites: activeSites };
}

export function getTreatmentComparisonData(filtered, metric = 'survival') {
  const isSurvival = metric === 'survival';
  const metricKey = isSurvival ? 'survival_percent' : 'growth_mm';

  if (isSurvival) {
    const lastBySiteTreatment = new Map();
    for (const row of filtered) {
      const key = `${row.site}|${row.treatment}`;
      const existing = lastBySiteTreatment.get(key);
      if (!existing || row.date > existing.date) {
        lastBySiteTreatment.set(key, row);
      }
    }

    const bySite = {};
    for (const row of lastBySiteTreatment.values()) {
      if (!bySite[row.site]) bySite[row.site] = { site: row.site };
      bySite[row.site][row.treatment] = row[metricKey];
    }
    return Object.values(bySite);
  }

  const grouped = {};
  for (const row of filtered) {
    const key = `${row.site}|${row.treatment}`;
    if (!grouped[key]) {
      grouped[key] = { site: row.site, treatment: row.treatment, sum: 0, count: 0 };
    }
    grouped[key].sum += row[metricKey];
    grouped[key].count += 1;
  }

  const bySite = {};
  for (const g of Object.values(grouped)) {
    if (!bySite[g.site]) bySite[g.site] = { site: g.site };
    bySite[g.site][g.treatment] =
      Math.round((g.sum / g.count) * 10) / 10;
  }
  return Object.values(bySite);
}

export function getSiteComparisonData(filtered, metric = 'growth') {
  const configs = {
    growth: { key: 'growth_mm', useFinal: false },
    survival: { key: 'survival_percent', useFinal: true },
    temperature: { key: 'temperature_C', useFinal: false },
  };
  const { key, useFinal } = configs[metric];

  if (useFinal) {
    const lastBySiteTreatment = new Map();
    for (const row of filtered) {
      const mapKey = `${row.site}|${row.treatment}`;
      const existing = lastBySiteTreatment.get(mapKey);
      if (!existing || row.date > existing.date) {
        lastBySiteTreatment.set(mapKey, row);
      }
    }

    const bySite = {};
    for (const row of lastBySiteTreatment.values()) {
      if (!bySite[row.site]) bySite[row.site] = { sum: 0, count: 0 };
      bySite[row.site].sum += row[key];
      bySite[row.site].count += 1;
    }

    return SITES.map((site) => ({
      site,
      value: bySite[site]
        ? Math.round((bySite[site].sum / bySite[site].count) * 10) / 10
        : 0,
    }));
  }

  const bySite = {};
  for (const row of filtered) {
    if (!bySite[row.site]) bySite[row.site] = { sum: 0, count: 0 };
    bySite[row.site].sum += row[key];
    bySite[row.site].count += 1;
  }

  return SITES.map((site) => ({
    site,
    value: bySite[site]
      ? Math.round((bySite[site].sum / bySite[site].count) * 10) / 10
      : 0,
  }));
}

export function getSiteGeographicSummaries(data) {
  const lastBySiteTreatment = new Map();
  for (const row of data) {
    const key = `${row.site}|${row.treatment}`;
    const existing = lastBySiteTreatment.get(key);
    if (!existing || row.date > existing.date) {
      lastBySiteTreatment.set(key, row);
    }
  }

  return SITES.map((site) => {
    const siteRows = data.filter((r) => r.site === site);
    const finalRows = [...lastBySiteTreatment.values()].filter(
      (r) => r.site === site
    );
    const location = SITE_LOCATIONS[site];

    const meanGrowth =
      siteRows.length > 0
        ? Math.round(
            (siteRows.reduce((s, r) => s + r.growth_mm, 0) / siteRows.length) *
              10
          ) / 10
        : null;
    const meanTemp =
      siteRows.length > 0
        ? Math.round(
            (siteRows.reduce((s, r) => s + r.temperature_C, 0) /
              siteRows.length) *
              10
          ) / 10
        : null;
    const finalSurvival =
      finalRows.length > 0
        ? Math.round(
            (finalRows.reduce((s, r) => s + r.survival_percent, 0) /
              finalRows.length) *
              10
          ) / 10
        : null;

    return {
      site,
      ...location,
      meanGrowth,
      meanTemp,
      finalSurvival,
      recordCount: siteRows.length,
    };
  });
}
