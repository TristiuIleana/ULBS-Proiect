# AI Log — ULBS-Proiect (P01 Beauty Studio)

Jurnalul interacțiunilor și sesiunilor de lucru cu asistentul AI Antigravity pentru dezvoltarea proiectului P01.

---

## Sesiunea 1 — 18 Noiembrie 2026: Interviu de Scoping & Definire Cerințe (P01)

### 1. Ce s-a cerut
- Desfășurarea unui interviu structurat de tip `/grill-me` pentru clarificarea cerințelor proiectului **P01** din catalog (sistem de programări pentru un salon/cabinet real).
- Stabilirea variabilelor specifice: salonul real (Beauty Studio local, activitate de make-up & sprâncene amenajată acasă), serviciul split (laminare sprâncene în etape cu timpi de acțiune liberi pentru specialistă), politica de anulare diferențiată (zile normale vs zile Full cu restricție sub 24h).
- Clarificarea rolurilor utilizatorilor, structurii datelor, ecranelor necesare și delimitarea elementelor excluse (ce NU este în proiect).
- Menținerea integrității informațiilor fără a inventa detalii despre client (elementele necunoscute devenind întrebări deschise `Q-`).

### 2. Ce s-a primit de la AI
- **Interviu iterativ ghidat:** Întrebări adresate pas cu pas privind tipul de afacere, componența echipei (Ioana în rolul Admin și Ana în rolul Angajat make-up), etapele laminării sprâncenelor pe 5 pași, mecanismul listei de așteptare (fereastră prioritară de 30 min) și delimitarea Out-of-Scope.
- **Clarificarea cerințelor tehnice:** Standardizare fus orar (UTC intern / Europe/Bucharest afișat), prevenirea rezervărilor concurente (tranzacții ACID + row-level locks), export iCal (.ics) și background jobs programate (reminder automat la 24h).
- **Întrebări deschise înregistrate în ledger (`OPEN-QUESTIONS.md`):**
  - `Q-001`: Soluționată cu alegerea stivei tehnologice.
  - `Q-002`: Numele de afișare și datele oficiale de contact ale studioului.
  - `Q-003`: Numele reale ale specialistelor și conturile inițiale de acces.
  - `Q-004`: Duratele exacte pe minute pentru fiecare etapă a serviciului split.
  - `Q-005`: Catalogul complet de prețuri și durate pentru serviciile standard (make-up, pensat, vopsit).
- **Document de Scope complet:** Generat în artifactul `scope_p01.md`.
- **Propunerea de decizie D-002:** Stiva tehnologică NestJS + PostgreSQL + React (Vite) în containere Docker.

### 3. Ce s-a făcut cu răspunsul
- **Aprobarea deciziei D-002:** Decizia a fost aprobată formal și înregistrată în `docs/agents/DECISIONS.md`.
- **Consolidarea documentației:**
  - Sinteza detaliată a scope-ului a fost salvată în `README.md`.
  - Vocabularul de domeniu (`Split service`, `Laminare sprâncene`, `Zi Full`, `Waitlist`, `Beauty Studio`) a fost adăugat în `CONTEXT.md`.
  - Toate întrebările deschise au fost sincronizate în `docs/agents/OPEN-QUESTIONS.md`.
- **Pregătirea pentru faza următoare:** Domeniul proiectului și limitele sale (out-of-scope) sunt complet cristalizate, permițând trecerea către etapa de planificare arhitecturală și design (`/plan`).

---

## Sesiunea 2 — 18 Noiembrie 2026: Identitate Vizuală, Design Tokens (D-003) & Registry Ecrane (DS-)

### 1. Ce s-a cerut
- Interviu de stil axat pe: culori, tipografie, ton, site-uri inspiraționale/benchmark și identitatea existentă a salonului.
- Propunerea unui set complet de token-uri (culori light/dark, fonturi, spațiere, raze) în `docs/design/DESIGN.md`, formulat ca propunere de decizie.
- Înregistrarea deciziei aprobate `D-003` în `docs/agents/DECISIONS.md`.
- Propunerea registrului de ecrane cu ID-uri `DS-` în `docs/design/registry.yaml`, fără desenarea de mock-uri încă.

### 2. Ce s-a primit de la AI
- **Interviu de stil pas cu pas:** S-a stabilit pornirea de la zero (tabula rasa), direcția *Elegant & Warm Minimalist*, paleta Nude Rose (`#C48B71`), Linen cald (`#FAF7F2`) / Deep Espresso (`#1A1716`), fonturile `Playfair Display` + `Plus Jakarta Sans` și inspirația GlossGenius / Aesop.
- **Sistemul de design:** Redactat complet în `docs/design/DESIGN.md` cu token-uri cromatice, scară tipografică, spațiere de 4px, raze rotunjite și reguli vizuale specifice pentru etapele split și zilele Full.
- **Propunerea de decizie D-003:** Identitatea vizuală definită în `docs/design/DESIGN.md`.
- **Registrul ecranelor (`registry.yaml`):** 13 ecrane (`DS-pub-*`, `DS-adm-*`, `DS-emp-*`) și 3 componente partajate de bază (`DS-comp-*`).

### 3. Ce s-a făcut cu răspunsul
- **Aprobarea deciziei D-003:** Înregistrată formal în `docs/agents/DECISIONS.md`.
- **Generarea `registry.yaml`:** Structură completă de ecrane mapate din `README.md`, pregătite pentru faza de mock-uri și planificare.

---

## Sesiunea 3 — 18 Noiembrie 2026: Mock Interactiv pentru Ecranul de Rezervare (DS-pub-booking)

### 1. Ce s-a cerut
- Aprobarea listei de ecrane din `registry.yaml`.
- Desenarea mock-ului pentru ecranul de rezervare client (`DS-pub-booking`): selecție serviciu, selecție opțională angajat, vizualizare sloturi libere (inclusiv indicarea vizuală pe 5 etape pentru serviciul split de laminare sprâncene).
- Salvarea în `docs/design/mocks/DS-pub-booking.html` cu status `draft` în `registry.yaml`.
- Utilizarea exclusivă a token-urilor din `DESIGN.md`.
- Acoperirea stărilor: default/interactiv, empty (waitlist), loading, error (conflict slot), success (confirmare) și long text (reziliență la texte lungi), atât în mod Light cât și Dark.

### 2. Ce s-a primit de la AI
- **Mock interactiv complet în HTML/CSS:** `docs/design/mocks/DS-pub-booking.html`.
- **Bara de control interactivă:** Permite comutarea live între Light Mode și Dark Mode, precum și între toate cele 6 stări (`default`, `empty`, `loading`, `error`, `success`, `long-text`).
- **Componente specifice P01 integrate:**
  - Componenta `DS-comp-split-stepper` pentru cele 5 etape ale laminării sprâncenelor (ocupat vs liber pentru intercalare).
  - Componenta `DS-comp-time-grid` cu sloturi orare grupate (dimineață/după-amiază) și sloturi selectate/dezactivate.
  - Componenta `DS-comp-peak-badge` cu banner și indicator vizual pentru zile aglomerate („Zile Full” cu regulă 24h).
  - Formular rapid de contact fără cont obligatoriu.
