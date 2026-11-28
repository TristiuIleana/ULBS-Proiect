# Decisions — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> Constraints the code must obey. Status: `approved` (obey) · `proposed` (do not
> build on it) · `superseded-by <ID>` (kept to explain old code).
> Adding or changing an entry needs the user's OK (AGENTS.md → The gate).
<!-- graffino-agentic:end -->

## Index
- D-001 · Docker for all server components
- D-002 · Application stack NestJS PostgreSQL React in Docker
- D-003 · Visual identity and design tokens
- D-004 · Salon schedule, split interleaving, waitlist locking and Mailpit
- D-006 · Gestiunea și blocarea rezervării online
- D-007 · Waitlist fără cont și asocierea prin e-mail
- D-009 · Fereastra și idempotența reminderelor
- D-010 · Blocarea slotului și confirmarea programării prin e-mail
- D-011 · Fidelizare și marcarea vizitelor după rol
- D-012 · Acces exclusiv și drepturi distincte pentru personal
- D-013 · Recepție Admin, Waitlist și export iCalendar

### [Sprint 5](decisions/sprint-5.md)
- D-014 · Conversie Waitlist, Rapoarte și Gestiunea Serviciilor

---

## D-001 · Docker for all server components
- **Status:** approved
- **Date:** 2026-11-06
- **Confirmed:** 2026-11-18
- **Rule:** All server components, backend services, databases, and associated infrastructure must run in Docker containers (via Docker / Docker Compose).
- **Why:** Ensures isolated, reproducible environments and clean separation from host OS dependencies.
- **Rejected:** Running services directly on host OS without containerization.
- **Evidence:** User requirement: "vei felosii docker pentru oricce tine de server"
- **Source:** user · confidence high

---

## D-002 · Application stack NestJS PostgreSQL React in Docker
- **Status:** approved
- **Date:** 2026-11-18
- **Confirmed:** 2026-11-18
- **Rule:** The backend service is built using NestJS (TypeScript) with PostgreSQL (using ACID transactions and row-level locks for booking concurrency) and scheduled jobs via NestJS Schedule / BullMQ. The frontend is built as a separate React SPA (Vite + Tailwind CSS + FullCalendar). All services run containerized via Docker Compose.
- **Why:** Provides robust modular architecture, strict type safety across the entire stack, reliable ACID transaction controls for preventing simultaneous double-booking, and clean responsive UI.
- **Rejected:** Monolithic full-stack framework without container separation; Python/Django or PHP stacks without full TypeScript end-to-end typing.
- **Evidence:** User decision during P01 project scoping interview answering Q-001 and explicit confirmation: "Da, aprob decizia D-002."
- **Source:** user · confidence high

---

