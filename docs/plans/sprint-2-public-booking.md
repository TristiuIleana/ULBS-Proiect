# Plan — Sprintul 2 · Rezervarea publică fără cont

**Dimensiune M.** Un flux public complet prin React, NestJS, PostgreSQL și Mailpit. Plan confirmat la 25 noiembrie 2026.

## Abordare

1. **API.** `POST /api/bookings` primește `serviceId`, `specialistId`, `slotUtcMs` (valoarea exactă `utcMs` din `/api/availability`) și datele de contact (`firstName`, `lastName`, `phone`, `email`). Serverul validează tipurile, numele, telefonul și e-mailul, derivă ziua în `Europe/Bucharest`, verifică specializarea și calculează prețul din catalog. Contractul propus întoarce `201` cu sumarul programării și starea trimiterii e-mailului, `400` pentru date invalide, `404` pentru serviciu sau specialistă indisponibilă în catalog și `409` pentru un slot pierdut.
2. **Persistență și concurență.** Programarea ca vizitatoare păstrează propriile date de contact și are `clientId` nul. Aceeași adresă poate fi folosită la rezervare fără asociere automată la un cont. În `AppointmentsService`, blocarea rândului specialistei cu `FOR UPDATE` precedă citirea disponibilității în aceeași tranzacție PostgreSQL la `READ COMMITTED`. Se reutilizează calculul din `AvailabilityService` pentru orar, excepții, grila de sloturi și coliziuni între etape ocupate pe intervale `[start, end)`. În aceeași tranzacție se salvează programarea și etapele în `CONFIRMED`. Constrângerea GiST rămâne protecția la nivel de bază de date, iar coliziunea produce `409`.
3. **Confirmare.** Mesajul SMTP pleacă spre Mailpit pe `mailpit:1025` după commit. Dacă trimiterea eșuează, Serverul înregistrează eroarea, păstrează programarea confirmată și comunică separat eșecul trimiterii. Se evită retrimiterea automată a cererii de rezervare.
4. **Pagină publică.** `frontend/` găzduiește aplicația Vite, React, TypeScript și Tailwind. Serviciul Compose expune `5173:5173`, Vite ascultă pe `0.0.0.0`, iar proxy-ul `/api` trimite cererile către `http://server:3000`. Dockerfile-ul și Compose folosesc același director de lucru, cu manifestul în calea montată și dependențele într-un volum separat. Pagina încarcă serviciile și specialistele compatibile din `/api/services`, apoi sloturile pentru data aleasă. La `409` actualizează sloturile și păstrează datele de contact. La `201` afișează sumarul în aceeași pagină.

## Fișiere vizate la implementare

| Acțiune | Fișiere | Rol |
| --- | --- | --- |
| Adaugă și modifică | `server/src/modules/appointments/`, `server/src/modules/availability/availability.service.ts` | Controller, validare, SMTP și reutilizarea calculului de disponibilitate în tranzacție. |
| Modifică | `server/prisma/schema.prisma`, migrare nouă în `server/prisma/migrations/`, `server/package.json` și lockfile-ul aferent | Persistența datelor de contact pentru vizitatoare, migrare compatibilă cu programările existente și client SMTP. |
| Adaugă și modifică | `docker-compose.yml`, `frontend/Dockerfile`, `frontend/package.json` și lockfile, configurarea Vite, TypeScript și Tailwind | Pornire din checkout curat și acces la API prin proxy. |
| Adaugă | `frontend/src/pages/public/BookingWizardPage.tsx`, punctul de intrare React și clientul API | Consumatorul contractelor de catalog, disponibilitate și rezervare. |
| Adaugă și actualizează | `server/test/public-booking.spec.ts`, `server/test/concurrency.spec.ts`, `docs/design/registry.yaml`, capturi `DS-pub-booking` | Regresii HTTP și PostgreSQL, mock-ul de concurență cu aserțiunile păstrate și verificarea vizuală. |

## Criterii de acceptare

| Comportament | Verificare |
| --- | --- |
| Rezervare fără cont, date invalide și specializare | Teste HTTP pe PostgreSQL în Docker. Cererile invalide lasă baza fără scrieri parțiale. O adresă existentă în conturi poate fi folosită fără modificarea sau asocierea contului. |
| Intercalare și concurență | Teste PostgreSQL reale pentru ambele ordini de rezervare, ferestrele de 20 și 25 min, respingerea serviciului de 30 min, limite adiacente, orarul de duminică și cereri simultane pentru același slot. O singură cerere reușește, celelalte primesc `409`. |
| E-mail după commit | Verificare în Mailpit pentru rezervarea confirmată, absența e-mailului la conflict și păstrarea programării la eșec SMTP simulat. |
| Pornire și parcurs complet | `docker compose config --quiet`, build NestJS și Vite, toate suitele Serverului, apoi pornire din checkout curat și verificare în browser la `http://localhost:5173`, inclusiv alegerea slotului, confirmarea și recuperarea după `409`. |

## Design

Revizia `DS-pub-booking` pentru rezervarea fără cont este confirmată. Se folosesc token-urile D-003 pentru paletă și tipografie. Se verifică Light și Dark la 390 și 1440 px, navigarea cu tastatura, focalizarea, încărcarea, lipsa sloturilor, eroarea, textul lung și confirmarea. Starea de succes rămâne în aceeași pagină. [Mock](../design/mocks/DS-pub-booking.html) · [Registru](../design/registry.yaml) · [Design](../design/DESIGN.md)

## Secvență, riscuri și limite

- Un singur builder aliniază contractul API cu formularul. După aprobarea planului, scrie întâi testele de backend, implementează tranzacția și confirmarea, apoi conectează frontendul și verifică parcursul complet în Docker.
- Migrarea trebuie verificată pe o bază cu programări existente. Calculul din `GET /api/availability` descrie disponibilitatea la momentul citirii, iar tranzacția decide dacă slotul mai poate fi rezervat.
- `AGENTS.md` nu prevede detalii sau anulare publică. Gestiunea prin token, inclusiv politica Zi Full, rămâne în etapa de gestiune din planul proiectului. Sprintul livrează e-mailul de confirmare. Conturile, Fidelizarea, Waitlist, reprogramarea, reminderele și calendarul de echipă sunt în afara sprintului. [AGENTS.md](../../AGENTS.md) · [Planul proiectului](../../PLAN.md)

## Cunoaștere folosită și confirmări

- Confirmate anterior. D-001 și PATTERN-001 pentru execuție în Docker, C-001 pentru interfața Serverului consumată de frontendul nou, D-002 pentru stivă și blocare la nivel de rând, D-004 pentru orar, intercalare și Mailpit, Q-003–Q-005 pentru specialiste, etape și catalog. [Decizii](../agents/DECISIONS.md) · [Pattern-uri](../agents/PATTERNS.md) · [Contracte](../agents/CONTRACTS.md) · [Întrebări](../agents/OPEN-QUESTIONS.md)
- Confirmate la 25 noiembrie 2026. D-003 pentru designul paginii, revizia mock-ului `DS-pub-booking`, păstrarea datelor vizitatoarei pe programare și înregistrarea erorii SMTP cu păstrarea programării.
- D-005 și regula Waitlist din D-004 se aplică în etapele lor de produs. Testele HTTP ale Sprintului 1 sunt o referință pentru informare privind mediul PostgreSQL existent. [Teste Sprintul 1](../../server/test/sprint-1.spec.ts)
