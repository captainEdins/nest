# Phase 20 QA Gate — The arrears screen fix (line-height footgun + rhythm + mobile truncation)

**Issue**: #98 · **Branch**: `fix/issue-98-arrears-visual-defects` · **Org model**: first `dev`-based flow (permanent `dev` branch created at `main`; temp branch from `dev`; PR → dev; dev → main release PR)

Trigger: user report — "the ui in arrears does not look good." agent-browser DOM measurement + VLM audit (desktop 4/10), every VLM claim re-verified claim-by-claim before acceptance (the standing Phase 18+ VLM-variance practice).

## Verified defects

1. **[sev 5 · the big one] Arrears table rows rendered 387px tall** (payments ledger rows: 43px). Root cause: `rent-score-chip.tsx` used `text-caption/90`. `--text-caption` is a Tailwind v4 **font-size** token, so the `/90` suffix is a **leading modifier** — `line-height = 90 × 0.25rem = 360px` (DOM-verified: computed `line-height: 360px` on the band-word span). Chip → 366px tall, every row → 387px, the table → 1592px. The intended "90% opacity" never existed. Also inflated the mobile card rows wherever the band word is visible (≥420px viewports).
2. **[sev 4] Aging bucket cards 133px tall** — a D-032 (Phase 19) sweep miss: these Cards put `p-3` on the Card root while inheriting the base `gap-6` — 24px gaps between an 11px label, 14px amount, 12px caption.
3. **[sev 3] Page total `text-h3` (18px/700) < title `text-h2` (22px/600)** — D-031: the total is the page's primary number; it may not be the smaller element.
4. **[sev 4] Mobile row caption truncated the months-behind label** (scrollW 211 > clientW 192 — "…1 month beh…"): the urgency fact sat at the END of the truncated line, so it was the item most often cut.
5. **[sev 3] Mobile bucket strip = horizontal scroll of 4 × 128px cards** (560px content in a 343px viewport, no affordance) — two independent VLM audits read the clipped third bucket as broken content.
6. **[sev 3 · found during fix] `OpenStatementButton` pinned at `h-11` (44px) desktop** while sibling `SendReminderButton` shrinks `sm:h-9` — misaligned action pair, rows stuck at 65px.

## Disproved claims (documented to prevent re-litigating)

- "Massive gap between table header and first row" — measured 0px; the void was the 387px row bodies (defect 1).
- "Rent score chip vertically misaligned" — side-effect of defect 1.
- Bucket height inconsistency — all four exactly 133px (now all 89px).
- Page-level horizontal overflow at 375px — scrollWidth 375 = viewport 375.
- "Ghost text below the bottom nav" — standard fixed nav; main `pb-[88px]`; at full scroll the last row's buttons clear the nav by 231px (491 vs 722).
- "Circular N FAB overlapping nav" — Next.js dev-tools indicator; dev-only, absent in production.
- "31–60 days bucket contradicts '1 month behind' rows" — buckets derive from `oldestUnpaidPeriod` (days overdue vs the 5th), not `monthsBehind` (unpaid period count): a tenant can be one period behind with that period 31–60 days overdue. Data semantics, not a rendering defect; logged as a possible future affordance note.
- "Table not sortable / no hover" — rows do hover (`hover:bg-muted/50`); the sort is fixed by design (largest balance first — S-11).

## Fix

- `rent-score-chip.tsx`: `text-caption/90` → `text-caption opacity-90` (colour tokens take the slash; font-size tokens take it as **leading** — the footgun is documented in the component header + design-system D-033 note).
- `arrears-screen.tsx`: bucket strip `flex overflow-x-auto …` → `grid grid-cols-2 gap-3 sm:grid-cols-4` (nothing urgent hides behind scroll); bucket Card root `py-0 gap-0 rounded-xl` + inner `div.flex.flex-col.gap-1.p-3` (D-032 flat-card anatomy); total `text-h3` → `text-h2` (22px/700 amber, D-031); table balance cell `font-semibold` → `font-bold`; skeleton `h-24` → `h-20 py-0 gap-0` (matches the new bucket height).
- `arrears-row.tsx` (mobile): months-behind moves under the amount in a right-aligned debt block (`shrink-0 text-right`: amber bold amount over muted caption months — never the truncated tail); caption keeps only `unit · property`.
- `statement-screen.tsx`: `OpenStatementButton` gains `sm:h-9 sm:w-9` (44px touch target preserved on mobile; desktop tracks the sibling button — rows 65px → 57px).

## Verification matrix

| # | Check (issue #98 AC) | Result |
|---|---|---|
| 1 | Chip band-word computed line-height ≤ 1.5rem | PASS — 16px (was 360px); chip 22px (was 366px) |
| 2 | Desktop arrears rows ≤ 64px | PASS — 57px ×4 (was 387px); payments ledger cadence |
| 3 | Bucket cards ≤ 90px, D-032 root | PASS — 89px ×4 (was 133px); `py-0 gap-0` + inner p-3 |
| 4 | Total ≥ title size, amber, bold, tabular | PASS — 22px/700 vs title 22px/600 |
| 5 | Mobile months-behind fully visible | PASS — "1 month behind" ×4, no truncation (caretaker ×3 too) |
| 6 | Mobile: all four buckets visible, no h-scroll | PASS — 2×2 grid, 166px wide, page overflow false |
| 7 | Regressions: payments rows | PASS — 43px ×7 unchanged |
| 8 | Regressions: caretaker arrears view | PASS — desktop rows 57px, chips 22px; mobile rows ~127px, months visible, buckets 4×166 |
| 9 | Last row clears fixed bottom nav at full scroll | PASS — buttons end 491px vs nav top 722px |
| 10 | Console errors (landlord + caretaker sessions) | PASS — 0 |
| 11 | `npx tsc --noEmit` | PASS — 0 errors |
| 12 | `bun run lint` | PASS — 0 errors |
| 13 | Slash-leading sweep (`text-(caption|body|label|kpi|micro|display|h1..h3)/` in src/) | PASS — only the doc-comment mention remains |
| 14 | VLM re-audit desktop | 4/10 → **7.5/10** (remaining claims disproved above) |
| 15 | VLM re-audit mobile | **7.5/10** (remaining claims disproved above) |

Evidence: `/tmp/arrears-desktop-before.png`, `/tmp/arrears-desktop-after.png`, `/tmp/arrears-mobile-before.png`, `/tmp/arrears-mobile-after.png`, `/tmp/arrears-caretaker-mobile-after.png` (agent-browser, 1280×800 + 375×800).
