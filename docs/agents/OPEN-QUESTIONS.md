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
- Q-006 · Politica sub 24 h și deblocarea rezervării online · _investigating_
- Q-007 · Identitatea clientei în Waitlist, la înregistrare și în istoric · _investigating_
- Q-008 · Alocarea Fidelizării și operațiile Admin din Sprintul 3 · _investigating_
- Q-009 · Reminder pentru rezervări apropiate și reprogramări · _investigating_

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
- **Status:** investigating
- **Date:** 2026-11-26
- **Question:** În zile normale și în Zi Full, când sunt permise anularea și reprogramarea sub 24 h? În Zi Full, fluxul aprobat blochează anularea online. Cum se marchează anulările prin recepție sau prin linkul unei vizitatoare? La deblocare se resetează marcările? Ce identificare se cere la rezervarea fără cont pentru a aplica blocarea unui profil?

---

## Q-007 · Identitatea clientei în Waitlist, la înregistrare și în istoric
- **Status:** investigating
- **Date:** 2026-11-26
- **Question:** Waitlist acceptă vizitatoare cu adresă de e-mail sau cere cont? Dacă acceptă vizitatoare, când se colectează datele de contact pentru confirmarea ofertei? Înregistrarea colectează nume și telefon în formular sau într-un pas de profil? Istoricul și Fidelizarea includ programări anterioare fără cont dacă legătura este verificată?

---

## Q-008 · Alocarea Fidelizării și operațiile Admin din Sprintul 3
- **Status:** investigating
- **Date:** 2026-11-26
- **Question:** Cum se alocă reducerea confirmată dacă există mai multe programări viitoare la progresul 4/5, dacă ordinea se schimbă sau dacă programarea cu reducere este anulată ori devine neprezentare? Ce interfață Admin trebuie livrată pentru finalizare, evidențierea reducerii și deblocare?

---

## Q-009 · Reminder pentru rezervări apropiate și reprogramări
- **Status:** investigating
- **Date:** 2026-11-26
- **Question:** Pentru o programare creată sau mutată la mai puțin de 24 h înainte, se trimite reminder la următoarea rulare sau se omite? Dacă reminderul s-a trimis pentru ora veche, se trimite unul pentru ora nouă?