- **Actualizare `registry.yaml`:** Asociat `design_ref: mocks/DS-pub-booking.html` și marcat statusul ca `draft`.

### 3. Ce s-a făcut cu răspunsul
- Mock-ul este finalizat și poate fi inspectat în browser pentru validarea design-ului înainte de începerea implementării frontend.

---

## Sesiunea 4 — 18 Noiembrie 2026: Rafinare UX Client & Interactivitate Mock (DS-pub-booking)

### 1. Ce s-a cerut
- Eliminarea detaliilor tehnice interne (boxa cu etapele split) din perspectiva clientei: afișarea exclusivă a numelui serviciului, descriere prietenoasă, durată și preț.
- Adăugarea posibilității de a schimba dinamic între servicii din catalog (Laminare Sprâncene 180 RON, Pensat & Vopsit 70 RON, Make-up Eveniment 250 RON).
- Interactivitate JavaScript completă: selecție dinamică pentru specialistă, zile din calendar (cu activare automată a bannerului de Zi Full) și sloturi orare, cu actualizarea în timp real a textului de pe butonul final și din sumarul de confirmare.
- Traducerea completă în limba română a tuturor etichetelor din bara de control a mock-ului.

### 2. Ce s-a primit de la AI
- **Actualizare `docs/design/mocks/DS-pub-booking.html`:**
  - Carduri de servicii orientate pe client (nume, descriere scurtă, durată, preț, radio indicator) cu comutare dinamică.
  - Logică JavaScript completă (`bookingState`, `selectService`, `selectSpecialist`, `selectDate`, `selectTime`, `updateSummaryUI`, `handleFormSubmit`).
  - Banner dinamic pentru zile aglomerate (afișat automat la selectarea zilelor de weekend marcate cu punct auriu).
  - Bară de control complet tradusă în limba română (`STARE:`, `Interactiv (Implicit)`, `Fără locuri (Waitlist)`, `Se încarcă`, `Eroare`, `Confirmare (Succes)`, `Text Lung`, `☀️ Mod Luminos` / `🌙 Mod Întunecat`).

### 3. Ce s-a făcut cu răspunsul
- Mock-ul oferă o experiență de utilizare autentică, curată și rafinată, aliniată perfect cu viziunea salonului boutique.

---

## Sesiunea 5 — 18 Noiembrie 2026: Flux Modern Inspirat din Rova & Integrare Catalog Real (Slimnic, Sibiu)

### 1. Ce s-a cerut
- Eliminarea textului meta de dezvoltator din starea Text Lung și înlocuirea cu o descriere reală de pachet premium de salon.
- Păstrarea barei de previzualizare de sus pentru verificarea stărilor (`Interactiv`, `Fără locuri`, `Se încarcă`, `Eroare`, `Confirmare`, `Text Lung`, `Mod Luminos/Întunecat`).
- Antet de studio compact și primitor cu locația Slimnic, Sibiu și buton de derulare lină către servicii.
- Organizarea serviciilor pe categorii clare:
  - Sprâncene: Laminare sprâncene (180 RON, 90 min), Pensat simplu (fără vopsit) (50 RON, 20 min).
  - Make-up: Make-up ocazie fără gene (150 RON, 1h 15m), Make-up ocazie cu gene (170 RON, 1h 30m), Make-up mireasă (220 RON, 2h).
- Afișarea interactivă a selecției specialistei, datei, orelor și formularului fără cont cu actualizarea dinamică a rezumatului și prețului.
- Actualizarea datelor reale în documentația de proiect (`README.md` și `OPEN-QUESTIONS.md`).

### 2. Ce s-a primit de la AI
- **Mock redesenat conform fluxului Rova:** `docs/design/mocks/DS-pub-booking.html` actualizat cu layout aerisit, hero primitor și carduri structurate pe categorii.
- **Starea Text Lung reformatată:** Înlocuită cu „Make-up Mireasă & Pachet Complet de Pregătire a Tenului”, cu detalii reale de salon (mască, kit de retuș, instrucțiuni prealabile).
- **Actualizare `docs/agents/OPEN-QUESTIONS.md`:** Soluționată întrebarea `Q-005` cu privire la catalogul oficial de prețuri și durate; actualizată locația în `Q-002` (Slimnic, Sibiu).
- **Actualizare `README.md`:** Înregistrată locația salonului și catalogul complet de servicii și prețuri.

### 3. Ce s-a făcut cu răspunsul
- Mock-ul și documentația reflectă acum 100% cerințele de business și experiența de utilizare reală dorită de client.

---

## Sesiunea 6 — 18 Noiembrie 2026: Localizare Gura Râului & Partajare Strictă Specialiste

### 1. Ce s-a cerut
- Actualizarea locației studioului în antet și documentație: **Gura Râului, Sibiu**.
- În categoria „Sprâncene”, listarea tuturor celor 3 servicii reale:
  - *Laminare sprâncene* (180 RON, 90 min)
  - *Pensat cu vopsit* (70 RON, 30 min)
  - *Pensat simplu (fără vopsit)* (50 RON, 20 min)
- În categoria „Make-up”, păstrarea celor 3 servicii:
  - *Make-up ocazie (fără gene)* (150 RON, 1 h 15 min)
  - *Make-up ocazie (cu gene)* (170 RON, 1 h 30 min)
  - *Make-up mireasă* (220 RON, 2 h)
- Eliminarea completă a opțiunii „Oricine este disponibil” de la pasul de selecție specialistă (deoarece specializările nu se suprapun).
- Introducerea a două butoane dedicate, pentru sprâncene și make-up, cu legătură bidirecțională automată între categoria serviciului selectat și specialista responsabilă.
- Actualizarea corespunzătoare a documentației (`README.md` și `docs/agents/OPEN-QUESTIONS.md`).

### 2. Ce s-a primit de la AI
- **Actualizare `docs/design/mocks/DS-pub-booking.html`:**
  - Badge locație: `📍 Gura Râului, Sibiu`.
  - Catalog complet cu 6 servicii (3 sprâncene + 3 make-up).
  - Selector specialistă cu 2 butoane (`pill-brows` și `pill-makeup`), cu avatar, denumire și descriere domeniu.
  - Logică JavaScript sincronizată bidirecțional: selectarea unui serviciu activează automat specialista dedicată, iar click pe o specialistă filtrează/activează serviciul corespunzător.
- **Actualizare `docs/agents/OPEN-QUESTIONS.md`:** `Q-002` actualizată cu locația Gura Râului; `Q-005` actualizată cu toate cele 6 servicii reale și nota de partajare strictă pe specialiste.
- **Actualizare `README.md`:** Locația Gura Râului, Sibiu și catalogul complet de servicii și prețuri.

### 3. Ce s-a făcut cu răspunsul
- Toate cerințele de business și UX sunt sincronizate impecabil între mock-ul interactiv și documentația de guvernanță a proiectului.

---

## Sesiunea 7 — 18 Noiembrie 2026: Curățare Termeni Interni & Filtrare Directă pe Domeniu (Sprâncene / Make-up)

### 1. Ce s-a cerut
- Eliminarea etichetelor interne de rol ale specialistelor din interfața mock-ului `docs/design/mocks/DS-pub-booking.html`.
- Înlocuirea selecției la Pasul 2 cu două butoane simple și curate: *„Sprâncene”* și *„Make-up”*.
- Filtrarea dinamică a serviciilor și orelor la apăsarea pe „Sprâncene” sau „Make-up”.

