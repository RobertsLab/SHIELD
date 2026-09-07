<p align="center">
  <img src="src/assets/logo-lockup.png" alt="SHIELD — Shellfish Hardening and Integrated Environmental Longitudinal Dashboard" width="640" />
</p>

SHIELD is a lightweight web dashboard for exploring how stress-hardening
treatments perform across Pacific Northwest shellfish outplant sites. It brings
together RobertsLab field observations, individual oyster growth-volume records,
in-situ temperature logger summaries, and near-live public environmental feeds
so users can compare growth, survival, temperature, site conditions, source
coverage, and treatment outcomes in one browser-based view.

The app is built with React, Vite, Recharts, Leaflet, and React Router. It is
deployed as a static single-page app. Data is prepared ahead of time by build
scripts into compact JSON bundles under `public/data/`, which the app fetches at
runtime per route; there is no application server.

## Website

- Public dashboard: <https://robertslab.github.io/SHIELD/>
- Research overview: <https://robertslab.github.io/SHIELD/research>

The website now includes four main views:

| Route | View | Purpose |
|-------|------|---------|
| `/` | Dashboard | Filter field observations, compare treatments and sites, inspect time-series charts, and export field summaries |
| `/map` | Site Map | Explore outplant locations, site summaries, and links back into filtered dashboard views |
| `/live-data` | Live Data | Review near-live environmental observations, source metadata, source maps, and 4-week OSEL-score context |
| `/research` | Research Overview | Share project objectives, collaborators, Washington Sea Grant support, and research context |

## Purpose

The dashboard is intended as a shareable research and collaboration interface
for the RobertsLab *Crassostrea gigas* stress-hardening outplant program. It
helps users:

- Compare survival and growth across hardening treatments and farm sites
- Inspect long-running HOBO logger temperature records by site
- View geographic site summaries on an interactive map
- Check near-live environmental context from nearby observing stations
- Export the currently filtered field summary for reporting
- Share a direct research overview page with project objectives, personnel, and
  funding context

## How It Works

SHIELD has no browser-facing backend. The deployed site fetches committed JSON
bundles from `public/data/` when a route needs them (the dashboard and map load
the observation bundles, the live-data page loads the live snapshot) and renders
them entirely in the React app. Keeping data out of the JavaScript bundle means
the Research page never downloads the growth dataset, and the hourly live
snapshot caches independently of the application code.

The backend-like work happens before deployment:

- `scripts/build_real_observations.py` reads RobertsLab field observation files
  from the public `project-gigas-conditioning` repository (or a local checkout
  via `PGC_SOURCE`) and writes `public/data/realObservations.json`.
- `scripts/build_growth_observations.py` downloads RobertsLab growth CSV
  outputs and writes `public/data/growthObservations.json`.
- `scripts/build_survival_observations.py` downloads RobertsLab survival CSV
  outputs and writes `public/data/survivalObservations.json`.
- `scripts/buildArchivalTemperature.mjs` downloads high-frequency HOBO logger
  CSVs, aggregates them to daily mean/min/max water temperature, and writes
  `public/data/archivalTemperatureData.json`.
- `scripts/build_live_temperature.py` fetches recent public environmental
  observations from nearby NOAA, USGS, and NANOOS-matched sources and writes
  `public/data/liveTemperature.json`.
- `scripts/shield_data.py` holds the helpers the observation scripts share:
  treatment normalization, date parsing, HTTP fetching with retries, and the
  compact bundle encoder.
- `npm run build:data` runs the four static builders in dependency order
  (archival temperature first, because the field observations reuse its monthly
  means).
- `.github/workflows/ci.yml` runs the unit tests and a production build on
  pull requests and non-main branches.
- `.github/workflows/live-temperature.yml` refreshes the live environmental
  snapshot hourly, commits it only when the JSON changes, and dispatches the
  deploy workflow only in that case.
- `.github/workflows/deploy.yml` builds the static app and deploys the `dist/`
  artifact to GitHub Pages after pushes to `main` or workflow dispatches
  (manual, or from a live-environment refresh that changed the snapshot).

