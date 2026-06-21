import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import LiveDataPage from './pages/LiveDataPage';
import MapPage from './pages/MapPage';
import ResearchPage from './pages/ResearchPage';
import { mockShellfishData } from './data/mockShellfishData';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/live-data" element={<LiveDataPage />} />
        </Routes>
        <footer className="dashboard-footer">
          <p>
            SHIELD · Shellfish Hardening and Integrated Environmental
            Longitudinal Dashboard · Real field data — RobertsLab
            project-gigas-conditioning + Baywater 10K-Seed ·{' '}
            {mockShellfishData.length.toLocaleString()} observation records ·{' '}
            <a
              href="https://github.com/sr320/mock-farm-dashboard-03"
              target="_blank"
              rel="noreferrer"
            >
              GitHub repository
            </a>
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
