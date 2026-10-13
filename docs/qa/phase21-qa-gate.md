# Phase 21 QA Gate — The Classic Home (D-034, issue #101)

**Branch**: `feat/issue-101-classic-home` (from `dev`) · **PR**: → dev, then release dev→main.
**Scope**: visual language only — five role homes wear the ledger language; zero data/logic/i18n changes; zero new dependencies; non-home screens untouched.

All checks re-verified on the final DOM via agent-browser (`getComputedStyle` / `getBoundingClientRect`); VLM claims accepted only after DOM confirmation (standing Phase 18+ practice).

## 1. The classic recipes render (light + dark)

| # | Check | Method | Result |
|---|---|---|---|
| 1.1 | Masthead h1 is the serif stack | computed `font-family` | `Georgia, "Times New Roman", "Noto Serif", "Liberation Serif"` ✓ |
| 1.2 | `nest-rule` double rule | computed `border-top` + `::after` | `2px solid` primary green; `::after` 1px ✓ |
| 1.3 | Classic card frame | computed border/radius/shadow | 1px (2px top on `-rule`), 6px radius, `box-shadow: none` ✓ |
| 1.4 | Dark mode re-themes | `.dark` toggle | rule + borders → light-green `lab(69.2 -41.3 21.2)` ✓ |
| 1.5 | Cascade rule | recipes unlayered, beat utilities | `rounded-[6px]`/`rounded-[4px]` written explicitly at call sites (project `rounded-md` token = 10px ≠ Tailwind 6px — caught by DOM audit, fixed) ✓ |

## 2. Anatomy (per role home)

| # | Check | Result |
|---|---|---|
| 2.1 | Landlord KPI quad row heights | 185/185 (row 1), 147/147 (row 2) — one bottom edge per row ✓ |
| 2.2 | Landlord KPI quad mobile | 1-col ≥sm 2×2 (reverted a 2-col mobile squeeze — VLM caught "vs last m…" truncation; DOM now: 0 truncated money/labels) ✓ |
| 2.3 | Caretaker quad | 177/177, 129/129 ✓ |
| 2.4 | Caretaker action tiles | 6px radius, no shadow, 80px height, Record-cash solid primary ✓ |
| 2.5 | Tenant statement card | `nest-classic-rule` + small-caps head + `text-kpi` figure + hairline above next-due ✓ |
| 2.6 | Agent KpiCells + guard tiles/figure box | `nest-classic-rule` / squared tiles ✓ |
| 2.7 | Masthead skeletons | `MastheadSkeleton` (serif line + rule lines + stat lines) replaces `HeroSkeleton` at the masthead slot ✓ |

## 3. Regression — non-home screens unchanged

| # | Check | Result |
|---|---|---|
| 3.1 | Arrears screen (Phase 20 spec) | h1 "Arrears"; rows 57/57/57px; `nest-classic` count **0**; card sample 16px radius + soft shadow ✓ |
| 3.2 | Shared primitives default | `variant="soft"` default — KpiCard/SectionHeader/SecurityCard/NotificationsList soft paths byte-identical (analytics/KRA/tickets/etc. untouched) ✓ |
| 3.3 | `nest-hero-soft` / `HeroIllustration` | retired with the hero panels (file deleted, CSS removed) ✓ |

## 4. VLM audit (claim-by-claim)

- Landlord desktop: **8/10**. Structural claims DISPROVED by DOM: section gaps uniform 24px ([24,24,24,23,24,24,24]); arrears preview rows 119/119/118; section-header/View-all alignment identical (bottom 930/930, link 934/934). Accepted-and-fixed: mobile quad squeeze (see 2.2).
- Landlord mobile: **7/10** → after the 1-col fix, 0 truncated figures. Remaining VLM notes (dense bottom-nav, reminder icon size, date format mix) are pre-existing shared-row traits outside this phase's scope.
- Screenshots: `docs/qa/shots/phase21/` — before/after × {landlord, caretaker, tenant} × {desktop, mobile}, after × {agent, guard} × both, landlord dark, arrears regression.

## 5. Build & runtime

| # | Check | Result |
|---|---|---|
| 5.1 | `bunx tsc --noEmit` | exit 0 ✓ |
| 5.2 | `bun run lint` | clean ✓ |
| 5.3 | Console errors (all five roles, desktop + mobile passes) | 0 ✓ |
| 5.4 | Dev server | 200, compiles clean ✓ |
| 5.5 | i18n | zero new keys (composed from existing `role.*`, `heroContext`, `formatMonthKey`) — EN + SW both covered ✓ |
| 5.6 | Drift checklist §12 | no new colours, no new webfont (system serif stack only), money keeps `tabular-nums` (serif never sets data), amber-as-text rule intact ✓ |

## Verdict

**PASS** — 5/5 role homes in the ledger language; non-home surfaces verified untouched; all constraints (deep green, Poppins-for-data, zero downloads, error-shape, print) hold.
