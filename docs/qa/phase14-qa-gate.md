# Phase 14 QA Gate — Two plots, one truth (issue #86, D-027)

**Scope**: Riverside Flats seed (2nd property) + `GET /api/payments` ledger + property chips.
**Method**: curl API probes + agent-browser E2E (Amina / Kevin Wakaba / Wanjiku / arrears / payments / analytics). No test code per platform rule — this document is the evidence.
**Date**: 2026-10-12. **Dev server**: running, clean (old Phase-12 QA 500s only — lines 646–689, previous session).

## A. Seed + money correctness (curl + Prisma)

| # | Probe | Expected | Result |
|---|---|---|---|
| A1 | Seed re-run | clean; counts: 11 profiles, 2 properties, 9 units, 6 tenancies, 30 charges, 7 payments, 12 allocations, 2 listings, 20 notifications, 37 audit rows | ✅ PASS |
| A2 | Seed ops fix | re-seed on a DB WITH expense reversals no longer crashes (reversing rows deleted first — self-FK) | ✅ PASS (fixed in-round) |
| A3 | Fatuma ledger | both months fully paid; receipts NEST-R-000005/6; statement: billed 3,700,000 = settled, closing 0, months Sep+Oct | ✅ PASS |
| A4 | Brian balance | 2 months billed 5,700,000 − 1,000,000 cash = 4,700,000 (KSh 47,000 arrears, C2) | ✅ PASS |
| A5 | Amina portfolio | properties [Baraka Court, Riverside Flats]; vacancies 3 (B3+C3+C4); arrears 10,000,000 minor = 4 tenants (Brian 47k, David 31k, Sarah 13k, Grace 9k); collected this month 43,500 (+78% MoM — 43.5k vs 24.5k) | ✅ PASS |
| A6 | Analytics P&L across plots | Net this month KSh 24,700 = 43,500 collected − 18,800 expenses (both plots: incl. Riverside pump 3,500) | ✅ PASS |

## B. Scope isolation (the trust story)

| # | Probe | Expected | Result |
|---|---|---|---|
| B1 | Kevin Wakaba (caretaker, +254711000009) overview | property = Riverside Flats ONLY; 4 units; arrears 4,700,000 (Brian only); collected 2,850,000; vacant 2; 0 visitors (no guard at that plot) | ✅ PASS |
| B2 | Kevin ledger `GET /api/payments` | 3 rows, all Riverside Flats | ✅ PASS |
| B3 | Kevin money-out | has "Water pump repair"; does NOT have Baraka's "Pipe fittings" | ✅ PASS (browser) |
| B4 | Kevin repairs | has "Kitchen sink draining slowly"; does NOT have Baraka's tickets | ✅ PASS (browser) |
| B5 | John Mwangi overview | property = Baraka Court only; 5 units; arrears 5,300,000; recent payments all Baraka | ✅ PASS |
| B6 | John ledger | 3 rows, all Baraka Court | ✅ PASS |
| B7 | Wanjiku listings | B3 PUBLISHED (Baraka) + C3 DRAFT (Riverside) — agent works both plots | ✅ PASS (API + browser) |
| B8 | Remind-all (Amina) | notifiedCount 4 (incl. Brian), skippedCount 1 (Fatuma — settled balance never reminded) | ✅ PASS |

## C. GET /api/payments contract (curl)

| # | Probe | Expected | Result |
|---|---|---|---|
| C1 | Landlord, no filter | 7 payments newest-first, with propertyName/unitLabel; unmatched has nulls | ✅ PASS |
| C2 | `?propertyId=<Riverside id>` | 3 rows, all Riverside | ✅ PASS |
| C3 | `?propertyId=FAKE` | 0 rows (scope narrows; existence doesn't leak) | ✅ PASS |
| C4 | GUARD | 403 "The payments ledger is a staff view" | ✅ PASS |
| C5 | TENANT (Grace) | 403 (receipts + statement are the tenant surface) | ✅ PASS |

## D. E2E UI (agent-browser)

| # | Step | Expected | Result |
|---|---|---|---|
| D1 | Amina home | Properties(2); KPIs: 43,500 collected +78%, arrears 100,000 (4 tenants), occupancy 67% (6 of 9), 3 repairs, 7 visitors | ✅ PASS |
| D2 | Payments tab | property chips [All plots · Baraka Court · Riverside Flats] + Property column; 7 rows | ✅ PASS |
| D3 | Click "Riverside Flats" chip | 3 rows visible, 0 Baraka cells | ✅ PASS |
| D4 | Arrears tab | Brian Kilonzo row with Riverside Flats; Remind all (4) | ✅ PASS |
| D5 | Kevin login via phone form (+254711000009) | caretaker home: "Hi, Kevin · Riverside Flats"; 28,500/47,000 month; 1 arrears; 1 repair | ✅ PASS |
| D6 | Kevin Collections | 3 rows, NO property chips (single-plot view unchanged), no Baraka | ✅ PASS |
| D7 | Agent Listings screen | both listings + Draft status chip | ✅ PASS |
| D8 | Analytics | P&L hero renders portfolio-wide | ✅ PASS |

## E. Regression

- Lint clean. Zero new console/server errors during the sweep. Offline fixture fallback updated for the new PaymentDto fields (stays single-plot Baraka — documented). Login cards unchanged (one per role — first seeded profile per role).
- Fatuma statement print story intact (both months' receipts on one statement).

## Verdict

**29/29 PASS. Phase 14 clears the QA gate.**
