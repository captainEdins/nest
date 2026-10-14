# Phase 25 QA Gate — bar chart redesign (issue #117)

**Issue**: #117 · **Branch**: `fix/issue-117-bar-chart-redesign` (from dev @ `7e6b58f`)
**Scope**: CollectionTrendChart (analytics) + MiniTrendCard (home) rebuilt as
CSS/flex bar charts; axis headroom; real-text labels; footer v0.25.0.

## The defect (user-reported: "does not look good at any screen")

VLM design critique of the LIVE pre-change charts found, at mobile AND desktop:

1. **Zero headroom** — `niceAxisMaxMinor(84k) == 84k` (data max), so the tallest
   bar sat exactly on the plot ceiling and read as clipped; rounded tops invisible.
2. **Fixed viewBox text scaling** — 10px SVG text scaled with container width →
   ~6px month labels at 375px, inflated at desktop.
3. **Floating y-axis labels** — no axis line, weak gridline association.
4. **Billed series near-invisible** — `fill-muted` (gray-on-white ~15% contrast).
5. Cramped legend; faint dashed gridlines; wrong visual hierarchy.

## The fix

- Both charts are now **CSS/flex bar charts**: div bars with % heights, real
  HTML text labels (always crisp at any width), hairline divs for gridlines.
- **Axis headroom**: data max × 1.18 before nice-rounding (84k data → 100k axis),
  plus `MAX_BAR_SHARE = 0.92` → tallest bar = 77% of the bar zone (measured:
   108px in a 140px row — **32px of visible air** below the top gridline).
- **Billed series**: `bg-primary/15` tint (dark: `/25`) — visible on both themes.
- **Y-axis gutter**: tick labels anchored to their gridlines (right-aligned,
  tabular-nums), baseline solid `foreground/25`.
- Zero-value months keep a 0.6%-height sliver (shape preserved).
- **A11y contract unchanged**: 6 focusable month groups per chart, full summary
  aria-labels + native title tooltips; exact values in the table/honesty line.

## Gates

| # | Check | Result |
|---|---|---|
| 1 | `bunx tsc --noEmit` | PASS (0 errors) |
| 2 | `bun run lint` | PASS (0 errors) |
| 3 | No dead refs (TREND_*, PLOT_*, topRoundedBarPath, BAR_*) | PASS (grep clean) |
| 4 | DOM geometry: tallest bar 77.28% (108px / 140px row), 32px headroom | PASS (measured) |
| 5 | Zero months render 1px slivers (shape preserved) | PASS (measured) |
| 6 | Neutral VLM review (mobile analytics): clear space above tallest bar, labels readable, no defects | PASS |
| 7 | VLM review (mini trend on home): labels readable, headroom, no overlap | PASS |
| 8 | VLM review (dark mode): all three series visible, labels readable | PASS |
| 9 | A11y: 6 focusable month groups with full summary aria-labels | PASS (DOM) |
| 10 | Footer version | PASS (Phase 25 · v0.25.0) |
| 11 | Console/page errors during all flows | PASS (0) |

**Evidence**: `docs/qa/shots/phase25/` — before/after mobile, desktop, dark,
mini trend.

Note on methodology: an initial VLM pass with a leading prompt ("note whether
bars look clipped…") reported clipping; the objective DOM measurement
(77% height, 32px gap) contradicted it, and a neutral re-run confirmed the
headroom. DOM geometry is the ground truth for this gate.

**QA verdict: 11/11 gates PASS. Release-ready.**
