import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Filters from '../components/Filters';
import FieldReportExport from '../components/FieldReportExport';
import SummaryCards from '../components/SummaryCards';
import TimeSeriesChart from '../components/TimeSeriesChart';
import ArchivalTemperatureChart from '../components/ArchivalTemperatureChart';
import TreatmentComparisonChart from '../components/TreatmentComparisonChart';
import SiteComparisonChart from '../components/SiteComparisonChart';
import DataTable from '../components/DataTable';
import DataStatus from '../components/DataStatus';
import { useObservations } from '../data/resources';
import {
  filterData,
  computeSummaryStats,
  getTimeSeriesData,
  getTreatmentComparisonData,
  getSiteComparisonData,
} from '../data/observations';

const DEFAULT_FILTERS = {
  site: 'All Sites',
  treatment: 'All Treatments',
  metric: 'Growth Volume',
  year: 'All Years',
};

const EMPTY = [];

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const observations = useObservations();
  const dataset = observations.data;
  const records = dataset?.records ?? EMPTY;
  const sites = dataset?.sites ?? EMPTY;
  const treatments = dataset?.treatments ?? EMPTY;
  const years = dataset?.years ?? EMPTY;

  useEffect(() => {
    const siteParam = searchParams.get('site');
    if (siteParam && sites.includes(siteParam)) {
      setFilters((prev) => ({ ...prev, site: siteParam }));
    }
  }, [searchParams, sites]);

  const filteredData = useMemo(() => filterData(records, filters), [records, filters]);

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
    () => getSiteComparisonData(filteredData, 'growth', sites),
    [filteredData, sites]
  );

  const siteSurvivalData = useMemo(
    () => getSiteComparisonData(filteredData, 'survival', sites),
    [filteredData, sites]
  );

  const siteTempData = useMemo(
    () => getSiteComparisonData(filteredData, 'temperature', sites),
    [filteredData, sites]
  );

  if (observations.status !== 'ready') {
    return (
      <main className="dashboard-main">
        <DataStatus
          status={observations.status}
          error={observations.error}
          retry={observations.retry}
          label="field observations"
        />
        <ArchivalTemperatureChart />
      </main>
    );
  }

  return (
    <main className="dashboard-main">
      <Filters
        filters={filters}
        onChange={setFilters}
        sites={sites}
        treatments={treatments}
        years={years}
      />
      <SummaryCards stats={summaryStats} />
      <TimeSeriesChart data={timeSeriesData} metric={filters.metric} />
      <ArchivalTemperatureChart />
      <div className="charts-row">
        <TreatmentComparisonChart
          survivalData={treatmentSurvivalData}
          growthData={treatmentGrowthData}
          treatments={treatments}
        />
        <SiteComparisonChart
          growthData={siteGrowthData}
          survivalData={siteSurvivalData}
          tempData={siteTempData}
        />
      </div>
      <DataTable data={filteredData} />
      <FieldReportExport
        filters={filters}
        stats={summaryStats}
        data={filteredData}
      />
    </main>
  );
}
