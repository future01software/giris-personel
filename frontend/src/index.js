import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { ThemeProvider } from './contexts/ThemeContext';

import * as serviceWorkerRegistration from './serviceWorkerRegistration';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// ✅ Firebase'te service-worker.js yanlış MIME ile dönüyorsa register hata verir.
// ✅ PWA şart değilse en temiz çözüm: kapat.
serviceWorkerRegistration.unregister();
