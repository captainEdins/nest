# Phase 26 QA gate — property drill-down (issue #121)

**Branch**: `feature/issue-121-property-drilldown` (from dev @ `8c36dc1`)
**Date**: 2026-10-14 (UTC) · **Tester**: Principal Engineering (agent-browser + curl)
**Scope**: tap-a-property → detail (units + tenants) + add-unit flow + API edges.

## Results — 14/14 PASS

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Home property cards tappable (`View units for {name}` aria) | PASS | a11y tree refs `e475/e476`; shots/phase26/desktop-home-cards.png |
| 2 | Tap → detail pushed screen with Back | PASS | Back button → returns to origin tab (home AND properties tab both exercised) |
| 3 | Detail masthead: letter tile, name, location, `units · occupied · vacant`, occupancy % | PASS | "5 units · 4 occupied · 1 vacant" (Baraka) / "4 units · 2 occupied · 2 vacant" (Riverside) |
| 4 | Units scoped to THE property only (label-sorted) | PASS | Baraka shows A1/A2/B1/B2/C1 — never Riverside's C1–C4 |
| 5 | Row content: label · tenant name · type · rent · balance · status | PASS | "A1 · David Otieno / One bedroom · KSh 15,000 per month · Balance KSh 31,000 / Occupied"; "B2 · Grace Wanjiku · … · Balance KSh 9,000" |
| 6 | Vacant rows informational; statement opener on live tenancies | PASS | "C1 · —"; "Open David Otieno's statement" → pushed statement screen rendered |
| 7 | Add-unit sheet: label + 6-type chip grid + rent + deposit (prefills = rent) | PASS | dialog tree; confirm states "C1 · Shop · KSh 12,000/month · deposit KSh 12,000 · Baraka Court. The unit starts vacant." |
| 8 | Create happy path → 201, row appears, counts + toast update | PASS | Units (6); "6 units · 4 occupied · 2 vacant"; toast "Unit C1 added — it starts vacant" |
| 9 | Duplicate label → 409 inline (bilingual key, not raw server string) | PASS | "A unit labelled C1/B1 already exists on this property"; shots/phase26/desktop-duplicate-409.png |
| 10 | POST /api/units role matrix | PASS | LANDLORD 201; CARETAKER 403 `{"code":"FORBIDDEN"}`; no-auth 401 `UNAUTHORIZED` |
| 11 | POST /api/units scope/validation | PASS | foreign propertyId → 404 `NOT_FOUND` (no existence leak); bad body → 400 `VALIDATION` with zod details |
| 12 | AuditLog UNIT_CREATED | PASS | row verified: entity Unit, detail {propertyId, propertyName, label, type, rentAmountMinor, depositAmountMinor, createdBy:"Amina Barasa"} |
| 13 | Flat all-properties unit directory REMOVED from Properties tab | PASS | Properties tab a11y tree shows only the two tappable cards |
| 14 | Mobile 390px + desktop 1280px, 0 console errors | PASS | clean reload → zero errors; VLM false-positives disproven by DOM (see note) |

## Bug found & fixed during QA

- `KSh 15,000per month` — missing space between `formatKes()` and the per-month
  caption in the new UnitRow (mobile AND desktop). Fixed: explicit `{" "}`
  before `t("agent.perMonth")`. Verified after fix.

## VLM note (methodology, per Phase 25 lesson)

A leading-prompt VLM pass reported 4 defects. DOM ground truth disproved all:

1. "B1 notice text clipped" — `scrollHeight === clientHeight` (48 === 48);
   the caption wraps to two rendered lines, no overflow.
2. "Statement icon < 44px" — `OpenStatementButton` is `h-11 w-11` (44px)
   on mobile by design (Phase 20, issue #98); VLM measured the decorative
   inner glyph.
3. "Type-chip indicators 24–28px" — the chip (the actual radio target) is
   `h-11` (44px); VLM measured the decorative letter tile inside it.
4. "Bottom-nav avatar overlaps Home label" — the existing active-tab
   indicator, unchanged in this phase, not a defect.

Neutral re-run pattern stands: DOM measurement is the arbiter.

## i18n parity

- 19 new keys both dictionaries (`property.viewUnitsAria` … `property.notFoundHint`)
- `en` 834 = `sw` 834 (rg count of quoted keys)

## Build

- `bunx tsc --noEmit` clean · `bun run lint` clean · footer **Phase 26 · v0.26.0**
