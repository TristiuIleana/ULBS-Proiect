# CONTEXT — ULBS-Proiect vocabulary

<!-- graffino-agentic:begin v1 -->
> The approved terms for this project. Use each term exactly as defined, in the part
> of speech given. Never swap in a synonym; never use a word on an _Avoid_ line.
<!-- graffino-agentic:end -->

**ULBS** (noun) — Universitatea Lucian Blaga din Sibiu.
_Avoid_: Lucian Blaga, sibiu-uni

**Server** (noun) — The backend or service layer running inside Docker containers.
_Avoid_: host service, local daemon

**Beauty Studio** (noun) — The local beauty and styling studio business modeled in project P01.
_Avoid_: frizerie, barbershop, cabinet stomatologic

**Split service** (noun) — A service composed of alternating busy and free technician stages where short appointments can be slotted into the technician's free stages.
_Avoid_: multi-part service, fragmented appointment

**Laminare sprâncene** (noun) — The brow lamination split service modeled across 5 consecutive stages (apply 1, idle 1, apply 2, idle 2, finish).
_Avoid_: brow lift, tratament sprâncene generic

**Zi Full** (noun) — A high-demand calendar day flagged by Admin where online cancellation and rescheduling are blocked.
_Avoid_: busy day, zi aglomerată neoficială

**Waitlist** (noun) — The automated queue for fully booked slots that dispatches a priority booking link with a 30-minute claim window to the next waiting client when a cancellation or rescheduling frees a compatible slot.
_Avoid_: coadă de așteptare, stand-by list

**Mailpit** (noun) — The local SMTP test server and web interface running in Docker on port 8025 to capture and inspect outgoing transactional emails.
_Avoid_: MailHog, real email credentials in dev

**Fidelizare** (noun) — The automated client loyalty program: a repeating cycle where every 5th completed visit earns a 10% discount allocated automatically to the first eligible booking based on completed visits (D-011). Counted per studio, regardless of service or specialist.
_Avoid_: loyalty points, stamp card, coupon code, manual discount

