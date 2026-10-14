# Phase 26 post-release smoke — main @ 68badf0 (issue #121)

**Released**: 2026-10-14 (UTC) · Release PR #123 (dev @ 8082d05 → main @ 68badf0)
**Method**: agent-browser against the running release build on `main`.

## Smoke results — PASS

| Step | Result |
|---|---|
| Session + login state | PASS — "Good afternoon, Amina", full estate data |
| Home property cards tappable on release | PASS — `View units for Baraka Court / Riverside Flats` |
| Tap → property detail (released build) | PASS — Back button, `Add a unit to Baraka Court`, `Units (6)` |
| Add-unit happy path on release | PASS — D1 · Bedsitter · KSh 6,500 → confirm dialog states exact values → `Units (7)`, row `D1 · —`, toast "Unit D1 added — it starts vacant" (shot: smoke/released-main-d1-created.png) |
| Footer version | PASS — **Phase 26 · v0.26.0** |
| Console | PASS — 0 errors (clean reload + post-flow) |

**Verdict**: release healthy. Issue #121 closed with this evidence.
