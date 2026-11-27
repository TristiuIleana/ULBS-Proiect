# Plan — Sprintul 4 · Acces personal, recepție și export calendar

**Stare** · Propus spre aprobare, 27 noiembrie 2026. Regulile funcționale Q-010–Q-012 sunt confirmate. Propunerile de decizie și reviziile de design rămân la aprobare înainte de `/build`.

**Bază** · `main` sincronizat la `614dfcd`. Branch `feat/sprint-4-staff-reception`.

## Dimensiune

**L** · Acces intern cu migrare de date și sesiuni, două vizualizări de calendar, operații tranzacționale de recepție, Waitlist și export interoperabil.

## Abordare

În NestJS, un modul de acces validează identitatea personalului, iar controlerele interne aplică permisiunea agendei proprii, a recepției sau a operației Admin. Calendarul React folosește același model de interval și aceleași rezultate de disponibilitate ca Serverul. Crearea și modificarea refolosesc tranzacțiile, etapele și regulile de disponibilitate existente, iar exportul refolosește filtrarea autorizată a calendarului. FullCalendar acoperă afișarea pe zi și săptămână conform D-002, cu pachetele necesare pentru aceste vizualizări și fusul studioului.

### Acces și seed

- Cele două identități fixe sunt `ioana@admin.com` (Ioana, `ADMIN`, `BROWS`) și `ana@admin.com` (Ana, `SPECIALIST`, `MAKEUP`). Serverul verifică lista exactă după normalizarea adresei și verifică rolul și categoria persistate la fiecare cerere internă. Ambele adrese sunt rezervate și la înregistrarea publică. Loginul, verificarea și sesiunile clientelor cer `CLIENT`.
- Pe o bază nouă seed-ul creează ambele conturi. La upgrade redenumește tranzacțional conturile seed-uite anterior, păstrând ID-urile, programul, excepțiile, programările și referințele Waitlist. Validează ambele parole înainte de a scrie. O coliziune de adresă, inclusiv cu altă capitalizare, oprește schimbarea de identitate și se rezolvă înainte de rerulare. Rularea cu aceleași parole păstrează accesul configurat, iar schimbarea parolei revocă sesiunile contului. Sesiunile de client ale vechilor conturi de personal se invalidează la migrare.
- `IOANA_SEED_PASSWORD` și `ANA_SEED_PASSWORD` sunt valori obligatorii și stabile între rulări, în fișierul local ignorat `.env.staff`. Documentația de dezvoltare descrie exact câmpurile, locul de configurare și comanda `docker compose run --rm --env-from-file .env.staff server npm run prisma:seed`. Documentația folosește substituenți pentru valori. Seed-ul reutilizează funcția de hash cu salt deja folosită de conturile clientelor. Configurația intră doar în containerul de seed, iar porturile, healthcheckul și configurația serviciilor rămân conform C-001.
- Propunerea de API include `POST /api/staff/login`, `GET /api/staff/session` și `POST /api/staff/logout`. Loginul are validare strictă, răspuns generic la credențiale greșite și limitare a încercărilor. Sesiunea dedicată folosește token opac cu hash și expirare în PostgreSQL și cookie dedicat `HttpOnly`, `SameSite`, `Secure` pe HTTPS. HTTP este rezervat dezvoltării locale. Serverul verifică originea mutațiilor, expirarea și revocarea. Răspunsurile de sesiune și date interne folosesc `Cache-Control: no-store`.
- În Compose, cererile directe pentru `/staff/agenda` și `/staff/receptie` trec printr-un middleware Vite care delegă validarea cookie-ului la Server înainte de a servi pagina. Cookie-ul folosește `Path=/` pentru verificarea documentului și a API-ului. Accesul fără sesiune redirecționează spre `/staff/login`, iar o verificare indisponibilă închide accesul. React verifică sesiunea și la navigarea internă înainte de afișarea calendarului, apoi curăță datele la logout sau la pierderea sesiunii. Toate API-urile interne au guard NestJS, inclusiv cele trei operații existente sub `/api/admin`. Înregistrarea personalului nu face parte din interfață sau din API.

### Calendar și permisiuni

| Operație | Ioana | Ana |
|---|---|---|
| Agenda proprie, detalii și export | Programări Ioana | Programări Ana |
| `COMPLETED` / `NO_SHOW` din agenda proprie | Programări Ioana | Programări Ana |
| Recepție, detalii, creare, reprogramare, anulare, Waitlist și export | Ambele specialiste | Ambele specialiste |
| Operațiile Admin existente de finalizare și deblocare cu resetare | Admin | Acces refuzat |

