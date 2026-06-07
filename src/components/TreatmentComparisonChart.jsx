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
} from 'recharts';
import { TREATMENTS } from '../data/mockShellfishData';

const TREATMENT_COLORS = {
  Control: '#64748b',
  'Heat primed': '#dc2626',
  'Freshwater primed': '#0891b2',
  'Immune primed': '#7c3aed',
  'Combined stress primed': '#059669',
};

export default function TreatmentComparisonChart({ survivalData, growthData }) {
  const [view, setView] = useState('survival');
  const data = view === 'survival' ? survivalData : growthData;
  const yLabel =
    view === 'survival' ? 'Final survival (%)' : 'Mean growth (mm)';

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
        <div className="toggle-group" role="group" aria-label="Comparison metric">
          <button
            type="button"
            className={view === 'survival' ? 'toggle active' : 'toggle'}
            onClick={() => setView('survival')}
          >
            Final Survival
          </button>
          <button
            type="button"
            className={view === 'growth' ? 'toggle active' : 'toggle'}
            onClick={() => setView('growth')}
          >
            Mean Growth
          </button>
        </div>
      </div>
      <p className="chart-caption">
        {view === 'survival'
          ? 'End-of-period survival by priming treatment within each site'
          : 'Mean shell height growth by priming treatment within each site'}
      </p>
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
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {TREATMENTS.map((t) => (
              <Bar
                key={t}
                dataKey={t}
                name={t}
                fill={TREATMENT_COLORS[t]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
