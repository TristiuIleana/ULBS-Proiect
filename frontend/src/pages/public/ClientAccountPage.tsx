import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ApiError, fetchAccount, post } from '../../booking-api';
import type { Account, AccountBooking } from '../../booking-api';
import { ContactFields, emptyContact, errorMessage, price, salonTimeZone } from '../../components/public/BookingControls';

const time = new Intl.DateTimeFormat('ro-RO', { timeZone: salonTimeZone, timeStyle: 'short' });
const day = new Intl.DateTimeFormat('ro-RO', { timeZone: salonTimeZone, day: '2-digit' });
const month = new Intl.DateTimeFormat('ro-RO', { timeZone: salonTimeZone, month: 'short' });
const since = new Intl.DateTimeFormat('ro-RO', { timeZone: salonTimeZone, month: 'long', year: 'numeric' });
const status = { PENDING_CONFIRMATION: 'În așteptarea confirmării', CONFIRMED: '● Confirmată',
  CANCELLED: 'Anulată', COMPLETED: '✓ Finalizată', NO_SHOW: 'Neprezentare' };

function BookingList({ title, bookings, upcoming }: { title: string; bookings: AccountBooking[]; upcoming?: boolean }) {
  return <section className="account-bookings">
    <div className="section-title"><h2>{title}</h2><span className="count-badge">{bookings.length}</span></div>
    {!bookings.length && <p className="card">{upcoming ? 'Nu ai programări viitoare.' : 'Nu ai programări în istoric.'}</p>}
    {bookings.map(booking => {
      const date = new Date(booking.startTime);
      const discounted = Number(booking.loyaltyDiscountRon) > 0;
      return <article className={`appointment-card ${discounted ? 'has-discount' : ''}`} key={booking.id}>
        <div className="appointment-date"><strong>{day.format(date)}</strong><span>{month.format(date)}</span></div>
        <div className="appointment-copy"><strong>{booking.service.name}</strong><p>{booking.specialist.firstName}</p>
          {discounted && <span className="discount-tag">★ −10% fidelizare</span>}
          {upcoming && <a className="text-link" href={`/programare?id=${booking.id}`}>Gestionează programarea</a>}
        </div>
        <div className="appointment-price">
          <span>{time.format(date)}</span>
          <strong>{discounted && <del>{price(Number(booking.totalPriceRon) + Number(booking.loyaltyDiscountRon))}</del>} {price(booking.totalPriceRon)}</strong>
          <span className={`status-chip ${booking.status.toLowerCase()}`}>{status[booking.status]}</span>
        </div>
      </article>;
    })}
  </section>;
}

