# SHIELD Codebase Evaluation

Date: 2026-09-07
Scope: full read of `src/`, `scripts/`, `.github/workflows/`, `README.md`, the committed data bundles, a production build, and a headless render of the deployed dashboard route.

## Summary

SHIELD is a well scoped static dashboard. The architecture choice (build scripts produce JSON, React renders it, GitHub Pages hosts it) is the right one for this project, the README is unusually thorough, aggregation code is null-safe, and provenance links are carried all the way to the UI. The codebase is small enough to keep in one head.

The problems cluster in three places:

1. **Payload and render cost.** The site ships a single 19.9 MB JavaScript chunk and the dashboard mounts a hidden 30,000 row table on every load. Both are fixable without changing the architecture.
2. **A survival data-loss bug.** Site-level replacement of field survival with per-bag survival silently drops 22 measured records that have no replacement, including all Sequim Bay heat-primed survival.
3. **No safety net.** There are no tests, no lint, no CI on pull requests, and one build script only runs on one person's laptop.

Everything below is ordered by impact. A prioritized roadmap is at the end.

## Measurements

| Measurement | Value |
|---|---|
| Production JS bundle (single chunk) | 19,916 kB raw, 670 kB gzip |
| `growthObservations.json` | 19.9 MB raw, 422 kB gzip, 29,836 records |
| Same growth data in compact columnar form | about 2.6 MB raw (7x smaller) |
| DOM on dashboard first render | 30,665 `<tr>`, 337,293 `<td>`, 5.6 MB serialized HTML |
| Commits in the last 50 | 50 of 50 are hourly bot snapshot commits |
| Field survival records dropped with no replacement | 22 |
| `npm audit` | 2 moderate (react-router) |
| Test files, lint config, PR CI | none |

## 1. Critical: performance

### 1.1 One 20 MB chunk for every route

All five JSON bundles are imported statically from `src/data/`, so Vite inlines them into the main chunk. Consequences:

- The Research page and Site Map download and parse 20 MB of oyster volume rows they never use.
- `liveTemperature.json` is in the same chunk. It changes hourly, so the chunk hash changes hourly and every returning visitor re-downloads the full 670 kB gzip bundle every hour. The cache is defeated by design.
- The growth bundle is 87 percent redundant. Every record repeats `growth_mm: null`, `temperature_C: null`, `survival_percent: null`, `survival_source: "none"`, `growth_source: "measured-volume"`, `temperature_source: "none"`, `source_repo`, and a 90 character `source_url`. Those are constants per source file.

Recommended fix, in order of leverage:

1. Move the JSON bundles to `public/data/` and fetch them at runtime per route. The live snapshot then caches independently of the app code.
2. Emit growth data in a columnar or per-source shape (constants once in `meta`, rows as arrays). Expect roughly 2.6 MB raw before gzip.
3. Consider precomputing the per site, treatment, date aggregates the dashboard actually plots. The browser only needs raw rows for the data table and CSV export, and those could load on demand.
4. As a minimum stopgap, add `build.rollupOptions.output.manualChunks` so vendor code, growth data, and the live snapshot are separate chunks.

### 1.2 Hidden print appendix renders every filtered row

`FieldReportExport.jsx` renders a `print-only` table containing every row in `data`. With default filters that is 30,648 rows and 337,000 cells mounted, diffed, and held in memory on every dashboard render, then hidden with `display: none`. This is the dominant cost of the dashboard route and it scales with the dataset.

Fix: render the appendix only during printing (toggle a state flag in the `beforeprint` event, or build the print view in a dedicated route or `window.open` document), and cap or paginate the appendix. The CSV export already covers the full record dump.

### 1.3 Smaller render costs

- `DataTable.jsx` re-filters and re-sorts all rows on every keystroke with no debounce. Fine today, but it compounds with 1.2.
- `getSiteGeographicSummaries` filters the whole array once per site. Trivial now, but it will matter if aggregation is not moved to build time.

## 2. Critical: data correctness

### 2.1 Site-level survival replacement drops measured data

`mockShellfishData.js` nulls out `survival_percent` on every field row whose site appears in `survivalObservations.sites`. The intent is to avoid double counting per-bag rows. The replacement is coarser than the data:

| Site | Field survival dropped | Per-bag replacement exists? |
|---|---|---|
| Sequim Bay, Heat primed, 3 dates (2025-05-28, 2025-10-06, 2026-05-31) | yes | No. Per-bag Sequim data is PolyIC only (Control vs Immune primed). Heat-primed survival at Sequim no longer appears anywhere in the dashboard. |
| Sequim Bay, Control, 2025-05-28 | yes | No per-bag row on that date. |
| Palix River/Willapa Bay, all 3 treatments, 6 dates 2024-06 to 2025-10 | yes | No. Per-bag Palix data is a single 2026-05-22 total. The 2024 to 2025 survival trajectory is gone from the time series. |

