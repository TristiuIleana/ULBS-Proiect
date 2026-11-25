# Planul proiectului P01 — Beauty Studio, Gura Râului

**Proiect universitar ULBS · Sistem de programări online**

**Stadiu documentat la 25 noiembrie 2026**

## 1. Obiectiv și viziune

Beauty Studio este un studio de make-up și stilizare a sprâncenelor din Gura Râului, Sibiu. Platforma oferă clientelor un parcurs web responsiv de la alegerea serviciului până la confirmarea și gestionarea programării. Echipa folosește un calendar comun la recepție, iar fiecare specialistă are acces la programul propriu conform rolului. Disponibilitatea reflectă programul studioului și permite folosirea pauzelor de acționare din Laminare sprâncene pentru servicii scurte compatibile.

Rezervarea publică este disponibilă fără cont, pe bază de nume, telefon și e-mail. Contul opțional oferă acces la istoric și Fidelizare. Confirmările, reminderele și ofertele Waitlist sunt prevăzute prin e-mail. Plata are loc la studio, iar platforma deservește un singur studio.

## 2. Faze de dezvoltare

| Fază | Rezultat urmărit | Status |
| --- | --- | --- |
| 1. Inițializare și interviu | Definirea proiectului P01, a rolurilor, catalogului, orarelor și regulilor pentru Split service. Clarificarea Q-001–Q-005. | Finalizată la nivel de cerințe. [Întrebări și răspunsuri](docs/agents/OPEN-QUESTIONS.md) · [Jurnal, sesiunile 1–12](AI_LOG.md) |
| 2. Decizii | Aprobarea infrastructurii, a stivei, a identității vizuale și a regulilor de planificare și Fidelizare. | D-001–D-005 aprobate. [Registrul deciziilor](docs/agents/DECISIONS.md) |
| 3. Design și prototipare | Opt mock-up-uri HTML, grilă de previzualizare și traseu rezervare–cont–Fidelizare. | Gestiunea este aprobată, rezervarea publică fără cont este implementată, iar contul clientei este în `draft`. [Grila](docs/design/mocks/preview-grid.html) · [Registrul](docs/design/registry.yaml) |
| 4. Fundația tehnică | Docker Compose, schema Prisma, migrarea inițială și seed cu serviciile, etapele și orarele. | Fișierele sunt implementate. [Compose](docker-compose.yml) · [Schema](server/prisma/schema.prisma) · [Migrarea](server/prisma/migrations/0_init/migration.sql) · [Seed](server/prisma/seed.ts) |
| 5. Disponibilitate și rezervare | Calcul de disponibilitate pe etape și salvare tranzacțională a programărilor. | Catalogul, disponibilitatea și rezervarea publică pe etape sunt implementate. |
| 6. Backend funcțional | API de rezervare și gestiune, acces pe roluri, Fidelizare, Waitlist, e-mailuri și export iCal. | Crearea publică și confirmarea prin Mailpit sunt implementate. Gestiunea programărilor și restul fluxurilor urmează. |
| 7. Frontend și validare | SPA React conectată la API, fluxuri publice și de echipă, verificare integrată în Docker. | Pagina React de rezervare fără cont este disponibilă în Compose pe portul 5173. |

### Deciziile aprobate

| ID | Conținut |
| --- | --- |
| D-001 | Serverul, baza de date și infrastructura asociată rulează în Docker, orchestrate prin Docker Compose. |
| D-002 | NestJS și TypeScript pentru API, PostgreSQL cu tranzacții ACID pentru integritatea rezervărilor, joburi prin NestJS Schedule / BullMQ și SPA React separată cu Vite, Tailwind CSS și FullCalendar. |
| D-003 | Identitate Warm Minimalist cu Nude Rose, Terracotta și Muted Gold, suprafețe Linen și Deep Espresso, Playfair Display și Plus Jakarta Sans, spațiere în multipli de 4 px. |
| D-004 | Orare separate pe specializări, pauze de 20 și 25 min intercalabile, slot Waitlist blocat 30 min pentru clienta notificată și Mailpit pentru e-mailul local. |
| D-005 | Reducere recurentă de 10% la fiecare a 5-a vizită a unei cliente cu cont, calculată la confirmarea programării și înregistrată pe programare. |

Sursă pentru formularea completă a regulilor aprobate. [D-001–D-005](docs/agents/DECISIONS.md)

### Cele opt ecrane prototipate

