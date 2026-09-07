import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ErrorBar,
} from 'recharts';
import { TREATMENT_COLORS, FALLBACK_COLOR } from '../data/siteMetadata';

const VIEW_CONFIG = {
  survival: {
    label: 'Final Survival',
    yLabel: 'Final survival (%)',
    caption: 'Survival at the latest assessment by priming treatment within each site',
  },
  growth: {
    label: 'Final Growth Volume',
    yLabel: 'Final predicted volume',
    caption:
      'Mean predicted oyster volume at the latest assessment by priming treatment within each site',
  },
};

export default function TreatmentComparisonChart({ survivalData, growthData, treatments }) {
  const [view, setView] = useState('survival');
  const [showErrorBars, setShowErrorBars] = useState(false);
  const data = view === 'survival' ? survivalData : growthData;
  const config = VIEW_CONFIG[view];
  const canShowErrorBars = data?.some((row) =>
    treatments.some((treatment) => row[`${treatment}Error`] != null)
  );

  if (!data || data.length === 0) {
    return (
      <section className="chart-section card">
        <h2 className="section-title">Treatment Comparison by Site</h2>
        <p className="empty-state">No data available for the selected filters.</p>
      </section>
    );
  }

  return (
    <section className="chart-section card">
      <div className="chart-header-row">
        <h2 className="section-title">Treatment Comparison by Site</h2>
        <div className="chart-controls">
          <div className="toggle-group" role="group" aria-label="Comparison metric">
            {Object.keys(VIEW_CONFIG).map((key) => (
              <button
                key={key}
                type="button"
                className={view === key ? 'toggle active' : 'toggle'}
                aria-pressed={view === key}
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
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="site"
              tick={{ fontSize: 12, fill: '#475569' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#475569' }}
              label={{
                value: config.yLabel,
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
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {treatments.map((t) => {
              const color = TREATMENT_COLORS[t] ?? FALLBACK_COLOR;
              return (
                <Bar key={t} dataKey={t} name={t} fill={color} radius={[3, 3, 0, 0]}>
                  {showErrorBars && canShowErrorBars && (
                    <ErrorBar
                      dataKey={`${t}Error`}
                      direction="y"
                      width={4}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  )}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
