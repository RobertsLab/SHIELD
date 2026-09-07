import { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import DataStatus from './components/DataStatus';
import { OBSERVATIONS_KEY, usePeekResource } from './data/resources';

// Route-level code splitting: the map and live-data routes pull in Leaflet,
// and the dashboard pulls in Recharts; none of that is needed on the others.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LiveDataPage = lazy(() => import('./pages/LiveDataPage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage'));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

function Footer() {
  // Peek rather than load: the footer should not pull the observation
  // bundles onto routes that do not otherwise need them.
  const observations = usePeekResource(OBSERVATIONS_KEY);
  const recordCount = observations.status === 'ready' ? observations.data.records.length : null;

  return (
    <footer className="dashboard-footer">
      <p>
        SHIELD · Shellfish Hardening and Integrated Environmental Longitudinal
        Dashboard · Real field data from RobertsLab project-gigas-conditioning,
        10K-Seed, and polyIC-larvae outputs
        {recordCount != null ? ` · ${recordCount.toLocaleString()} observation records` : ''}
        {' '}· <Link to="/research">Research background</Link> ·{' '}
        <a
          href="https://github.com/RobertsLab/SHIELD"
          target="_blank"
          rel="noreferrer"
        >
          GitHub repository
        </a>
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <div className="app">
        <Header />
        <Suspense
          fallback={
            <main className="dashboard-main">
              <DataStatus status="loading" label="page" />
            </main>
          }
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/live-data" element={<LiveDataPage />} />
          </Routes>
        </Suspense>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