## D-003 · Visual identity and design tokens
- **Status:** approved
- **Date:** 2026-11-18
- **Confirmed:** 2026-11-25
- **Rule:** The user interface follows the Warm Minimalist design system documented in docs/design/DESIGN.md: Nude Rose (#C48B71) primary with Terracotta (#9E6B55) and Muted Gold (#D4AF37) accents, warm linen (#FAF7F2) light surface and deep espresso (#1A1716) dark mode, Playfair Display serif for headings with Plus Jakarta Sans for body and UI elements, 4px-based spacing scale, and soft 10-16px border radii.
- **Why:** Delivers an intimate, refined, high-end boutique beauty salon experience aligned with client expectations and visual benchmarks (GlossGenius, Aesop).
- **Rejected:** Generic sterile corporate UI kits or cold dark-slate palettes.
- **Evidence:** User style interview and explicit approval: "Da, aprob decizia D-003. Salvează token-urile în docs/design/DESIGN.md și înregistrează D-003 în docs/agents/DECISIONS.md."
- **Source:** user · confidence high

---

## D-004 · Salon schedule, split interleaving, waitlist locking and Mailpit
- **Status:** approved
- **Date:** 2026-11-18
- **Confirmed:** 2026-11-18
- **Rule:** The business logic and local environment obey the following constraints:
  1. **Working Schedule:** Monday to Saturday 09:00–19:00 for both domains (Ioana – BROWS and Ana – MAKEUP). Sunday 09:00–19:00 is open EXCLUSIVELY for MAKEUP (Ana); BROWS (Ioana) is closed on Sunday.
  2. **Split Interleaving:** The idle action stages of Brow Lamination (Etapa 2 = 20m, Etapa 4 = 25m) are exposed as available slots both in the public client booking wizard and in the reception calendar for short compatible services (Pensat simplu = 20 min).
  3. **Waitlist Priority Locking:** During the 30-minute priority claim window after a slot cancellation, the slot is locked against general public booking and can only be reserved using the secret token link sent to the notified client. On expiration, the slot is offered to the next waitlist entry.
  4. **Email Development:** Local development and testing use a Mailpit container (port 1025 SMTP, port 8025 Web UI) inside Docker Compose to capture all outgoing transactional emails without external dependencies.
- **Why:** Crystalizes the core scheduling constraints, domain partitioning, waitlist exclusivity, and testability required for project P01.
- **Evidence:** User explicit confirmation to final clarification interview: "Iată răspunsurile finale pentru închiderea neclarităților (actualizează te rog OPEN-QUESTIONS.md și DECISIONS.md cu ele)".
- **Source:** user · confidence high

---

## D-006 · Gestiunea și blocarea rezervării online
- **Status:** approved
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-26
- **Rule:** Anularea și reprogramarea online sunt gratuite în zile normale cu cel puțin 24 h înainte. Ambele sunt blocate sub 24 h sau în orice Zi Full, cu mesaj de contactare a salonului. O anulare târzie înregistrată adaugă o marcare. La trei marcări rezervarea online se blochează până la resetarea lor de către Admin.
- **Why:** Aplică politica salonului în gestiune și rezervare.
- **Evidence:** Confirmarea planului Sprintului 3, Q-006.
- **Source:** user · confidence high

---

## D-007 · Waitlist fără cont și asocierea prin e-mail
- **Status:** approved
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-26
- **Rule:** Vizitatoarele se înscriu cu nume, telefon, e-mail, serviciu, dată și interval preferat. Crearea contului asociază automat programările și înscrierile anterioare fără cont pe același e-mail. Serverul verifică adresa înainte de a acorda acces la datele asociate.
- **Why:** Păstrează opțiunea fără cont și istoricul centralizat.
- **Evidence:** Confirmarea planului Sprintului 3, Q-007.
- **Source:** user · confidence high

---

## D-009 · Fereastra și idempotența reminderelor
- **Status:** approved
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-26
- **Rule:** Jobul periodic NestJS trimite prin Mailpit pentru programări CONFIRMED cu reminderSentAt nul, între 2 și 24 h inclusiv înainte de start. Programările create sau mutate în fereastră primesc reminder la prima rulare. Un reminder deja trimis rămâne înregistrat la mutarea aceleiași programări.
- **Why:** Trimite un reminder util și previne duplicatele.
- **Evidence:** Confirmarea planului Sprintului 3, Q-009.
- **Source:** user · confidence high

---

## D-010 · Blocarea slotului și confirmarea programării prin e-mail
- **Status:** approved
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-27
- **Rule:** Rezervările fără cont, cele din cont și cele revendicate prin Waitlist pornesc în `PENDING_CONFIRMATION`. Etapele ocupate blochează sloturile imediat după salvare, inclusiv când trimiterea e-mailului eșuează, până la `created_at + 60 minute`. Numai linkul dedicat din e-mail poate trece programarea în `CONFIRMED` înainte de termen. Retrimiterea e-mailului și reprogramarea păstrează termenul inițial. E-mailul și pagina de rezervare afișează durata de 1 oră.
  La expirare, slotul redevine disponibil public, sub rezerva ofertelor Waitlist deja active conform D-004. Serverul marchează programarea și etapele `CANCELLED`, cu motivul `CONFIRMATION_EXPIRED`. Expirarea nu lansează o ofertă Waitlist și nu adaugă marcări de anulare târzie. Un link expirat îi spune clientei că termenul de 1 oră a expirat și îi cere să facă o programare nouă. Sumarul și pagina de gestiune afișează starea și permit retrimiterea cât timp confirmarea este posibilă.
- **Why:** Protejează intervalul de rezervări concurente, îl eliberează după termen și comunică starea programării.
- **Evidence:** Utilizatorul a confirmat planul de extindere a D-010 și regula Waitlist la expirare.
- **Source:** user · confidence high

---

## D-011 · Fidelizare și marcarea vizitelor după rol
- **Status:** approved
- **Date:** 2026-11-27
- **Confirmed:** 2026-11-27
- **Rule:** Serverul calculează Fidelizarea pe baza vizitelor COMPLETED din întregul studio. Alocă reducerea de 10% la fiecare a cincea vizită, primei programări eligibile în ordine cronologică, persistă prețul și recalculează la anularea unei programări anterioare. Contul clientei afișează progresul și reducerile. Ioana poate marca vizitele oricărei specialiste. Ana poate marca exclusiv vizitele proprii. Trecerea la COMPLETED sau NO_SHOW este permisă din CONFIRMED după ora de sfârșit. NO_SHOW nu adaugă marcări de anulare și nu declanșează Waitlist. Deblocarea clientelor cu resetarea marcărilor rămâne operație Admin.
- **Why:** Permite operarea agendei proprii și administrarea salonului, păstrând calculul comun al Fidelizării.
- **Evidence:** Q-012 și cererea de ajustare a drepturilor înainte de buildul Sprintului 4.
- **Source:** user · confidence high

---

## D-012 · Acces exclusiv și drepturi distincte pentru personal
- **Status:** approved
- **Date:** 2026-11-27
- **Confirmed:** 2026-11-27
- **Rule:** Accesul intern aparține exclusiv conturilor fixe din seed: ioana@admin.com (Ioana, ADMIN, BROWS) și ana@admin.com (Ana, SPECIALIST, MAKEUP). Parolele se configurează local pentru seed. Serverul verifică la fiecare cerere internă sesiunea, identitatea și dreptul pentru operație. Accesul personalului nu are înregistrare publică. Ioana vede și administrează toate programările, filtrează pe specialistă sau vede agendele simultan și are acces la Recepție. Ana își vede exclusiv agenda, fără acces la Recepție sau la programările Ioanei, inclusiv prin API.
- **Why:** Limitează accesul la datele clientelor și separă administrarea salonului de operațiile specialistei.
- **Evidence:** Cerința Sprintului 4 și matricea de drepturi ajustată de utilizator.
- **Source:** user · confidence high

---

## D-013 · Recepție Admin, Waitlist și export iCalendar
- **Status:** approved
- **Date:** 2026-11-27
- **Confirmed:** 2026-11-27
- **Rule:** Ioana creează la recepție programări direct CONFIRMED cu nume și telefon, gestionează anulările și mutările în Zi Full și sub 24 h și poate crea sau muta pentru clientele blocate online fără resetare. Waitlist la recepție permite consultarea și expedierea unei oferte active nestrimise cu prioritatea D-004. Descărcarea .ics include programările CONFIRMED din ziua sau săptămâna afișată. Ioana poate exporta una sau ambele agende. Ana poate exporta exclusiv propria agendă. Fluxurile publice respectă D-006, D-007, D-009 și D-010.
- **Why:** Permite gestionarea programărilor la ghișeu și telefon și importul calendarului cu aceleași limite de acces ca în aplicație.
- **Evidence:** Q-010, Q-011 și Q-012, cu rolurile precizate în ajustarea Sprintului 4.
- **Source:** user · confidence high
