import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import SiteMap from '../components/SiteMap';
import {
  mockShellfishData,
  getSiteGeographicSummaries,
} from '../data/mockShellfishData';

export default function MapPage() {
  const [selectedSite, setSelectedSite] = useState(null);

  const siteSummaries = useMemo(
    () => getSiteGeographicSummaries(mockShellfishData),
    []
  );

  const activeSite = siteSummaries.find((s) => s.site === selectedSite);

  return (
    <main className="dashboard-main map-page">
      <section className="card map-intro">
        <h2 className="section-title">Geographic Site Overview</h2>
        <p className="chart-caption">
          RobertsLab <em>Crassostrea gigas</em> outplant monitoring sites across
          the Pacific Northwest shellfish farming region. Click a marker or site
          card to view location details and field summaries.
        </p>
      </section>

      <div className="map-layout">
        <section className="card map-panel">
          <SiteMap
            sites={siteSummaries}
            selectedSite={selectedSite}
            onSelectSite={setSelectedSite}
          />
        </section>

        <aside className="map-sidebar">
          <div className="card map-detail-card">
            <h2 className="section-title">
              {activeSite ? activeSite.site : 'Select a Site'}
            </h2>
            {activeSite ? (
              <>
                <p className="map-detail-region">{activeSite.region}</p>
                <p className="map-detail-desc">{activeSite.description}</p>
                <dl className="map-detail-stats">
                  <div>
                    <dt>Coordinates</dt>
                    <dd>
                      {activeSite.lat.toFixed(3)}°N,{' '}
                      {Math.abs(activeSite.lng).toFixed(3)}°W
                    </dd>
                  </div>
                  <div>
                    <dt>Mean growth volume</dt>
                    <dd>{activeSite.meanGrowth?.toLocaleString() ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Mean temperature</dt>
                    <dd>{activeSite.meanTemp} °C</dd>
                  </div>
                  <div>
                    <dt>Final survival</dt>
                    <dd>{activeSite.finalSurvival}%</dd>
                  </div>
                  <div>
                    <dt>Records</dt>
                    <dd>{activeSite.recordCount.toLocaleString()}</dd>
                  </div>
                </dl>
                <Link
                  to={`/?site=${encodeURIComponent(activeSite.site)}`}
                  className="map-detail-link"
                >
                  Open dashboard for {activeSite.site} →
                </Link>
              </>
            ) : (
              <p className="map-detail-placeholder">
                Select a site on the map or from the list below to view
                geographic and monitoring summary data.
              </p>
            )}
          </div>

          <div className="site-card-list">
            {siteSummaries.map((site) => (
              <button
                key={site.site}
                type="button"
                className={
                  selectedSite === site.site
                    ? 'site-list-card card active'
                    : 'site-list-card card'
                }
                onClick={() => setSelectedSite(site.site)}
              >
                <span
                  className="site-list-dot"
                  style={{ backgroundColor: site.color }}
                  aria-hidden="true"
                />
                <div className="site-list-info">
                  <span className="site-list-name">{site.site}</span>
                  <span className="site-list-region">{site.region}</span>
                </div>
                <span className="site-list-survival">
                  {site.finalSurvival}% surv.
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
