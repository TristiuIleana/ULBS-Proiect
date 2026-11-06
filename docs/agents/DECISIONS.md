# Decisions — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> Constraints the code must obey. Status: `approved` (obey) · `proposed` (do not
> build on it) · `superseded-by <ID>` (kept to explain old code).
> Adding or changing an entry needs the user's OK (AGENTS.md → The gate).
<!-- graffino-agentic:end -->

## Index
- D-001 · Docker for all server components

---

## D-001 · Docker for all server components
- **Status:** approved
- **Date:** 2026-11-06
- **Rule:** All server components, backend services, databases, and associated infrastructure must run in Docker containers (via Docker / Docker Compose).
- **Why:** Ensures isolated, reproducible environments and clean separation from host OS dependencies.
- **Rejected:** Running services directly on host OS without containerization.
- **Evidence:** User requirement: "vei felosii docker pentru oricce tine de server"
- **Source:** user · confidence high