| Ecran | Parcurs sau funcție | Status în registru |
| --- | --- | --- |
| `DS-pub-booking` | Alegerea serviciului și specialistei, selectarea slotului, date de contact și confirmare. | Implementat |
| `DS-pub-manage` | Consultare, anulare sau reprogramare prin link securizat. | Aprobat |
| `DS-pub-auth` | Acces client, creare cont, progres N/5, programări viitoare și istoric cu reduceri. | Draft |
| `DS-adm-login` | Autentificare demonstrativă cu sesiune de rol. | Draft |
| `DS-adm-calendar` | Calendar de recepție pe specialiste și navigare către Servicii și Rapoarte. | Draft |
| `DS-adm-services` | Configurarea serviciilor, duratelor, prețurilor și etapelor, cu navigare către Rapoarte. | Draft |
| `DS-adm-reports` | Rapoarte demo pentru Admin, KPI, defalcări, filtre și export CSV/PDF. | Draft |
| `DS-emp-calendar` | Agenda proprie a specialistei Make-up, cu detalii, stări și blocaje. | Draft |

Traseul demonstrativ pornește din rezervare, continuă prin autentificare sau creare cont și deschide panoul cu progres 4/5. Acțiunea „Programare nouă cu −10%” revine în rezervare cu reducerea demonstrativă aplicată. Demo-ul păstrează indicatorul de autentificare în `sessionStorage` și permite deconectarea. Jurnalul consemnează verificarea în Chrome, inclusiv după reîncărcare și deconectare. Designul include teme luminoasă și întunecată. [Design](docs/design/DESIGN.md) · [Registru](docs/design/registry.yaml) · [Jurnal, sesiunile 14–17](AI_LOG.md)

## 3. Arhitectura tehnică și datele

Fluxul țintă este **browser → SPA React → API NestJS → Prisma → PostgreSQL**. Serverul validează accesul, disponibilitatea și regulile de business. Joburile de fundal vor gestiona reminderele și expirarea ofertelor Waitlist. În mediul local, Compose definește Serverul pe portul 3000, PostgreSQL 16 cu volum persistent și Mailpit pe porturile 1025 (SMTP) și 8025 (interfață web). Instantele programărilor sunt persistate ca `timestamptz`, iar orarele și afișarea folosesc `Europe/Bucharest`. [Arhitectură](docs/agents/ARCHITECTURE.md) · [Compose](docker-compose.yml)

| Modele Prisma | Responsabilitate |
| --- | --- |
| `User` | Identitatea clientelor și a personalului, rolurile `CLIENT`, `SPECIALIST`, `ADMIN` și parolă opțională pentru cont. |
| `Service`, `ServiceStage` | Catalog, categorie, preț, durată și etape ordonate, ocupate sau libere. |
| `SpecialistSchedule`, `ScheduleOverride` | Orar săptămânal, excepții pe dată și indicatorul politicii Zi Full. |
| `Appointment`, `AppointmentStage` | Clientă sau date de contact ale vizitatoarei, specialistă, serviciu, preț total, token de gestionare și intervale concrete ale etapelor. Stările sunt `CONFIRMED`, `CANCELLED`, `COMPLETED` și `NO_SHOW`. |
| `WaitlistEntry` | Cerere pe serviciu, specialistă și dată, cu token prioritar și termene de notificare și expirare. Stările sunt `WAITING`, `NOTIFIED`, `CLAIMED` și `EXPIRED`. |

Schema actuală păstrează prețul total, iar persistarea distinctă a reducerii D-005 rămâne de implementat. Sprintul 1 a adăugat categoria specialistei, a expus-o în catalog și verifică în API-ul de disponibilitate dacă serviciul aparține aceleiași categorii. [Schema Prisma](server/prisma/schema.prisma) · [Migrarea categoriei](server/prisma/migrations/1_specialist_category/migration.sql)

## 4. Roluri și reguli de business

| Rol | Acces și responsabilități |
| --- | --- |
| Clientă | Rezervă din portal, primește confirmarea și linkul securizat pentru gestiune, se înscrie în Waitlist și poate crea un cont pentru istoric și Fidelizare. |
| Specialistă | Ana prestează Make-up și consultă propriile programări și datele clientelor aferente. Calendarul propriu va fi disponibil și printr-un link privat iCal. |
| Admin | Ioana gestionează recepția, calendarul echipei, rezervările telefonice, catalogul, personalul, excepțiile de program, zilele marcate Zi Full și Waitlist. Ioana prestează și serviciile de sprâncene. |

| Specialistă și program | Serviciu | Durată | Preț |
| --- | --- | ---: | ---: |
| Ioana · luni–sâmbătă, 09:00–19:00 | Laminare sprâncene | 90 min | 180 RON |
| Ioana | Pensat cu vopsit | 30 min | 70 RON |
| Ioana | Pensat simplu (fără vopsit) | 20 min | 50 RON |
| Ana · luni–duminică, 09:00–19:00 | Make-up ocazie (fără gene) | 75 min | 150 RON |
| Ana | Make-up ocazie (cu gene) | 90 min | 170 RON |
| Ana | Make-up mireasă | 120 min | 220 RON |