### 2. Ce s-a primit de la AI
- **Actualizare `docs/design/mocks/DS-pub-booking.html`:**
  - Verificarea absenței etichetelor interne de rol ale specialistelor.
  - Pasul 2 redenumit „Alege Categoria & Orarul” cu 2 butoane rafinate: `Sprâncene` (🌿) și `Make-up` (💄).
  - Logică JavaScript `filterByCategory()`: la click pe „Sprâncene”, se afișează exclusiv serviciile de sprâncene; la click pe „Make-up”, se afișează exclusiv serviciile de machiaj.
  - Sincronizare automată a sumarului și ecranului de confirmare cu eticheta categoriei selectate (`Categorie: Sprâncene` / `Categorie: Make-up`).

### 3. Ce s-a făcut cu răspunsul
- Interfața este 100% orientată pe client, profesională, lipsită de mențiuni interne administrative.

---

## Sesiunea 8 — 18 Noiembrie 2026: Program Complet de Lucru (09:00 - 19:00), Zile Full & Listă de Așteptare Interactivă

### 1. Ce s-a cerut
- Actualizarea interactivității din `docs/design/mocks/DS-pub-booking.html` pentru a permite testarea completă a Zilelor Full și a Listei de Așteptare direct din modul Interactiv.
- Afișarea programului complet al zilei (toate intervalele orare din timpul programului de lucru 09:00 - 19:00, grupate pe Dimineața și După-amiaza), atât pe zilele normale cât și pe Zilele Full.
- Modelarea a două tipuri de Zile Full în calendar:
  1. *Zi Full cu câteva locuri libere* (ex: Sâmbătă 21 Nov) — banner alertă cu regula de 24h și posibilitatea de a rezerva sloturile rămase.
  2. *Zi Full complet ocupată* (ex: Duminică 22 Nov) — toate orele ocupate/dezactivate și afișarea imediată a formularului interactiv de înscriere pe Lista de Așteptare (cu alegere interval preferat, date contact și confirmare prioritară de 30 min).

### 2. Ce s-a primit de la AI
- **Actualizare `docs/design/mocks/DS-pub-booking.html`:**
  - Grilă completă de 20 de intervale orare (09:00 - 19:00) grupate pe Dimineața (`09:00` - `12:30`) și După-amiaza (`13:00` - `18:30`), cu contoare dinamice de disponibilitate.
  - Două Zile Full interactive:
    - `Sâm 21 Nov`: Marcată ca *Zi Full (3 locuri)*, banner cu regula strictă de anulare (min. 24h), cu orele 10:30, 14:30 și 17:30 selectabile.
    - `Dum 22 Nov`: Marcată ca *Complet Ocupat*, activează automat formularul inline de înscriere pe Lista de Așteptare (`#waitlist-interactive-card`), ascunzând formularul standard de rezervare.
  - Formular Waitlist complet funcțional: opțiuni radio pentru intervalul preferat (*Oricând în timpul zilei*, *Doar Dimineața*, *Doar După-amiaza*), notă de prioritate 30 minute și panou de confirmare instantă a înscrierii.
  - Trecerea înapoi pe o zi normală (Joi 19, Vineri 20, Luni 23, Marți 24) reactivează automat formularul standard de rezervare.

### 3. Ce s-a făcut cu răspunsul
- Mock-ul permite validarea interactivă directă și completă a două dintre cele mai importante reguli de business din proiect (Zile Full cu politică strictă și Waitlist automatizat cu fereastră de 30 min).

---

## Sesiunea 9 — 18 Noiembrie 2026: Aprobare DS-pub-booking & Mock-uri Administrare (DS-adm-login, DS-adm-calendar)

### 1. Ce s-a cerut
- Aprobarea formală a mock-ului pentru ecranul public de rezervare (`DS-pub-booking`) și marcarea lui ca `approved` în `docs/design/registry.yaml`.
- Desenarea mock-urilor pentru partea de administrare și recepție conform `registry.yaml`:
  1. `DS-adm-login`: Autentificare securizată în cont pentru personalul salonului.
  2. `DS-adm-calendar`: Calendarul recepției salonului cu vizualizare multi-coloană pe domenii (Sprâncene și Make-up), program de lucru (09:00 - 19:00), adăugare/editare/anulare programări, vizualizare servicii split cu etape libere intercalate, toggle Zile Full și panou dedicat pentru Lista de Așteptare.
- Salvarea fișierelor în `docs/design/mocks/` cu status `draft` în `registry.yaml`.
- Utilizarea strictă a token-urilor din `DESIGN.md`, formulare și etichete 100% în limba română, suport complet Light/Dark mode și acoperirea tuturor stărilor (`default/interactiv`, `empty`, `loading`, `error`, `success`).

### 2. Ce s-a primit de la AI
- **Actualizare `docs/design/registry.yaml`:**
  - `DS-pub-booking` actualizat la `status: approved`.
  - `DS-adm-login` și `DS-adm-calendar` asociate cu fișierele corespunzătoare în stadiul `draft`.
- **Mock `docs/design/mocks/DS-adm-login.html`:**
  - Formular elegant de login cu email, parolă, "Ține-mă minte" și recuperare parolă.
  - Butoane rapide de pre-completare demo pentru cele două roluri (Admin / Proprietară Sprâncene și Angajată Make-up).
  - Bară de control mock cu comutare între stările: `Interactiv (Implicit)`, `Se încarcă`, `Eroare Date`, `Succes / Redirecționare`, `Câmpuri Goale`, precum și comutator Light/Dark mode.
- **Mock `docs/design/mocks/DS-adm-calendar.html`:**
  - Calendar de zi/săptămână cu coloane paralele dedicate celor două specialiste / domenii (`🌿 Sprâncene` și `💄 Make-up`).
  - Interval complet orar de lucru (09:00 - 19:00) cu marcaje vizuale pentru programări.
  - Reprezentare specială pentru serviciul split de Laminare Sprâncene: etapele de acțiune libere sunt evidențiate vizual ca sloturi sigure pentru intercalarea unui pensat simplu (20 min).
  - Modal interactiv de detalii programare (cu acțiuni de anulare rapidă și notificare automată a listei de așteptare).
  - Modal interactiv de adăugare programare telefonică/la recepție cu validare automată.
  - Buton interactiv pentru activarea/dezactivarea regimului de „Zi Aglomerată (Zi Full)” cu banner de avertizare privind politica de anulare la sub 24h.
  - Modal de vizualizare și gestiune a Listei de Așteptare (Waitlist) cu contor de clienți în așteptare și declanșare ofertă prioritară valabilă 30 min.
  - Sistem de notificări Toast și bară completă de testare a stărilor (`Interactiv`, `Fără Programări (Empty)`, `Se încarcă`, `Eroare Conexiune`, `Succes`).

### 3. Ce s-a făcut cu răspunsul
- Mock-urile de administrare sunt complete, funcționale și gata pentru inspecție și validare din partea utilizatorului înainte de implementarea backend-ului și a componentelor React.

---

