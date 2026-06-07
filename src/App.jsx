import { useState, useMemo } from 'react';
import Header from './components/Header';
import Filters from './components/Filters';
import SummaryCards from './components/SummaryCards';
import TimeSeriesChart from './components/TimeSeriesChart';
import TreatmentComparisonChart from './components/TreatmentComparisonChart';
import SiteComparisonChart from './components/SiteComparisonChart';
import DataTable from './components/DataTable';
import {
  mockShellfishData,
  filterData,
  computeSummaryStats,
  getTimeSeriesData,
  getTreatmentComparisonData,
  getSiteComparisonData,
} from './data/mockShellfishData';

const DEFAULT_FILTERS = {
  site: 'All Sites',
  treatment: 'All Treatments',
  metric: 'Growth',
  year: 'All Years',
};

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const filteredData = useMemo(
    () => filterData(mockShellfishData, filters),
    [filters]
  );

  const summaryStats = useMemo(
    () => computeSummaryStats(filteredData),
    [filteredData]
  );

  const timeSeriesData = useMemo(
    () => getTimeSeriesData(filteredData, filters.metric),
    [filteredData, filters.metric]
  );

  const treatmentSurvivalData = useMemo(
    () => getTreatmentComparisonData(filteredData, 'survival'),
    [filteredData]
  );

  const treatmentGrowthData = useMemo(
    () => getTreatmentComparisonData(filteredData, 'growth'),
    [filteredData]
  );

  const siteGrowthData = useMemo(
    () => getSiteComparisonData(filteredData, 'growth'),
    [filteredData]
  );

  const siteSurvivalData = useMemo(
    () => getSiteComparisonData(filteredData, 'survival'),
    [filteredData]
  );

  const siteTempData = useMemo(
    () => getSiteComparisonData(filteredData, 'temperature'),
    [filteredData]
  );

  return (
    <div className="app">
      <Header />
      <main className="dashboard-main">
        <Filters filters={filters} onChange={setFilters} />
        <SummaryCards stats={summaryStats} />
        <TimeSeriesChart data={timeSeriesData} metric={filters.metric} />
        <div className="charts-row">
          <TreatmentComparisonChart
            survivalData={treatmentSurvivalData}
            growthData={treatmentGrowthData}
          />
          <SiteComparisonChart
            growthData={siteGrowthData}
            survivalData={siteSurvivalData}
            tempData={siteTempData}
          />
        </div>
        <DataTable data={filteredData} />
      </main>
      <footer className="dashboard-footer">
        <p>
          Shellfish Farm Outplant Dashboard · Simulated data ·{' '}
          {mockShellfishData.length.toLocaleString()} total records
        </p>
      </footer>
    </div>
  );
}
