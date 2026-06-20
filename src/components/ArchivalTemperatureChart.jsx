import { useMemo, useState } from 'react';
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
import archivalTemperature from '../data/archivalTemperatureData.json';

function ArchivalTooltip({ active, payload, label }) {
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

function formatRange(start, end) {
  const fmt = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function ArchivalTemperatureChart() {
  const { series, sites, meta, generatedAt } = archivalTemperature;
  const [activeSites, setActiveSites] = useState(() => new Set(sites));

  const toggleSite = (site) => {
    setActiveSites((prev) => {
      const next = new Set(prev);
      if (next.has(site)) {
        if (next.size > 1) next.delete(site);
      } else {
        next.add(site);
      }
      return next;
    });
  };

  const overallRange = useMemo(() => {
    const starts = meta.map((m) => m.start).filter(Boolean).sort();
    const ends = meta.map((m) => m.end).filter(Boolean).sort();
    return formatRange(starts[0], ends.at(-1));
  }, [meta]);

  const tickInterval = Math.max(1, Math.floor(series.length / 10));

  return (
    <section className="chart-section card">
      <h2 className="section-title">Archival Water Temperature</h2>
      <p className="chart-caption">
        Daily mean water temperature (°C) recorded by in-situ HOBO loggers at
        four Pacific Northwest shellfish sites ({overallRange}). Aggregated from
        ~15-minute field observations. Click a site to toggle it.
      </p>

      <div className="archival-site-toggles">
        {sites.map((site) => {
          const on = activeSites.has(site);
          const color = SITE_LOCATIONS[site]?.color ?? '#64748b';
          return (
            <button
              key={site}
              type="button"
              className={`archival-toggle${on ? ' is-active' : ''}`}
              onClick={() => toggleSite(site)}
              style={on ? { borderColor: color, color } : undefined}
            >
              <span
                className="chart-tooltip-dot"
                style={{ backgroundColor: on ? color : '#cbd5e1' }}
              />
              {site}
            </button>
          );
        })}
      </div>

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
            <Tooltip content={<ArchivalTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {sites
              .filter((site) => activeSites.has(site))
              .map((site) => (
                <Line
                  key={site}
                  type="monotone"
                  dataKey={site}
                  name={site}
                  stroke={SITE_LOCATIONS[site]?.color ?? '#64748b'}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="chart-source-note">
        Source loggers:{' '}
        {meta.map((m, i) => (
          <span key={m.site}>
            {i > 0 && ' · '}
            <a href={m.source} target="_blank" rel="noreferrer">
              {m.site}
            </a>
          </span>
        ))}
        . Generated {generatedAt}.
      </p>
    </section>
  );
}
