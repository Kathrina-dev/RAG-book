import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider, ToastProvider } from './context.jsx';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found. Check index.html.');

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>
);
