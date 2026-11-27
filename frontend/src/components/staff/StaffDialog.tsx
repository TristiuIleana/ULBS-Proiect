import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function StaffDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="card staff-dialog" aria-labelledby="staff-dialog-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="staff-row">
      <h2 id="staff-dialog-title">{title}</h2>
      <button type="button" className="secondary-button" onClick={onClose}>Închide</button>
    </header>
    {children}
  </dialog>;
}
