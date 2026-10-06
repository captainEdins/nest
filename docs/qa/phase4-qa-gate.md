# Phase 4 QA Gate — Agent Module (Listings → Applicants → Decision)

**Task ID:** P4-QA · **Issue:** #50 · **Gate date:** 7 Oct 2026 (demo clock) · **App version:** Phase 4 · v0.4.0
**Scope under test:** P4-a contracts (schema/seed/types), P4-b funnel API (7 routes), P4-c agent UI, P4-d landlord approvals UI, P4-e polish (guard unit picker, visitor-row convergence, sw.js, footer bump).
**Method:** adversarial curl probe battery (expected vs actual) + full-role agent-browser E2E at 375×812 + reseed verification. No test files per platform rule.

---

## Part 1 — Adversarial API probe battery

Login profiles: landlord Amina `+254711000001` · caretaker John `+254711000002` · tenant Grace `+254711000003` · guard Peter `+254711000006` · agent Wanjiku `+254711000007`.

### Money / invariants

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1a | GET /api/listings as AGENT | 200 | 200 — 1 listing (B3 PUBLISHED) | PASS |
| 1b | every listing rentAmountMinor is an integer (no floats) | all int | 2500000 (int, KES minor) | PASS |
| 1c | list applicationCount == len(detail.applications) | equal | 3 == 3 | PASS |
| 2a | GET /api/applications as LANDLORD | 200 | 200 — 3 rows | PASS |
| 2b | zero `*Minor` fields anywhere in the applications payload | none | NONE (recursive scan; keys: applicant/phone/source/status/events/handledBy/decidedBy… — marketing module carries no money beyond listing rent) | PASS |
| 3 | POST /api/listings rentAmountMinor `2500000.5` as AGENT | 400 (zod int) | 400 VALIDATION "expected int, received number" | PASS |
| 4 | POST /api/listings rentAmountMinor `0` / `-500` | 400 | 400 VALIDATION "Too small: expected number to be >0" (×2) | PASS |

### Role fence (matrix §4.1/§4.2)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 5 | GET /api/listings + GET /api/applications as TENANT / GUARD / CARETAKER | 403 ×6 | 403 FORBIDDEN "Role X may not access this resource" ×6 | PASS |
| 6 | POST /api/listings + POST /api/applications/{id}/status as TENANT / GUARD / CARETAKER | 403 ×6 | 403 FORBIDDEN ×6 | PASS |
| 7 | Unauthenticated GET /api/listings | 401 | 401 UNAUTHORIZED "Authentication required" | PASS |

### Scope no-leak (existence must not leak — matrix §1)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 8 | GET /api/listings/{garbage-cuid} as AGENT | 404 | 404 NOT_FOUND "Listing not found" | PASS |
| 9 | GET /api/applications/{garbage} as LANDLORD (P4-c single-GET route) | 404 | 404 NOT_FOUND "Application not found" | PASS |

