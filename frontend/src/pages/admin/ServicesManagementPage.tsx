import { useEffect, useState, type FormEvent } from 'react';
import { post, request, type Category, type Service } from '../../booking-api';
import { StaffDialog } from '../../components/staff/StaffDialog';
import { price } from '../../components/public/BookingControls';
import { staffError } from '../../staff-api';

type Stage = { name: string; durationMinutes: number; isBusy: boolean };
type CatalogService = Service & { isActive: boolean; isSplit: boolean; stages: Stage[] };
type Draft = Pick<Service, 'name' | 'category' | 'description' | 'priceRon' | 'totalDurationMinutes'> & { stages: Stage[] };
const endpoint = '/api/staff/services';
const categories: Record<Category, string> = { BROWS: 'Sprâncene', MAKEUP: 'Make-up' };
const newDraft: Draft = { name: '', category: 'BROWS', description: '', priceRon: '', totalDurationMinutes: 30,
  stages: [{ name: 'Execuție', durationMinutes: 30, isBusy: true }] };

function updateService(id: string, payload: object) {
  return request<CatalogService>(`${endpoint}/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

function ServiceEditor({ service, onSave, busy, error }: {
  service?: CatalogService; onSave: (draft: Draft) => void; busy: boolean; error: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => service ? {
    name: service.name, category: service.category, description: service.description,
    priceRon: service.priceRon, totalDurationMinutes: service.totalDurationMinutes,
    stages: service.stages.map(({ name, durationMinutes, isBusy }) => ({ name, durationMinutes, isBusy })),
  } : newDraft);
  const sum = draft.stages.reduce((total, stage) => total + stage.durationMinutes, 0);
  function stageChange(index: number, changes: Partial<Stage>) {
    setDraft(value => ({ ...value, stages: value.stages.map((stage, current) =>
      current === index ? { ...stage, ...changes } : stage) }));
  }
  function moveStage(index: number, destination: number) {
    const stages = [...draft.stages];
    const [stage] = stages.splice(index, 1);
    stages.splice(destination, 0, stage);
    setDraft({ ...draft, stages });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy && sum === draft.totalDurationMinutes) onSave(draft);
  }
  return <form className="staff-form" onSubmit={submit}>
    <fieldset className="staff-form" disabled={busy}>
      <label className="field">Nume<input required maxLength={120} value={draft.name}
        onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className="field">Descriere<textarea maxLength={2000} value={draft.description ?? ''}
        onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <div className="staff-fields">
        <label className="field">Categorie<select disabled={Boolean(service)} value={draft.category}
          onChange={event => setDraft({ ...draft, category: event.target.value as Category })}>
          {Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label className="field">Preț (RON)<input required inputMode="decimal" value={draft.priceRon}
          pattern="[0-9]{1,8}([.,][0-9]{1,2})?" onChange={event => setDraft({ ...draft, priceRon: event.target.value })} /></label>
      </div>
      <label className="field">Durată totală (minute)<input required type="number" min={1} step={1}
        value={draft.totalDurationMinutes || ''} onChange={event => setDraft({ ...draft, totalDurationMinutes: Number(event.target.value) })} /></label>
      <h3>Etape de execuție</h3>
      {draft.stages.map((stage, index) => <fieldset key={index} className="staff-form staff-visit">
        <legend>Etapa {index + 1}</legend>
        <label className="field">Numele etapei<input required maxLength={120} value={stage.name}
          onChange={event => stageChange(index, { name: event.target.value })} /></label>
        <div className="staff-fields">
          <label className="field">Minute<input required type="number" min={1} step={1} value={stage.durationMinutes || ''}
            onChange={event => stageChange(index, { durationMinutes: Number(event.target.value) })} /></label>
          <label className="field">Disponibilitatea specialistei
            <select value={stage.isBusy ? 'busy' : 'free'} onChange={event => stageChange(index, { isBusy: event.target.value === 'busy' })}>
              <option value="busy">Ocupată</option><option value="free">Liberă</option>
            </select></label>
        </div>
        <div className="staff-controls">
          <button type="button" className="secondary-button" disabled={index === 0} onClick={() => moveStage(index, index - 1)}>Mută mai sus</button>
          <button type="button" className="secondary-button" disabled={index === draft.stages.length - 1}
            onClick={() => moveStage(index, index + 1)}>Mută mai jos</button>
          <button type="button" className="secondary-button" disabled={draft.stages.length === 1}
            onClick={() => setDraft({ ...draft, stages: draft.stages.filter((_, current) => current !== index) })}>Elimină etapa</button>
        </div>
      </fieldset>)}
      <button type="button" className="secondary-button" onClick={() => setDraft({ ...draft,
        stages: [...draft.stages, { name: '', durationMinutes: 0, isBusy: !draft.stages.at(-1)?.isBusy }],
      })}>Adaugă etapă</button>
      <p className={sum === draft.totalDurationMinutes ? '' : 'staff-full'} role="status">
        {sum} din {draft.totalDurationMinutes} minute configurate. {sum !== draft.totalDurationMinutes &&
          'Suma etapelor trebuie să coincidă cu durata totală.'}
      </p>
    </fieldset>
    {error && <p className="staff-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy || sum !== draft.totalDurationMinutes}>
      {busy ? 'Se salvează…' : 'Salvează serviciul'}
    </button>
  </form>;
}

export function ServicesManagementPage() {
  const [services, setServices] = useState<CatalogService[]>();
  const [category, setCategory] = useState<Category | ''>('');
  const [editor, setEditor] = useState<CatalogService | 'new'>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    request<{ services: CatalogService[] }>(endpoint, { signal: abort.signal })
      .then(response => { if (!abort.signal.aborted) setServices(response.services); })
      .catch(failure => { if (!abort.signal.aborted) setError(staffError(failure)); });
    return () => abort.abort();
  }, [revision]);

  function open(service: CatalogService | 'new') {
    setError('');
    setNotice('');
    setEditor(service);
  }
  async function save(action: () => Promise<CatalogService>, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const service = await action();
      setServices(current => [...(current ?? []).filter(item => item.id !== service.id), service]
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'ro')));
      setEditor(undefined);
      setNotice(message);
    } catch (failure) {
      setError(staffError(failure));
    } finally {
      setBusy(false);
    }
  }
  function saveDraft({ category, ...draft }: Draft) {
    const changes = { ...draft, priceRon: draft.priceRon.replace(',', '.') };
    void save(() => editor && editor !== 'new' ? updateService(editor.id, changes)
      : post<CatalogService>(endpoint, { ...changes, category }), 'Serviciul a fost salvat.');
  }
  const visible = services?.filter(service => !category || service.category === category);
  return <main className="staff-page staff-services">
    <header className="staff-row">
      <div><h1>Gestiunea Serviciilor</h1><p>Catalog, durate și etape de execuție</p></div>
      <button className="primary-button" disabled={busy || !services} onClick={() => open('new')}>Adaugă serviciu</button>
    </header>
    <div className="staff-controls" aria-label="Categorii de servicii">
      {(['', 'BROWS', 'MAKEUP'] as const).map(option => <button key={option} type="button"
        className="secondary-button" aria-pressed={category === option} onClick={() => setCategory(option)}>
        {option ? categories[option] : 'Toate serviciile'}
      </button>)}
    </div>
    {notice && <p className="staff-notice" role="status">{notice}</p>}
    {!editor && error && <p className="staff-error" role="alert">{error}{' '}
      {!services && <button className="secondary-button" onClick={() => { setError(''); setRevision(value => value + 1); }}>Reîncearcă</button>}</p>}
    {!services && !error && <p role="status">Se încarcă serviciile…</p>}
    {visible?.length === 0 && <p className="staff-empty">Nu există servicii pentru filtrul ales.</p>}
    {visible?.map(service => <article className="card staff-workspace service-card" key={service.id}>
      <div className="staff-row">
        <div><h2>{service.name}</h2>
          <span className="staff-badge" data-status={service.isActive ? 'COMPLETED' : 'CANCELLED'}>
            {service.isActive ? 'Activ' : 'Inactiv'}</span>{' '}
          <span className="staff-badge">{categories[service.category]}</span>{' '}
          <span className="staff-badge">{service.isSplit ? 'Split service' : 'Serviciu continuu'}</span>
        </div>
        <div><strong>{price(service.priceRon)}</strong><p>{service.totalDurationMinutes} min</p></div>
      </div>
      {service.description && <p>{service.description}</p>}
      {service.isSplit && <ol className="staff-stages service-stages" aria-label="Etape și ferestre de intercalare">
        {service.stages.map((stage, index) => <li key={index} data-busy={stage.isBusy}
          style={{ flexGrow: stage.durationMinutes }}>
          {stage.name} · {stage.durationMinutes} min · {stage.isBusy ? 'Ocupată' : 'Liberă'}
        </li>)}
      </ol>}
      <div className="staff-controls">
        <button className="secondary-button" disabled={busy} onClick={() => open(service)}>Editează serviciul</button>
        <button className="secondary-button" disabled={busy} onClick={() => void save(
          () => updateService(service.id, { isActive: !service.isActive }),
          service.isActive ? 'Serviciul a fost dezactivat.' : 'Serviciul a fost activat.')}>
          {service.isActive ? 'Dezactivează' : 'Activează'}
        </button>
      </div>
    </article>)}
    {editor && <StaffDialog title={editor === 'new' ? 'Adaugă serviciu' : 'Editează serviciul'}
      onClose={() => { if (!busy) { setEditor(undefined); setError(''); } }}>
      <ServiceEditor service={editor === 'new' ? undefined : editor} busy={busy} error={error} onSave={saveDraft} />
    </StaffDialog>}
  </main>;
}
