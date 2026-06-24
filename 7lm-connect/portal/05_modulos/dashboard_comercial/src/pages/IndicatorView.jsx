import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import IndicatorDetailPanel from '../components/indicator/IndicatorDetailPanel';
import IndicatorExecutiveSummary from '../components/indicator/IndicatorExecutiveSummary';
import IndicatorHeader from '../components/indicator/IndicatorHeader';
import IndicatorPageLayout from '../components/indicator/IndicatorPageLayout';
import { useFilters } from '../contexts/FiltersContext';
import { getIndicatorById } from '../data/indicatorCatalog';
import './IndicatorView.css';

const IndicatorDashboardTab = ({ indicator, activeFilterLabels }) => {
  return (
    <div className="indicator-tab-content">
      <IndicatorExecutiveSummary indicator={indicator} activeFilterLabels={activeFilterLabels} />
    </div>
  );
};

const IndicatorDetailTab = ({ indicator, activeFilterLabels }) => {
  return (
    <div className="indicator-tab-content">
      <IndicatorExecutiveSummary indicator={indicator} activeFilterLabels={activeFilterLabels} />
      <IndicatorDetailPanel indicator={indicator} activeFilterLabels={activeFilterLabels} />
    </div>
  );
};

const IndicatorView = () => {
  const { indicatorId } = useParams();
  const indicator = getIndicatorById(indicatorId);
  const { activeFilterLabels } = useFilters();

  if (!indicator) {
    return <Navigate to="/" replace />;
  }

  return (
    <IndicatorPageLayout>
      <IndicatorHeader indicator={indicator} activeFilterLabels={activeFilterLabels} />

      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={<IndicatorDashboardTab indicator={indicator} activeFilterLabels={activeFilterLabels} />}
        />
        <Route
          path="detalhamento"
          element={<IndicatorDetailTab indicator={indicator} activeFilterLabels={activeFilterLabels} />}
        />
      </Routes>
    </IndicatorPageLayout>
  );
};

export default IndicatorView;
