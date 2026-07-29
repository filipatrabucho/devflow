import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { applyBrandingCssVars, applyBrandingMeta, loadBrandingOverrides } from './branding.js';
import './styles/index.css';

await loadBrandingOverrides();
applyBrandingCssVars();
applyBrandingMeta();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
