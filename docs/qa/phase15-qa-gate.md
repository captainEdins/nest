# Phase 15 QA Gate — One record, every desk: the staff statement view (issue #88, D-028)

Scope: statement resolution accepts `NOTICE` tenancies (bug fix); the staff statement screen
(LANDLORD + CARETAKER) with 4 entry points; print from the staff view; shared timeline
refactor of the tenant screen.

## A. API probes (curl, live dev server)

| # | Probe | Expected | Result |
|---|-------|----------|--------|
| T1 | Landlord `GET /api/statements?tenancyId=<David/ACTIVE>` | 200 + full payload | ✅ 200 |
| T2 | Landlord `GET /api/statements` (no tenancyId) | 404 (staff must name the tenancy) | ✅ 404 |
| T3 | John (Baraka caretaker) reads Brian (Riverside tenancy) | 404 — scope miss, existence doesn't leak | ✅ 404 |
| T4 | Kevin (Riverside caretaker) reads Brian (his plot) | 200 | ✅ 200 |
| T5 | Agent statement read | 403 by role | ✅ 403 |
| T6 | Guard statement read | 403 by role | ✅ 403 |
| T7 | **NOTICE tenant (Kevin Mutua) own statement** | 200 — **was 404 pre-fix** | ✅ 200 |
| T8 | Landlord reads the NOTICE tenancy (staff branch) | 200 | ✅ 200 |
| T9 | Tenant `?tenancyId=<foreign>` | own record returned (client never trusted) | ✅ Grace's record |
| T10 | Staff payload shape (all 10 StatementDto fields + months) | complete; Brian: 2 months, closing 4,700,000 minor | ✅ complete |

**API result: 11/11 PASS.**

## B. E2E via agent-browser

| # | Flow | Result |
|---|------|--------|
| E1 | Amina → Arrears tab → desktop table rows show statement icon (accessible name "Open {name}'s statement") beside Send reminder | ✅ all 4 rows |
| E2 | Click David's statement → pushed screen: Back + "Tenant statement" h1, accountRef pill, generated date, one-truth caption, Print button, context banner (name + phone · unit · plot), summary strip, months timeline (brought-forward, billed lines, carried-forward) | ✅ |
| E3 | Print media (`agent-browser pdf`): one page, letterhead starts clean (shell h1 hidden via `print:hidden`), issued-to David Otieno, period, totals, month table, signature lines | ✅ 1 page |
| E4 | Back → returns to the Arrears tab | ✅ |
| E5 | ⌘K → "david" → TENANT result opens DAVID's statement directly (was: vague arrears-tab jump) | ✅ |
| E6 | Properties tab → unit rows (A1 David, A2 Sarah, B1 Kevin Mutua, B2 Grace, C1 Fatuma, C2 Brian) all carry the statement opener; Kevin Mutua (NOTICE) opens fine | ✅ |
| E7 | John (caretaker) → Units tab → statement opener on occupied/notice rows; opens David's statement | ✅ |
| E8 | Mobile viewport 390×844: unit rows fit with all actions; statement opens; caretaker pushed arrears cards show statement icon + Send reminder per row | ✅ |
| E9 | Grace (tenant) → More → Statement: refactored screen renders (h1, accountRef, Print, timeline w/ receipt NEST-R-000001); print media one page with full sheet (receipts, both signature lines, paybill footnote) — Phase 13 regression | ✅ |
| E10 | Agent (Wanjiku) + Guard (Peter) homes render | ✅ |
| E11 | Page errors + console errors/warnings across the whole session (all 5 roles) | ✅ zero |
| E12 | dev.log: no 5xx; only expected 401 sign-out transitions | ✅ |

**E2E result: 12/12 PASS.**

## C. Static checks

- `bun run lint` — clean.
- `bunx tsc --noEmit` — clean (codebase-wide; includes the in-round fix of the pre-existing
  `.slice()`-on-number latent crash in the print sheet's receiptless fallback).

## Verdict

**23/23 PASS.** The record now sits on every desk: arrears, units, properties and ⌘K search
all open the SAME statement the tenant sees, printable on the spot; a tenant on notice keeps
their own record through the exit window.