None of the dropped dates overlap a per-bag date, so there was no double counting to prevent. Because `finalDateRowsWithValue` already picks the latest date per site and treatment, keeping the field rows would not have changed the final-survival cards either.

Fix: replace at the granularity of (site, treatment, date), or better, (site, effort, date). Drop a field row only when a per-bag row exists for the same key.

### 2.2 Pooled time series is confounded by site composition

With "All Sites" selected, the growth time series averages whatever sites happened to be measured on each date. Site means differ by a factor of three (Palix about 57,600, Sequim about 33,400, Westcott about 21,600, Thorndyke about 19,200), and sites were sampled on different dates. The resulting line mostly tracks which site was sampled, not growth over time. Survival has the same issue. Plot one line per site (or per site and treatment) and let the user collapse them, or at least show the contributing sites in the tooltip.

### 2.3 Growth and survival comparisons use different windows

`getTreatmentComparisonData` and `getSiteComparisonData` use final-date rows for survival but pool every date for growth. A treatment measured more often, or only early, is penalized or inflated in the growth bar. Use the same final-assessment rule for both, or label the growth bars as "all assessments pooled".

### 2.4 Mixed growth models under one axis

`growth_metric` is `vol` for 16,236 Westcott rows and `Predicted_Volume_Poly` for 13,600 rows elsewhere. The dashboard averages them together as "Growth Volume". If the two models are not on the same scale this is a units error; if they are, say so in the caption and `meta`.

### 2.5 Duplicate x-axis labels

`getTimeSeriesData` groups by exact date but labels by `Month Year`. Nine months contain two to five distinct assessment dates (August 2024 has five), so the axis shows repeated labels and the tooltip reads "Period: Aug 2024" for several different points. Use the ISO date, or a day-level label.

### 2.6 "Best-performing treatment" pools across sites

The summary card ranks treatments by mean final survival pooled across all sites, but treatments differ per site (Immune primed exists at Thorndyke and Sequim only). Restrict the card to the current site filter or rank within site.

### 2.7 Shipped but invisible data

- 23 field rows carry `growth_mm` shell length that no chart, table column, or export shows.
- The Thorndyke Bay survival anchors hard-coded in `build_real_observations.py` are superseded by `survivalObservations.json` and dropped at merge time, but still shipped.
- `realObservations.json` still exports `Treated` handling in `TREATMENT_ORDER`, but `TreatmentComparisonChart` has no color for it. Latent, not live today.

## 3. Data pipeline and reproducibility

- `scripts/build_real_observations.py` reads from `/Users/sr320/Documents/GitHub/project-gigas-conditioning`. Nobody else and no CI job can regenerate `realObservations.json`. Point it at the raw GitHub URLs like the other scripts, or accept a path via environment variable.
- It also needs `pandas` and `openpyxl` (for `read_excel`) while the README says only `pandas`. Add a `requirements.txt` or `pyproject.toml`.
- `realObservations.json` derives its monthly temperatures from `archivalTemperatureData.json`, so regeneration order is archival, then real, then growth and survival. Nothing documents or enforces this. Add an `npm run build:data` that runs them in order.
- `normal_treatment`, `date_fields`, `read_csv`, `site_slug`, `parse_date`, and `number` are copy-pasted between the growth and survival scripts. Extract a `scripts/shield_data.py` module. The treatment mapping in particular must stay identical across the two.
- `datetime.utcnow()` is deprecated in Python 3.12 and emits warnings under `-W error`.
- `urlopen` calls in the growth and survival scripts have no timeout and no retry.
- The header comment in `mockShellfishData.js` points to `docs/DATA_FORMAT.md`, but `docs/` is in `.gitignore` so the schema document is not in the repo. Either un-ignore a `docs/` folder or fold the schema into the README.
- No output validation. A one-line check that every record has the expected keys and that `treatments` contains only the controlled vocabulary would catch mapping regressions before they reach the site.

## 4. CI, deployment, and repository hygiene

