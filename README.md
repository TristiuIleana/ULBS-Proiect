# P01 — Sistem de Programări Online pentru Beauty Studio
> Proiect universitar ULBS (Universitatea „Lucian Blaga” din Sibiu)  
> Student / Dezvoltator: Tristiu  
> Proiect Catalog: **P01 — Programări pentru un salon / cabinet real**

---

## 1. Despre Proiect & Contextul Salonului

Aplicația este un sistem complet de programări online dezvoltat pentru un salon real de înfrumusețare de tip boutique / home-based studio (**Beauty Studio - Make-up & Brow Styling**), situat în **Gura Râului, Sibiu**.

### Echipa Studioului (2 persoane cu roluri strict separate)
1. **Proprietara (Rol: Admin / Recepție / Tehnician):** Gestionează salonul și prestează exclusiv servicii de stilizare și tratamente pentru sprâncene (pensat simplu, pensat cu vopsit, laminare sprâncene).
2. **Colega (Rol: Angajat / Tehnician):** Specializată exclusiv pe machiaj profesional (make-up de ocazie fără/cu gene, make-up mireasă).
*(Notă: Specializările nu se suprapun; fiecare specialistă gestionează exclusiv categoria proprie de servicii).*

### Catalogul Real de Servicii și Prețuri
- **Categoria „Sprâncene” (Proprietara):**
  - **Laminare sprâncene:** 180 RON • 90 min *(Serviciu split modelat pe etape de acțiune)*
  - **Pensat cu vopsit:** 70 RON • 30 min
  - **Pensat simplu (fără vopsit):** 50 RON • 20 min
- **Categoria „Make-up” (Colega):**
  - **Make-up ocazie (fără gene):** 150 RON • 1 h 15 min (75 min)
  - **Make-up ocazie (cu gene):** 170 RON • 1 h 30 min (90 min)
  - **Make-up mireasă:** 220 RON • 2 h (120 min)

---

## 2. Variabilele Specifice ale Proiectului

### A. Serviciul Split: Laminare Sprâncene (5 Etape)
Spre deosebire de serviciile monolitice, serviciul de **Laminare sprâncene** este modelat ca o succesiune de 5 etape:
1. **Etapa 1 (Ocupat):** Pregătire & Aplicare soluția 1 (permanentă/lifting).
2. **Etapa 2 (Liber):** Pauză de acționare soluția 1 — *specialista este liberă și poate prelua o altă clientă pentru un serviciu scurt (ex: pensat).*
3. **Etapa 3 (Ocupat):** Aplicare soluția 2 (fixare).
4. **Etapa 4 (Liber):** Pauză de acționare soluția 2 — *specialista este liberă și poate prelua un alt serviciu scurt (ex: vopsit sprâncene).*
5. **Etapa 5 (Ocupat):** Neutralizare, tratament de hidratare & finalizare.

Algoritmul de disponibilitate garantează că programările intercalate nu depășesc intervalul liber și că nu apar suprapuneri. *(Duratele exacte per etapă urmează să fie confirmate în Q-004).*

### B. Politica de Anulare și Reprogramare Diferențiată
- **Zile normale:** Anularea și reprogramarea online sunt permise liber de către client în orice moment.
- **Zile aglomerate / „Full” (marcate ca atare în sistem de către Admin):** Anularea online este permisă doar cu **cel puțin 24 de ore înainte**. În ziua programării (< 24h), anularea directă este blocată în interfață, clienta fiind instruită să contacteze telefonic recepția salonului.

---

## 3. Roluri și Permisiuni

- **Client:**
  - Rezervă direct prin interfața publică, fără a fi constrâns să creeze un cont cu parolă (furnizează Nume, Telefon, Email).
  - Primește pe email confirmarea și un **link securizat cu token unic** pentru consultarea, reprogramarea sau anularea rezervării.
  - Opțional: Poate activa un cont cu parolă pentru a avea acces la întreg istoricul programărilor sale.
  - Înscriere pe **Lista de așteptare** când o zi / un interval dorit nu are sloturi disponibile.