This design keeps the public site simple to host on GitHub Pages while still
allowing scheduled server-side data refreshes for sources that cannot be fetched
directly from the browser because of CORS or credential constraints.

## Data

All records are real observations. `src/data/observations.js` assembles the
dashboard dataset from `public/data/realObservations.json`,
`public/data/growthObservations.json`, and `public/data/survivalObservations.json`,
and holds the null-safe aggregation functions; `src/data/resources.js` fetches
and caches the bundles; `src/data/siteMetadata.js` holds site coordinates,
colors, and controlled vocabularies.

Current committed data summary:

| Dataset | File | Description |
|---------|------|-------------|
| Field observations | `public/data/realObservations.json` | 74 site x treatment x assessment-date records generated from RobertsLab outplant data and Thorndyke Bay 10K-Seed survival anchors |
| Growth observations | `public/data/growthObservations.json` | 29,836 individual oyster predicted-volume records refreshed from Thorndyke Bay, Palix River/Willapa Bay, Sequim Bay thermal, Sequim Bay PolyIC, and Westcott growth CSV outputs |
| Survival observations | `public/data/survivalObservations.json` | 738 per-bag percent-survival records from Thorndyke Bay, Palix River/Willapa Bay, Sequim Bay PolyIC, and Westcott survival CSV outputs (Sequim Bay PolyIC and Westcott per assessment date; Thorndyke Bay and Palix River/Willapa Bay total survival) |
| Archival temperature | `public/data/archivalTemperatureData.json` | Daily water-temperature summaries aggregated from approximately 15-minute HOBO logger records |
| Near-live environment | `public/data/liveTemperature.json` | Recent matched observations and source metadata for temperature, tide, wind, pressure, waves, streamflow where available, and chlorophyll source matches |
| Site metadata | `src/data/siteMetadata.js` | Site coordinates, regions, descriptions, colors, and controlled vocabularies |

### Bundle format

The three observation bundles use a compact positional format so the growth
dataset ships at about 1.5 MB instead of 20 MB. Each bundle carries `columns`
(the field at each row position), `lookups` (columns stored as an index into a
value list), `constants` (fields identical on every record), and `rows`.
`year`, `month`, `quarter`, and `id` are derived on load. The encoder is
`compact_bundle` in `scripts/shield_data.py` and the decoder is
`src/data/bundleFormat.js`; `npm test` validates every committed bundle against
the schema and vocabularies.

The dashboard-facing observation array is assembled in `src/data/observations.js`
from field, growth, and survival observations. Field rows supply monthly
logger-temperature (and legacy shell-length growth) values; per-bag survival
rows carry percent survival; individual growth-volume rows carry predicted
volume. Each record leaves metrics it does not measure as `null`. Aggregated field
survival is dropped only where a per-bag survival row exists for the same site,
treatment, and assessment date, avoiding double-counting; field survival is
retained for every other site, treatment, and date. Aggregations and exports
are null-safe, so missing metrics show as unavailable rather than as zeroes.

### Sites

- Thorndyke Bay / Hood Canal, Washington
- Sequim Bay, Washington
- Palix River / Willapa Bay, Washington
- Westcott, Westcott Bay / San Juan Island, Washington
- Bainbridge Island and Dabob Bay are included in the near-live environmental
  panel as environmental-only context sites

### Treatments

- Control
- Heat primed
- Freshwater primed
- Immune primed
- Combined stress primed

### Metrics

- Growth volume, as predicted oyster volume from image-derived models
- Survival, as percent surviving where measured
- Water temperature, in degrees Celsius from in-situ logger monthly means for
  field observation rows and daily means for the archival temperature chart
- Near-live environmental context, including water temperature, air temperature,
  air pressure, wind, gusts, wave height, tide height, salinity/conductivity
  where available, streamflow where available, and chlorophyll source matches
- OSEL-Score, a 1-5 current-condition screening heuristic based on the latest
  observed air temperature and tide height; it is not a forecast

## Data Sources And Credits

SHIELD combines data from the following sources. Please preserve these credits
when reusing the dashboard or derived data products.