- **History is dominated by snapshot commits.** All 50 most recent commits are "Refresh live environmental snapshot" from the bot, roughly 6 to 8 per day. Options: write the snapshot to an orphan `data` branch and fetch it at runtime, publish it as a workflow artifact consumed by the deploy job, or commit it to `public/` on the `gh-pages` deployment only. Any of these keep `main` history readable.
- **Deploy runs hourly even when nothing changed.** `deploy.yml` triggers on `workflow_run` success, and the refresh job exits successfully whether or not it committed. Emit a job output such as `changed=true` and gate the deploy on it.
- **No pull request CI.** Nothing builds, lints, or tests a branch before merge. Add a workflow that runs `npm ci && npm run build` on `pull_request`.
- **No dependency automation.** Add Dependabot or Renovate.
- **Audit findings.** `react-router-dom` 6.30.4 has two moderate advisories (open redirect via backslash in `Link`, SSR deserialization). The fixed range starts at 7.18, so this is a major upgrade rather than a patch. The app only uses `BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, and `useSearchParams`, all unchanged in v7, so the upgrade is low risk.
- **Major versions behind.** React 19, Recharts 3, react-leaflet 5, react-router 7, Vite 8. Not urgent; plan one upgrade pass.
- `npm run deploy` is an alias for `npm run build` and does not deploy. Remove or rename it.

## 5. Code quality and maintainability

- **Naming.** `mockShellfishData.js` and the `mockShellfishData` export contain the real dataset. The README apologizes for this. Rename to `observations.js` and `observations`; it is a one-commit refactor with an IDE.
- **Four copies of site constants.** Coordinates and colors for the same sites live in `SITE_LOCATIONS`, `SiteComparisonChart.SITE_COLORS`, `LiveTemperaturePanel.LIVE_SITE_LOCATIONS`, and `build_live_temperature.py SITES`. Keep one `sites.json` that both the app and the scripts read.
- **Navigation.** The header offers Dashboard, Site Map, and an external Conditioning Atlas link. Live Data is reachable only through a "Beta" link under the archival chart, and Research only through the footer. Add both to the header nav.
- **Stale copy.** The header disclaimer still describes "image-derived shell growth" and lists sites that no longer match the data. `DataTable` and `FieldReportExport` describe "field observation records" for what are mostly individual oyster rows.
- **URL state is one-way.** `DashboardPage` reads `?site=` on load but never writes filter changes back, so a shared URL and the visible state diverge after the first click. Treatment, metric, and year are not in the URL at all.
- **Search matches the string "null".** `DataTable` stringifies missing values before matching, so typing "nu" matches every row with a blank metric.
- **`SiteMap` passes both `bounds` and `center` and `zoom`** to `MapContainer`; only `bounds` takes effect.
- **One 1,739 line stylesheet.** Consider splitting by page or component, or at least adding a table of contents comment. Only one `!important`, which is good.
- **OSEL score thresholds** live as constants inside a component. They are scientific parameters, so move them to a documented config and surface the thresholds in the UI legend.
- **External font dependency.** `index.html` loads Inter from Google Fonts. For a research tool that is a privacy and offline consideration; self-host or fall back to system fonts.

## 6. Testing

There are none. The highest value targets are the pure functions in `mockShellfishData.js`: `finalDateRowsWithValue`, `summarizeValues`, `computeSummaryStats`, `getTimeSeriesData`, `getTreatmentComparisonData`, and the merge logic that produced bug 2.1. Add Vitest, write a fixture of about 20 rows, and assert the aggregates by hand. A second tier is a snapshot test that each committed JSON bundle matches its declared schema and controlled vocabularies.

## 7. Accessibility

Generally reasonable: semantic sections, `aria-label`s on control groups, `role="table"` on the ledger, labeled selects. Gaps:

- Toggle buttons do not expose `aria-pressed`.
- Charts have no text alternative. A short visually hidden summary or the data table link would cover it.
- Two `<h1>` elements render on the dashboard (header and print title).
- The `sort-button` headers do not expose `aria-sort`.

## Prioritized roadmap

**Quick wins (an afternoon)**, addressed on this branch

1. Gate the print appendix behind a `beforeprint` flag. Removes 337,000 DOM nodes from every dashboard load. Done: the appendix mounts only while printing and is capped at 1,000 rows with a pointer to the CSV. Dashboard DOM went from 30,665 rows to 16.
2. Fix survival replacement to key on (site, treatment, date). Restores 22 measured records. Done and verified against the merged dataset: Sequim Bay heat-primed survival and the Palix River 2024 to 2025 trajectory are back.
3. Resolve the `npm audit` findings. Done by upgrading `react-router-dom` to 7.18.3; the audit is clean and all routes render.
4. Add Live Data and Research to the header nav; refresh the disclaimer copy. Done.
5. Label time series points by date, not month. Done; no duplicate labels remain.
6. Skip the deploy when the snapshot did not change. Done: the refresh workflow now dispatches `deploy.yml` only after committing a changed snapshot, and the `workflow_run` trigger is removed from `deploy.yml`.

**Medium (a few days)**

7. Move data bundles to `public/data/` and fetch per route; split live snapshot from app code.
8. Emit growth data in a compact shape; drop constant columns into `meta`.
9. Per-site time series lines; same final-date rule for growth and survival.
10. Add Vitest with fixtures for the aggregation functions; add a `pull_request` build workflow.
11. Extract shared Python helpers; add `requirements.txt`; add `npm run build:data`.
12. Make `build_real_observations.py` reproducible from public URLs.

**Larger (plan for)**

13. Precompute aggregates at build time and load raw rows on demand.
14. Move the hourly snapshot off `main` history.
15. Dependency upgrade pass (React 19, Recharts 3, react-leaflet 5, react-router 7, Vite 8).
16. Rename `mockShellfishData` and unify site constants into one shared file.
