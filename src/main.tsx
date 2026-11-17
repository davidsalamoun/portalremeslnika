import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AuthGate} from './components/AuthGate.tsx';
import {PrivacyPolicyHost} from './components/PrivacyPolicy.tsx';
import {TermsOfUseHost} from './components/TermsOfUse.tsx';
import './fonts.css';
import './index.css';

// Service worker (jen v produkčním buildu): aplikace se po prvním načtení otevře i bez signálu
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker se nepodařilo zaregistrovat', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <>
    <AuthGate>
      <App />
    </AuthGate>
    <PrivacyPolicyHost />
    <TermsOfUseHost />
  </>
);
