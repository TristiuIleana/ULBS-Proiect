import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/plus-jakarta-sans';
import { BookingWizardPage } from './pages/public/BookingWizardPage';
import { ClientAccountPage } from './pages/public/ClientAccountPage';
import { ManageBookingPage } from './pages/public/ManageBookingPage';
import { WaitlistOfferPage } from './pages/public/WaitlistOfferPage';
import './styles.css';

function App() {
  const [dark, setDark] = useState(() => {
    const remembered = sessionStorage.getItem('beauty-theme');
    return remembered ? remembered === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    sessionStorage.setItem('beauty-theme', dark ? 'dark' : 'light');
  }, [dark]);
  const path = location.pathname;
  return <>
    <div className="public-toolbar">
      <button type="button" className="secondary-button" onClick={() => setDark(current => !current)}>
        {dark ? '☀ Mod luminos' : '☾ Mod întunecat'}
      </button>
    </div>
    {path === '/cont' ? <ClientAccountPage /> : path === '/programare' ? <ManageBookingPage /> :
      path === '/oferta' ? <WaitlistOfferPage /> : <BookingWizardPage />}
  </>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
