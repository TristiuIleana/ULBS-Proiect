# Patterns — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> How we build things here. Copy only `approved` entries. `candidate` = seen once or
> not yet confirmed; agents add these freely. Promotion needs the user's OK.
<!-- graffino-agentic:end -->

## Index
- PATTERN-001 · Containerized server execution · approved
- PATTERN-002 · Recheck slot availability after a PostgreSQL row lock · candidate
- PATTERN-003 · Durable claim before a scheduled SMTP send · candidate

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
