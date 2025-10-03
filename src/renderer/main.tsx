import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './tauri/desktop-bridge';
import './tauri/moonscape-bridge';
import { initializeRendererLogger } from './utils/logger-init';
import './services/wallet-executor-bridge';
import './services/wallet-bridge-renderer';
import './utils/global-error-overlay';

initializeRendererLogger();

try {
const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

const reactRoot = ReactDOM.createRoot(root);

const app = import.meta.env.DEV ? (
  <App />
) : (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reactRoot.render(app);
} catch (error) {
  const pre = document.createElement('pre');
  pre.style.margin = '2rem';
  pre.style.color = '#b91c1c';
  pre.style.fontFamily = 'monospace';
  pre.textContent = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  document.body.appendChild(pre);
}
