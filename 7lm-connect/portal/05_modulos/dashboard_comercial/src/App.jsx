import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const BISelector = lazy(() => import('./pages/BISelector'));
const IndicatorView = lazy(() => import('./pages/IndicatorView'));
const GoalSettings = lazy(() => import('./pages/GoalSettings'));
const CorretorAnalytics = lazy(() => import('./pages/CorretorAnalytics'));
const ReservasBI = lazy(() => import('./pages/ReservasBI'));
const FunnelDashboard = lazy(() => import('./pages/FunnelDashboard'));

const THEME_STORAGE_KEY = 'commercial-dashboard:theme';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const resolvedTheme = savedTheme === 'dark' ? 'dark' : 'light';
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolvedTheme;
  }
  return resolvedTheme;
};

const AppLayout = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const theme = getInitialTheme();
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
    }
  }, []);

  return (
    <div className="page-shell">
      <div className="page-container">
        <main className="page-main">
          <Suspense fallback={<div className="body-sm text-variant">Carregando módulo...</div>}>
            <Routes>
              <Route path="/" element={<BISelector />} />
              <Route path="/geral" element={<Dashboard />} />
              <Route path="/indicadores-gerais" element={<Dashboard />} />
              <Route path="/corretores" element={<CorretorAnalytics />} />
              <Route path="/reservas" element={<ReservasBI />} />
              <Route path="/funil" element={<FunnelDashboard />} />
              <Route path="/indicadores/:indicatorId/*" element={<IndicatorView />} />
              <Route
                path="/settings"
                element={<GoalSettings />}
              />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router basename="/comercial/dashboard">
      <AppLayout />
    </Router>
  );
}

export default App;
