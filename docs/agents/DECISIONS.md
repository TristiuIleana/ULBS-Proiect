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

---

## D-001 · Docker for all server components
- **Status:** approved
- **Date:** 2026-11-06
- **Rule:** All server components, backend services, databases, and associated infrastructure must run in Docker containers (via Docker / Docker Compose).
- **Why:** Ensures isolated, reproducible environments and clean separation from host OS dependencies.
- **Rejected:** Running services directly on host OS without containerization.
- **Evidence:** User requirement: "vei felosii docker pentru oricce tine de server"
- **Source:** user · confidence high

---

## D-002 · Application stack NestJS PostgreSQL React in Docker
- **Status:** approved
- **Date:** 2026-11-18
- **Rule:** The backend service is built using NestJS (TypeScript) with PostgreSQL (using ACID transactions and row-level locks for booking concurrency) and scheduled jobs via NestJS Schedule / BullMQ. The frontend is built as a separate React SPA (Vite + Tailwind CSS + FullCalendar). All services run containerized via Docker Compose.
- **Why:** Provides robust modular architecture, strict type safety across the entire stack, reliable ACID transaction controls for preventing simultaneous double-booking, and clean responsive UI.
- **Rejected:** Monolithic full-stack framework without container separation; Python/Django or PHP stacks without full TypeScript end-to-end typing.
- **Evidence:** User decision during P01 project scoping interview answering Q-001 and explicit confirmation: "Da, aprob decizia D-002."
- **Source:** user · confidence high

---

## D-003 · Visual identity and design tokens
- **Status:** approved
- **Date:** 2026-11-18
- **Rule:** The user interface follows the Warm Minimalist design system documented in docs/design/DESIGN.md: Nude Rose (#C48B71) primary with Terracotta (#9E6B55) and Muted Gold (#D4AF37) accents, warm linen (#FAF7F2) light surface and deep espresso (#1A1716) dark mode, Playfair Display serif for headings with Plus Jakarta Sans for body and UI elements, 4px-based spacing scale, and soft 10-16px border radii.
- **Why:** Delivers an intimate, refined, high-end boutique beauty salon experience aligned with client expectations and visual benchmarks (GlossGenius, Aesop).
- **Rejected:** Generic sterile corporate UI kits or cold dark-slate palettes.
- **Evidence:** User style interview and explicit approval: "Da, aprob decizia D-003. Salvează token-urile în docs/design/DESIGN.md și înregistrează D-003 în docs/agents/DECISIONS.md."
- **Source:** user · confidence high
