# Plan — Sprintul 3 · Portal client, Waitlist și remindere

**Stare** · Aprobat la 26 noiembrie 2026. Q-006–Q-009 sunt închise prin D-006–D-009.

## Dimensiune

L. Sprintul cuprinde trei ecrane publice, autentificare, modificări tranzacționale ale programărilor, Fidelizare, Waitlist și două joburi programate.

## Abordare

Extindem wizard-ul React, păstrând fluxul fără cont și folosind catalogul, disponibilitatea pe etape și confirmarea SMTP existente. Gestiunea, rezervarea cu cont și revendicarea din Waitlist trec prin aceleași verificări din Server, folosind tranzacții PostgreSQL pentru programări, etape, prioritate și Fidelizare. NestJS Schedule pornește joburile în containerul Server, cu PostgreSQL pentru starea trimiterilor și Mailpit pentru livrare. Această combinație acoperă joburile persistente fără infrastructură de cozi suplimentară.

### 1. Rezervare publică și disponibilitate

- Reproducem antetul Beauty Studio, zona introductivă și ordinea cardurilor din `DS-pub-booking`. În antet apar mesajul complet „Te poți programa fără cont. Cont opțional, cu 10% reducere la fiecare a 5-a vizită.” și „Contul meu / Autentificare”. Sesiunea autentificată actualizează eticheta și starea de Fidelizare din răspunsul Serverului.
- Înlocuim câmpul de dată cu banda orizontală de zile, începând cu data studioului. Păstrăm accesul la date ulterioare prin deplasarea benzii și încărcăm zilele pe ferestre. Cardurile au ziua săptămânii, data, selecția și marcajul `Disponibil`, `Zi Full (X locuri)` sau `Complet Ocupat`. Marcajul de Zi Full provine din `ScheduleOverride.isFullDayPolicy`. Bannerul imediat sub bandă folosește data selectată, disponibilitatea și politica confirmată. O zi închisă ori o zi ale cărei ore au trecut integral primește o stare distinctă, cu mesaj în același loc. Duminica verificăm separat Sprâncene și Make-up.
- Serverul furnizează rezumate pe zile și detaliile zilei selectate din același calcul pe etape, păstrând compatibilitatea `GET /api/availability` pentru consumatorii care citesc `slots`. `Y` numără începuturile de pe grila existentă de 5 minute pentru care serviciul încape în tură și al căror început nu a trecut. `X` numără începuturile disponibile dintre acestea, ținând cont de programări și oferte Waitlist active. Orele indisponibile din grilă sunt dezactivate. Ora de început în `Europe/Bucharest` definește grupa, cu 13:00 inclusă în `DUPĂ-AMIAZA (13:00 - 19:00)`, după `DIMINEAȚA (09:00 - 13:00)`. Fiecare grupă afișează `X din Y libere`.
- Schimbarea serviciului, a specialistei sau a zilei invalidează selecția orei și răspunsurile vechi. La `409`, reîncărcăm banda și ziua fără a pierde datele completate. Păstrăm confirmarea în pagină, cu sumar și starea SMTP.

### 2. Waitlist

- În ziua lucrătoare cu zero intervale disponibile, afișăm cardul integrat „Intră pe lista de așteptare” în locul acțiunii de rezervare. Serviciul, specialista și data provin din selecție. Păstrăm opțiunile din mock-up `Oricând`, `Dimineața` și `După-amiaza`, nota despre prioritatea de 30 de minute și confirmarea înscrierii. Propunem aceeași apartenență după ora de început ca în grila orară. D-007 permite înscrierea fără cont. Cardul preia numele, telefonul și e-mailul.
- La anulare sau reprogramare, în aceeași tranzacție cu eliberarea etapelor, alegem prima intrare eligibilă în ordinea `createdAt, id` și persistăm oferta concretă și trimiterea în așteptare. Eligibilitatea se recalculează pe specialista, data, serviciul și intervalul solicitat, cu orar, etapele rămase și politica de blocare a profilului. Comparăm disponibilitatea înainte și după modificare pentru a oferi un început efectiv eliberat, inclusiv când serviciul de pe listă diferă de cel mutat sau anulat.
- Oferta rezervă etapele ocupate necesare timp de 30 de minute. API-ul de disponibilitate și toate scrierile care rezervă timp verifică oferta, inclusiv porniri diferite cu etape ocupate suprapuse. Linkul trimis prin Mailpit se leagă de o singură ofertă, iar revendicarea și rezervarea se salvează împreună sub blocare. Verificăm expirarea la acces și la revendicare. Jobul de expirare oferă un interval încă disponibil următoarei intrări eligibile sau îl redă rezervării publice. Expedierea se face după commit.

