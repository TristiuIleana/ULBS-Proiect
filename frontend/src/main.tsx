import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/plus-jakarta-sans';
import { BookingWizardPage } from './pages/public/BookingWizardPage';
import { ClientAccountPage } from './pages/public/ClientAccountPage';
import { ConfirmBookingPage } from './pages/public/ConfirmBookingPage';
import { ManageBookingPage } from './pages/public/ManageBookingPage';
import { WaitlistOfferPage } from './pages/public/WaitlistOfferPage';
import { ApiError } from './booking-api';
import { StaffLoginPage } from './pages/admin/StaffLoginPage';
import { getSession, staffLogout, type Staff } from './staff-api';
import './styles.css';

const ReceptionCalendarPage = lazy(() => import('./pages/admin/ReceptionCalendarPage')
  .then(module => ({ default: module.ReceptionCalendarPage })));
const EmployeeCalendarPage = lazy(() => import('./pages/employee/EmployeeCalendarPage')
  .then(module => ({ default: module.EmployeeCalendarPage })));

function StaffArea({ reception }: { reception: boolean }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const verify = () => {
      getSession(abort.signal).then(user => {
        if (reception && user.role !== 'ADMIN') location.replace('/staff/agenda');
        else { setError(''); setStaff(user); }
      }).catch(failure => {
        if (abort.signal.aborted) return;
        setStaff(null);
        if (failure instanceof ApiError && [401, 403].includes(failure.status)) location.replace('/staff/login');
        else setError('Verificarea sesiunii este temporar indisponibilă.');
      });
    };
    verify();
    const revalidate = () => { if (document.visibilityState === 'visible') verify(); };
    document.addEventListener('visibilitychange', revalidate);
    return () => { abort.abort(); document.removeEventListener('visibilitychange', revalidate); };
  }, [reception]);

  async function logout() {
    try {
      await staffLogout();
      setStaff(null);
      location.replace('/staff/login');
    } catch {
      setError('Deconectarea a eșuat. Încearcă din nou.');
    }
  }

  return <>
    {staff && <nav className="staff-nav" aria-label="Navigare personal">
      <a className="secondary-button staff-download" href="/staff/agenda" aria-current={!reception ? 'page' : undefined}>Agenda mea</a>
      {staff.role === 'ADMIN' && <a className="secondary-button staff-download"
        href="/staff/receptie" aria-current={reception ? 'page' : undefined}>Recepție</a>}
      <button className="secondary-button" onClick={() => void logout()}>Deconectare</button>
    </nav>}
    {error && <p className="staff-error staff-nav" role="alert">{error}</p>}
    {!staff && !error && <p className="staff-nav" role="status">Se verifică sesiunea…</p>}
    {staff && <Suspense fallback={<p className="staff-nav" role="status">Se încarcă agenda…</p>}>
      {reception ? <ReceptionCalendarPage staff={staff} /> : <EmployeeCalendarPage staff={staff} />}
    </Suspense>}
  </>;
}

function App() {
  const [dark, setDark] = useState(() => {
    const remembered = sessionStorage.getItem('beauty-theme');
    return remembered ? remembered === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    sessionStorage.setItem('beauty-theme', dark ? 'dark' : 'light');
  }, [dark]);
  const path = location.pathname.replace(/\/+$/, '');
  return <>
    <div className={path.startsWith('/staff/') ? 'public-toolbar staff-toolbar' : 'public-toolbar'}>
      <button type="button" className="secondary-button" onClick={() => setDark(current => !current)}>
        {dark ? '☀ Mod luminos' : '☾ Mod întunecat'}
      </button>
    </div>
    {path === '/staff/login' ? <StaffLoginPage /> :
      path === '/staff/agenda' || path === '/staff/receptie' ? <StaffArea reception={path === '/staff/receptie'} /> :
      path === '/cont' ? <ClientAccountPage /> : path === '/programare' ? <ManageBookingPage /> :
      path === '/confirmare' ? <ConfirmBookingPage /> :
      path === '/oferta' ? <WaitlistOfferPage /> : <BookingWizardPage />}
  </>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
