export default function SummaryCards({ stats }) {
  const cards = [
    {
      label: 'Mean Growth Volume',
      value:
        stats.meanGrowth != null
          ? stats.meanGrowth.toLocaleString()
          : '—',
      detail: 'Predicted volume across filtered oysters',
    },
    {
      label: 'Mean Temperature',
      value: stats.meanTemp != null ? `${stats.meanTemp} °C` : '—',
      detail: 'Water temperature (filtered period)',
    },
    {
      label: 'Final Survival',
      value:
        stats.finalSurvival != null ? `${stats.finalSurvival}%` : '—',
      detail: 'Mean end-of-period survival by group',
    },
    {
      label: 'Best-performing Treatment',
      value: stats.bestTreatment,
      detail: 'Highest mean final survival',
    },
    {
      label: 'Highest-survival Site',
      value: stats.highestSurvivalSite,
      detail: 'Site with best mean final survival',
    },
  ];

  return (
    <section className="summary-cards" aria-label="Summary statistics">
      {cards.map((card) => (
        <div key={card.label} className="summary-card card">
          <span className="summary-label">{card.label}</span>
          <span className="summary-value">{card.value}</span>
          <span className="summary-detail">{card.detail}</span>
        </div>
      ))}
    </section>
  );
}