export function ClientAccountPage() {
  const [account, setAccount] = useState<Account | null>();
  const [verifyToken, setVerifyToken] = useState(() => new URLSearchParams(location.search).get('token'));
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [contact, setContact] = useState(emptyContact);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const loginTab = useRef<HTMLButtonElement>(null);
  const registerTab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccount(controller.signal).then(data => {
      if (!controller.signal.aborted) setAccount(data);
    }).catch(error => {
      if (!controller.signal.aborted) {
        setAccount(null);
        if (!(error instanceof ApiError && error.status === 401)) setError('Contul nu s-a putut încărca.');
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (account) heading.current?.focus();
  }, [account]);

  function selectMode(value: 'login' | 'register') {
    setMode(value);
    setError('');
    setMessage('');
    setPassword('');
  }

  function tabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' || (event.key !== 'End' && mode === 'register') ? 'login' : 'register';
    selectMode(target);
    (target === 'login' ? loginTab : registerTab).current?.focus();
  }

  async function action(operation: () => Promise<void>) {
    setError('');
    setMessage('');
    setPending(true);
    try {
      await operation();
    } catch (error) {
      setError(errorMessage(error, 'Operația nu a putut fi finalizată. Reîncearcă.'));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action(async () => {
      if (mode === 'register') {
        await post('/api/client/register', { ...contact, password });
        setMessage('Ți-am trimis un e-mail. Deschide linkul pentru a activa contul și a vedea programările asociate.');
      } else {
        await post('/api/client/login', { email, password });
        setAccount(await fetchAccount());
      }
      setPassword('');
    });
  }

  if (account && !verifyToken) return <main className="account-page">
    <div className="account-toolbar"><a href="/" className="text-link">Înapoi la rezervare</a>
      <button type="button" className="secondary-button" disabled={pending} onClick={() => void action(async () => {
        await post('/api/client/logout');
        setAccount(null);
      })}>Deconectare</button></div>
    <header className="account-title"><h1 ref={heading} tabIndex={-1}>Contul meu și fidelizare</h1>
      <p>Bine ai revenit, <strong>{account.firstName}</strong>!</p></header>
    {error && <p className="feedback error" role="alert">{error}</p>}
    <div className="card profile-card">
      <span className="profile-avatar" aria-hidden="true">{account.firstName.charAt(0)}{account.lastName.charAt(0)}</span>
      <div><strong>{account.firstName} {account.lastName}</strong><p>{account.email} · {account.phone}</p>
        <p>Clientă din {since.format(new Date(account.createdAt))}</p></div>
    </div>
    {account.blocked && <p className="feedback error" role="alert">Rezervarea online este blocată. Contactează salonul pentru deblocare.</p>}
    <section className="card loyalty-card">
      <div className="loyalty-header"><strong>✦ Program Fidelizare</strong><span className="discount-badge">🎁 −10% la a 5-a vizită</span></div>
      <div className="loyalty-progress">
        <div className="progress-ring" role="img" aria-label={`${account.progress} din 5 vizite`}>
          <svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="40" className="progress-bg"/>
            <circle cx="48" cy="48" r="40" pathLength="5" strokeDasharray={`${account.progress} 5`} className="progress-fill"/></svg>
          <div aria-hidden="true"><strong>{account.progress}<small>/5</small></strong><span>vizite</span></div>
        </div>
        <div><h3>{account.progress === 4 ? 'Încă o vizită! 🎉' : 'Progresul tău'}</h3>
          <p>Ai completat <strong>{account.progress} din 5</strong> vizite din ciclul curent.</p></div>
      </div>
      <div className="loyalty-steps" aria-hidden="true">{Array.from({ length: 5 }, (_, index) =>
        <span key={index} className={index < account.progress ? 'filled' : index === 4 ? 'reward' : ''} />)}</div>
      <div className="loyalty-labels"><span>Vizita 1</span><span>Vizita 5 · −10%</span></div>
      {account.progress === 4 && <p className="discount-callout">💎 Reducerea de <strong>10%</strong> se aplică automat programării eligibile.</p>}
      {!account.blocked && <a href="/" className="primary-button">{account.nextDiscount ? 'Programare nouă cu −10%' : 'Programează o vizită'}</a>}
    </section>
    <BookingList title="Programări Viitoare" bookings={account.upcoming} upcoming />
    <BookingList title="Istoric Programări" bookings={account.history} />
  </main>;

  return <main className="access-page"><section className="card auth-card" aria-labelledby="auth-title">
    <header className="account-title"><h1 id="auth-title">Acces client</h1><p>Beauty Studio</p></header>
    {verifyToken ? <div className="auth-form">
      <p>Confirmă adresa pentru a activa contul și a accesa programările asociate.</p>
      <button className="primary-button" type="button" disabled={pending} onClick={() => void action(async () => {
        await post('/api/client/verify', { token: verifyToken });
        history.replaceState(null, '', '/cont');
        setVerifyToken(null);
        setAccount(await fetchAccount());
      })}>{pending ? 'Se confirmă…' : 'Confirmă adresa'}</button>
    </div> : account === undefined ? <p role="status">Se încarcă…</p> : <>
      <div className="auth-tabs" role="tablist" aria-labelledby="auth-title" onKeyDown={tabKey}>
        <button ref={loginTab} type="button" id="login-tab" role="tab" aria-controls="auth-panel" aria-selected={mode === 'login'}
          tabIndex={mode === 'login' ? 0 : -1} disabled={pending} onClick={() => selectMode('login')}>Autentificare</button>
        <button ref={registerTab} type="button" id="register-tab" role="tab" aria-controls="auth-panel" aria-selected={mode === 'register'}
          tabIndex={mode === 'register' ? 0 : -1} disabled={pending} onClick={() => selectMode('register')}>Creează cont nou</button>
      </div>
      <div id="auth-panel" role="tabpanel" aria-labelledby={`${mode}-tab`}>
        <form className="auth-form" onSubmit={submit}>
          <fieldset disabled={pending}>
            {mode === 'register' ? <ContactFields value={contact} change={setContact} /> :
              <label className="field">E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)}
                autoComplete="username" maxLength={254} required /></label>}
            <label className="field">Parolă<input type="password" value={password} onChange={event => setPassword(event.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : undefined}
              maxLength={128} required /></label>
          </fieldset>
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? 'Se trimite…' : mode === 'login' ? 'Intră în cont' : 'Creează cont'}
          </button>
        </form>
      </div>
    </>}
    {error && <p className="feedback error" role="alert">{error}</p>}
    {message && <p className="waitlist-success" role="status">{message}</p>}
    <a href="/" className="text-link">Înapoi la rezervare</a>
  </section></main>;
}
