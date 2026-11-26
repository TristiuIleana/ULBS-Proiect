# Open questions — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> Unknowns. Work that depends on an open question is out of scope until it is
> answered. Only the user answers; an agent never answers by guessing. An agent may
> write a `Proposed answer` the evidence supports; the question stays
> `investigating` until the user confirms it.
> Answered entries stay, with the answer and date, and usually become a D- or PATTERN-.
<!-- graffino-agentic:end -->

## Index
- Q-001 · Which technology stack and features will the project use? · _answered_
- Q-002 · Official studio display name and contact details · _answered_
- Q-003 · Specialist names and initial staff profile details · _answered_
- Q-004 · Exact stage durations for the Brow Lamination split service · _answered_
- Q-005 · Complete service catalog with prices and standard durations · _answered_
- Q-006 · Politica sub 24 h și deblocarea rezervării online · _answered_
- Q-007 · Identitatea clientei în Waitlist, la înregistrare și în istoric · _answered_
- Q-008 · Alocarea Fidelizării și operațiile Admin din Sprintul 3 · _answered_
- Q-009 · Reminder pentru rezervări apropiate și reprogramări · _answered_

---

## Q-001 · Which technology stack and features will the project use?
- **Status:** answered
- **Date:** 2026-11-18
- **Answer:** NestJS (TypeScript, TypeORM/Prisma with ACID transactions, NestJS Schedule / BullMQ for background reminder jobs) + PostgreSQL + React (Vite + Tailwind CSS + FullCalendar) as separate SPA in Docker containers.

---

## Q-002 · Official studio display name and contact details
- **Status:** answered
- **Date:** 2026-11-18
- **Confirmed:** 2026-11-19
- **Answer:** Denumire oficială: „Beauty Studio”. Adresă: Str. Principală nr. 45, Gura Râului, Sibiu. Telefon: 0756 062 883.

---

## Q-003 · Specialist names and initial staff profile details
- **Status:** answered
- **Date:** 2026-11-18
- **Confirmed:** 2026-11-19
- **Answer:** 2 specialiste: Ioana (Proprietara – Rol Admin & Recepție, servicii exclusive Sprâncene) și Ana (Colega – Rol Angajată / Tehnician, servicii exclusive Make-up).

---

## Q-004 · Exact stage durations for the Brow Lamination split service
- **Status:** answered
- **Date:** 2026-11-18
- **Confirmed:** 2026-11-19
- **Answer:** Durată totală: 90 min (180 RON). Defalcare etape: Etapa 1 = 15 min (Ocupat / Lucru direct), Etapa 2 = 20 min (Liber / Pauză acțiune sol. 1 - compatibilă cu pensat simplu 20 min), Etapa 3 = 15 min (Ocupat / Lucru direct), Etapa 4 = 25 min (Liber / Pauză acțiune sol. 2 & vopsea - compatibilă cu pensat simplu 20 min), Etapa 5 = 15 min (Ocupat / Lucru direct). Suma etapelor = 15 + 20 + 15 + 25 + 15 = 90 min.

---

## Q-005 · Complete service catalog with prices and standard durations
- **Status:** answered
- **Date:** 2026-11-18
- **Confirmed:** 2026-11-19
- **Answer:** Catalog confirmat de utilizator: Sprâncene (Ioana): „Laminare sprâncene” (180 RON, 90 min), „Pensat cu vopsit” (70 RON, 30 min), „Pensat simplu (fără vopsit)” (50 RON, 20 min). Make-up (Ana): „Make-up ocazie (fără gene)” (150 RON, 75 min / 1 h 15 min), „Make-up ocazie (cu gene)” (170 RON, 90 min / 1 h 30 min), „Make-up mireasă” (220 RON, 120 min / 2 h). Specialiștii sunt strict partajați pe categorii.

---

## Q-006 · Politica sub 24 h și deblocarea rezervării online
- **Status:** answered
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-26
- **Answer:** Anularea și reprogramarea online sunt gratuite în zile normale cu cel puțin 24 h înainte. Ambele sunt blocate sub 24 h sau în orice Zi Full, cu mesaj de contactare a salonului. O anulare târzie înregistrată adaugă o marcare. La trei marcări rezervarea online se blochează până la resetarea lor de către Admin.
- **Decision:** D-006

---

## Q-007 · Identitatea clientei în Waitlist, la înregistrare și în istoric
- **Status:** answered
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-26
- **Answer:** Vizitatoarele se înscriu cu nume, telefon, e-mail, serviciu, dată și interval preferat. Crearea contului asociază automat programările și înscrierile anterioare fără cont pe același e-mail. Serverul verifică adresa înainte de a acorda acces la datele asociate.
- **Decision:** D-007

---

## Q-008 · Alocarea Fidelizării și operațiile Admin din Sprintul 3
- **Status:** answered
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-26
- **Answer:** La fiecare a cincea vizită, pe baza vizitelor COMPLETED din întregul studio, Serverul alocă automat reducerea de 10% primei programări eligibile în ordine cronologică, persistă prețul și recalculează la anularea unei programări anterioare. Contul afișează progresul și reducerile. Operațiile de finalizare și deblocare cu resetarea marcărilor cer rolul Admin.
- **Decision:** D-008

---

## Q-009 · Reminder pentru rezervări apropiate și reprogramări
- **Status:** answered
- **Date:** 2026-11-26
- **Confirmed:** 2026-11-26
- **Answer:** Jobul periodic NestJS trimite prin Mailpit pentru programări CONFIRMED cu reminderSentAt nul, între 2 și 24 h inclusiv înainte de start. Programările create sau mutate în fereastră primesc reminder la prima rulare. Un reminder deja trimis rămâne înregistrat la mutarea aceleiași programări.
- **Decision:** D-009
