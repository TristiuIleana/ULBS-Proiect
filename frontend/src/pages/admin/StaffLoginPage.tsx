import { useState } from 'react';
import { StaffLoginForm } from '../../components/staff/StaffLoginForm';

export function StaffLoginPage() {
  const [busy, setBusy] = useState(false);

  return <main className="staff-login">
    <section className="card studio-header">
      <span className="staff-brand">Beauty Studio</span>
      <h1>Autentificare personal</h1>
      <StaffLoginForm className="staff-form" busy={busy} setBusy={setBusy} />
    </section>
  </main>;
}