## Sesiunea 10 — 18 Noiembrie 2026: Aprobare DS-adm-login/calendar & Mock-uri DS-pub-manage, DS-adm-services

### 1. Ce s-a cerut
- Aprobarea formală a mock-urilor de administrare `DS-adm-login` și `DS-adm-calendar` și marcarea lor ca `approved` în `docs/design/registry.yaml`.
- Desenarea următoarelor două mock-uri esențiale din `registry.yaml`:
  1. `DS-pub-manage`: Gestiunea programării de către clientă prin link securizat din email (cu posibilitate de reprogramare și blocarea strictă a anulării sub 24h în Zilele Full).
  2. `DS-adm-services`: Gestiunea catalogului de servicii, prețurilor și configurarea etapelor de lucru activ vs. pauze de acțiune pentru intercalări (split services).
- Salvarea în `docs/design/mocks/` cu status `draft` în `registry.yaml`.
- Utilizarea token-urilor din `DESIGN.md`, formulare și etichete 100% în limba română, interactivitate completă, stări (`default/interactiv`, `empty`, `loading`, `error`, `success`) și comutator Light/Dark mode.

### 2. Ce s-a primit de la AI
- **Actualizare `docs/design/registry.yaml`:**
  - `DS-adm-login` și `DS-adm-calendar` actualizate la `status: approved`.
  - `DS-pub-manage` și `DS-adm-services` legate la fișierele mock create în `docs/design/mocks/` cu `status: draft`.
- **Mock `docs/design/mocks/DS-pub-manage.html`:**
  - Card detaliat de prezentare a rezervării (serviciu, dată, oră, preț, clientă, locație Gura Râului, Sibiu).
  - Bară de scenarii interactive pentru testarea regulilor de business:
    - *Zi Normală:* Anulare permisă oricând online.
    - *Zi Full (> 24h rămase):* Anulare permisă cu atenționare.
    - *Zi Full (< 24h rămase):* Buton de anulare dezactivat/blocat cu iconiță de lacăt și banner de avertizare (contact telefonic la salon pentru urgențe).
  - Modal interactiv de reprogramare: selecție dinamică a unei noi zile și slot orar liber, cu actualizarea în timp real a datelor programării.
  - Modal de confirmare a anulării cu eliberarea intervalului pentru lista de așteptare.
  - Stări preview complete în bara de sus: `Interactiv`, `Se încarcă` (skeleton loader), `Link Expirat / Nevalid`, `Programare Anulată`, `Fără Rezervare Activă (Empty)`, comutator Light/Dark mode.
- **Mock `docs/design/mocks/DS-adm-services.html`:**
  - Prezentare completă a celor 6 servicii reale grupate pe categorii (`Sprâncene` și `Make-up`).
  - Filtre dinamice pe categorii (*Toate Serviciile*, *Sprâncene*, *Make-up*).
  - Reprezentare grafică tip timeline proporțional pentru cele 5 etape ale serviciului split de Laminare Sprâncene (45 min lucru activ vs 45 min pauze libere pentru intercalare).
  - Modal complex de configurare etape split: adăugare/ștergere etape, setare tip (Ocupat vs Liber) și durată, calculator în timp real al balanței de minute (90 min) cu validare vizuală.
  - Modal de adăugare serviciu nou și sistem integrat de notificări Toast.
  - Stări preview: `Interactiv`, `Fără Servicii (Empty)`, `Se încarcă`, `Eroare Salvare` (când minutele etapelor nu însumează durata totală), `Succes`, comutator Light/Dark mode.

### 3. Ce s-a făcut cu răspunsul
- Toate ecranele cheie ale fluxului public (rezervare, gestiune) și administrativ (autentificare, calendar recepție, configurare servicii/split) au mock-uri validate și conforme cu sistemul de design. Proiectul este pregătit pentru trecerea la etapa de planificare tehnică (`/plan`) a implementării backend și frontend.

---

## Sesiunea 11 — 18 Noiembrie 2026: Aprobare Ecrane, Generare Design Figma (MCP) & Finalizare Pasul D (Design)

### 1. Ce s-a cerut
- Aprobarea formală a mock-urilor interactive pentru `DS-pub-manage` (Gestiune Programare Client via Token Securizat) și `DS-adm-services` (Gestiune Servicii & Configurator Etape Split).
- Marcarea ambelor ecrane ca `approved` în `docs/design/registry.yaml`.
- Folosirea uneltelor MCP Figma pentru generarea nativă a tuturor celor 5 ecrane aprobate (`DS-pub-booking`, `DS-pub-manage`, `DS-adm-login`, `DS-adm-calendar`, `DS-adm-services`) în fișierul Figma dedicat: `https://www.figma.com/design/Tl2JUVQKpVMcApSRJ56N9V/Untitled`.
- Actualizarea `docs/design/registry.yaml` și `AI_LOG.md` cu link-urile directe către frame-urile Figma generate.
- Clarificarea următorului pas conform metodologiei din proiect după finalizarea Pasului D.
- Realizarea unui commit Git cu toate modificările și fișierele create în Pasul D (Design).

### 2. Ce s-a primit de la AI
- **Actualizare `docs/design/registry.yaml`:**
  - `DS-pub-manage` și `DS-adm-services` actualizate la `status: approved`.
  - Toate cele 5 ecrane conțin acum referințele directe `figma_ref` către frame-urile Figma generate.