Specializările sunt exclusive, iar duminica sunt disponibile doar serviciile Make-up. În zilele normale, clienta poate anula sau reprograma online. Într-o Zi Full, anularea online este permisă cu cel puțin 24 de ore înainte. Sub acest prag, clienta contactează recepția.

La eliberarea unui slot, prima clientă eligibilă din Waitlist primește prin e-mail un link cu token. Slotul rămâne rezervat acelei cliente timp de 30 de minute. După expirare, oferta trece la următoarea intrare. Reminderul de programare se trimite cu 24 de ore înainte.

Fidelizarea numără vizitele finalizate la nivelul studioului, indiferent de serviciu sau specialistă. La confirmarea programării aferente vizitei 5, 10, 15 și așa mai departe, Serverul calculează și stochează reducerea de 10%. Contul arată progresul și reducerile din istoric, iar panoul Admin evidențiază programările cu reducere. [Cerințe de proiect](README.md) · [Vocabular](CONTEXT.md) · [Decizii](docs/agents/DECISIONS.md)

## 5. Algoritmul de disponibilitate Split service

Pentru Laminare sprâncene, cele cinci etape sunt **15 min ocupat → 20 min liber → 15 min ocupat → 25 min liber → 15 min ocupat**. Pentru o laminare la 10:00, ferestrele libere sunt 10:15–10:35 și 10:50–11:15. Pensatul simplu de 20 min încape în ambele. Pensatul cu vopsit de 30 min depășește ambele ferestre.

1. Pentru data locală și specialistă, modulul `Availability` aplică mai întâi excepția de orar, apoi folosește orarul săptămânal. Dacă programul este închis, returnează lista goală. Limitele turei se convertesc în UTC.
2. Modulul încarcă etapele serviciului și intervalele etichetate ocupat ale programărilor confirmate. Durata rezervării este suma etapelor.
3. Încearcă porniri din 5 în 5 minute, cu toate etapele în interiorul turei. Simulează etapele consecutiv și acceptă pornirea dacă etapele ocupate nu se intersectează cu intervalele ocupate deja. Intervalele sunt de forma `[start, end)`, astfel încât două etape pot avea o limită comună.
4. `GET /api/availability` primește `serviceId`, `specialistId` și `date` și returnează sloturile ca instante UTC și valori locale. Portalul și calendarul recepției vor consuma același calcul.
5. `POST /api/bookings` folosește o tranzacție PostgreSQL `READ COMMITTED` și blochează rândul specialistei înainte de revalidarea disponibilității pe etape. Programarea și etapele se salvează împreună în starea `CONFIRMED`. Constrângerea de excludere PostgreSQL protejează etapele ocupate, iar Mailpit primește confirmarea după commit.

[Disponibilitate](server/src/modules/availability/availability.service.ts) · [Rezervare](server/src/modules/appointments/appointments.service.ts) · [Constrângerea SQL](server/prisma/migrations/0_init/migration.sql)

## 6. Stadiu tehnic și pași următori

[Sprintul 2 — Rezervarea publică fără cont](docs/plans/sprint-2-public-booking.md) include API-ul de creare, confirmarea prin Mailpit și pagina React de rezervare.

| Componentă | Disponibil acum | Urmează |
| --- | --- | --- |
| Infrastructură și date | Compose, Dockerfile, Prisma, migrare și seed. | Verificare integrată cu pornirea containerelor, migrare și seed. |
| Disponibilitate și rezervare | Catalog, disponibilitate și creare publică prin API. Teste PostgreSQL pentru intercalare, schimbarea orei și concurență. | Conectarea fluxurilor de echipă la același calcul. |
| Gestiune programări | Modele pentru programări, stări și token. | Consultare, anulare și reprogramare prin token, cu aplicarea politicii Zi Full și eliberarea consecventă a etapelor. |
| Conturi și Fidelizare | Roluri în schemă, decizie aprobată și flux demonstrativ în mock-up. | Autentificare reală și autorizare, calculul prețului pe Server, stocarea reducerii și afișarea progresului și istoricului. |
| Waitlist, e-mail și iCal | Model WaitlistEntry și confirmări de rezervare prin Mailpit. | Notificări, remindere, blocarea slotului, revendicare și expirare, plus export privat iCal. |
| Frontend | Pagina React de rezervare fără cont consumă API-ul prin proxy-ul Vite. | Fluxurile de cont, gestiune și echipă. |
| Validare finală | Suite pentru disponibilitate și concurență în repository. | Testare cu PostgreSQL în Docker și verificarea fluxurilor complete, a accesului pe roluri, a politicii Zi Full, a ferestrei Waitlist, a Fidelizării și a afișării pe mobil și desktop în ambele teme. |

[Teste de disponibilitate](server/test/availability.spec.ts) · [Teste de concurență](server/test/concurrency.spec.ts) · [Jurnalul implementării](AI_LOG.md)
