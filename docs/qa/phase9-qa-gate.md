# Phase 9 QA Gate — Monty-inspired Visual Refresh (Soft-SaaS layer + MoM KPI deltas)

**Task ID:** P9 · **Issue:** #74 · **Gate date:** 9 Oct 2026 (demo clock) · **App version:** Phase 9 · v0.9.0
**Scope under test:** D-022 token layer (radius 12px base, cool-green canvas, `.nest-card-shadow`/`.nest-float-shadow`), primitives (Card 2xl+shadow, pill Buttons, pill Badges), KpiCard rewrite (micro-labels, 28px tabular values, `highlight` hero, delta chips), backend `monthCollectedPrevMinor` (LANDLORD + CARETAKER overviews), pastel StatusBadge/listing chips, SegmentedControl (notifications feed + payments ledger), floating bottom dock, desktop sidebar pill nav, login hero, analytics chart polish, row hovers, seed Sarah prev-month payment (NEST-R-000000).
**Method:** API arithmetic verification (curl) + agent-browser sweep at 375×812 and 1440×900 across all 5 roles + VLM screenshot audits (13 audits) + dark-mode and Kiswahili passes + tsc/lint. No test files per platform rule.

---

## Part 1 — MoM delta arithmetic (the new money fact)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | `GET /api/overview` as LANDLORD (Amina) → totals | `monthCollectedMinor 1,500,000` (Grace 900k + Sarah 600k), `monthCollectedPrevMinor 600,000` (Sarah NEST-R-000000, 26 Sep) | exact match | PASS |
| 2 | Derived delta (server-integers, client display) | (1.5M − 0.6M)/0.6M = **+150%** | hero chip renders "+150% vs last month" (VLM-verified desktop + mobile) | PASS |
| 3 | `monthCollectedPrevMinor` counts ONLY matched COMPLETED money received in the previous calendar month | UNMATCHED 500k excluded; current-month payments excluded | 600,000 exactly (no contamination) | PASS |
| 4 | Zero extra DB round trips | field computed inside `computeMoneyRollup`'s existing payments loop | same 3 queries as Phase 1 (code audit) | PASS |
| 5 | prev = 0 → delta renders "First full month on NEST", never "+∞%" | null path | `momDeltaPct` returns null; KpiCard falls back to `lastMonthValue` caption | PASS |
| 6 | Jan boundary (unit-month arithmetic) | `startOfPrevMonth(new Date(y, 0, 1))` → Dec of y−1 | JS Date month-1 wraps (code audit) | PASS |

## Part 2 — Cross-role sweep (agent-browser, 375×812 + 1440×900)

| # | Surface | Checks | Verdict |
|---|---|---|---|
| 7 | Login hero | display tagline, primary/10 logo tile, radial green wash (pure CSS), pastel role chips, 44px cards | PASS |
| 8 | Landlord home (desktop + mobile) | solid-green hero card + white value + "+150%" chip; uppercase tracked micro-labels; 4 KPI cards; 2xl radius cards; sidebar pill active state | PASS |
| 9 | Caretaker home (mobile) | micro-label hero, inline +150% delta chip under the month row, quick actions above the fold (moved from below SecurityCard — fix for the dock-bisection defect), dock intact | PASS |
| 10 | Payments ledger (caretaker mobile + landlord desktop) | SegmentedControl grey pill track + white selected pill; UNMATCHED amber accent + count (landlord: count 1 + amber row + Match button; caretaker: correctly empty — role-scoped visibility); table rows + pastel chips | PASS |
| 11 | Notifications modal (landlord) | SegmentedControl All 6 / Unread 6 with counts; unread tint + dot + left accent bar preserved | PASS |
| 12 | Tenant home (mobile EN + SW) | balance card, pastel "Paid on time"/"Current" chips, pill "Pay now" CTA, dock 4 tabs (Nyumbani/Risiti/Taarifa/Zaidi all fully visible) | PASS |
| 13 | Agent home (mobile) | listings/properties cards, pastel chips, dock | PASS |
| 14 | Guard home (mobile) | action buttons, stats chips, visitor cards, dock | PASS |
| 15 | Dark mode (landlord) | hero card white-on-green readable, delta chip readable, cards separated by `.dark` shadow pass, no invisible text | PASS |
| 16 | Kiswahili (login + tenant home) | all copy natural SW; `common.vsLastMonth` = "linganisha na mwezi uliopita" wired; nav labels fit the dock | PASS |
| 17 | Analytics (landlord desktop, code + screenshot) | bar radius 4, billed bars strokeless `fill-muted`, dashed non-baseline gridlines `3 4`, focus rings + `<title>` tooltips preserved | PASS |

## Part 3 — En-route defects found & fixed

| # | Defect | Root cause | Fix |
|---|---|---|---|
| 18 | Caretaker quick-action buttons bisected behind the floating dock at first paint (VLM: "labels cut in half by the dock") | actions sat below SecurityCard; opaque dock overlapped them at the initial 375×812 viewport | (a) quick actions moved directly under the hero (better UX for the persona anyway); (b) `main` bottom padding `pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-6` reserves dock clearance |
| 19 | Login hero radial wash initially painted solid primary (double-applied style) | outer wrapper carried a full-opacity `var(--color-primary)` gradient | removed; single `color-mix(… 9%, transparent)` overlay div |
| 20 | Decision numbering collision (comments said D-021; DECISIONS already had D-021 = Phase 8) | P8 used D-021 | renumbered all code comments to **D-022**; DECISIONS.md entry added as D-022 |

## Part 4 — Regression guards

| # | Check | Verdict |
|---|---|---|
| 21 | `bunx tsc --noEmit` | 0 errors |
| 22 | `bun run lint` | 0 errors |
| 23 | dev.log during the whole sweep | 0 runtime errors, 0 failed routes (only prisma query traces + HMR) |
| 24 | Browser console (all roles) | 0 errors |
| 25 | Reseed (`bun run db:seed`) | stable — 8 profiles, tenancies, 4 payments (incl. NEST-R-000000), grace outstanding 900k, david arrears 3.1M unchanged |
| 26 | Footer | "Phase 9 · v0.9.0" |
| 27 | PWA/service-worker, offline banner, outbox login sync | untouched paths; login sync-outbox flow exercised during every role switch |
| 28 | 44px touch targets | preserved (SegmentedControl h-11 on mobile; dock buttons min-h-11; KPI card is not a target) |

**Known non-defects (documented to avoid re-triage):**
- The floating "N" black circle overlapping the dock's first tab in screenshots is the **Next.js Dev Tools badge** — dev-only chrome, absent in production.
- Property names ("Baraka Court · Kahawa Wendani, Nairobi"), unit labels ("B2"), and brand words (NEST, M-Pesa, KSh) are names of record — correctly never translated.
- Mid-scroll content passing under the fixed dock is inherent to any fixed nav; the first-paint guarantee is covered by check #9/#18.
