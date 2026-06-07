# Shellfish Farm Outplant Dashboard

A polished, lightweight static web dashboard for visualizing mock shellfish farm outplant monitoring data over four years. Built with React, Vite, and Recharts — no backend required.

![Dashboard screenshot placeholder](docs/screenshot-placeholder.png)

> **Note:** Add a screenshot to `docs/screenshot-placeholder.png` after running the dashboard locally.

## Overview

This dashboard presents simulated multi-year monitoring data from four shellfish farm sites, comparing priming treatments across growth, temperature, and survival metrics. It is designed as a shareable demo suitable for GitHub Pages hosting.

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
- Treatment comparison grouped bar chart
- Site comparison bar chart
- Sortable, searchable, paginated data table

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

Open the URL shown in the terminal (typically `http://localhost:5173/shellfish-farm-dashboard/`).

## Build for Production

```bash
npm run build
```

Output is written to the `dist/` directory.

Preview the production build locally:

```bash
npm run preview
```

## Deploy to GitHub Pages

This project is configured for GitHub Pages with base path `/shellfish-farm-dashboard/`.

### Option 1: Using the deploy script (recommended)

1. Create a GitHub repository named **`shellfish-farm-dashboard`** (the repo name must match the base path).
2. Push this project to the repository.
3. Run:

```bash
npm run deploy
```

This builds the project and publishes the `dist/` folder to the `gh-pages` branch.

4. In your GitHub repository, go to **Settings → Pages** and set the source to the **`gh-pages`** branch, folder **`/ (root)`**.
5. Your site will be available at:

```
https://<your-username>.github.io/shellfish-farm-dashboard/
```

### Option 2: GitHub Actions (alternative)

You can also configure a GitHub Actions workflow to deploy on push to `main`. The `gh-pages` package approach above is the simplest for a first deployment.

### Important: Repository name

The Vite `base` path is set to `/shellfish-farm-dashboard/`. If your GitHub repository has a different name, update `base` in `vite.config.js` to match:

```js
base: '/your-repo-name/',
```

## Project Structure

```
shellfish-farm-dashboard/
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
    └── components/
        ├── Header.jsx
        ├── Filters.jsx
        ├── SummaryCards.jsx
        ├── TimeSeriesChart.jsx
        ├── TreatmentComparisonChart.jsx
        ├── SiteComparisonChart.jsx
        └── DataTable.jsx
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
