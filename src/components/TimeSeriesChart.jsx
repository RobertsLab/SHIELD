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

const METRIC_LABELS = {
  'Growth Volume': 'Predicted volume',
  Temperature: 'Water temperature (°C)',
  Survival: 'Survival (%)',
};

export default function TimeSeriesChart({ data, metric }) {
  const [showErrorBars, setShowErrorBars] = useState(false);
  const yLabel = METRIC_LABELS[metric] ?? metric;
  const unit = data.unit ?? '';

  if (!data.series || data.series.length === 0) {
    return (
      <section className="chart-section card">
        <h2 className="section-title">Time Series — {metric}</h2>
        <p className="empty-state">No data available for the selected filters.</p>
      </section>
    );
  }

  const tickInterval = Math.max(1, Math.floor(data.series.length / 12));
  const canShowErrorBars = data.series.some((point) => point.error != null);

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
        Mean {metric.toLowerCase()} across filtered cohorts at each field
        assessment{unit ? ` (${unit})` : ''}
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
            <Tooltip
              contentStyle={{
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
              }}
              formatter={(value) => [`${value} ${unit}`.trim(), metric]}
              labelFormatter={(label) => `Period: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              name={metric}
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            >
              {showErrorBars && canShowErrorBars && (
                <ErrorBar
                  dataKey="error"
                  direction="y"
                  width={4}
                  stroke="#2563eb"
                  strokeWidth={1.5}
                />
              )}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
