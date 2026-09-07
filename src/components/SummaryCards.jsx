export default function SummaryCards({ stats }) {
  const cards = [
    {
      label: 'Final Growth Volume',
      value:
        stats.finalGrowth != null
          ? stats.finalGrowth.toLocaleString()
          : '—',
      detail: 'Mean predicted volume at the latest assessment per group',
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
      detail: 'Mean survival at the latest assessment per group',
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
