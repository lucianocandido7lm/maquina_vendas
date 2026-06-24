import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installPortalFetch } from './portalFetch.js';
import './styles.css';

installPortalFetch();

createRoot(document.getElementById('comissionamentoRoot') || document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
