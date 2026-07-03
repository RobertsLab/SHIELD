import { SITE_LOCATIONS } from '../data/mockShellfishData';

const REPORT_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'year', label: 'Year' },
  { key: 'month', label: 'Month' },
  { key: 'site', label: 'Site' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'effort', label: 'Experiment' },
  { key: 'tag', label: 'Tag' },
  { key: 'oyster_number', label: 'Oyster' },
  { key: 'growth_volume', label: 'Growth Volume' },
  { key: 'temperature_C', label: 'Temperature (deg C)' },
  { key: 'survival_percent', label: 'Survival (%)' },
];

function formatValue(value) {
  return value == null ? '' : String(value);
}

function csvEscape(value) {
  const text = formatValue(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getDateRange(data) {
  const dates = data.map((row) => row.date).filter(Boolean).sort();
  if (dates.length === 0) return 'No dated records';
  if (dates[0] === dates[dates.length - 1]) return dates[0];
  return `${dates[0]} to ${dates[dates.length - 1]}`;
}

function getFilterSummary(filters) {
  return [
    ['Site', filters.site],
    ['Treatment', filters.treatment],
    ['Metric', filters.metric],
    ['Year', filters.year],
  ];
}

function buildCsv(data, filters, stats) {
  const metadataRows = [
    ['SHIELD Field Report'],
    ['Dashboard', 'Shellfish Hardening and Integrated Environmental Longitudinal Dashboard'],
    ['Generated', new Date().toISOString()],
    ['Date range', getDateRange(data)],
    ['Record count', data.length],
    ...getFilterSummary(filters).map(([label, value]) => [`Filter: ${label}`, value]),
    ['Mean growth volume', stats.meanGrowth ?? ''],
    ['Mean temperature (deg C)', stats.meanTemp ?? ''],
    ['Final survival (%)', stats.finalSurvival ?? ''],
    ['Best-performing treatment', stats.bestTreatment],
    ['Highest-survival site', stats.highestSurvivalSite],
    [],
  ];

  const dataRows = [
    REPORT_COLUMNS.map((col) => col.label),
    ...data.map((row) => REPORT_COLUMNS.map((col) => formatValue(row[col.key]))),
  ];

  return [...metadataRows, ...dataRows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
}

function getFileDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function FieldReportExport({ filters, stats, data }) {
  const siteDetails = SITE_LOCATIONS[filters.site];
  const generatedLabel = formatDate(Date.now());
  const dateRange = getDateRange(data);

  const handleDownloadCsv = () => {
    const csv = buildCsv(data, filters, stats);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shield-field-report-${getFileDate()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const previousTitle = document.title;
    document.title = `SHIELD Field Report ${getFileDate()}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  };

  return (
    <section className="field-report card">
      <div className="field-report-header">
        <div>
          <h2 className="section-title">Field Report Export</h2>
          <p className="chart-caption">
            Generate a shareable report from the active dashboard filters,
            summary metrics, charts, and observation records.
          </p>
        </div>
        <div className="field-report-actions no-print">
          <button type="button" className="primary-action" onClick={handlePrint}>
            Save PDF
          </button>
          <button type="button" className="secondary-action" onClick={handleDownloadCsv}>
            Download CSV
          </button>
        </div>
      </div>

      <div className="report-meta-grid">
        <div>
          <span className="report-meta-label">Generated</span>
          <strong>{generatedLabel}</strong>
        </div>
        <div>
          <span className="report-meta-label">Date range</span>
          <strong>{dateRange}</strong>
        </div>
        <div>
          <span className="report-meta-label">Records</span>
          <strong>{data.length.toLocaleString()}</strong>
        </div>
      </div>

      <div className="report-filter-list" aria-label="Report filter summary">
        {getFilterSummary(filters).map(([label, value]) => (
          <span key={label}>
            <strong>{label}:</strong> {value}
          </span>
        ))}
      </div>

      {siteDetails ? (
        <div className="report-site-detail">
          <span
            className="report-site-dot"
            style={{ backgroundColor: siteDetails.color }}
            aria-hidden="true"
          />
          <div>
            <strong>{filters.site}</strong>
            <p>
              {siteDetails.region}. {siteDetails.description}
            </p>
          </div>
        </div>
      ) : (
        <p className="report-site-detail muted">
          Report covers all configured monitoring sites.
        </p>
      )}

      <div className="print-only report-print-title">
        <h1>SHIELD Field Report</h1>
        <p>
          Shellfish Hardening and Integrated Environmental Longitudinal Dashboard
        </p>
        <p>
          Generated {generatedLabel} · {data.length.toLocaleString()} records ·{' '}
          {dateRange}
        </p>
      </div>

      <div className="print-only report-record-appendix">
        <h2>Filtered Observation Records</h2>
        <table>
          <thead>
            <tr>
              {REPORT_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                {REPORT_COLUMNS.map((col) => (
                  <td key={col.key}>{row[col.key] == null ? '-' : row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
