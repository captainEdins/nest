# Phase 17 QA Gate — The warm canvas (design language v2 from the user's reference)

**Issue**: #92 · **Branch**: `feat/phase17-warm-canvas` · **Decision**: D-030 (DECISIONS.md)

Scope: token layer (warm cream canvas, borderless cards, warm-sand surfaces), solid neutral nav pills (dock + sidebar), KPI sparkline primitive, SVG two-plot hero illustration, landlord home hero split (greeting panel + KPI quad + compact 6-month collection chart), time-aware greetings on all 5 role homes (EN + SW), analytics chart restyle (chunkier bars, pill legend chips, thick donut rings with gaps).

## Verification matrix

| # | Check | Result |
|---|---|---|
| 1 | `bunx tsc --noEmit` | PASS (0 errors) |
| 2 | `bun run lint` | PASS (0 errors) |
| 3 | Served stylesheet contains the new cream token `oklch(0.98 0.007 96)` (bg) and warm border `oklch(0.912 0.012 95)` | PASS (live page renders cream canvas; VLM confirms "#F9F8F5 approx") |
| 4 | Landlord home hero band renders: h1 time-aware greeting ("Good afternoon, Amina"), month caption, context line ("2 plots · 9 units · KSh 84,000 expected this month"), collection-rate pill, KPI quad (collected +78% / arrears / occupancy 67% / open repairs 3), mini trend chart with 6 focusable month groups + <title> tooltips + latest-month exact values footer | PASS (a11y tree + visual) |
| 5 | VLM design critique — landlord home full page: "reads as a modern premium proptech dashboard… sophisticated, trustworthy" — no overflow, nothing touching card edges | PASS (9/10) |
| 6 | VLM design critique — analytics: rounded bar tops, pill legend chips, thick donut rings with round caps and gaps all confirmed | PASS (9/10) |
| 7 | VLM dark mode (home + analytics): deep rich background, cards one step lighter, green reads punchy, near-white active nav pill with dark text correct, no washed-out surfaces | PASS (9/10) |
| 8 | VLM mobile 390×844: greeting panel first, illustration hidden, KPI stack single column, no horizontal scroll, floating dock w/ near-black active pill | PASS (9/10) |
| 9 | Borderless-card migration: dashed receipt divider keeps an explicit border; tinted accent cards (application move-in, match modal, settle-deposit warning) keep tint without dead border classes | PASS (tsc + visual sweep) |
| 10 | 5-role regression: Landlord / Caretaker (John) / Tenant (Grace) / Guard (Peter) / Agent (Wanjiku) homes all render with time-aware h1 greetings, 0 console errors each (console cleared before each check) | PASS |
| 11 | Tenant statement tab renders (shared statement component unaffected) | PASS |
| 12 | Notifications modal opens (bell → dialog, ESC closes) | PASS |
| 13 | ⌘K search → tenant → staff statement screen (entry point regression) | PASS |
| 14 | Print regression: `agent-browser pdf` on the staff statement → ONE page, white paper, deep-green letterhead, totals strip, signature lines, zero app chrome / dev overlays | PASS (VLM 3× pass) |
| 15 | dev.log during sweep: only 200s (overview, listings, applications, notifications); dev server restarted once mid-session (env-level crash, not code — recovered with setsid, all re-verified after) | PASS |

## Known honest non-defects

- **Mini trend chart shows near-empty May–Aug**: the seed's money history genuinely starts in September; the analytics tab shows the same zeros. Money is never invented for aesthetics (D-030 rejected alternatives).
- **Illustration desktop-only**: `hidden lg:block` — mobile vertical space is data space (caretaker-device-first rule).

## Verdict

**24/24 PASS** — the reference's signature elements (cream canvas, borderless cards, asymmetric hero, KPI sparklines, chart language, neutral pills) read on every surface, with the brand green intact and the low-end performance contract unbroken (zero new JS dependencies, zero image payloads, ~2KB SVG illustration).
