# SHIELD

Shellfish Hardening and Integrated Environmental Longitudinal Dashboard.

SHIELD is a lightweight web dashboard for exploring how stress-hardening
treatments perform across Pacific Northwest shellfish outplant sites. It brings
together real RobertsLab field observations, in-situ temperature logger records,
and near-live public environmental feeds so users can compare growth, survival,
temperature, site conditions, and treatment outcomes in one browser-based view.

The app is built with React, Vite, Recharts, Leaflet, and React Router. It is
deployed as a static single-page app, with data prepared ahead of time by build
scripts rather than by a runtime application server.

## Purpose

The dashboard is intended as a shareable research and collaboration interface
for the RobertsLab *Crassostrea gigas* stress-hardening outplant program. It
helps users:

- Compare survival and growth across hardening treatments and farm sites
- Inspect long-running HOBO logger temperature records by site
- View geographic site summaries on an interactive map
- Check near-live environmental context from nearby observing stations
- Export the currently filtered field summary for reporting

## How It Works

SHIELD has no browser-facing backend. The deployed site loads committed JSON
bundles from `src/data/` and renders them entirely in the React app.

The backend-like work happens before deployment:

- `scripts/build_real_observations.py` reads RobertsLab observation files and
  writes `src/data/realObservations.json`.
- `scripts/buildArchivalTemperature.mjs` downloads high-frequency HOBO logger
  CSVs, aggregates them to daily mean/min/max water temperature, and writes
  `src/data/archivalTemperatureData.json`.
- `scripts/build_live_temperature.py` fetches recent public environmental
  observations from nearby NOAA, USGS, and NANOOS-matched sources and writes
  `src/data/liveTemperature.json`.
- `.github/workflows/live-temperature.yml` refreshes the live environmental
  snapshot hourly and commits it only when the JSON changes.
- `.github/workflows/deploy.yml` builds the static app and deploys the `dist/`
  artifact to GitHub Pages.

This design keeps the public site simple to host on GitHub Pages while still
allowing scheduled server-side data refreshes for sources that cannot be fetched
directly from the browser because of CORS or credential constraints.

## Data

The historical placeholder dataset has been replaced with real observation
records. The `mockShellfishData` export name remains for component compatibility,
but it now points to `src/data/realObservations.json`.

Current committed data summary:

| Dataset | File | Description |
|---------|------|-------------|
| Field observations | `src/data/realObservations.json` | 74 site x treatment x assessment-date records generated from RobertsLab outplant data and Baywater 10K-Seed survival anchors |
| Archival temperature | `src/data/archivalTemperatureData.json` | Daily water-temperature summaries aggregated from approximately 15-minute HOBO logger records |
| Near-live environment | `src/data/liveTemperature.json` | Recent matched observations and source metadata for temperature, tide, wind, pressure, streamflow, and chlorophyll source matches |
| Site metadata | `src/data/mockShellfishData.js` | Site coordinates, regions, descriptions, colors, filter helpers, and chart aggregation helpers |

### Sites

- Baywater, Thorndyke Bay / Hood Canal, Washington
- Sequim Bay, Washington
- Goose Point, Palix River / Willapa Bay, Washington
- Westcott, Westcott Bay / San Juan Island, Washington
- Dabob Bay is included in the near-live environmental panel as an
  environmental-only context site

### Treatments

- Control
- Heat primed
- Freshwater primed
- Immune primed
- Combined stress primed

### Metrics

- Growth, in millimeters shell height where measured
- Survival, as percent surviving where measured
- Water temperature, in degrees Celsius from in-situ logger monthly means for
  field observation rows and daily means for the archival temperature chart
- Near-live environmental context, including water temperature, air temperature,
  air pressure, wind, tide height, tide predictions, salinity/conductivity where
  available, streamflow, and chlorophyll source matches

See `docs/DATA_FORMAT.md` for the observation schema and integration notes.

## Data Sources And Credits

SHIELD combines data from the following sources. Please preserve these credits
when reusing the dashboard or derived data products.