### 3. Acces client, Fidelizare și gestiune

- Construim formularele `Autentificare` și `Creează cont nou`, sesiunea reală și ecranul `Contul meu și fidelizare`. Serverul validează datele, stochează hash-ul parolei și gestionează sesiunea cu cookie HttpOnly, expirare și invalidare la deconectare. Identitatea și rolul vin din sesiune. Rezervările fără cont deja înregistrate își păstrează datele, iar la crearea contului Serverul asociază programările și înscrierile Waitlist pe același e-mail, cu verificare a adresei înainte de acces.
- Panoul arată progresul `N/5`, programările viitoare și istoricul cu stări și reduceri. În D-008, Serverul numără vizitele `COMPLETED` din întregul studio și aplică la confirmare 10% pentru vizitele 5, 10, 15 și următoarele multipli de 5. Persistăm valoarea monetară și marcajul reducerii pe programare, folosind calcule zecimale. Serializăm alocarea pentru același client inclusiv dacă rezervă la specialiste diferite. Alocăm reducerea primei programări eligibile în ordine cronologică și recalculăm la anulare. Endpointurile de finalizare și resetare cer rol Admin.
- Acțiunile de anulare și reprogramare din cont refolosesc structura `DS-pub-manage`. Planificăm consultarea și gestiunea fără cont prin tokenul de pe programare, conform fluxului aprobat al ecranului. Răspunsurile validează proprietarul ori tokenul și afișează acțiunile permise. Anularea actualizează programarea și etapele. Reprogramarea revalidează slotul țintă omițând etapele proprii care urmează să fie mutate. La conflict, programarea inițială rămâne întreagă. Ambele căi apelează Waitlist după o eliberare efectivă, iar mesajul reflectă rezultatul real.
- Politica solicitată prevede anulare și reprogramare gratuite cu cel puțin 24 de ore înainte, o marcare per anulare târzie acceptată și blocare după trei marcări, până la deblocare Admin. Verificarea pragului și actualizarea marcării se fac pe Server, în aceeași tranzacție cu anularea, astfel încât repetarea cererii să producă o singură marcare. Blocarea se verifică în toate căile online care creează o rezervare pentru identitatea blocată, inclusiv la revendicarea Waitlist. Anularea și mutarea online sunt blocate sub 24 h sau în orice Zi Full. Admin înregistrează anularea târzie și resetează marcările.

### 4. Reminder programat

- Înregistrăm jobul periodic la pornirea NestJS. Timpul de trimitere este începutul programării minus `N`, cu `N = 24 h` conform documentației proiectului. Jobul caută trimiterile scadente pentru programări viitoare confirmate, verifică la expediere că ora și starea sunt încă valabile și refolosește Nodemailer pentru Mailpit. Pentru vizitatoare folosește adresa de pe programare, iar pentru cliente cu cont adresa contului. [Cerința reminderului](../../README.md)
- Persistăm o cheie unică per reminder, cu identitatea programării. Revendicarea atomică împiedică două rulări sau două instanțe să expediaze aceeași notificare. Reîncercăm un eșec SMTP confirmat înainte de acceptare. Rezultatul ambiguu rămâne de reconciliat, deoarece SMTP și PostgreSQL confirmă separat. Un `Message-ID` stabil ajută reconcilierea în Mailpit. Fereastra D-009 este 2–24 h inclusiv, cu reminderSentAt nul. Ora schimbată păstrează trimiterea deja înregistrată.

## Fișiere

