import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './shared/theme';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
