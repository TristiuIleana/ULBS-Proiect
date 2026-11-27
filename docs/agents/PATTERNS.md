# Patterns — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> How we build things here. Copy only `approved` entries. `candidate` = seen once or
> not yet confirmed; agents add these freely. Promotion needs the user's OK.
<!-- graffino-agentic:end -->

## Index
- PATTERN-001 · Containerized server execution · approved
- PATTERN-002 · Recheck slot availability after a PostgreSQL row lock · candidate
- PATTERN-003 · Durable claim before a scheduled SMTP send · candidate
- PATTERN-004 · Reîncarcă disponibilitatea după commit prin SSE · candidate
- PATTERN-005 · Verifică același termen la citirea și reutilizarea unui slot · candidate
- PATTERN-006 · Verifică aceeași sesiune pentru documentul intern și API · candidate

---

## PATTERN-001 · Containerized server execution
- **Status:** approved
- **Confirmed:** 2026-11-18
- **Use when:** Defining or launching backend services, databases, or API components.
- **How:** Encapsulate runtime dependencies and configuration in Dockerfile and docker-compose.yml files.
- **Example:** docs/agents/DECISIONS.md
- **Why:** Eliminates environment discrepancies and provides standard startup workflows.
- **Source:** user · confidence high

---

## PATTERN-002 · Recheck slot availability after a PostgreSQL row lock
- **Status:** candidate
- **Use when:** Confirming a booking from a previously displayed slot.
- **How:** Acquire a row lock for the specialist in a `READ COMMITTED` transaction. Re-read the shift and busy stages using the same transaction client, then save the booking and stages atomically. Keep the database exclusion constraint as a backstop.
- **Example:** [AppointmentsService](../../server/src/modules/appointments/appointments.service.ts)
- **Why:** A waiting request rechecks against the committed booking and still permits interleaving during free stages.
- **Source:** Sprint 2 implementation · confidence high

---

## PATTERN-003 · Durable claim before a scheduled SMTP send
- **Status:** candidate
- **Use when:** Concurrent scheduler runs can dispatch the same transactional notification.
- **How:** Atomically persist a claim for the eligible record, recheck the current appointment state before SMTP, and record acceptance. Reopen a claim only after a definite pre-acceptance failure. Reconcile ambiguous results by stable Message-ID.
- **Example:** [NotificationJobsService](../../server/src/modules/notifications/notification-jobs.service.ts)
- **Why:** Repeated runs, concurrent workers and restarts honor the same claim. Ambiguous delivery does not trigger a duplicate.
- **Source:** Sprint 3 implementation · confidence high

---

## PATTERN-004 · Reîncarcă disponibilitatea după commit prin SSE
- **Status:** candidate
- **Use when:** Mai multe pagini deschise afișează sloturile unei specialiste.
- **How:** După commit, Serverul publică prin SSE numai ziua afectată pe fluxul specialistei. Browserul recitește disponibilitatea pentru perioada afișată și la reconectare. Tranzacția verifică din nou disponibilitatea înainte de a salva.
- **Example:** [AvailabilityController](../../server/src/modules/availability/availability.controller.ts) și [BookingControls](../../frontend/src/components/public/BookingControls.tsx)
- **Why:** Paginile deschise primesc rapid starea actuală, inclusiv după o reconectare.
- **Source:** Implementarea D-010 · confidence high

---

## PATTERN-005 · Verifică același termen la citirea și reutilizarea unui slot
- **Status:** candidate
- **Use when:** O rezervare temporară are un termen de expirare, iar PostgreSQL verifică suprapunerile prin starea etapelor.
- **How:** Exclude la citire rezervările expirate. Sub blocarea specialistei, folosește același moment pentru verificarea disponibilității și eliberarea etapelor înainte să scrii noua rezervare. Persistă anularea prin jobul periodic sau prin acțiunea care întâlnește rezervarea expirată, apoi publică actualizarea calendarului după commit.
- **Example:** [AppointmentsService](../../server/src/modules/appointments/appointments.service.ts)
- **Why:** Slotul poate fi rezervat la termen, iar baza de date continuă să verifice suprapunerile.
- **Source:** Implementarea expirării din D-010 · confidence high

---

## PATTERN-006 · Verifică aceeași sesiune pentru documentul intern și API
- **Status:** candidate
- **Use when:** O aplicație SPA deservește pagini publice și pagini de personal pe aceeași origine.
- **How:** Proxy-ul verifică documentele interne prin endpointul de sesiune al Serverului. Guard-urile Serverului verifică din nou sesiunea și dreptul operației la fiecare API. Derivă specialista din sesiune pentru agenda proprie și export. Restricționează rutele de echipă prin guard-ul Admin.
- **Example:** [Proxy Vite](../../frontend/vite.config.ts) și [controlerele de calendar](../../server/src/modules/appointments/staff-calendar.controller.ts)
- **Why:** Accesul direct la un document, o cerere API și descărcarea calendarului respectă aceeași identitate și același domeniu de acces.
- **Source:** Implementarea D-012 și D-013 · confidence high
