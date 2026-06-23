import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ErrorBar,
} from 'recharts';

const SITE_COLORS = {
  Baywater: '#2563eb',
  'Sequim Bay': '#0891b2',
  'Goose Point': '#d97706',
  Westcott: '#6366f1',
};

const VIEW_CONFIG = {
  growth: { label: 'Mean Growth', unit: 'mm', caption: 'Average shell height (mm) by site' },
  survival: { label: 'Final Survival', unit: '%', caption: 'Mean end-of-period survival (%) by site' },
  temperature: { label: 'Mean Temperature', unit: '°C', caption: 'Average water temperature (°C) by site' },
};

export default function SiteComparisonChart({ growthData, survivalData, tempData }) {
  const [view, setView] = useState('growth');
  const [showErrorBars, setShowErrorBars] = useState(false);

  const dataMap = {
    growth: growthData,
    survival: survivalData,
    temperature: tempData,
  };
  const data = dataMap[view];
  const config = VIEW_CONFIG[view];
  const yLabel = `${config.label} (${config.unit})`;
  const canShowErrorBars = data?.some((row) => row.error != null);

  if (!data || data.length === 0) {
    return (
      <section className="chart-section card">
        <h2 className="section-title">Site Comparison</h2>
        <p className="empty-state">No data available for the selected filters.</p>
      </section>
    );
  }

  return (
    <section className="chart-section card">
      <div className="chart-header-row">
        <h2 className="section-title">Site Comparison</h2>
        <div className="chart-controls">
          <div className="toggle-group" role="group" aria-label="Site comparison metric">
            {Object.keys(VIEW_CONFIG).map((key) => (
              <button
                key={key}
                type="button"
                className={view === key ? 'toggle active' : 'toggle'}
                onClick={() => setView(key)}
              >
                {VIEW_CONFIG[key].label}
              </button>
            ))}
          </div>
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
      </div>
      <p className="chart-caption">{config.caption}</p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="site"
              tick={{ fontSize: 12, fill: '#475569' }}
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
              formatter={(value) => [`${value} ${config.unit}`, config.label]}
            />
            <Bar dataKey="value" name={config.label} radius={[4, 4, 0, 0]}>
              {showErrorBars && canShowErrorBars && (
                <ErrorBar
                  dataKey="error"
                  direction="y"
                  width={4}
                  stroke="#334155"
                  strokeWidth={1.5}
                />
              )}
              {data.map((entry) => (
                <Cell key={entry.site} fill={SITE_COLORS[entry.site] ?? '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
