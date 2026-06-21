# SHIELD

Shellfish Hardening and Integrated Environmental Longitudinal Dashboard.

Tracking how stress-hardening treatments perform across farms, years, and environments.

A polished, lightweight static web dashboard for visualizing shellfish farm outplant monitoring data over multiple years. Built with React, Vite, and Recharts — no backend required.

![Dashboard screenshot placeholder](docs/screenshot-placeholder.png)

> **Note:** Add a screenshot to `docs/screenshot-placeholder.png` after running the dashboard locally.

## Overview

This dashboard presents multi-year monitoring data from shellfish farm sites, comparing stress-hardening treatments across growth, temperature, and survival metrics. It is designed as a shareable demo suitable for GitHub Pages hosting.

## Data Description

All data are **simulated** for demonstration purposes.

| Dimension | Values |
|-----------|--------|
| **Sites** | Baywater, Sequim Bay, Goose Point, Westcott |
| **Treatments** | Control, Heat primed, Freshwater primed, Immune primed, Combined stress primed |
| **Metrics** | Growth (mm shell height), Temperature (°C), Survival (%) |
| **Time span** | 4 years (Year 1–Year 4), monthly time points |

Mock data patterns:
- Growth generally increases over time
- Survival generally declines over time
- Temperature shows seasonal cycles
- Site and treatment differences are intentionally embedded

Data source: `src/data/mockShellfishData.js` (960 records generated programmatically).

## Features

- Interactive filters (site, treatment, metric, year)
- Summary statistic cards
- Time-series line chart
- Scheduled live environmental snapshot from matched NOAA and NANOOS shellfish sources
- Treatment comparison grouped bar chart
- Site comparison bar chart
- Sortable, searchable, paginated data table
- Geographic site map with interactive markers (OpenStreetMap)

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

## Install Dependencies

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173/mock-farm-dashboard-03/`).

## Build for Production

```bash
npm run build
```

Output is written to the `dist/` directory.

Refresh the near-live environmental snapshot locally:

```bash
npm run build:live-environment
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy to GitHub Pages

This project is configured for GitHub Pages with base path `/mock-farm-dashboard-03/` (must match the repository name).

Deployment uses the official **GitHub Actions** workflow (`.github/workflows/deploy.yml`). Do **not** use branch-based deploy from `main` or `docs/` — that serves source files and causes blank pages or workflow conflicts.

### One-time GitHub Pages setup

1. In your repository go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` — the workflow builds `dist/` and deploys automatically.

Your site will be at:

```
https://<your-username>.github.io/mock-farm-dashboard-03/
```

You can also trigger a deploy manually from the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Workflow fails on "Deploy to docs/" | Old peaceiris workflow conflicting with GitHub Actions | Use the current `deploy-pages` workflow; set Pages source to **GitHub Actions** |
| Blank white page | Pages serving `main` root or `/docs` instead of the Actions artifact | Set Pages source to **GitHub Actions** |
| 404 on JS/CSS files | Wrong base path in `vite.config.js` | `base` must match repo name: `/mock-farm-dashboard-03/` |
| `/map` route 404 | Missing SPA fallback | Build copies `index.html` → `404.html` automatically |
| Intermittent deploy failures | Concurrent pushes racing to update `main` | The workflow uses concurrency control; re-run the failed job if needed |

### Important: Repository name

The Vite `base` path must match your GitHub repository name. It is currently set to `/mock-farm-dashboard-03/`. If you rename the repo, update `base` in `vite.config.js`:

```js
base: '/your-repo-name/',
```

The React Router basename is derived automatically from this setting.

## Project Structure

```
shield-dashboard/
├── README.md
├── package.json
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── data/
    │   └── mockShellfishData.js
    ├── pages/
    │   ├── DashboardPage.jsx
    │   └── MapPage.jsx
    └── components/
        ├── Header.jsx
        ├── Filters.jsx
        ├── SummaryCards.jsx
        ├── TimeSeriesChart.jsx
        ├── TreatmentComparisonChart.jsx
        ├── SiteComparisonChart.jsx
        ├── DataTable.jsx
        └── SiteMap.jsx
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run deploy` | Build and deploy to GitHub Pages |

## License

Mock demonstration project — use freely for collaboration and prototyping.
