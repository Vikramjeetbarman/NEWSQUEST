import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/oswald';
import '@fontsource/unifrakturmaguntia';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { LiveProvider } from './contexts/LiveContext';
import { ToastProvider } from './contexts/ToastContext';
import './index.css';
import { paintFavicon } from './lib/favicon';

paintFavicon();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LiveProvider>
              <App />
            </LiveProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);