| Acțiune | Cale | Schimbare |
|---|---|---|
| Extindere | `server/prisma/schema.prisma`, `server/prisma/migrations/<sprint-3>/migration.sql` | Migrare aditivă pentru sesiuni, datele politicii, reducerea persistată, fereastra și oferta Waitlist, trimiterea durabilă și indexurile lor. Păstrează programările și datele vizitatoarelor existente. |
| Extindere | `server/src/modules/availability/{availability.controller,availability.service,availability.types}.ts` | Rezumate pe zile, stare Zi Full, grupe, totaluri și excluderea ofertelor active. Consumatori în `frontend/src/booking-api.ts`, wizard și ecranul de gestiune. |
| Extindere | `server/src/modules/appointments/{appointments.service,appointments.module,public-bookings.controller,public-booking.dto,booking-confirmation.service}.ts` | Tranzacția comună de rezervare, preț, conflict, verificarea blocării și linkul de gestiune în confirmare. Păstrăm API-ul public pentru vizitatoare și adăugăm operații autentificate. |
| Adăugare | `server/src/modules/client-access/`, `server/src/modules/appointments/` | Sesiune și cont, controlere și DTO-uri pentru gestiune, plus operațiile de personal din Q-008. |
| Adăugare | `server/src/modules/waitlist/`, `server/src/modules/notifications/` | Înscriere, ofertă, revendicare, expirare, reminder și transport SMTP partajat cu confirmarea. |
| Extindere | `server/src/app.module.ts`, `server/package.json`, `server/package-lock.json` | Înregistrare module și dependență NestJS Schedule compatibilă cu NestJS 10, pentru execuție fără cereri HTTP. |
| Extindere | `frontend/src/main.tsx`, `frontend/src/booking-api.ts`, `frontend/src/styles.css`, `frontend/src/pages/public/BookingWizardPage.tsx` | Navigare SPA, cereri tipizate, antet, bandă, bannere, grile, formular și sumar. |
| Adăugare | `frontend/src/pages/public/{ClientAccountPage,ManageBookingPage}.tsx`, `frontend/src/components/public/` | Contul, gestiunea și cardul Waitlist integrat. Componenta de înscriere și revendicarea folosesc contractele Serverului și sesiunea ori tokenul potrivit. |
| Actualizare la build | `docs/design/{registry.yaml,screens/}`, `docs/agents/ARCHITECTURE.md` | Surse și capturi ale ecranelor, traseul Browser–Server și joburile. |

## Teste

| # | Comportament | Verificare |
|---|---|---|
| 1 | Bandă, contori și ore | HTTP/PostgreSQL în `server/test/availability.spec.ts` și `server/test/sprint-1.spec.ts`. Toate stările de zi, 13:00, ture scurtate, programul de duminică, începuturi trecute, oferte active, compatibilitate cu răspunsul vechi și treceri de oră. |
| 2 | Cont și acces | `server/test/client-access.spec.ts`, HTTP/PostgreSQL. Înregistrare, e-mail unic, sesiune și deconectare, separarea rolurilor, istoric propriu, acces respins pentru alt cont sau token invalid și regresia rezervării fără cont. |
| 3 | Fidelizare și politică | `server/test/appointment-management.spec.ts`, HTTP/PostgreSQL. Vizitele 5 și 10 peste categorii, stări care nu adaugă o vizită, prețul persistat și confirmări concurente. Teste pentru pragul exact de 24 h, cu 1 ms sub prag, anulare repetată, trei marcări și deblocare doar de către Admin. Acoperim D-006–D-008. |
| 4 | Eliberare și exclusivitate | `server/test/waitlist.spec.ts`, HTTP/PostgreSQL și Mailpit. FIFO cu intrare incompatibilă, anulare, mutare reușită și conflict, revendicare înainte de expirare, reluare și token reutilizat, expirare cu rotație sau eliberare, blocare publică a suprapunerilor și intercalare permisă între etapele libere. |
| 5 | Reminder fără trafic HTTP | `server/test/reminders.spec.ts`, ceas controlat, PostgreSQL și Mailpit. Pragul de 24 h, rulări periodice, suprapuse și după restart, destinatari din cont și fără cont, anulări, ore vechi, eșec SMTP cert și rezultat ambiguu fără retrimitere automată. Cazurile de reprogramare și rezervare apropiată urmează D-009. |
| 6 | Regresii și migrare | Toate suitele Jest din `server/test/` în Docker, inclusiv `public-booking.spec.ts` și `concurrency.spec.ts`, fără modificarea aserțiunilor existente. Aplicăm migrarea pe bază goală și pe o copie de test cu date Sprint 2. Verificăm Prisma, build-urile NestJS și Vite, Compose, pornirea serviciilor și ledger lint cu `PYTHONUTF8=1`. |
| 7 | Parcurs vizual și accesibilitate | Browser și capturi la 390 și 1440 px în Light și Dark. Fluxul rezervare–cont–gestiune, Waitlist până la linkul Mailpit, recuperare după `409`, tastatură, focus, derulare, text lung, încărcare, eroare, stare goală și confirmare. Frontendul are script de build și acoperirea interacțiunilor vizuale se face în browser. |

## Design

