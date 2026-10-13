# Phase 22 QA Gate — The Agent's Mandate (issue #105)

**Scope**: AGENT role framing copy (login demo cards EN+SW, README investor one-pager + demo table, role-scope-matrix §4.2) + footer phase bump + dead i18n key removal. Copy-only — no behavior, schema, or API change.
**Method**: agent-browser E2E (login cards both languages, agent login smoke) + Prisma/DB probes + lint. No test code per platform rule — this document is the evidence.
**Date**: 2026-10-13. **Dev server**: running, clean log (only `prisma:query` lines + 200s; one pre-existing 401 explained below).

## A. Incident found & fixed during pre-flight QA (blocking)

| # | Observation | Result |
|---|---|---|
| A1 | Login screen rendered **no demo cards** (empty space between tagline and manual form); `GET /api/auth/profiles` → `{"data":[]}` | ✅ Root-caused, fixed |
| A2 | DB probe (Prisma): `profiles: 0, properties: 0, tenancies: 0, payments: 0` — the seeded demo dataset was gone | ✅ Confirmed empty DB |
| A3 | Root cause chain: an earlier cycle reset the DB, then the re-seed (`bun prisma/seed.ts`) failed with `Cannot find module '.prisma/client/default'` — the generated Prisma client was missing/stale in node_modules while the Next dev server's own resolution kept working (masking it). Evidence: the same module error reproduced on a bare script before `bunx prisma generate` | ✅ Reproduced & explained |
| A4 | Fix: `bunx prisma generate` (v6.19.2 → node_modules) + `bun run db:seed` → `[seed] done ✔` (notifications: 20, auditLogs: 37) | ✅ PASS |
| A5 | After fix: `/api/auth/profiles` returns all 11 seeded identities (Amina…Brian), including AGENT Wanjiku Kamau +254711000007 | ✅ PASS |
| A6 | Historical 401s in dev.log (`POST /api/auth/login 401`) are consistent with the empty-DB window — unknown phone ⇒ 401 by design; not an auth defect | ✅ Explained, no code change |

**Prevention note**: run `bun run db:generate` before `db:seed` in any reset flow; the bare-bun seed path is the fragile seam. Logged in worklog for the next cycle.

## B. Login demo cards — the copy fix (agent-browser)

| # | Step | Expected | Result |
|---|---|---|---|
| B1 | EN login screen, Agent card | Description reads "Manage the plot on the landlord's behalf" (was "Watch over a portfolio of plots") | ✅ PASS (`docs/qa/shots/phase22/login-agent-card-en.png`) |
| B2 | Language dropdown → Kiswahili, Agent card | "Simamia mali kwa niaba ya mmiliki" (was "Simamia mali zote kwa mahali pamoja") | ✅ PASS (`docs/qa/shots/phase22/login-agent-card-sw.png`) |
| B3 | Sibling role cards unchanged | Landlord/Caretaker/Tenant/Guard descriptions byte-identical to v0.21.0 | ✅ PASS (snapshot diff) |
| B4 | Card tap = login | Demo card login still works end-to-end | ✅ PASS (D1 below) |

## C. Static checks

| # | Check | Expected | Result |
|---|---|---|---|
| C1 | i18n key parity (EN vs SW) | 810 = 810 keys, no orphan either side (dead `phase.agentNotice` removed from both) | ✅ PASS (scripted check) |
| C2 | `bun run lint` | clean | ✅ PASS |
| C3 | Console during QA | no errors/warnings (only React DevTools info + HMR) | ✅ PASS |
| C4 | README | "The problem" sentence now: "an agent appointed to run the plot on their behalf"; demo table Agent row: "**Amina's appointed agent** — runs both plots on her behalf: publish a listing, record applicants, run the pipeline" | ✅ PASS (grep) |
| C5 | role-scope-matrix.md §4.2 | heading: "appointed by the landlord to run their plot; manages the pipeline, not the ledger" | ✅ PASS (grep) |

## D. Agent login smoke (post-copy, seeded DB)

| # | Step | Expected | Result |
|---|---|---|---|
| D1 | Tap Wanjiku Kamau card | Signs in as AGENT, lands on agent home | ✅ PASS |
| D2 | Agent home renders | Classic masthead (WAKALA / Habari ya mchana, Wanjiku), funnel KPIs 3/1/1/2, live-listing hero (B3 · KSh 25,000 · 3 wagombeaji), listings preview, Mali (2) | ✅ PASS (`docs/qa/shots/phase22/agent-home-sw.png`) |
| D3 | Footer | "Phase 22 · v0.22.0" | ✅ PASS |

**Gate: PASS (issue #105 AC 1–6 all green).**
