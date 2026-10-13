# Phase 23 QA Gate — Agent Parity: the agent's full desk (issue #109)

**Scope**: `AgentOverviewDto` money block (+arrears/recentPayments/security/month); analytics route+lib generalization; remind-all/match/visitors/incidents/statements route gates; nav + app-shell + agent home + agent properties + expenses P&L source; footer v0.23.0. The "almost": KRA + expense writes stay the owner's.
**Method**: agent-browser E2E (full agent journey, every tab) + curl boundary probes + Prisma persistence checks + `tsc --noEmit` + `bun run lint`. No test code per platform rule — this document is the evidence.
**Date**: 2026-10-13. **Dev server**: clean log (only `prisma:query` lines + 200s).

## A. Nav & shell

| # | Check | Expected | Result |
|---|---|---|---|
| A1 | Agent tab set | Top-4: Home, Arrears, Payments, Listings; More: Applicants, Properties, Repairs, Analytics, Security, Money out | ✅ PASS (snapshot) |
| A2 | KRA absent | No KRA tab for agent; `GET /api/kra/summary` as agent → 403 | ✅ PASS (curl) |

## B. Home — the money desk (one overview call)

| # | Check | Expected | Result |
|---|---|---|---|
| B1 | Masthead | "AGENT · OCT 2026", estate figures "2 plots · 9 units · KSh 84,000 expected", collection-rate aside 52% | ✅ PASS |
| B2 | Money KPI quad | Collected KSh 43,500 (+78% MoM), Arrears KSh 100,000 (4 tenants), Occupancy 67% (6/9), Open repairs 3 (tap→repairs) | ✅ PASS |
| B3 | Funnel cells | 3 vacant / 1 live / 1 new / 2 in pipeline | ✅ PASS |
| B4 | Mini trend + security | Shared chart (Sep/Oct values; earlier months 0 — seed history) + digest (7 visitors, 3 on site, 1 HIGH unseen, Peter on duty) | ✅ PASS |
| B5 | Arrears + recent payments previews | 4 rows biggest-first (Brian 47,000 → Grace 9,000) with statement + remind buttons; payments with receipts | ✅ PASS |

## C. Arrears tab — action parity

| # | Check | Expected | Result |
|---|---|---|---|
| C1 | Shared ArrearsScreen | 4 scoped rows, ledger rhythm | ✅ PASS |
| C2 | Remind all (4) | AlertDialog → confirm → `POST /api/notifications/remind-all 200` → button "Sent" disabled + toast | ✅ PASS (257ms, dev.log) |
| C3 | Staff statement view | "Open David Otieno's statement" → pushed screen renders (exact record + closing balance) | ✅ PASS |

## D. Payments tab — reconciliation parity

| # | Check | Expected | Result |
|---|---|---|---|
| D1 | Ledger | Scoped rows, property chips (All/Baraka/Riverside), status filters incl. Unmatched | ✅ PASS |
| D2 | Match flow (fixture: UNMATCHED KSh 6,000 from David's phone) | MatchModal → scoped tenant suggestions → confirm → "Matched successfully" | ✅ PASS |
| D3 | Persistence | Payment 8: `status=COMPLETED`, tenancyId set, 1 allocation of 600,000 | ✅ PASS (Prisma read) |

## E. The desk's remaining tabs

| # | Check | Expected | Result |
|---|---|---|---|
| E1 | Analytics | 3 charts (trend, arrears-by-age, occupancy) scoped | ✅ PASS |
| E2 | Properties | 2 property cards + vacancy funnel section (C4 Riverside, create-listing CTA) | ✅ PASS |
| E3 | Repairs | 5 scoped tickets, filter chips | ✅ PASS |
| E4 | Security | Visitors (7 today) + incidents (1) | ✅ PASS |
| E5 | Expenses | Read-only ledger + P&L (TOTAL MONEY OUT, NET THIS MONTH from the AGENT-scoped overview); no record/reverse buttons for agent | ✅ PASS |

## F. Boundaries (the "almost")

| # | Probe | Expected | Result |
|---|---|---|---|
| F1 | `POST /api/expenses` as AGENT | 403 `Role AGENT may not access this resource` | ✅ PASS |
| F2 | `GET /api/kra/summary` as AGENT | 403 | ✅ PASS |
| F3 | Existing gates untouched | remind-all/match still 403 for TENANT/GUARD (paths unchanged — Phase 13 QA A4/A5 evidence carries) | ✅ PASS (code path) |

## G. Static

| # | Check | Result |
|---|---|---|
| G1 | `bunx tsc --noEmit` | ✅ PASS |
| G2 | `bun run lint` | ✅ PASS |
| G3 | Footer "Phase 23 · v0.23.0" | ✅ PASS |
| G4 | i18n — zero new keys (all surfaces reuse existing EN/SW copy) | ✅ PASS |

**Screenshots**: `docs/qa/shots/phase23/` — agent-home-parity, agent-arrears-tab, agent-payments-tab, agent-analytics-tab, agent-properties-tab, agent-repairs-tab, agent-expenses-tab, agent-statement-view.

**Gate: PASS (issue #109 AC 1–7 all green).**
