# P01 — Sistem de Programări Online pentru Beauty Studio
> Proiect universitar ULBS (Universitatea „Lucian Blaga” din Sibiu)  
> Student / Dezvoltator: Tristiu  
> Proiect Catalog: **P01 — Programări pentru un salon / cabinet real**

---

## 1. Despre Proiect & Contextul Salonului

Aplicația este un sistem complet de programări online dezvoltat pentru un salon real de înfrumusețare de tip boutique / home-based studio (**Beauty Studio - Make-up & Brow Styling**), situat în **Str. Principală nr. 45, Gura Râului, Sibiu** (telefon contact: **0756 062 883**).

### Echipa Studioului & Orare de Lucru (Partajare Strictă)
1. **Ioana — Proprietara (Rol: Admin / Recepție / Tehnician Sprâncene):**
   - Gestionează salonul și prestează exclusiv servicii de stilizare sprâncene.
   - Program de lucru: **Luni – Sâmbătă 09:00 – 19:00** (Duminica este închis pentru sprâncene).
2. **Ana — Colega (Rol: Angajată / Tehnician Make-up):**
   - Specializată exclusiv pe machiaj profesional de ocazie și mireasă.
   - Program de lucru: **Luni – Duminică 09:00 – 19:00** (deschis Duminica exclusiv pentru evenimente de make-up).
*(Notă: Specializările nu se suprapun; fiecare specialistă gestionează exclusiv categoria proprie de servicii).*

### Catalogul Real de Servicii și Prețuri
- **Categoria „Sprâncene” (Ioana):**
  - **Laminare sprâncene:** 180 RON • 90 min *(Serviciu split modelat pe 5 etape de acțiune)*
  - **Pensat cu vopsit:** 70 RON • 30 min
  - **Pensat simplu (fără vopsit):** 50 RON • 20 min *(compatibil cu intercalarea în pauzele laminării)*
- **Categoria „Make-up” (Ana):**
  - **Make-up ocazie (fără gene):** 150 RON • 1 h 15 min (75 min)
  - **Make-up ocazie (cu gene):** 170 RON • 1 h 30 min (90 min)
  - **Make-up mireasă:** 220 RON • 2 h (120 min)

---

## 2. Variabilele Specifice ale Proiectului

### A. Serviciul Split: Laminare Sprâncene (5 Etape • 90 min)
Spre deosebire de serviciile monolitice, serviciul de **Laminare sprâncene** este modelat ca o succesiune de 5 etape:
1. **Etapa 1 (15 min • Ocupat):** Pregătire & Aplicare soluția 1 (permanentă/lifting).
2. **Etapa 2 (20 min • Liber):** Pauză de acționare soluția 1 — *specialista este liberă; intervalul poate fi rezervat automat online sau la recepție pentru un pensat simplu (20 min).*
3. **Etapa 3 (15 min • Ocupat):** Aplicare soluția 2 (fixare formă).
4. **Etapa 4 (25 min • Liber):** Pauză de acționare soluția 2 & vopsea — *specialista este liberă; intervalul poate fi rezervat automat online sau la recepție pentru un pensat simplu (20 min).*
5. **Etapa 5 (15 min • Ocupat):** Curățare, tratament de hidratare cu keratină & finalizare.

Algoritmul de disponibilitate garantează că programările intercalate nu depășesc intervalul liber și că nu apar suprapuneri (15 + 20 + 15 + 25 + 15 = 90 min).

### C. Programul de Fidelizare Automată (D-008)
Clientele care și-au creat un cont beneficiază de un **sistem automat de loialitate cu ciclu repetat**:
- Se numără **toate vizitele finalizate** la nivelul întregului studio (indiferent de serviciu sau specialist).
- La fiecare **a 5-a vizită** (5, 10, 15…), o **reducere de 10%** se aplică automat la prețul programării respective.
- Reducerea este calculată **server-side** la confirmarea booking-ului și stocată pe înregistrarea Appointment — nu necesită coduri promoționale sau intervenție manuală.
- Ecranul **„Contul Meu & Fidelizare"** (DS-pub-auth) afișează cardul de progres (N/5 vizite), badge-ul de reducere, programările viitoare și istoricul cu reducerile aplicate evidențiate.

### D. Politica de Anulare și Reprogramare Diferențiată
- **Zile normale:** Anularea și reprogramarea online sunt gratuite cu cel puțin 24 h înainte. Sub 24 h, clienta contactează salonul.
- **Zi Full:** Anularea și reprogramarea online sunt blocate. Clienta contactează salonul. Anularea târzie înregistrată marchează profilul. La trei marcări rezervarea online este blocată până la resetarea de către Admin.

---

## 3. Roluri și Permisiuni

- **Client:**
  - Rezervă direct prin interfața publică, fără a fi constrâns să creeze un cont cu parolă (furnizează Nume, Telefon, Email).
  - Primește pe email confirmarea și un **link securizat cu token unic** pentru consultarea, reprogramarea sau anularea rezervării.
  - Opțional: Poate activa un cont cu parolă pentru a avea acces la întreg istoricul programărilor sale și la **programul de fidelizare** (progres vizite, reduceri automate — vezi secțiunea 2.C).
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
- **Email local & observabilitate:** Mailpit (server SMTP pe port 1025 și interfață web pe port 8025 pentru vizualizarea în timp real a emailurilor trimise).
- **Infrastructură:** Docker & Docker Compose per decizia aprobată `D-001`.

---

## 7. Structura Documentației de Proiect

Documentația este gestionată conform regulilor de guvernanță agentică din `AGENTS.md`:
- [PLAN.md](PLAN.md) — Obiectivele, fazele, arhitectura și stadiul proiectului P01.
- `docs/agents/DECISIONS.md` — Deciziile arhitecturale și tehnice aprobate (`D-001`..`D-008`).
- `docs/agents/OPEN-QUESTIONS.md` — Întrebările deschise în curs de clarificare cu clientul (`Q-002`..`Q-005`).
- `docs/agents/PATTERNS.md` — Modelele de bune practici reutilizabile (`PATTERN-001`).
- `docs/agents/CONTRACTS.md` — Contractele de interfață între componente (`C-001`).
- `CONTEXT.md` — Vocabularul controlat al domeniului aplicației.
- `AI_LOG.md` — Jurnalul transparent al sesiunilor de lucru cu asistentul AI.
