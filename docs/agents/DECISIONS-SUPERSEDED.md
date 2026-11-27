# Decisions superseded — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> Decisions that no longer apply. **Never obeyed**; read only to explain old code or a
> past choice. Each points to the entry that replaced it. `ledger-lint.py --fix`
> keeps this file in sync: superseded entries move here from `DECISIONS.md`, and
> their index lines move here from its index.
<!-- graffino-agentic:end -->

## Index
- D-005 · Client loyalty program with automatic recurring discount · _superseded-by D-008_
- D-008 · Alocarea Fidelizării și operațiile Admin · _superseded-by D-011_

---

## D-005 · Client loyalty program with automatic recurring discount
- **Status:** superseded-by D-008
- **Date:** 2026-11-19
- **Rule:** Clients with an account accumulate completed visits counted across the entire studio (regardless of service or specialist). The visit counter follows a repeating cycle of 5: at every 5th completed appointment (visit count modulo 5 == 0, i.e. visits 5, 10, 15…), a 10% discount is applied automatically to that appointment's price at booking confirmation time. The discount is computed server-side and stored on the Appointment record (no manual coupon codes or client-side claiming). The public client portal ("Contul Meu & Fidelizare" — DS-pub-auth) shows a progress card (N/5 visits toward the next discount), upcoming bookings, and past booking history with any applied discounts highlighted. The admin dashboard shows the discount flag on affected appointments.
- **Why:** Incentivizes client retention and repeat bookings through a simple, transparent, and fully automated loyalty mechanic that requires no manual intervention from staff.
- **Rejected:** Physical stamp cards; percentage escalating by tier; manual coupon codes; one-time-only discount at the 5th visit without repeating cycle.
- **Evidence:** User explicit confirmation: "Confirm toate cele 3 puncte exact cum le-ai propus: 1. Ciclu repetat: la fiecare a 5-a vizită (5, 10, 15...). 2. Aplicare automată la booking (fără coduri sau revendicare manuală). 3. Numărare per total studio (indiferent de serviciu sau specialist)."
- **Source:** user · confidence high

---

## D-008 · Alocarea Fidelizării și operațiile Admin
- **Status:** superseded-by D-011
- **Date:** 2026-11-26
- **Rule:** La fiecare a cincea vizită, pe baza vizitelor COMPLETED din întregul studio, Serverul alocă automat reducerea de 10% primei programări eligibile în ordine cronologică, persistă prețul și recalculează la anularea unei programări anterioare. Contul afișează progresul și reducerile. Operațiile de finalizare și deblocare cu resetarea marcărilor cer rolul Admin.
- **Why:** Determină prețul consecvent când se schimbă ordinea programărilor.
- **Evidence:** Confirmarea planului Sprintului 3, Q-008.
- **Source:** user · confidence high

---
