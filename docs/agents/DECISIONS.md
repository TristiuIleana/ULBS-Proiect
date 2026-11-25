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
- D-005 · Client loyalty program with automatic recurring discount

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

## D-005 · Client loyalty program with automatic recurring discount
- **Status:** approved
- **Date:** 2026-11-19
- **Confirmed:** 2026-11-19
- **Rule:** Clients with an account accumulate completed visits counted across the entire studio (regardless of service or specialist). The visit counter follows a repeating cycle of 5: at every 5th completed appointment (visit count modulo 5 == 0, i.e. visits 5, 10, 15…), a 10% discount is applied automatically to that appointment's price at booking confirmation time. The discount is computed server-side and stored on the Appointment record (no manual coupon codes or client-side claiming). The public client portal ("Contul Meu & Fidelizare" — DS-pub-auth) shows a progress card (N/5 visits toward the next discount), upcoming bookings, and past booking history with any applied discounts highlighted. The admin dashboard shows the discount flag on affected appointments.
- **Why:** Incentivizes client retention and repeat bookings through a simple, transparent, and fully automated loyalty mechanic that requires no manual intervention from staff.
- **Rejected:** Physical stamp cards; percentage escalating by tier; manual coupon codes; one-time-only discount at the 5th visit without repeating cycle.
- **Evidence:** User explicit confirmation: "Confirm toate cele 3 puncte exact cum le-ai propus: 1. Ciclu repetat: la fiecare a 5-a vizită (5, 10, 15...). 2. Aplicare automată la booking (fără coduri sau revendicare manuală). 3. Numărare per total studio (indiferent de serviciu sau specialist)."
- **Source:** user · confidence high
