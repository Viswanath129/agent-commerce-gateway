import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App.js';
import { AppProviders } from './app/providers.js';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/motion.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </React.StrictMode>
  );
}
