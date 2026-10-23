# Phase 27 post-release smoke — main @ 284bca4 (issue #125)

**Released**: 2026-10-23 (UTC) · PR #126 (fix branch → dev, squash @ 572f9c2) · Release PR #127 (dev → main @ 284bca4)
**Method**: agent-browser against the running release build on `main`; VLM screenshot review for visual confirmation.

## Pre-release QA (fix branch) — PASS

| Check | Result |
|---|---|
| Zero-month dots — analytics chart | PASS — 4 dots in DOM (`size-[5px]`, baseline-anchored); VLM-confirmed at 390/768/1280 light + dark (shots: qa-analytics-*.png) |
| Zero-month dots — mini trend (home) | PASS — first pass too faint at 4px/40% (VLM missed on mobile); bumped to 5px/50% → VLM-confirmed (shot: qa-mini-trend-zeros-390.png) |
| Shared exact-values tooltip | PASS — hover `Sep`/`May` → chip renders at plot top-center, aria `status` role carries the full `monthSummary` line; never clips (anchored to plot, `whitespace-normal`, max-w clamped) |
| Values table breathe | PASS — `scrollWidth 420 > clientWidth 326` at 390px → scrolls; travel measured 94px; right-edge fade visible; ≥sm renders full-width |
| Press feedback pass | PASS — arrears/payment/unit/visitor rows + unmatched banner all carry hover tint + `active:` states (code + caretaker render check) |
| Tenant pay flow (regression) | PASS — full STK → simulate → receipt NEST-R-000008 issued, balance updated (earlier "stuck" report was a QA-script error — Escape dismissed the pending dialog before the simulate tap) |
| Property drill-down (regression) | PASS — tap card → units + tenants + add-unit dialog (disabled submit until valid) |
| `bun run lint` | PASS — clean |

## Smoke results (released main) — PASS

| Step | Result |
|---|---|
| Home on release | PASS — mini trend renders May zero group; footer **Phase 27 · v0.27.0** (shot: released-main-home-1280.png) |
| Analytics on release | PASS — chart + honest zero dots + gridlines + legend (shot: released-main-analytics-1280.png) |
| Tooltip on release | PASS — hover May → exact-values chip (shot: released-main-tooltip-hover.png) |
| Property drill-down on release | PASS — `Units (5)`, per-unit tenant/balance/status, Add unit present (shot: released-main-drilldown-1280.png) |
| Console | PASS — 0 errors |

## Ops incidents (documented per playbook)

Two concurrent-cron branch collisions mid-delivery (the 15-min webDevReview agent switched the checkout between staging and commit; a third switch happened after the explicit-refspec push, which was unaffected). Recovered atomically: `git update-ref refs/heads/fix/issue-125-… 09edc22` + local main `reset --hard origin/main`; `git diff cfe6758 1513606` verified empty so the PR carried exactly the 12 intended files. **Remote main/dev never touched by the incidents.**

**Verdict**: release healthy. Issue #125 closed with this evidence.
