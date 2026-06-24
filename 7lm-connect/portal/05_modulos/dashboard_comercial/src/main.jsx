import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installPortalFetch } from './portalFetch.js';
import { FiltersProvider } from './contexts/FiltersContext.jsx';
import './index.css';

installPortalFetch();

createRoot(document.getElementById('dashboardComercialRoot') || document.getElementById('root')).render(
  <StrictMode>
    <FiltersProvider>
      <App />
    </FiltersProvider>
  </StrictMode>,
);
