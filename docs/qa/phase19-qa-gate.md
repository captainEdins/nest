# Phase 19 QA Gate — The rhythm pass (card padding spec alignment + KPI row fill)

**Issue**: #96 · **Branch**: `feat/phase19-rhythm-pass` · **Decision**: D-032 (design-system §5 alignment note)

Trigger: post-reset VLM design audits of the landlord + caretaker homes (desktop + mobile) scored 6.5/10 with rhythm findings. Code + DOM verification isolated three systemic defects (and disproved several audit claims — the Phase 18 VLM-variance practice, continued):

**Verified defects**
1. **Double vertical padding on flat cards**: Card base `py-6 gap-6` (D-030) stacked under flat cards' `CardContent p-4 sm:p-6` → measured 40/48px vertical vs 16/24px horizontal (2:1 asymmetry) — design-system §5 specifies `p-4 → sm:p-6` **total**. 63 flat-card sites / 22 files.
2. **Button-wrapped KPI cards don't fill their row** (`KpiButton` caretaker; raw `<button>` landlord repairs): DOM showed Arrears outer 226px vs inner Card 186px (40px dead zone) — flagged by 3 independent audits.
3. **Landlord occupancy KPI had no icon** while siblings did.

**Disproved claims (kept as documented VLM variance)**
- KPI row-1 height mismatch (crop check: equal both rows, both themes).
- Hero progress-bar contrast (clearly visible; custom `primary-foreground` track).
- Sidebar active state weak (solid neutral pill — D-030).
- "View all" touch target (h-11 = 44px mobile).
- Mobile bottom-edge mismatch (DOM at 390px: Row1 206/206, Row2 122/122 — identical boxes).
- Dark-mode muted text / hairline dividers / amber-on-dark (borderline subjective calls vs the documented §4 contrast matrix).

## Fix
`kpi-card.tsx` root: `py-0 gap-0 h-full` (CardContent padding becomes the whole card; the card fills its grid cell / clickable wrapper). Scripted nested-safe sweep (skip Cards containing nested `<Card`, CardHeader/Footer cards, already-zeroed divide-y lists): 59 sites / 20 files + 3 manual `p-0`-content sites (guard stat-strip skeleton, login identity cards, tenant charges accordion). 5 multiline-attr sites merged by hand after the script duplicated `className` (tsc caught all 5 — the type system as the sweep's safety net). Landlord occupancy KPI gains `Building2`. KPI icon tile tint now follows the card tone (amber cards get amber tiles — arrears icon no longer contradicts the amber value).

## Verification matrix

| # | Check | Result |
|---|---|---|
| 1 | `bunx tsc --noEmit` | PASS (0 errors — after the 5 duplicate-attr merges) |
| 2 | `bun run lint` | PASS (0 errors) |
| 3 | DOM re-measure (caretaker desktop): flat-card root padding 0+0; content padding 24px symmetric; row heights equal — Collected 178 / Arrears 178, Repairs 138 / Unmatched 138 | PASS |
| 4 | DOM button-fill: Arrears card height == KpiButton height (178 == 178, `filled: true`) | PASS |
| 5 | DOM mobile 390px (caretaker): Row1 206/206 same top+bottom; Row2 122/122 | PASS |
| 6 | VLM re-audit landlord home: 6.5 → **8.5/10** — "KPI cards now share equal heights per row with consistent padding. Strong, production-ready dashboard." | PASS |
| 7 | VLM re-audit caretaker desktop: 6.5 → **8.5/10** — "high-fidelity, professional; uniform height, symmetric padding, no cramping" | PASS |
| 8 | VLM re-audit caretaker mobile 390×844: **8.5/10** — spacing balanced, touch targets ≥44px | PASS |
| 9 | VLM tone check: arrears icon tile reads AMBER (was green); unmatched stays green (default tone) | PASS |
| 10 | VLM dark mode (guard home): 8.5/10; remaining claims are documented-contrast borderline calls (§4 matrix wins) | PASS |
| 11 | VLM 3-role regression (tenant / agent / guard homes post-sweep): **PASS / PASS / PASS** — no layout breaks, no asymmetric padding, no clipped text | PASS |
| 12 | Print regression: tenant statement → `agent-browser pdf` → ONE page; VLM 6/6 yes (letterhead, tabular money, totals, signature lines, zero chrome, single page) | PASS |
| 13 | Console sweep across all 5 roles: 0 errors/warnings; dev.log during sweep: only 200s + prisma queries, zero 5xx | PASS |

## In-round findings
- The scripted sweep is only as safe as its escape hatches: the 5 duplicate-`className` sites prove tsc belongs in the loop for any code transform (all caught before commit).
- The 3 `p-0`-content sites (login cards, accordion, guard skeleton) shared the same 2:1 asymmetry via the root `py-6` — the "flat card" definition includes content-managed padding, not just `p-4 sm:p-6`.

## Known honest non-defects
- Mini trend chart's empty May–Aug (genuinely zero in the seed — money is never invented for aesthetics; D-030 documented).
- Greeting panel vertical share (the asymmetric hero is the D-030 design intent).
- Lucide stroke weights are uniform across header/sidebar (single icon family, 2px stroke) — audit claim disproved by the icon set's own spec.
