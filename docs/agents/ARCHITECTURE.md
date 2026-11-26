# Architecture — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> How this repo is built, generated from the code at backfill and kept current by
> whoever changes the structure. The code wins: when this page is wrong, fix it.
<!-- graffino-agentic:end -->

## Overview
ULBS-Proiect is a university project developed for ULBS.
All server-side services and backends run inside Docker containers.

```text
[ Client / Browser ] ---> [ Dockerized Server Services ] ---> [ Database / Storage ]
```

## Parts
| Part | Path | Responsibility | Talks to |
|---|---|---|---|
| Server | `server/` | Backend services and APIs | Database, Client |
| Public portal | `frontend/` | React booking, account, management and offer screens, with a Vite development proxy | Server |

## Data flow
1. The browser opens the booking page on port 5173. The Vite development proxy forwards `/api` to the Server.
2. The Server reads availability from working shifts, busy appointment stages and Waitlist offers. It persists bookings and stages in PostgreSQL and sends confirmations to Mailpit over SMTP after commit.
3. The Server verifies the account e-mail before linking guest bookings and Waitlist entries. Authenticated actions use a server-side session. Guest management and Waitlist offers use separate tokens.
4. Cancellation and rescheduling update appointment stages and reserve a priority offer in the same transaction. NestJS Schedule processes expirations and reminders. PostgreSQL records a dispatch claim before SMTP so overlapping instances cannot send a duplicate.

## State and storage
| What | Where | Owner | Notes |
|---|---|---|---|
| Application Data | Database container / volumes | Server | Persisted via Docker volumes |

## Configuration
| Name | Where set | Used by | Notes |
|---|---|---|---|
| Environment variables | `.env` / `docker-compose.yml` | Server containers | Sensitive secrets never committed |

## Build, deploy, runtime
Runs via Docker and Docker Compose. Refer to AGENTS.md section 2.

## Boundaries
Container boundary isolates server services from host operating system (D-001).