| Source | Used for | Where used |
|--------|----------|------------|
| RobertsLab `project-gigas-conditioning` | Palix River/Willapa Bay, Sequim Bay, and Westcott outplant survival/growth inputs; Palix River/Willapa Bay and Westcott survival CSV outputs; environmental temperature CSVs for Sequim Bay, Palix River/Willapa Bay, and Westcott | `scripts/build_real_observations.py`, `scripts/build_growth_observations.py`, `scripts/build_survival_observations.py`, `scripts/buildArchivalTemperature.mjs` |
| RobertsLab `10K-seed-Cgigas` | Thorndyke Bay 10K-Seed survival CSV output, Thorndyke Bay growth CSV, and Thorndyke Bay temperature CSV | `scripts/build_real_observations.py`, `scripts/build_growth_observations.py`, `scripts/build_survival_observations.py`, `scripts/buildArchivalTemperature.mjs` |
| RobertsLab `polyIC-larvae` | Sequim Bay PolyIC growth and survival CSV outputs | `scripts/build_growth_observations.py`, `scripts/build_survival_observations.py` |
| NOAA National Data Buoy Center (NDBC) realtime feeds | Nearby buoy meteorological, wave, and water-condition observations | `scripts/build_live_temperature.py` |
| NOAA CO-OPS Tides and Currents API | Water temperature, air temperature, pressure, humidity, salinity, conductivity, wind, water level, and tide predictions from nearby stations | `scripts/build_live_temperature.py` |
| USGS National Water Information System (NWIS) Instantaneous Values API | Nearby watershed streamflow context for Dabob Bay | `scripts/build_live_temperature.py` |
| NANOOS Shellfish Growers portal, including matched UW ORCA, Padilla Bay NERR, WA Ecology, and Pacific Shellfish Institute sources | Shellfish-focused chlorophyll and water-quality source matches; some imports are marked as source-matched until automated access is configured | `scripts/build_live_temperature.py` |
| OpenStreetMap contributors | Base map tiles and map attribution | `src/components/SiteMap.jsx`, `src/components/LiveTemperaturePanel.jsx` |

Direct public source URLs are stored in the generated JSON metadata where
available, especially `public/data/archivalTemperatureData.json` and
`public/data/liveTemperature.json`.

## Features

- Interactive filters for site, treatment, metric, and study year
- Summary statistic cards for filtered records
- Time-series chart for growth volume, temperature, or survival, one line per
  site so sites sampled on different dates are never pooled
- Archival water-temperature chart from HOBO logger data
- Treatment comparison and site comparison charts, using the latest assessment
  per site and treatment for both growth and survival
- Sortable, searchable, paginated data table
- Field report export for the current filter state
- Geographic site map with interactive markers
- Near-live environmental dashboard with source map and source ledger
- Current-condition OSEL-score cards for sites with observed air-temperature
  and tide-height inputs
- Research overview page for objectives, collaborators, Washington Sea Grant
  support, and project summary language

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm, included with Node.js
- Python 3.10 or later. The growth, survival, and live-environment scripts use
  only the standard library. Regenerating `realObservations.json` needs the
  packages in `requirements.txt` (`pip install -r requirements.txt`).

## Install Dependencies

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the URL shown in the terminal, typically
`http://localhost:5173/SHIELD/`.

Local route shortcuts:

- Dashboard: `http://localhost:5173/SHIELD/`
- Site map: `http://localhost:5173/SHIELD/map`
- Live data: `http://localhost:5173/SHIELD/live-data`
- Research overview: `http://localhost:5173/SHIELD/research`

## Build And Refresh Data

Build the static site:

```bash
npm run build
```

Output is written to `dist/`.

Run the unit and bundle-validation tests:

```bash
npm test
```

Regenerate every static data bundle in dependency order:

```bash
npm run build:data
```

Refresh the near-live environmental snapshot locally:

```bash
npm run build:live-environment
```

Regenerate the archival temperature bundle:

```bash
npm run build:temperature
```

Regenerate field observations manually (reads the public GitHub repository by
default; set `PGC_SOURCE` to a local `project-gigas-conditioning` checkout to
build offline):

```bash
npm run build:real
```

Regenerate growth observations manually:

```bash
npm run build:growth
```

Regenerate survival observations manually:

