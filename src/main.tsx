import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress known/benign errors that pop up in the development environment
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('WebSocket closed without opened') || 
      event.reason?.message?.includes('failed to connect to websocket')) {
    event.preventDefault();
    console.warn('Suppressed benign HMR WebSocket error');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


