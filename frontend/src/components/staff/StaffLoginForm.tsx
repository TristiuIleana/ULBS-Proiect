import { useState, type FormEvent } from 'react';
import { getSession, staffError, staffLogin } from '../../staff-api';

export function StaffLoginForm({ busy, setBusy, className }: {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  className: string;
}) {
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await staffLogin(String(form.get('email')), String(form.get('password')));
      const staff = await getSession();
      location.replace(staff.role === 'ADMIN' ? '/staff/receptie' : '/staff/agenda');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : staffError(failure));
      setBusy(false);
    }
  }

  return <form className={className} onSubmit={submit}>
    <label className="field">E-mail<input name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy} /></label>
    <label className="field">Parolă<input name="password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy} /></label>
    {error && <p className="staff-error" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Se verifică…' : 'Autentifică-te'}</button>
  </form>;
}