| Source | Used for | Where used |
|--------|----------|------------|
| RobertsLab `project-gigas-conditioning` | Goose Point, Sequim Bay, and Westcott outplant survival/growth inputs; environmental temperature CSVs for Sequim Bay, Goose Point, and Westcott | `scripts/build_real_observations.py`, `scripts/buildArchivalTemperature.mjs` |
| RobertsLab `10K-seed-Cgigas` | Baywater 10K-Seed survival anchors and Baywater temperature CSV | `scripts/build_real_observations.py`, `scripts/buildArchivalTemperature.mjs` |
| NOAA National Data Buoy Center (NDBC) realtime feeds | Nearby buoy meteorological and water-condition observations | `scripts/build_live_temperature.py` |
| NOAA CO-OPS Tides and Currents API | Water temperature, air temperature, pressure, humidity, salinity, conductivity, wind, water level, and tide predictions from nearby stations | `scripts/build_live_temperature.py` |
| USGS National Water Information System (NWIS) Instantaneous Values API | Nearby watershed streamflow context for Dabob Bay | `scripts/build_live_temperature.py` |
| NANOOS Shellfish Growers portal, including matched UW ORCA, Padilla Bay NERR, WA Ecology, and Pacific Shellfish Institute sources | Shellfish-focused chlorophyll and water-quality source matches; some imports are marked as source-matched until automated access is configured | `scripts/build_live_temperature.py` |
| OpenStreetMap contributors | Base map tiles and map attribution | `src/components/SiteMap.jsx`, `src/components/LiveTemperaturePanel.jsx` |

Direct public source URLs are stored in the generated JSON metadata where
available, especially `src/data/archivalTemperatureData.json` and
`src/data/liveTemperature.json`.

## Features

- Interactive filters for site, treatment, metric, and study year
- Summary statistic cards for filtered records
- Time-series chart for growth, temperature, or survival
- Archival water-temperature chart from HOBO logger data
- Treatment comparison and site comparison charts
- Sortable, searchable, paginated data table
- Field report export for the current filter state
- Geographic site map with interactive markers
- Near-live environmental dashboard with source map and source ledger

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm, included with Node.js
- Python 3 with `pandas` if regenerating `realObservations.json`

## Install Dependencies

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the URL shown in the terminal, typically
`http://localhost:5173/mock-farm-dashboard-03/`.

## Build And Refresh Data

Build the static site:

```bash
npm run build
```

Output is written to `dist/`.

Refresh the near-live environmental snapshot locally:

```bash
npm run build:live-environment
```

Regenerate the archival temperature bundle:

```bash
npm run build:temperature
```

Regenerate real observations manually:

```bash
python3 scripts/build_real_observations.py
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy To GitHub Pages

This project is configured for GitHub Pages with base path
`/mock-farm-dashboard-03/`, which must match the repository name.

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
https://<your-username>.github.io/mock-farm-dashboard-03/
```

You can also trigger a deploy manually from the **Actions** tab:
**Deploy to GitHub Pages** -> **Run workflow**.

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Workflow fails on "Deploy to docs/" | Old branch-based workflow conflicting with GitHub Actions | Use the current Pages workflow and set Pages source to **GitHub Actions** |
| Blank white page | Pages serving the repository root or `/docs` instead of the Actions artifact | Set Pages source to **GitHub Actions** |
| 404 on JS/CSS files | Wrong base path in `vite.config.js` | `base` must match repo name: `/mock-farm-dashboard-03/` |
| `/map` or `/live-data` route 404 | Missing SPA fallback | Build copies `index.html` to `404.html` automatically |
| Intermittent deploy failures | Concurrent pushes racing to deploy | The workflow uses concurrency control; re-run the failed job if needed |

### Important: Repository Name

The Vite `base` path must match the GitHub repository name. It is currently set
to `/mock-farm-dashboard-03/`. If you rename the repo, update `base` in
`vite.config.js`:

```js
base: '/your-repo-name/',
```

The React Router basename is derived automatically from this setting.

## Project Structure

```text
shield-dashboard/
├── README.md
├── docs/
│   └── DATA_FORMAT.md
├── package.json
├── index.html
├── vite.config.js
├── scripts/
│   ├── build_real_observations.py
│   ├── buildArchivalTemperature.mjs
│   └── build_live_temperature.py
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── data/
    │   ├── archivalTemperatureData.json
    │   ├── liveTemperature.json
    │   ├── mockShellfishData.js
    │   └── realObservations.json
    ├── pages/
    │   ├── DashboardPage.jsx
    │   ├── LiveDataPage.jsx
    │   └── MapPage.jsx
    └── components/
        ├── ArchivalTemperatureChart.jsx
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
| `npm run deploy` | Alias for the production build |
| `npm run build:live-environment` | Refresh `src/data/liveTemperature.json` from public observing feeds |
| `npm run build:temperature` | Regenerate `src/data/archivalTemperatureData.json` from source temperature CSVs |

## License

Research dashboard prototype for collaboration and data exploration. Check
upstream source repositories and public data provider terms before redistributing
raw or derived datasets.