HTML-ul din repo este referința vizuală pentru `DS-pub-booking`, `DS-pub-waitlist` integrat și `DS-comp-peak-badge`. Comparăm alinierea antetului și ordinea cardurilor, bara de zile cu punctul auriu, bannerul chihlimbar, stările orelor și cardul Waitlist cu icon, opțiuni și succes. Păstrăm Playfair Display și Plus Jakarta Sans, cardurile și razele D-003, culorile semantice și contrastul în ambele teme. Datele și disponibilitatea vin din Server. [Rezervare](../design/mocks/DS-pub-booking.html) · [Design](../design/DESIGN.md) · [Registru](../design/registry.yaml)

`DS-pub-auth` este în `draft`. Pentru aprobare, reperul include cardul central cu filele de acces, panoul de profil, inelul și cele cinci trepte de progres, acțiunea de rezervare, listele viitoare și trecute cu badge-uri și deconectarea. În `DS-pub-manage` folosim cardul de detalii, bannerul de politică, confirmarea anulării și dialogul de reprogramare. Stările tehnice sunt declanșate de API. Capturile de rezervare din Sprintul 2 și captura luminoasă de acces servesc pentru informare. Pentru gestiune, reperul disponibil este HTML-ul. [Cont](../design/mocks/DS-pub-auth.html) · [Gestiune](../design/mocks/DS-pub-manage.html)

## Secvență

Un builder. După aprobare, scriem testele care lipsesc, stabilim migrarea și contractele HTTP, apoi construim disponibilitatea, sesiunea și gestiunea. Adăugăm Waitlist și joburile peste tranzacțiile comune, conectăm ecranele React și verificăm fluxurile împreună cu PostgreSQL și Mailpit în Compose.

## Riscuri

- O rezervare poate ocupa intervalul între eliberare și ofertare. Salvăm oferta în tranzacția care eliberează etapele. Menținem ordinea blocărilor pentru clientă și specialistă în toate scrierile concurente.
- Mai multe rezervări și marcări concurente pot folosi aceeași stare de profil. Serializăm calculul și scrierea la nivel de clientă, cu teste pentru cursa dintre rezervări și pentru repetarea anulării.
- O oră mutată sau o anulare poate lăsa un reminder scadent în coadă. Trimiterea revalidează starea programării și versiunea ei. Un rezultat SMTP ambiguu necesită reconciliere înainte de o eventuală reîncercare.
- Migrarea introduce relații și indexuri pentru fluxuri care împart datele de producție. Verificăm păstrarea programărilor fără cont, a orelor și a prețurilor existente pe date din schema Sprintului 2.

## Limitele sprintului

Sunt în afara sprintului iCal, panoul Admin de monitorizare Waitlist, rapoartele și livrarea SMTP externă. Panoul Admin complet este în afara sprintului.

## Cunoaștere folosită

Confirmate anterior. D-001 și PATTERN-001 pentru Docker, D-002 pentru stivă și joburi, D-003 pentru design, D-004 pentru orare, Split service, Waitlist și Mailpit, D-008 pentru Fidelizare, C-001 pentru interfața Compose, Q-002–Q-005 pentru datele studioului, specialiste, etape și catalog. Consumatorii C-001 păstrează porturile, verificarea de sănătate și configurația SMTP existentă. [Decizii](../agents/DECISIONS.md) · [Pattern-uri](../agents/PATTERNS.md) · [Contracte](../agents/CONTRACTS.md)

| Intrare | Aplicare | Apel |
|---|---|---|
| Q-001 | Stiva și joburile de fundal. Răspunsul este deja consemnat, iar D-002 fixează stiva. | confirm |
| D-006, Q-006 | Blocarea online, marcările și resetarea. | confirmat |
| D-007, Q-007 | Waitlist fără cont și asocierea pe e-mail. | confirmat |
| D-008, Q-008 | Fidelizare cronologică, finalizare și deblocare Admin. | confirmat |
| D-009, Q-009 | Reminder unic în fereastra 2–24 h. | confirmat |

Aprobarea include HTML-ul indicat pentru ecranele publice, cu mesajele de gestiune actualizate conform D-006. Banda păstrează accesul la date ulterioare. Grupele și preferințele Waitlist folosesc începutul local al slotului.

### Consultate pentru informare

- PATTERN-002 este `candidate`. Reutilizăm implementarea existentă din `AppointmentsService` în baza D-002 și D-004.
- Planul Sprintului 2 și capturile lui explică faptul că antetul curent are text prescurtat, iar disponibilitatea actuală are selector nativ de dată și o listă de ore libere. HTML-ul indicat pentru Sprintul 3 oferă referința vizuală cerută. [Planul Sprintului 2](sprint-2-public-booking.md)