- Agenda zilnică și săptămânală derivă `specialistId` din sesiune, inclusiv pentru Ioana. Recepția afișează Ioana și Ana împreună și permite filtrarea. Serverul limitează cererile la o zi sau o săptămână și interpretează zilele civile în `Europe/Bucharest`, cu limite UTC calculate separat la schimbarea orei.
- Detaliile autorizate includ numele, telefonul, e-mailul disponibil, notițele existente, serviciul, startul și sfârșitul, specialista și starea. Serverul alege datele din cont sau din câmpurile programării fără cont și întoarce doar câmpurile necesare. Autorizarea se aplică înaintea returnării detaliilor sau modificării pe ID.
- Acțiunile rapide permit trecerea unei programări proprii `CONFIRMED` în `COMPLETED` sau `NO_SHOW` după încheiere. Actualizarea programării și a etapelor se face atomic, cu reverificarea proprietarului și a stării în tranzacție. Repetarea acțiunii nu dublează efectele. `COMPLETED` folosește calculul existent de Fidelizare. `NO_SHOW` nu reprezintă o vizită finalizată și nu adaugă marcări sau oferte Waitlist. Finalizarea prin API-ul Admin existent păstrează semantica și cere sesiunea Ioanei.

### Recepție și Waitlist

- La ghișeu sau telefon, personalul selectează specialista, serviciul și un slot confirmat de Server. Numele și telefonul sunt suficiente. Serverul creează programarea și etapele direct în `CONFIRMED` pe calea recepției. Calea publică își păstrează confirmarea prin e-mail, termenul inițial la reprogramare și expirarea la o oră. Pentru programările de recepție, reminderul D-009 se aplică unde există o adresă de livrare.
- Disponibilitatea folosește `AvailabilityService`, `AppointmentsService.fit`, blocarea specialistei și constrângerea PostgreSQL pentru etapele ocupate. Se păstrează încadrarea serviciului în categorie, orarul, intercalarea pentru **Laminare sprâncene**, excepțiile și ofertele active Waitlist. O coliziune lasă programarea veche intactă. După commit se actualizează zilele afectate prin mecanismul existent de invalidare. Crearea asociată unei cliente și modificările folosesc regulile existente de Fidelizare și asocierea verificată D-007.
- Recepția poate anula și reprograma o programare eligibilă inclusiv în Zi Full și sub 24 h. Calea publică păstrează blocarea în aceste cazuri. Recepția poate crea sau muta și pentru o clientă blocată online, fără să îi reseteze marcările. O anulare târzie înregistrată păstrează marcarea prevăzută de D-006. Se reutilizează gestiunea tranzacțională și se trimit notificările existente unde sunt aplicabile.
- Panoul Waitlist din recepție arată cererile, filtrele după zi și specialistă, starea notificării și expirarea ofertei. Acțiunea de expediere se aplică unei oferte active nestrimise, prin `WaitlistService.notifyPending` și revendicarea SMTP existentă. `offer` și `expire` continuă să aleagă prima cerere compatibilă și să gestioneze prioritatea și expirarea. Fereastra rămâne de până la 30 de minute, limitată de startul slotului. UI-ul nu afișează tokenul.

### Descărcare iCalendar

