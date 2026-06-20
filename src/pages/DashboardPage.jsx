import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Filters from '../components/Filters';
import SummaryCards from '../components/SummaryCards';
import TimeSeriesChart from '../components/TimeSeriesChart';
import ArchivalTemperatureChart from '../components/ArchivalTemperatureChart';
import TreatmentComparisonChart from '../components/TreatmentComparisonChart';
import SiteComparisonChart from '../components/SiteComparisonChart';
import DataTable from '../components/DataTable';
import {
  mockShellfishData,
  SITES,
  filterData,
  computeSummaryStats,
  getTimeSeriesData,
  getTreatmentComparisonData,
  getSiteComparisonData,
} from '../data/mockShellfishData';

const DEFAULT_FILTERS = {
  site: 'All Sites',
  treatment: 'All Treatments',
  metric: 'Growth',
  year: 'All Years',
};

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    const siteParam = searchParams.get('site');
    if (siteParam && SITES.includes(siteParam)) {
      setFilters((prev) => ({ ...prev, site: siteParam }));
    }
  }, [searchParams]);

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
    <main className="dashboard-main">
      <Filters filters={filters} onChange={setFilters} />
      <SummaryCards stats={summaryStats} />
      <TimeSeriesChart data={timeSeriesData} metric={filters.metric} />
      <ArchivalTemperatureChart />
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
  );
}