```bash
npm run build:survival
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy To GitHub Pages

This project is configured for GitHub Pages with base path
`/SHIELD/`, which must match the repository name.

Deployment uses the official GitHub Pages Actions flow in
`.github/workflows/deploy.yml`. Do not use branch-based deploy from `main` or
`docs/`; that serves source files and can cause blank pages or workflow
conflicts.

### One-Time GitHub Pages Setup

1. In the repository, go to **Settings -> Pages**.
2. Under **Build and deployment -> Source**, choose **GitHub Actions**.
3. Push to `main`; the workflow builds `dist/` and deploys automatically.

The site will be available at:

```text
https://<your-username>.github.io/SHIELD/
```

For this repository, the direct research page is:

```text
https://robertslab.github.io/SHIELD/research
```

You can also trigger a deploy manually from the **Actions** tab:
**Deploy to GitHub Pages** -> **Run workflow**.

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Workflow fails on "Deploy to docs/" | Old branch-based workflow conflicting with GitHub Actions | Use the current Pages workflow and set Pages source to **GitHub Actions** |
| Blank white page | Pages serving the repository root or `/docs` instead of the Actions artifact | Set Pages source to **GitHub Actions** |
| 404 on JS/CSS files | Wrong base path in `vite.config.js` | `base` must match repo name: `/SHIELD/` |
| `/map`, `/live-data`, or `/research` route 404 | Missing SPA fallback | Build copies `index.html` to `404.html` automatically |
| Intermittent deploy failures | Concurrent pushes racing to deploy | The workflow uses concurrency control; re-run the failed job if needed |

### Important: Repository Name

The Vite `base` path must match the GitHub repository name. It is currently set
to `/SHIELD/`. If you rename the repo, update `base` in
`vite.config.js`:

```js
base: '/your-repo-name/',
```

The React Router basename is derived automatically from this setting.

## Project Structure

```text
shield-dashboard/
├── README.md
├── package.json
├── requirements.txt
├── index.html
├── vite.config.js
├── public/
│   └── data/
│       ├── archivalTemperatureData.json
│       ├── growthObservations.json
│       ├── liveTemperature.json
│       ├── realObservations.json
│       └── survivalObservations.json
├── scripts/
│   ├── shield_data.py
│   ├── build_growth_observations.py
│   ├── build_survival_observations.py
│   ├── build_real_observations.py
│   ├── buildArchivalTemperature.mjs
│   └── build_live_temperature.py
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── data/
    │   ├── bundleFormat.js
    │   ├── observations.js
    │   ├── resources.js
    │   ├── siteMetadata.js
    │   └── __tests__/
    ├── pages/
    │   ├── DashboardPage.jsx
    │   ├── LiveDataPage.jsx
    │   ├── MapPage.jsx
    │   └── ResearchPage.jsx
    └── components/
        ├── ArchivalTemperatureChart.jsx
        ├── DataStatus.jsx
        ├── DataTable.jsx
        ├── FieldReportExport.jsx
        ├── Filters.jsx
        ├── Header.jsx
        ├── LiveTemperaturePanel.jsx
        ├── SiteComparisonChart.jsx
        ├── SiteMap.jsx
        ├── SummaryCards.jsx
        ├── TimeSeriesChart.jsx
        └── TreatmentComparisonChart.jsx
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the static app and create GitHub Pages SPA fallback files |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest unit tests and validate the committed data bundles |
| `npm run build:data` | Regenerate all static bundles in dependency order (temperature, field, growth, survival) |
| `npm run build:real` | Refresh `public/data/realObservations.json` from RobertsLab field observation files |
| `npm run build:growth` | Refresh `public/data/growthObservations.json` from RobertsLab growth CSV outputs |
| `npm run build:survival` | Refresh `public/data/survivalObservations.json` from RobertsLab survival CSV outputs |
| `npm run build:live-environment` | Refresh `public/data/liveTemperature.json` from public observing feeds |
| `npm run build:temperature` | Regenerate `public/data/archivalTemperatureData.json` from source temperature CSVs |

## License

Research dashboard prototype for collaboration and data exploration. Check
upstream source repositories and public data provider terms before redistributing
raw or derived datasets.
