import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { applyTheme, watchSystemTheme } from './lib/theme.js';

applyTheme();
watchSystemTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable + works offline for the app shell. Data always comes fresh from the server.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  });
}