- **Angajat (Specialistă Make-up):**
  - Autentificare cu email și parolă.
  - Vizualizează exclusiv propriul calendar de lucru și datele clientelor programate la ea.
  - URL privat de abonare la calendar extern prin **iCal (.ics)** (Google Calendar, Apple Calendar, Outlook).
- **Admin / Recepție (Proprietara):**
  - Acces complet la panoul de administrare.
  - Calendar de recepție multi-angajat (zi/săptămână, editare rapidă, blocare manuală de intervale).
  - Gestiune catalog servicii și configurator de etape split (ocupat/liber).
  - Gestiune personal, orare săptămânale și excepții/concedii.
  - Marcare calendaristică a zilelor „Full” / aglomerate.
  - Monitorizare listă de așteptare.

---

## 4. Cerințe Tehnice Specifice

- **Controlul Concurenței (Fără Double Booking):** Solicitările simultane pentru același slot sunt gestionate prin tranzacții ACID și blocare la nivel de bază de date (`SELECT ... FOR UPDATE` / exclusion constraints). Demonstrarea se realizează printr-un test automat de concurență.
- **Standardizare Fus Orar:** Toate datele temporale sunt stocate în UTC în baza de date și convertite în `Europe/Bucharest` la nivel de afișare. Sistemul este testat împotriva tranzițiilor la ora de vară/iarnă (DST).
- **Joburi de Fundal Programate (Scheduled Crons):**
  - **Reminder automat pe email:** Trimis automat cu **24 de ore înainte** de programare.
  - **Procesare Listă de Așteptare:** Când se eliberează un slot în urma unei anulări, sistemul trimite un email primului client din waitlist, oferindu-i o fereastră prioritară de **30 de minute** pentru confirmare.
- **Export iCal (.ics):** Endpoint securizat cu token pentru sincronizarea automată a calendarului fiecărui angajat.

---

## 5. Delimitarea Proiectului: Ce NU este inclus (Out of Scope)

- **Plăți online cu cardul:** Plata se efectuează fizic la salon (cash/POS) la finalizarea serviciului.
- **Notificări SMS plătite:** Toată comunicarea se realizează prin Email (sau mock/loguri în mediul local).
- **Aplicații native iOS/Android:** Soluția este o aplicație web responsivă optimizată pentru dispozitive mobile.
- **Arhitectură SaaS / Multi-tenant:** Sistemul deservește exclusiv acest studio de înfrumusețare.
- **Chat în timp real sau modul de stocuri/inventar produse cosmetice.**

---

## 6. Stivă Tehnologică și Arhitectură (D-001, D-002)

Toate serviciile rulează containerizat prin Docker și Docker Compose:
- **Backend:** NestJS (Node.js, TypeScript), arhitectură modulară, TypeORM / Prisma cu tranzacții ACID, NestJS Schedule / BullMQ.
- **Bază de date:** PostgreSQL (cu suport pentru tranzacții stricte și constrângeri de timp).
- **Frontend:** React SPA (Vite, TypeScript, Tailwind CSS, FullCalendar, Lucide Icons).
- **Infrastructură:** Docker & Docker Compose per decizia aprobată `D-001`.

---

## 7. Structura Documentației de Proiect

Documentația este gestionată conform regulilor de guvernanță agentică din `AGENTS.md`:
- `docs/agents/DECISIONS.md` — Deciziile arhitecturale și tehnice aprobate (`D-001`, `D-002`).
- `docs/agents/OPEN-QUESTIONS.md` — Întrebările deschise în curs de clarificare cu clientul (`Q-002`..`Q-005`).
- `docs/agents/PATTERNS.md` — Modelele de bune practici reutilizabile (`PATTERN-001`).
- `docs/agents/CONTRACTS.md` — Contractele de interfață între componente (`C-001`).
- `CONTEXT.md` — Vocabularul controlat al domeniului aplicației.
- `AI_LOG.md` — Jurnalul transparent al sesiunilor de lucru cu asistentul AI.
