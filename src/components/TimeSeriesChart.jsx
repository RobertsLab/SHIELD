import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ErrorBar,
} from 'recharts';
import { siteColor } from '../data/siteMetadata';

const METRIC_LABELS = {
  'Growth Volume': 'Predicted volume',
  Temperature: 'Water temperature (°C)',
  Survival: 'Survival (%)',
};

function SeriesTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload ?? {};

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">Assessment: {label}</p>
      {payload
        .filter((entry) => entry.value != null)
        .map((entry) => {
          const count = point[`${entry.dataKey}Count`];
          return (
            <p key={entry.dataKey} className="chart-tooltip-row">
              <span
                className="chart-tooltip-dot"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}: <strong>{`${entry.value} ${unit}`.trim()}</strong>
              {count != null ? <span className="chart-tooltip-n"> (n={count})</span> : null}
            </p>
          );
        })}
    </div>
  );
}

export default function TimeSeriesChart({ data, metric }) {
  const [showErrorBars, setShowErrorBars] = useState(false);
  const yLabel = METRIC_LABELS[metric] ?? metric;
  const unit = data.unit ?? '';
  const sites = data.sites ?? [];

  if (!data.series || data.series.length === 0) {
    return (
      <section className="chart-section card">
        <h2 className="section-title">Time Series — {metric}</h2>
        <p className="empty-state">No data available for the selected filters.</p>
      </section>
    );
  }

  const tickInterval = Math.max(1, Math.floor(data.series.length / 12));
  const canShowErrorBars = data.series.some((point) =>
    sites.some((site) => point[`${site}Error`] != null)
  );

  return (
    <section className="chart-section card">
      <div className="chart-header-row">
        <h2 className="section-title">Time Series — {metric}</h2>
        {canShowErrorBars && (
          <label className="checkbox-control no-print">
            <input
              type="checkbox"
              checked={showErrorBars}
              onChange={(event) => setShowErrorBars(event.target.checked)}
            />
            Show error bars
          </label>
        )}
      </div>
      <p className="chart-caption">
        Mean {metric.toLowerCase()} at each field assessment, one line per site
        {unit ? ` (${unit})` : ''}. Sites are plotted separately because they were
        sampled on different dates.
      </p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={data.series} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#475569' }}
              interval={tickInterval}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#475569' }}
              label={{
                value: yLabel,
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#64748b', fontSize: 12 },
              }}
            />
            <Tooltip content={<SeriesTooltip unit={unit} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {sites.map((site) => (
              <Line
                key={site}
                type="monotone"
                dataKey={site}
                name={site}
                stroke={siteColor(site)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              >
                {showErrorBars && canShowErrorBars && (
                  <ErrorBar
                    dataKey={`${site}Error`}
                    direction="y"
                    width={4}
                    stroke={siteColor(site)}
                    strokeWidth={1.5}
                  />
                )}
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
