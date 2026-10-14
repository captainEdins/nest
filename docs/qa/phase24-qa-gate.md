# Phase 24 QA Gate — honest front door + README evidence gallery

**Issue**: #113 · **Branch**: `feat/issue-113-show-the-product` (from dev @ `cd0350c`)
**Scope**: login 200-but-empty empty state (EN/SW + retry), README product gallery,
roadmap rows restored (P22–P24), footer v0.24.0, post-reset verification evidence.

## Environment note (production incident, this session)

The sandbox environment reset wiped local state before this phase: `.env` lost
`DEMO_MODE=1` (profiles 404), the seed DB lost all rows (profiles 200-but-empty —
the exact defect this phase fixes), `.gitignore` was overwritten, `worklog.md`
and the cron job were deleted. Recovery per the incident manual:
`bunx prisma generate` → `bun run db:seed` → `.env` restored → post-reset
verification screenshots captured (`docs/qa/shots/phase24/reset-recovery-*.png`)
before any Phase 24 work began. Phase 23 (agent parity) was re-verified end to
end on the recovered DB (see "Pre-change verification" below).

## Gates

| # | Check | Result |
|---|---|---|
| 1 | `bunx tsc --noEmit` | PASS (0 errors) |
| 2 | `bun run lint` | PASS (0 errors) |
| 3 | i18n EN/SW key parity | PASS (812 = 812; +2 new keys both sides) |
| 4 | Happy path: seeded profiles → all 5 role cards render, login as agent works | PASS (browser-verified after change; cards byte-identical flow) |
| 5 | Empty state EN: profiles intercepted `{data:[]}` → title + hint + Retry visible, no cards | PASS (`login-empty-state-en.png`) |
| 6 | Empty state SW: same interception, language switched → SW strings exact | PASS (`login-empty-state-sw.png`) |
| 7 | Retry recovery: interception removed, Retry clicked → cards return without reload | PASS (SW labels visible post-refetch) |
| 8 | Error path regression: 404/500 → `ErrorState` + retry unchanged | PASS (code path untouched; only empty branch added) |
| 9 | Footer version | PASS (Phase 24 · v0.24.0) |
| 10 | README gallery: 5 images referenced, relative paths, descriptive alt text | PASS (`docs/shots/readme/`) |
| 11 | README roadmap: P22/P23/P24 rows present and accurate | PASS |
| 12 | Console errors / page errors during all above flows | PASS (0) |

## Pre-change verification (Phase 23 on recovered DB — agent parity still whole)

- Agent login → money KPI quad, trend, security digest, vacancy funnel, arrears
  preview (4 rows), recent payments — PASS
- Arrears tab + Remind all (4) — PASS · Payments tab with filters + match — PASS
- Analytics tab renders — PASS
- **403 boundaries**: `POST /api/expenses` → 403 · `GET /api/kra/export` → 403 ·
  `GET /api/kra/summary` → 403 — PASS
- Payments POST role guard admits LANDLORD/CARETAKER/AGENT (code inspection) — PASS
- Mobile 390×844 layout — PASS (`reset-recovery-agent-mobile.png`)

## Evidence

- `docs/qa/shots/phase24/login-empty-state-en.png` — empty state, English
- `docs/qa/shots/phase24/login-empty-state-sw.png` — empty state, Kiswahili
- `docs/qa/shots/phase24/reset-recovery-agent-home.png` — post-reset agent desk
- `docs/qa/shots/phase24/reset-recovery-agent-mobile.png` — post-reset mobile
- `docs/shots/readme/*.png` — the five gallery captures

**QA verdict: 12/12 gates PASS. Release-ready.**


## Post-release smoke (main @ 1a85879) — PASS

- Login happy path: 5 role cards (EN) — PASS
- Agent login → desk + footer "Phase 24 · v0.24.0" — PASS (`smoke-main-agent-home.png`)
- Empty state on the RELEASED build via interception: title + Retry render — PASS (`smoke-main-empty-state.png`)
- 0 page/console errors — PASS
