import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// In development, unregister any existing service worker to prevent HMR reload loops on localhost!
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[FFP Service Worker] Registered:', reg.scope))
        .catch(err => console.warn('[FFP Service Worker]:', err.message));
    });
  }
}

// Block Vite dev server automatic reload when in offline mode
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', () => {
    if (window.__FFP_IS_OFFLINE) {
      console.warn('[FFP] Automatic dev server reload blocked in offline mode to protect user data.');
      return false;
    }
  });
}