- Butonul „Descarcă .ics” exportă programările `CONFIRMED` din ziua sau săptămâna afișată. Același guard și aceeași filtrare se aplică exportului. Recepția respectă selecția Ioana, Ana sau ambele. Serverul trimite un atașament `text/calendar; charset=utf-8` cu nume de fișier determinat de dată și vizualizare.
- Un `VEVENT` per programare, cu `UID` stabil la reprogramare, `DTSTAMP`, `DTSTART` și `DTEND` în UTC și titlu din serviciu și specialistă. Fișierul omite datele de contact, notițele și tokenurile. Serializarea folosește UTF‑8, CRLF, escape pentru valori TEXT și pliere la 75 de octeți fără tăierea unui caracter multioctet. Verificarea include importul cu date sintetice în calendare de test Google și Apple. [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) · [Google Calendar](https://support.google.com/calendar/answer/37118) · [Apple Calendar](https://support.apple.com/en-ca/guide/calendar/icl1023/mac)

## Fișiere

| Acțiune | Cale | Conținut |
|---|---|---|
| Modificare și adăugare | `server/prisma/seed.ts`, `server/prisma/schema.prisma`, `server/prisma/migrations/<migrare>/migration.sql` | Identități fixe, upgrade și sesiuni de personal |
| Adăugare și conectare | `server/src/modules/staff-access/`, `server/src/app.module.ts`, `server/src/modules/client-access/client-access.service.ts` | Login și sesiune personal, guard, izolare față de conturile clientelor |
| Modificare | `server/src/modules/appointments/appointment-management.controller.ts`, `appointment-management.service.ts`, `appointments.service.ts`, `appointments.module.ts` din același director | Rute Admin protejate și corelarea noilor acțiuni cu tranzacțiile existente |
| Adăugare | `server/src/modules/appointments/staff-calendar.controller.ts`, `staff-calendar.service.ts`, `calendar-export.ts` din același director | Calendar, detalii, recepție și răspuns iCalendar |
| Reutilizare și extindere | `server/src/modules/waitlist/waitlist.service.ts`, `server/src/modules/availability/availability.service.ts` | Proiecția Waitlist pentru recepție, expedierea controlată și disponibilitatea existentă |
| Modificare și adăugare | `frontend/vite.config.ts`, `frontend/src/main.tsx`, `frontend/src/staff-api.ts`, `frontend/src/styles.css`, `frontend/package.json`, `frontend/package-lock.json` | Acces la pagini, apeluri API, temă și integrarea FullCalendar |
| Adăugare | `frontend/src/pages/admin/StaffLoginPage.tsx`, `frontend/src/pages/admin/ReceptionCalendarPage.tsx`, `frontend/src/pages/admin/WaitlistManagementPage.tsx`, `frontend/src/pages/employee/EmployeeCalendarPage.tsx` | Login, recepție cu panou Waitlist și agenda proprie |
| Modificare | `docs/design/DESIGN.md`, `docs/design/registry.yaml`, `docs/design/mocks/DS-adm-login.html`, `DS-adm-calendar.html`, `DS-emp-schedule.html` din directorul mocks, capturile DS aferente din `docs/design/screens/` | Reviziile de design și comparația vizuală |
| Adăugare și adaptare | `server/test/staff-reception.spec.ts`, `server/test/calendar-export.spec.ts`, `server/test/sprint-1.spec.ts`, `server/test/public-booking.spec.ts`, `server/test/sprint-3.spec.ts`, `frontend/test/staff-reception.spec.ts` | Cazuri noi și actualizarea identităților din fixture-uri, cu păstrarea aserțiunilor |
| Modificare | `README.md`, `PLAN.md`, `docs/agents/ARCHITECTURE.md`, `AI_LOG.md` | Setup local, înlocuirea loginului Admin via client, descărcarea .ics și arhitectura livrată |

Contractul C-001 rămâne la interfața existentă. Consumatorii de verificat sunt `docker-compose.yml`, `server/Dockerfile`, `frontend/Dockerfile`, proxy-ul din `frontend/vite.config.ts` și instrucțiunile din `README.md`. Consumatorii publici din `frontend/src/booking-api.ts`, `BookingWizardPage.tsx`, `ClientAccountPage.tsx`, `ManageBookingPage.tsx` și `WaitlistOfferPage.tsx` rămân pe rutele curente și intră în regresie.

## Teste

| # | Comportament | Acoperire |
|---|---|---|
| 1 | Instalare curată, upgrade păstrând ID-uri și relații, seed repetat, rotație, valori lipsă și coliziune fără preluare de cont | Jest cu PostgreSQL, `staff-reception.spec.ts` |
| 2 | Ambele logări fixe, refuz pentru clientă, alt `ADMIN`, adresa veche, parolă greșită și sesiune expirată sau revocată. Refuz pentru cookie client, origini nepermise și rutele Admin din contul Anei | Jest HTTP, `staff-reception.spec.ts`, `sprint-3.spec.ts` |
| 3 | Agendă zi/săptămână, acces după ID, date clientă cu și fără cont, finalizare și neprezentare după sfârșit, refuz prematur, conflict și repetare sigură. Fidelizarea numără numai `COMPLETED` | Jest HTTP, `staff-reception.spec.ts`, `sprint-3.spec.ts` |
| 4 | Ambele conturi creează direct `CONFIRMED` cu telefon, inclusiv pentru profil blocat online. Creare și mutare concurente, pierderea slotului, split și orarul de duminică. Reprogramare și anulare prin recepție versus refuz public în Zi Full și sub 24 h | Jest + PostgreSQL, `staff-reception.spec.ts`, `availability.spec.ts`, `concurrency.spec.ts` |
| 5 | Anularea sau mutarea oferă primul slot compatibil, respectă fereastra activă și ordinea la expirare. Expedierea concurentă din recepție și job produce cel mult o notificare. Marcările și reminderul își păstrează regulile | Jest + PostgreSQL/Mailpit, `staff-reception.spec.ts`, `sprint-3.spec.ts`, `public-booking.spec.ts` |
| 6 | Atașament, fără acces din exterior sau din cont client, filtru zi/săptămână și specialistă, doar `CONFIRMED`, UID stabil, conversie DST, escape și diacritice, fără date de contact | Jest HTTP și serializer, `staff-reception.spec.ts`, `calendar-export.spec.ts` |
| 7 | Navigare directă fără sesiune și verificarea răspunsului HTTP inițial, login, logout, ambele agende și recepția, formular și eroare de conflict, Waitlist și descărcare .ics | Playwright, `staff-reception.spec.ts` |
| 8 | Capturi light/dark pe desktop și la 390 px, comparație cu reviziile HTML. Ore și număr de evenimente corecte la importul Google/Apple Calendar | Playwright pentru capturi. Verificare manuală pentru import, care cere aplicațiile externe și calendare de test |

La build se rulează mai întâi cazurile de regresie noi, apoi toate suitele Jest cu PostgreSQL și Mailpit în Docker, validarea Prisma, migrarea pe bază nouă și pe o copie izolată a schemei precedente, seed, build-urile NestJS și Vite, verificarea Compose, Playwright și ledger lint cu `PYTHONUTF8=1`.

## Design

| ID și referință | Revizie de aprobat |
|---|---|
| `DS-adm-login` · [HTML](../design/mocks/DS-adm-login.html) | Păstrează formularul centrat și tema. Câmpuri e-mail și parolă, feedback la eroare, fără selector de rol, scurtături demo sau credențiale precompletate |
| `DS-emp-calendar` · [HTML](../design/mocks/DS-emp-schedule.html) | Păstrează agenda, cardurile și dialogul. Adaugă săptămâna, identitatea din sesiune, acțiunile de vizită și descărcarea în ambele agende |
| `DS-adm-calendar` · [HTML](../design/mocks/DS-adm-calendar.html) | Păstrează coloanele Ioana/Ana, filtrul, etapele și dialogurile. Completează săptămâna, excepțiile recepției și butonul de descărcare. Bannerul spune „Anularea și reprogramarea se fac prin salon în Zi Full”, conform D-006 |
| `DS-adm-waitlist` · [dialogul din mock-ul recepției](../design/mocks/DS-adm-calendar.html) | Adaptează dialogul la starea și expirarea ofertei, cu expediere doar când oferta este eligibilă |

Primele trei referințe sunt `draft`, iar Waitlist este `proposed`. Revizuiește mock-urile și capturile corespunzătoare pentru confirmare înaintea implementării UI. Aplică Warm Minimalist, Nude Rose, Terracotta, Muted Gold, suprafețele light/dark, Playfair Display, Plus Jakarta Sans și ritmul de 4 px. Compară contrastul stărilor în tema întunecată și validează încărcarea, lista goală, eroarea, succesul, textele lungi, navigarea la tastatură și revenirea focusului din dialog. [DESIGN.md](../design/DESIGN.md) · [Registrul designului](../design/registry.yaml)

## Secvență

Un singur builder după aprobare. În ordine, testele de seed și acces, migrarea și guard-ul, tranzacțiile și testele recepției, calendarul și exportul, apoi conectarea interfeței la mock-urile confirmate și verificarea în Docker. Aceste părți împart identitatea, tranzacțiile și forma datelor. Documentația și capturile se aliniază cu rezultatul verificat.

## Riscuri

- Conturi duplicate sau o migrare întreruptă. Verificare înaintea scrierii, upgrade atomic și validare pe copie izolată înainte de baza locală persistentă.
- Privilegii obținute prin rutele vechi sau printr-o navigare directă. Inventar complet al rutelor, guard server-side și teste de document, sesiune și acces după ID.
- Coliziuni între recepție, rezervare online, expirare și Waitlist. Refolosește ordinea blocărilor, reverificarea sub lock și constrângerea bazei de date. La eșec, interfața recitește sloturile.
- Confirmarea directă, schimbarea orei și exportul pot afișa rezultate diferite între calendar și Server. Validează aceleași limite civile și aceleași filtre în ambele căi, plus importul unui fișier sintetic.

## În afara Sprintului 4

Administrarea conturilor de personal, resetarea parolei prin UI, editarea programului sau a marcajului Zi Full, Servicii, Rapoarte, schimbarea manuală a priorității Waitlist și abonarea sincronizată la un feed iCalendar.

## Cunoștințe folosite

| Intrare | Aplicare | Validare |
|---|---|---|
| D-001, D-002, D-003, D-004, D-006, D-007, D-009, D-010, PATTERN-001, C-001, Q-004, Q-005, Q-006, Q-007, Q-009 | 15 intrări confirmate anterior. Docker, stivă și design, orar și split, politici publice, identitate clientă, remindere, confirmări publice și contractul Compose | Aplică versiunile curente. D-010 are ca domeniu rezervările publice |
| D-008, Q-008 | Fidelizare și privilegii Admin. Agenda Anei cere o permisiune nouă pentru finalizare | Confirmă propunerea de supersedare D-008 |
| Q-001 | Originea stivei și a funcțiilor planificate | Răspuns consemnat, aplică D-002 |
| Q-003 | Ioana Admin și Sprâncene, Ana Specialistă Make-up. Recepția fusese atribuită Ioanei | Confirmă extinderea accesului de recepție prin noua decizie. Răspunsul istoric rămâne consemnat |
| Q-010, Q-011, Q-012 | Confirmare directă, acces la recepție și Waitlist, marcarea vizitelor și exportul | Răspunsuri confirmate explicit la 27 noiembrie 2026. Confirmă propunerile de decizie de mai jos |

Referințe de registru. [Decizii](../agents/DECISIONS.md) · [Patterns](../agents/PATTERNS.md) · [Contracte](../agents/CONTRACTS.md) · [Întrebări](../agents/OPEN-QUESTIONS.md) · [Arhitectură](../agents/ARCHITECTURE.md) · [Vocabular](../../CONTEXT.md)

### Istoric consultat

- PATTERN-002–PATTERN-005 · **For awareness only**. Sunt candidate. Planul reutilizează codul existent pentru blocări, SMTP, invalidare și expirare în baza D-002, D-004, D-009 și D-010.
- Q-002 · Denumirea Beauty Studio vine din CONTEXT. Datele de contact istorice nu intră în export.
- Registrul propunerilor respinse nu are o intrare aplicabilă. [REJECTED.md](../agents/REJECTED.md)

### Propuneri de aprobat

```text
PROPOSAL: supersede
- Existing: D-008 cere rolul Admin pentru finalizare și resetarea marcărilor.
- Proposed: Păstrează algoritmul de Fidelizare și operațiile Admin existente. Permite fiecărei specialiste să marcheze propria programare CONFIRMED drept COMPLETED sau NO_SHOW după încheiere. NO_SHOW nu adaugă marcări și nu declanșează Waitlist. Resetarea marcărilor cere Admin.
- Why now: Q-012 confirmă acțiunile din agenda fiecărei specialiste.
- Impact: appointment-management.controller.ts, appointment-management.service.ts, sprint-3.spec.ts, agenda angajatului.
- If approved: D-008 → superseded-by D-011 (kept, not deleted).

PROPOSAL: add-decision
- Existing: none. Q-003 consemnează accesul istoric al Ioanei la recepție.
- Proposed: Accesul intern este exclusiv pentru cele două conturi fixe din seed, prin sesiuni verificate de Server. Ioana și Ana au acces la agenda proprie și la recepție. Ioana păstrează operațiile Admin.
- Why now: Cerința Sprintului 4 extinde accesul de recepție la Ana și fixează identitățile.
- Impact: seed.ts, schema.prisma, accesul client și personal, controlerele interne, paginile și documentația de dezvoltare.
- If approved: adaugă D-012.

PROPOSAL: add-decision
- Existing: none. D-004, D-006, D-007, D-009 și D-010 guvernează regulile existente.
- Proposed: Recepția creează programări CONFIRMED cu nume și telefon, gestionează excepțiile Zi Full și poate crea sau muta pentru cliente blocate online fără resetare. Waitlist permite consultarea și expedierea unei oferte active nestrimise, cu prioritatea existentă. Exportul autenticat include programările CONFIRMED din ziua sau săptămâna afișată.
- Why now: Q-010, Q-011 și Q-012 confirmă operațiile specifice recepției și exportului.
- Impact: appointments.service.ts, appointment-management.service.ts, waitlist.service.ts, calendarul recepției și descărcarea .ics.
- If approved: adaugă D-013.
```

### Ipoteze tehnice de confirmat cu planul

Reutilizarea proxy-ului Compose pentru poarta documentelor interne, sesiunile persistente de personal, săptămâna de luni până duminică și alegerea câmpurilor din fișier sunt propuneri de implementare. Confirmarea planului validează și aceste alegeri. Aprobarea deciziilor și a mock-urilor revizuite deblochează `/build`.
