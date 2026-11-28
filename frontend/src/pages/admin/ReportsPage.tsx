import { useEffect, useState } from 'react';
import { request } from '../../booking-api';
import { staffError } from '../../staff-api';

const periods = {
  week: 'Săptămâna curentă',
  month: 'Luna curentă',
  quarter: 'Ultimele 3 luni',
} as const;
type Period = keyof typeof periods;
type Group = { id: string; label: string; completed: number; netBani: number };
type Report = {
  first: string; last: string;
  specialists: { id: string; firstName: string }[];
  kpis: { netBani: number; completed: number; noShows: number; cancelled: number; discounted: number; discountBani: number };
  breakdowns: { categories: Group[]; services: Group[]; specialists: Group[] };
};
const tables = [
  { key: 'categories', title: 'Categorii', column: 'Categorie' },
  { key: 'services', title: 'Servicii', column: 'Serviciu' },
  { key: 'specialists', title: 'Performanță pe specialiste', column: 'Specialistă' },
] as const;
const currency = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' });
const percent = new Intl.NumberFormat('ro-RO', { style: 'percent', maximumFractionDigits: 1 });
const civilDay = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'long', timeZone: 'UTC' });
const money = (bani: number) => currency.format(bani / 100);
const ratio = (value: number, total: number) => total ? percent.format(value / total) : '—';
const formatDate = (date: string) => civilDay.format(new Date(`${date}T00:00:00Z`));

function indicators({ netBani, completed, noShows, cancelled, discounted, discountBani }: Report['kpis']) {
  return [
    ['Încasări totale', money(netBani), 'După reduceri'],
    ['Programări finalizate', completed, 'În perioada selectată'],
    ['Rată de prezentare', ratio(completed, completed + noShows), `${noShows} ${noShows === 1 ? 'neprezentare' : 'neprezentări'}`],
    ['Rată de anulare', ratio(cancelled, completed + noShows + cancelled), `${cancelled} ${cancelled === 1 ? 'anulare' : 'anulări'}`],
    ['Reduceri Fidelizare −10%', discounted, money(discountBani)],
  ] as const;
}

function rowValues(row: Group, total: number) {
  return [row.label, row.completed, money(row.netBani), ratio(row.netBani, total)] as const;
}

function exportCsv(report: Report, range: string, specialist: string) {
  const rows = [['Perioadă', range], ['Specialistă', specialist], [],
    ['Indicator', 'Valoare', 'Detalii'], ...indicators(report.kpis),
    ...tables.flatMap(table => [[], [table.title], [table.column, 'Finalizări', 'Venit net', 'Pondere'],
      ...report.breakdowns[table.key].map(row => rowValues(row, report.kpis.netBani))])];
  const csv = rows.map(row => row.map(value => {
    const cell = String(value);
    const literal = typeof value === 'string' && /^([\t\r\n]|\s*[=+\-@])/.test(cell) ? `'${cell}` : cell;
    return `"${literal.replaceAll('"', '""')}"`;
  }).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `raport-beauty-studio-${report.first}_${report.last}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [specialistId, setSpecialist] = useState('');
  const [report, setReport] = useState<Report>();
  const [specialists, setSpecialists] = useState<Report['specialists']>([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const query = new URLSearchParams({ period, ...(specialistId ? { specialistId } : {}) });
    setReport(undefined);
    setError('');
    request<Report>(`/api/staff/reports?${query}`, { signal: abort.signal }).then(result => {
      if (!abort.signal.aborted) {
        setSpecialists(result.specialists);
        setReport(result);
      }
    }).catch(failure => { if (!abort.signal.aborted) setError(staffError(failure)); });
    return () => abort.abort();
  }, [period, specialistId, revision]);

  const range = report && `${formatDate(report.first)} – ${formatDate(report.last)}`;
  const specialist = specialists.find(person => person.id === specialistId)?.firstName ?? 'Ambele specialiste';
  const totals = report?.kpis;
  return <main className="staff-page staff-reception staff-report">
    <header>
      <h1>Rapoarte Admin</h1>
      <p>{range && `${range} · ${specialist} · `}Europe/Bucharest</p>
    </header>
    <div className="staff-row report-controls">
      <div className="staff-controls">
        <label className="field">Perioadă
          <select value={period} onChange={event => { setReport(undefined); setPeriod(event.target.value as Period); }}>
            {Object.entries(periods).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="field">Specialistă
          <select value={specialistId} onChange={event => { setReport(undefined); setSpecialist(event.target.value); }}>
            <option value="">Ambele specialiste</option>
            {specialists.map(person => <option key={person.id} value={person.id}>{person.firstName}</option>)}
          </select>
        </label>
      </div>
      <div className="staff-controls">
        <button className="secondary-button" disabled={!report}
          onClick={() => { if (report && range) exportCsv(report, range, specialist); }}>Export CSV</button>
        <button className="secondary-button" disabled={!report} onClick={() => window.print()}>Salvare ca PDF</button>
      </div>
    </div>
    {error && <p className="staff-error" role="alert">{error}{' '}
      <button className="secondary-button" onClick={() => setRevision(value => value + 1)}>Reîncearcă</button></p>}
    {!report && !error && <p role="status">Se încarcă raportul…</p>}
    {report && totals && <>
      {!totals.completed && !totals.noShows && !totals.cancelled &&
        <p className="staff-empty">Nicio programare eligibilă pentru raport în perioada selectată.</p>}
      <dl className="report-kpis" aria-label="Indicatori">
        {indicators(totals).map(([label, value, details]) => <div key={label} className="card">
          <dt>{label}</dt><dd>{value}</dd><dd className="report-detail">{details}</dd>
        </div>)}
      </dl>
      {tables.map(({ key, title, column }) => <section className="card report-table" key={key}>
        <h2 id={`report-${key}`}>{title}</h2>
        <table aria-labelledby={`report-${key}`}>
          <thead><tr>{[column, 'Finalizări', 'Venit net', 'Pondere'].map(label =>
            <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{report.breakdowns[key].map(row => {
            const [label, completed, net, share] = rowValues(row, totals.netBani);
            return <tr key={row.id}><th scope="row">{label}</th><td>{completed}</td>
              <td>{net}</td><td>{share}</td></tr>;
          })}</tbody>
        </table>
      </section>)}
    </>}
  </main>;
}
