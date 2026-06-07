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
import { SITE_LOCATIONS } from '../data/mockShellfishData';

function SiteTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload
        .filter((entry) => entry.value != null)
        .sort((a, b) => b.value - a.value)
        .map((entry) => (
          <p key={entry.dataKey} className="chart-tooltip-row">
            <span
              className="chart-tooltip-dot"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}: <strong>{entry.value} °C</strong>
          </p>
        ))}
    </div>
  );
}

export default function TemperatureBySiteChart({ data }) {
  const { series, sites } = data;

  if (!series?.length || !sites?.length) {
    return (
      <section className="chart-section card">
        <h2 className="section-title">Temperature by Site</h2>
        <p className="empty-state">No data available for the selected filters.</p>
      </section>
    );
  }

  const tickInterval = Math.max(1, Math.floor(series.length / 12));

  return (
    <section className="chart-section card">
      <h2 className="section-title">Temperature by Site</h2>
      <p className="chart-caption">
        Monthly mean water temperature (°C) over time, with one line per
        outplant site. Averaged across treatments for each site.
      </p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={series} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
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
              domain={['auto', 'auto']}
              label={{
                value: 'Water temperature (°C)',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#64748b', fontSize: 12 },
              }}
            />
            <Tooltip content={<SiteTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {sites.map((site) => (
              <Line
                key={site}
                type="monotone"
                dataKey={site}
                name={site}
                stroke={SITE_LOCATIONS[site]?.color ?? '#64748b'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