- **Generare nativă Figma prin MCP (`use_figma` & Plugin API):**
  - Autentificare și creare sesiune de lucru în Figma (`Tl2JUVQKpVMcApSRJ56N9V`).
  - Creare cadre native cu Auto Layout, paleta cromatică din `DESIGN.md` (Nude Rose, Terracotta, Linen, Deep Espresso, Gold), fonturile oficiale `Playfair Display` și `Plus Jakarta Sans`:
    1. **`DS-pub-booking` (Wizard Rezervare Client):** Node ID `4:2` → [Figma Frame 4:2](https://www.figma.com/design/Tl2JUVQKpVMcApSRJ56N9V/Untitled?node-id=4-2)
    2. **`DS-pub-manage` (Gestiune Programare Client):** Node ID `5:2` → [Figma Frame 5:2](https://www.figma.com/design/Tl2JUVQKpVMcApSRJ56N9V/Untitled?node-id=5-2)
    3. **`DS-adm-login` (Autentificare Personal):** Node ID `5:43` → [Figma Frame 5:43](https://www.figma.com/design/Tl2JUVQKpVMcApSRJ56N9V/Untitled?node-id=5-43)
    4. **`DS-adm-calendar` (Calendar Recepție Salon):** Node ID `6:2` → [Figma Frame 6:2](https://www.figma.com/design/Tl2JUVQKpVMcApSRJ56N9V/Untitled?node-id=6-2)
    5. **`DS-adm-services` (Gestiune Servicii & Etape Split):** Node ID `7:2` → [Figma Frame 7:2](https://www.figma.com/design/Tl2JUVQKpVMcApSRJ56N9V/Untitled?node-id=7-2)
- **Ghidare metodologică pentru pasul următor:**
  - Încheierea cu succes a Pasului D (Design & Mockup-uri).
  - Trecerea la **Etapa de Arhitectură & Planificare Tehnică (`/plan`)** înainte de scrierea codului sursă (`/build`).

### 3. Ce s-a făcut cu răspunsul
- Registrul de design și fișierul Figma sunt sincronizate 100% cu sistemul de design și deciziile aprobate. S-a realizat commit-ul local în Git pentru întreaga etapă de Design.

---

## Sesiunea 12 — 18 Noiembrie 2026: Închiderea Tuturor Întrebărilor Deschise (Q-002..Q-004) & Decizia D-004

### 1. Ce s-a cerut
- Audit critic al documentației de proiect (`README.md`, `CONTEXT.md`, `OPEN-QUESTIONS.md`, mock-uri `docs/design/mocks/`) pentru identificarea oricăror neconcordanțe, ambiguități sau lacune înainte de faza de cod.
- Confirmarea răspunsurilor finale pentru toate întrebările deschise rămase:
  1. Defalcarea exactă a etapelor de Laminare Sprâncene (Q-004).
  2. Programul săptămânal detaliat pe specialiste (inclusiv regimul de Duminică).
  3. Comportamentul rezervării sloturilor intercalate pe site (Public vs. Recepție).
  4. Mecanismul de blocare a slotului pentru Lista de Așteptare (Waitlist 30 min).
  5. Datele reale ale studioului (Ioana - Sprâncene, Ana - Make-up, adresă, telefon Q-002, Q-003) și includerea Mailpit pentru dezvoltare.
- Actualizarea `docs/agents/OPEN-QUESTIONS.md` și `docs/agents/DECISIONS.md`.

### 2. Ce s-a primit de la AI
- **Audit de coerență:** Identificate diferențele dintre placeholderul vechi din Q-004 și mock-urile aprobate, precum și necesitatea specificării orarului de Duminică.
- **Actualizare `docs/agents/OPEN-QUESTIONS.md`:**
  - `Q-002` marcat ca `answered`: Beauty Studio, Str. Principală nr. 45, Gura Râului, Sibiu, tel. 0756 062 883.
  - `Q-003` marcat ca `answered`: Ioana (Admin/Recepție, Sprâncene) și Ana (Colega, Angajată, Make-up).
  - `Q-004` marcat ca `answered`: 15m (lucru) / 20m (liber) / 15m (lucru) / 25m (liber) / 15m (lucru) = 90m total.
  - **Stare ledger: 0 întrebări deschise rămase** (toate Q-001..Q-005 sunt complet soluționate).
- **Înregistrare Decizie aprobată `D-004` (`DECISIONS.md`):**
  - Orar: Luni–Sâmbătă 09:00–19:00 (ambele), Duminică 09:00–19:00 exclusiv Make-up (Ana).
  - Intercalare split direct din wizard-ul public (Opțiunea A).
  - Blocare exclusivă a slotului eliberat timp de 30 min pentru clientul din Waitlist.
  - Integrare container Mailpit (port 1025 SMTP / port 8025 Web) în Docker Compose.
- **Actualizare `README.md` și `CONTEXT.md`:** Sincronizate numele specialistelor, adresa fizică, telefonul, orarul și termenul de vocabular `Mailpit`.

### 3. Ce s-a făcut cu răspunsul
- Domeniul de business și cerințele tehnice sunt 100% clare, consistente și complete. Nu mai există nicio necunoscută sau contradicție, proiectul având undă verde totală pentru începerea implementării backend-ului și bazei de date.

---

## Sesiunea 13 — 18 Noiembrie 2026: Schema Prisma, Seed & Algoritm Disponibilitate Split

### 1. Ce s-a cerut
- Implementarea schemei Prisma pentru baza de date PostgreSQL: modele `User`, `Service`, `ServiceStep`, `Appointment`, `AppointmentStep`, `Schedule`, `ScheduleException`, `Waitlist`.
- Migrare inițială (`0_init`) și script de seed (`seed.ts`) cu datele reale ale studioului (specialistele Ioana și Ana, serviciile standard și split, programul săptămânal D-004).
- Algoritmul de disponibilitate cu suport split-service: calculul sloturilor libere ținând cont de etapele de lucru și de pauză ale laminării, intercalarea altor programări în ferestrele de pauză.
- Teste unitare (`availability.spec.ts`, `concurrency.spec.ts`) pentru validarea corectitudinii sloturilor calculate și a prevenirii suprapunerilor.
- Setup Docker Compose cu container PostgreSQL și Dockerfile NestJS.

### 2. Ce s-a primit de la AI
- **Schema Prisma completă** (`server/prisma/schema.prisma`): toate modelele cu relații, enum-uri (`Role`, `AppointmentStatus`, `DayOfWeek`) și câmpuri conform deciziilor aprobate.
- **Migrare SQL** (`server/prisma/migrations/0_init/migration.sql`): DDL generat automat din schema Prisma.
- **Script de seed** (`server/prisma/seed.ts`): populare cu utilizatorii Ioana (Sprâncene) și Ana (Make-up), serviciile standard și serviciul split Laminare Sprâncene (5 etape: 15m/20m/15m/25m/15m), programul săptămânal complet.
- **Modul Availability** (`server/src/modules/availability/`): serviciu, controller și tipuri pentru calculul sloturilor, cu logică de intercalare split.
- **Modul Appointments** (`server/src/modules/appointments/`): serviciu pentru gestionarea programărilor.
- **Teste** (`server/test/availability.spec.ts`, `server/test/concurrency.spec.ts`).
- **Docker Compose** (`docker-compose.yml`) cu PostgreSQL 16 și **Dockerfile** NestJS multi-stage.

### 3. Ce s-a făcut cu răspunsul
- Toate fișierele au fost create și comise local pe branch-ul `feat/db-schema-and-availability`. Schema, seed-ul și algoritmul sunt pregătite pentru testare integrată.

---

## Sesiunea 14 — 19 Noiembrie 2026: Funcționalitate Fidelizare (D-005) & Ecran „Contul Meu"

### 1. Ce s-a cerut
- Adăugarea unui program de fidelizare pentru clientele cu cont: la fiecare a 5-a vizită finalizată (ciclu repetat), reducere automată de 10%.
- Formularea propunerii de decizie D-005, confirmată de utilizator cu 3 clarificări: ciclu repetat (5, 10, 15…), aplicare automată la booking, numărare per total studio.
- Înregistrarea D-005 în `docs/agents/DECISIONS.md`, actualizarea `CONTEXT.md`, `README.md`.
- Adăugarea ecranului `DS-pub-auth` („Contul Meu & Fidelizare") în `docs/design/registry.yaml` cu status `draft`.
- Generarea mock-up-ului HTML (`docs/design/mocks/DS-pub-auth.html`) folosind token-urile din `DESIGN.md`.

### 2. Ce s-a primit de la AI
- **PROPOSAL D-005** formulată conform gate-ului din AGENTS.md cu cele 3 întrebări de clarificare, confirmată de utilizator.
- **`docs/agents/DECISIONS.md`:** D-005 adăugată (approved, confirmed 2026-11-19) cu regula completă: ciclu repetat de 5 vizite, 10% reducere automată server-side, numărare per studio.
- **`CONTEXT.md`:** Termen nou „Fidelizare" cu definiția oficială.
- **`README.md`:** Secțiunea 2.C nouă „Programul de Fidelizare Automată (D-005)" și actualizarea rolului Client cu referință la fidelizare.
- **`docs/design/registry.yaml`:** `DS-pub-auth` actualizat: nume „Contul Meu & Fidelizare", descriere extinsă cu D-005, `design_ref: mocks/DS-pub-auth.html`, status `draft`.
- **Mock-up HTML** (`docs/design/mocks/DS-pub-auth.html`): ecran complet cu card progres fidelizare (inel 4/5 vizite), badge -10%, callout pentru următoarea reducere, lista programărilor viitoare (cu reducere evidențiată pe vizita #5), istoric cu 4 programări finalizate, secțiune cont cu avatar și acțiuni. Token-uri DESIGN.md: Nude Rose, Gold, Linen, Playfair Display + Plus Jakarta Sans, radii, shadow-uri.

### 3. Ce s-a făcut cu răspunsul
- Toate fișierele de documentație au fost actualizate. Mock-up-ul HTML este pregătit pentru confirmare vizuală de către utilizator înainte de implementare.


---

## Sesiunea 15 — 19 Noiembrie 2026: Grilă de previzualizare pentru platformă

### 1. Ce s-a cerut
- O pagină HTML cu cele șase mock-up-uri ale platformei, inclusiv „Contul meu și fidelizare” (DS-pub-auth), care să respecte token-urile din DESIGN.md.
- Includerea grilei și a modificărilor D-005 din sesiunea anterioară în același commit pe branch-ul feat/db-schema-and-availability.

### 2. Ce s-a primit de la AI
- Pagina docs/design/mocks/preview-grid.html afișează cele șase mock-up-uri din registru într-o grilă cu două coloane pe ecrane late și o coloană pe ecrane înguste.
- Titlul fiecărui card deschide documentul HTML corespunzător. Grila preia paleta luminoasă și întunecată, fonturile și spațierea din DESIGN.md.

### 3. Ce s-a făcut cu răspunsul
- Grila a fost adăugată lângă mock-up-uri pentru a permite revizuirea lor dintr-o singură pagină.

---

## Sesiunea 16 — 19 Noiembrie 2026: Navigare din mock-up-ul de rezervare

### 1. Ce s-a cerut
- Link către contul clientei în cardul Beauty Studio, previzualizarea unei vizite eligibile pentru reducerea D-005 și link de acces pentru echipă în footer.
- Verificarea vizuală a ecranului de rezervare direct și în grila platformei.

### 2. Ce s-a primit de la AI
- DS-pub-booking leagă pagina de rezervare de DS-pub-auth și DS-adm-login.
- Comutatorul „Clientă autentificată” afișează reducerea de 10% în card, sumar, butonul de confirmare și ecranul de succes.

### 3. Ce s-a făcut cu răspunsul
- Linkurile și starea de fidelizare au fost testate în Chrome. Previzualizarea a fost verificată pe desktop și mobil, în ambele teme.

---

## Sesiunea 17 — 19 Noiembrie 2026: Autentificare clientă în mock-up

### 1. Ce s-a cerut
- Flux navigabil de la rezervare la autentificare sau creare cont, apoi la panoul de fidelizare și înapoi la rezervare cu reducerea activă.

### 2. Ce s-a primit de la AI
- DS-pub-auth afișează formularele demo, panoul cu progresul 4/5 și istoricul, precum și acțiunile „Programare nouă cu −10%” și „Deconectare”.
- Sesiunea demo păstrează în sessionStorage doar indicatorul de autentificare. DS-pub-booking activează automat reducerea pentru vizita demonstrată.
- Grila și registrul de design descriu traseul de autentificare și fidelizare.

### 3. Ce s-a făcut cu răspunsul
- Fluxul a fost verificat în Chrome, direct și în grilă, inclusiv după reîncărcare și deconectare.

---

## Sesiunea 18 — 19 Noiembrie 2026: Planul complet al proiectului

### 1. Ce s-a cerut
- Un document de prezentare pentru Beauty Studio, cu obiective, etape, arhitectură, reguli de business și stadiul componentelor.

### 2. Ce s-a primit de la AI
- [PLAN.md](PLAN.md) sintetizează interviul, deciziile D-001–D-005, cele șase mock-up-uri și fluxul de Fidelizare, schema Prisma, algoritmul de disponibilitate și pașii pentru backend și frontend.
- Verificarea codului a evidențiat diferența dintre calculul disponibilității pe etape și verificarea tranzacțională pe durata integrală a programării.

### 3. Ce s-a făcut cu răspunsul
- Planul a fost adăugat în rădăcina repository-ului și legat din secțiunea de documentație a README-ului.

---

## Sesiunea 19 — 19 Noiembrie 2026: Plan dedicat pentru autentificarea clientei și Fidelizare

### 1. Ce s-a cerut
- Documentarea implementărilor din `fae02c7` și `8a0af79` pentru navigarea din rezervare, reducerea demonstrativă și fluxul de cont al clientei.

### 2. Ce s-a primit de la AI
- Planul descrie linkurile de cont și echipă, simularea reducerii de 10%, formularele de autentificare și înregistrare, sesiunea demo, panoul 4/5 și comportamentul după deconectare.

### 3. Ce s-a făcut cu răspunsul
- Planul și criteriile de verificare au fost salvate în [docs/agents/PLAN-CLIENT-AUTH.md](docs/agents/PLAN-CLIENT-AUTH.md).

---

## Sesiunea 20 — 19 Noiembrie 2026: Rezervare fără cont și rolurile personalului

### 1. Ce s-a cerut
- Evidențierea rezervării fără cont, o agendă proprie pentru Ana și navigare separată pentru Admin și Specialistă Make-up.

### 2. Ce s-a primit de la AI
- Mesaj de rezervare fără cont și Fidelizare în `DS-pub-booking`, selector demonstrativ de rol în `DS-adm-login` și filtru pe specialistă cu acces la servicii în `DS-adm-calendar`.
- Agenda demonstrativă `DS-emp-calendar` în `DS-emp-schedule.html`, cu detalii clientă, stări de programare, blocarea pauzelor sau concediilor și revenire la login.

### 3. Ce s-a făcut cu răspunsul
- Cele patru ecrane au fost înregistrate ca `draft`. Ghidul de design și grila cu șapte ecrane au fost actualizate. Confirmarea Q-002–Q-005 a fost consemnată în registrul proiectului.
- În Chrome au fost verificate cele două fluxuri de rezervare ca vizitator, destinațiile rolurilor, filtrul și acțiunile din agendă. Ecranele au fost verificate la 390 și 1440 px în Light și Dark Mode, cu capturi desktop salvate în `docs/design/screens/`.
- Ledger lint a trecut cu ieșire UTF-8. Verificarea configurației Compose a trecut. Verificarea containerelor în execuție a fost indisponibilă deoarece motorul Docker Desktop era oprit.

---

## Sesiunea 21 — 19 Noiembrie 2026: Acces client și rapoarte Admin

### 1. Ce s-a cerut
- Redenumirea titlului în „Acces client” și adăugarea unui raport demonstrativ pentru rolul Admin, accesibil din Calendar și Servicii.

### 2. Ce s-a primit de la AI
- `DS-adm-reports` cu indicatori, defalcări pe categorii, servicii și specialiste, filtru pe cele trei perioade și export în CSV sau prin dialogul de salvare PDF.
- Acces la raport pe baza rolului demo din sesiunea de personal. O sesiune de angajat, una fără rol sau deconectarea duc la starea de acces restricționat, inclusiv în grila de previzualizare.

### 3. Ce s-a făcut cu răspunsul
- Grila, registrul, ghidul de design și planul proiectului au fost actualizate pentru opt ecrane. Rapoartele și revizia ecranului Servicii sunt în `draft`.
- Chrome a verificat traseul public, accesul pe roluri, deconectarea, toate perioadele, totalurile și exporturile. Rapoartele și navigarea Admin au fost verificate la 390 și 1440 px în Light și Dark Mode. Titlul public a fost verificat în tema disponibilă în mock.
- Ledger lint și validarea configurației Compose au trecut. Motorul Docker Desktop era oprit la verificarea containerelor în execuție.

---

## Sesiunea 22 — 24 Noiembrie 2026 — Sprint 1: catalog și disponibilitate

### 1. Ce s-a cerut

- Limitarea livrării la schema Prisma, seed și endpointurile publice de catalog și disponibilitate, cu testele pentru intercalarea la Laminare sprâncene.

### 2. Ce s-a implementat

- Specializarea este înregistrată în Prisma și populată prin seed pentru Ioana (Sprâncene) și Ana (Make-up).
- `GET /api/services` afișează serviciile active și etapele ordonate, alături de specialiste și categoriile lor. `GET /api/availability` validează identificatorii, data calendaristică și compatibilitatea serviciului cu specialista.

### 3. Verificare

- Testele HTTP au fost rulate înainte de implementare. Catalogul a răspuns cu 404, iar o combinație incompatibilă serviciu–specialistă a răspuns cu 200. Intercalarea a trecut deja.
- După migrare și două rulări ale seed-ului în baza PostgreSQL izolată, au trecut 15 teste în două suite, inclusiv ferestrele de 20 și 25 de minute și programul de duminică. Aserțiunile existente au fost păstrate. Build-ul NestJS, validarea Compose și ledger lint au trecut.
- Serverul pornit prin Compose a răspuns prin HTTP cu 6 servicii, 2 specialiste și 97 de sloturi Make-up pentru duminica de test.
- Lucrul din afara sprintului a fost păstrat local într-un branch de rezervă și un stash. Verificarea acestui sprint a vizat API-ul.

---

## Sesiunea 23 — 25 Noiembrie 2026 — Review Sprint 1 (Partea G)

- Review-ul diferențelor față de `main` a identificat două blocaje. Migrarea Prisma lăsa categoriile specialistelor existente necompletate, iar proprietatea duplicată `appointmentStage` oprea compilarea suitei de concurență cu `TS1117`.
- Commitul `4384225` completează categoriile aprobate pentru Ioana (`BROWS`) și Ana (`MAKEUP`) în migrare. Verificarea pe o bază PostgreSQL cu date din schema veche a confirmat că orarele săptămânale personalizate sunt păstrate. Mock-ul de concurență simulează blocarea tranzacțională, cu aceleași aserțiuni.
- În Docker au trecut toate cele 17 teste din trei suite, inclusiv testele HTTP cu PostgreSQL, build-ul NestJS, validarea Prisma și aplicarea migrărilor pe o bază nouă. Configurația Compose, `git diff --check` și ledger lint cu `PYTHONUTF8=1` au trecut.

---

## Sesiunea 24 — 25 Noiembrie 2026 — Sprintul 2 · Rezervarea publică fără cont

- `POST /api/bookings` validează datele de contact și salvează programarea `CONFIRMED` cu etapele ei în UTC. Datele vizitatoarei rămân pe programare. Serverul blochează rândul specialistei și revalidează doar suprapunerile între etapele ocupate.
- Confirmarea SMTP se trimite prin Mailpit după commit. La eșec, programarea rămâne confirmată, Serverul înregistrează eroarea și pagina afișează starea trimiterii.
- Pagina React `DS-pub-booking` rulează prin Vite în Compose pe portul 5173 și afișează orele în `Europe/Bucharest`. Revizia mock-ului include formularul fără cont și ambele stări ale confirmării prin e-mail.
- Cele 10 teste noi au primit `404` înaintea implementării. Pe PostgreSQL și Mailpit izolate au trecut apoi toate cele 27 de teste din patru suite, inclusiv cursa `201/409`, intercalarea în ambele ordini, trecerile la ora de vară și de iarnă și eșecul SMTP. Aserțiunile existente au fost păstrate. Migrarea a păstrat programarea din schema anterioară. Build-urile NestJS și Vite, validarea Prisma, configurația Compose și ledger lint cu `PYTHONUTF8=1` au trecut.
- Chrome a parcurs rezervarea, revenirea după `409` și confirmarea capturată în Mailpit. Au fost verificate tastatura, temele Light și Dark, lățimile de 390 și 1440 px și stările de încărcare, eroare, text lung și lipsă de sloturi. Prima pornire a relevat `ECONNREFUSED` în proxy cât timp pornea NestJS. Compose a fost ajustat să pornească frontendul după verificarea catalogului.
- Auditul npm al dependențelor de rulare a raportat aceleași 13 alerte pentru Server ca înainte de Sprintul 2.
- Pentru pornirea locală, construiește imaginile `server` și `frontend`, pornește PostgreSQL și Mailpit, apoi aplică migrările cu `docker compose run --rm --no-deps server npx prisma migrate deploy`. Rulează `npm run prisma:seed` în containerul Serverului pentru o bază goală. Pornește pagina cu `docker compose up -d --renew-anon-volumes server frontend` și deschide `http://localhost:5173`.

---

## Sesiunea 25 — 25 Noiembrie 2026 — Review Sprint 2 (Partea G)

- Review-ul commitului `36e6c6f` față de `main` a verificat migrarea, păstrarea datelor vizitatoarei pe programare, tranzacția pe etape, confirmarea după commit și fluxul public în Docker.
- Blocaj de integrare. Disponibilitatea publică a returnat 103 sloturi pentru 6 ianuarie 2020. Tranzacția de rezervare verifică orarul și suprapunerile, însă poate accepta un slot care a început deja și îl poate salva ca `CONFIRMED`. Este necesară excluderea acestor sloturi din disponibilitatea publică și respingerea lor la rezervare, inclusiv pentru orele deja trecute din ziua curentă.
- Au trecut toate cele 27 de teste din patru suite în Docker, cu PostgreSQL și Mailpit izolate, precum și `git diff --check main` și ledger lint cu `PYTHONUTF8=1`. Suitele actuale nu acoperă sloturile trecute. Integrarea în `main` rămâne blocată.

### Închiderea blocajului

- Disponibilitatea exclude sloturile al căror început a trecut. `POST /api/bookings` răspunde cu `400` pentru aceleași sloturi și verifică din nou ora în tranzacție, înainte de salvare.
- Cele trei teste de regresie au reprodus problema înainte de corecție. Disponibilitatea afișa ore din ziua anterioară, iar încercările de rezervare pentru un slot din ziua anterioară și unul deja trecut din ziua curentă primeau `201`.
- După corecție au trecut toate cele 30 de teste din patru suite în Docker, inclusiv verificarea că rezervările respinse nu sunt salvate și nu trimit e-mail. Au trecut și build-ul NestJS, validarea Compose și ledger lint cu `PYTHONUTF8=1`. Review-ul poate fi integrat în `main`.

---

## Sesiunea 26 — 26 Noiembrie 2026 — Plan Sprintul 3 · Portal client

- S-a cerut un plan pentru extinderea rezervării după mock-up-urile HTML, Waitlist, accesul clientei și Fidelizare, politica de anulare și reprogramare, plus remindere programate și idempotente prin Mailpit.
- `main` era sincronizat cu `origin/main`. Planul a fost redactat pe branch-ul `feat/sprint-3-client-portal` cu fișiere, teste, verificări vizuale și ordinea implementării. [Planul Sprintului 3](docs/plans/sprint-3-client-portal.md)
- Pragul documentat pentru reminder este 24 h. Q-006–Q-009 consemnează politica Zi Full și marcările, identitatea clientei, alocarea reducerii și operațiile Admin, respectiv comportamentul reminderelor pentru programări apropiate și reprogramări. Planul rămâne în revizie înainte de `/build`. [Întrebări deschise](docs/agents/OPEN-QUESTIONS.md)
- Ledger lint cu `PYTHONUTF8=1` a trecut, inclusiv după normalizarea registrului. Testele aplicației și pornirea în Docker fac parte din etapa de implementare.

---

## Sesiunea 27 — 26 Noiembrie 2026 — Build Sprintul 3 · Portal client

- Utilizatorul a aprobat planul și regulile Q-006–Q-009. Commitul `18eb7f1` le-a înregistrat ca D-006–D-009, cu D-008 în locul D-005. [Decizii](docs/agents/DECISIONS.md) · [Plan](docs/plans/sprint-3-client-portal.md)
- Migrarea adaugă sesiuni, câmpuri pentru preț și Fidelizare, marcări, oferte Waitlist și starea trimiterilor. Gestiunea verifică pragul de 24 h și Zi Full pe Server. Operațiile Admin pot înregistra anularea târzie, finaliza vizita și reseta marcările.
- Înregistrarea confirmă controlul e-mailului înainte de acces la programările și înscrierile asociate. Waitlist înscrie vizitatoare fără cont, protejează etapa oferită, notifică prima clientă eligibilă și rotește oferta după expirare. Cronul trimite un reminder per programare confirmată în fereastra de 2–24 h.
- Cele patru teste inițiale au reprodus endpointurile și linkul încă neimplementate. Prima integrare a identificat o constrângere incompatibilă cu asocierea datelor vizitatoarei și validarea unui ID din catalogul inițial. După corecții, toate cele 38 de teste din cinci suite au trecut în Docker, cu PostgreSQL și Mailpit izolate. Testele existente și-au păstrat aserțiunile. Au trecut și migrarea pe bază goală, migrarea cu date din Sprintul 2, validarea Prisma, build-urile NestJS și Vite, configurația Compose și ledger lint cu `PYTHONUTF8=1`.
- Verificarea Chrome a parcurs rezervarea și recuperarea după `409` cu păstrarea formularului, accesul cu tastatura, înscrierea Waitlist, asocierea după confirmarea e-mailului, anularea și revendicarea ofertei. Au fost verificate încărcarea, eroarea, textul lung și linkul incomplet. Am corectat derularea orizontală care depășea lățimea mobilă. Windows rezerva portul implicit Vite, așa că verificarea a folosit portul local 17173. [Capturi](docs/design/screens/)
- PATTERN-003 consemnează revendicarea persistentă a unei trimiteri. Rezultatele SMTP ambigue se reconciliază pe baza `Message-ID` înainte de o eventuală retrimitere. [Pattern-uri](docs/agents/PATTERNS.md)

---

## Sesiunea 28 — 26 Noiembrie 2026 — Review Sprintul 3 (Partea G)

- Review-ul față de `main` a confirmat politica de 24 h și Zi Full, blocarea după trei marcări și oferta Waitlist cu prioritate. Corecția de aliniere a antetului este în commitul `be31e06`. A fost verificată în Chrome în ambele teme la 390, 1024 și 1440 px după reconstruirea frontendului pe portul local 17173.
- D-008. Finalizarea vizitei a șasea înaintea celei de-a cincea inversa prețurile așteptate, 45 RON și 50 RON. Calculul comun parcurge vizitele eligibile în ordinea începerii și păstrează reducerea aferentă vizitei a cincea până la finalizare sau anulare.
- D-009. Eroarea înainte de SMTP lăsa marcajul de preluare setat. Cronul îl eliberează și reîncearcă eliberarea la următoarea rulare dacă PostgreSQL rămâne temporar indisponibil. După acceptarea SMTP, marcajul persistă în cazul unei erori la salvare, cu același `Message-ID` pentru reconciliere.
- Testele de regresie au reprodus alocarea greșită și cele două cazuri de reminder blocat înaintea corecției. Testul de după acceptarea SMTP a confirmat lipsa unei trimiteri suplimentare. După corecție au trecut toate cele 42 de teste din cinci suite în Docker, cu PostgreSQL și Mailpit izolate. Au trecut și buildul NestJS, validarea Prisma, aplicarea migrărilor și ledger lint cu `PYTHONUTF8=1`. Aserțiunile existente au fost păstrate.

---

## Sesiunea 29 — 26 Noiembrie 2026 — Blocarea slotului și confirmarea prin e-mail

- D-010 confirmă că rezervările fără cont, din cont și prin Waitlist pornesc în `PENDING_CONFIRMATION`. PostgreSQL protejează etapele ocupate în ambele stări active și permite intercalarea în pauzele serviciilor split. Serverul trimite o notificare de disponibilitate după commit, înainte de SMTP, iar paginile deschise recitesc sloturile. [Decizie](docs/agents/DECISIONS.md) · [Pattern SSE](docs/agents/PATTERNS.md)
- Linkul dedicat din e-mail confirmă programarea și etapele în aceeași tranzacție. Sumarul și gestiunea afișează avertismentul și acțiunea de retrimitere. Sumarul primește o credențială limitată la retrimiterea pe adresa existentă. Linkul de gestiune rămâne în e-mail. Reminderele se trimit pentru programări confirmate.
- Testele inițiale au reprodus starea `CONFIRMED` la creare. După implementare au trecut 44 de teste unitare și de integrare în Docker, validarea Prisma, buildurile NestJS și Vite, migrările pe o bază nouă și pe baza locală existentă și ledger lint cu `PYTHONUTF8=1`.
- Playwright a verificat două sesiuni Chrome, ora devenită indisponibilă, avertismentul, retrimiterea și confirmarea prin linkul preluat din Mailpit. O preluare HTTP a paginii de confirmare a păstrat starea în așteptare. Capturile acoperă sumarul și gestiunea în ambele teme, la 1440 px și 390 px. [Capturi](docs/design/screens/)
- Testul E2E se rulează din `frontend/` cu `npm ci`, `npx playwright install chromium` și `npm run test:e2e`, cu aplicația și Mailpit pornite în Docker Compose. Pentru Chrome instalat local se poate seta `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`.