### Pipeline / state machine

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 10 | AGENT posts APPROVED on a live application (Brian, NEW) | 403 | 403 FORBIDDEN "Only the landlord can approve or reject applicants" | PASS |
| 11 | LANDLORD posts CONTACTED on a live application | 403 | 403 FORBIDDEN "The pipeline stages are the agent's — you decide approve or reject" | PASS |
| 12 | LANDLORD POST /api/listings/{id}/applications (intake) | 403 | 403 FORBIDDEN (requireRole AGENT) | PASS |
| 13 | No-op: AGENT CONTACTED on already-CONTACTED application (Faith) | 409 | 409 CONFLICT "That status change is not allowed from here" | PASS |
| 14 | Double-decide: LANDLORD APPROVE Joyce (200) then REJECT Joyce | 200 then 409 | 200 → 409 CONFLICT "This application has already been decided" | PASS |
| 15 | Pause B3 as AGENT → intake → resume | 200 → 409 → 200 | 200 → 409 CONFLICT "Applicants can only be recorded on a published listing" → 200 (PUBLISHED restored) | PASS |
| 16 | POST /api/listings with fabricated unitId | 404 | 404 NOT_FOUND "Unit not found" (real occupied-unit 409 accepted on P4-b's documented evidence: create on OCCUPIED A1 → 409 "That unit is not vacant") | PASS |
| 17 | Title validation; bad phone on intake | 400 / 400 | 1-char title → 400 "expected string to have >=2 characters"; intake phone "+25" → 400 "Phone must be 9-15 digits, optionally starting with +" | PASS* |
| 18 | GET /api/applications?status=BOGUS / ?status=NEW | 400 / only NEW | 400 VALIDATION (enum listed) / exactly 1 row: Brian Ochieng/NEW | PASS |

\* **P17 note (probe-spec deviation, not a defect):** the brief's title `"ab"` (2 chars) is exactly the server contract's `min(2)` (P4-b, documented), so it passes zod and falls through to the unit-scope 404; the genuinely-too-short title (`"a"`) 400s as expected. The create-listing sheet enforces the stricter client minimum (5 chars) — the client-is-stricter pattern is deliberate and shipped.

### Trust / audit

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 19a | LANDLORD APPROVE Brian with note | 200 | 200, status APPROVED | PASS |
| 19b | decidedById/decidedByName/decidedAt stamped | set | decidedById set · "Amina Barasa" · decidedAt set | PASS |
| 19c | listing detail: Brian's timeline last event = APPROVED, actor landlord, note carried | last row APPROVED | last event APPROVED · actor Amina Barasa · note "QA Gate decision note — collect deposit by Friday" (2 events) | PASS |
| 19d | agent notification feed gained APPLICATION_DECIDED | +1 IN_APP | 2 rows: "Amina Barasa approved Brian Ochieng for B3 (Baraka Court)." (+ Joyce from probe 14) | PASS |
| 20 | server log clean across the whole battery | no `[api] unhandled error`, no 500s | zero unhandled errors; all responses 200/400/401/403/404/409 as designed. One historical dev.log line (`Megaphone is not defined`, line 1309/7204) is a P4-c mid-edit HMR artifact — current nav.ts imports Megaphone correctly, page GET / → 200, error never re-fires | PASS |

**Battery verdict: 20/20 probe groups PASS (35 individual checks), 0 defects found.**

---

## Part 2 — Full-role E2E (agent-browser, 375×812, session `p4qa`)

Login sweep executed in order; every screen renders with skeletons→data, EN + Kiswahili, light + dark.

| Role / flow | Verified | Screenshot |
|---|---|---|
| **Amina (landlord)** home | amber Vacancy-funnel card "3 application(s) awaiting your decision" (B3 · KSh 25,000) | p4qa-gate-01 |
| Amina → More → Listings → Applicants → Joyce → Approve with note | Approved chip flip, "Decided by Amina Barasa · 6 Oct 2026", timeline 3→4, Approve/Reject gone, home count 3→2 | p4qa-gate-02 |
| **Wanjiku (agent)** home | KPIs vacant 1 / live 1 / new 1 / pipeline 2 (post-Joyce), funnel card + listings preview + 3-tab nav | p4qa-gate-03 |
| Wanjiku → listing detail → record applicant ("QA Gate Applicant", +254701234567, WALK_IN, note) | toast "Applicant recorded — landlord notified", applicants 3→4, row visible | p4qa-gate-04 |
| Wanjiku → applicant → NEW→CONTACTED quick-action | timeline 1→2, toast "Status updated", current-status button disabled (no-op 409 unreachable by UI) | p4qa-gate-05 |
| **Peter (guard)** on-duty home → Log visitor w/ unit picker → B2 | "Joseph QA Gate" logged (toast + "Just now · B2" row), counts 8 today / 4 on site; P4-e unit picker renders A1–B3 chips | p4qa-gate-06 |
| **Grace (tenant)** home | "Visitors to your unit (4)" — includes the guard's new B2 entry: tenant loop closes | p4qa-gate-07 |
| **John (caretaker)** home + More sheet | home loads (arrears/repairs/security/units); More sheet shows ONLY Security — **no Listings entry (fence visible)** | p4qa-gate-08 |
| **Kevin (tenant, +254711000008 — manual phone login)** home | B1 story intact: balance KSh 0 "All paid up", deposit KSh 8,500, repairs preview, visitors (1) | p4qa-gate-09 |
| Agent listing detail — **dark mode** | chips/KPIs/applicants readable, no broken styling (VLM-verified) | p4qa-gate-10 |
| Agent application detail — **dark + Kiswahili** | "Mstari wa matukio (2)" timeline (Mpya → Ameulizwa) readable, "kwa mwezi", "Dakika 2 zilizopita" (VLM-verified) | p4qa-gate-11 (bonus 11b: listing detail dark+SW) |
| Footer | "Phase 4 · v0.4.0" | p4qa-gate-12 |

**Console:** `agent-browser errors` → ZERO page errors across the whole sweep. Console log: 18 lines, all React-DevTools info + HMR/Fast-Refresh noise — no red app errors.
**Theme/language restored** to light + English after the sweep.

---

## Part 3 — Close-out verification

| Check | Result |
|---|---|
| `bun run db:seed` post-gate | listings 1 · applications 3 · applicationEvents 6 · notifications 13 · auditLogs 33 |
| Agent home (fresh login) | vacant 1 · live 1 · new 1 · pipeline 3 ✓ |
| Landlord awaiting decisions | 3 (Brian NEW · Faith CONTACTED · Joyce VIEWING) ✓ |
| Guard | on duty (ACTIVE shift, Baraka Court) ✓ |
| Grace visitors | 3 ✓ |
| `bunx tsc --noEmit` | 0 errors |
| `bun run lint` | 0 findings |
| Dev server | healthy on :3000 throughout (no restart needed) |
| Code changes | **NONE — zero defects found; no QA fix required** |

**GATE VERDICT: PASS.** Phase 4 (agent funnel + landlord approvals + P3.x polish + PWA SW) is QA-gated on main. Screenshots: `download/qa-screens/p4qa-gate-01..12` (+11b).
