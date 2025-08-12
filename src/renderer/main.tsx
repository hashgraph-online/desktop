import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initializeRendererLogger } from './utils/logger-init';

initializeRendererLogger();

try {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element not found');
  }

  const reactRoot = ReactDOM.createRoot(root);

  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  console.error('Error stack:', error.stack);
}
