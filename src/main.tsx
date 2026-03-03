import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Suppress three.js r183+ deprecation warnings about THREE.Clock that come from @react-three/fiber internally
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes && args[0].includes('THREE.Clock: This module has been deprecated')) return;
  originalWarn(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
