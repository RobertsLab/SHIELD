import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const METRIC_LABELS = {
  Growth: 'Shell height (mm)',
  Temperature: 'Water temperature (°C)',
  Survival: 'Survival (%)',
};

export default function TimeSeriesChart({ data, metric }) {
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

  return (
    <section className="chart-section card">
      <h2 className="section-title">Time Series — {metric}</h2>
      <p className="chart-caption">
        Monthly mean {metric.toLowerCase()} over the monitoring period
        {unit ? ` (${unit})` : ''}
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
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
