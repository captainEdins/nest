# Phase 8 QA Gate — Move-in (Approved Applicant → Active Tenancy)

**Task ID:** P8 · **Issue:** #72 · **Gate date:** 9 Oct 2026 (demo clock) · **App version:** Phase 8 · v0.8.0
**Scope under test:** P8-a contracts (CONVERTED status, MoveInRequest/ResultDto, i18n EN+SW, chip/timeline tones, MOVE_IN template heading, seed Joyce→APPROVED), P8-b API (`POST /api/move-ins`), P8-c UI (MoveInSheet, MoveInCard, ConvertedSummary, landlord funnel ready-card, agent applicants filter).
**Method:** adversarial curl probe battery (expected vs actual) + full-flow agent-browser E2E at 375×812 + a 11-point DB transaction audit + reseed verification. No test files per platform rule.

---

## Part 1 — Adversarial API probe battery

Login profiles: landlord Amina `+254711000001` · caretaker John `+254711000002` · tenant Grace `+254711000003` · agent Wanjiku `+254711000007`.

### Role fence (matrix §4.2 — the move-in is the landlord's decision of record)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | POST /api/move-ins as AGENT | 403 | 403 FORBIDDEN | PASS |
| 2 | POST as TENANT | 403 | 403 FORBIDDEN | PASS |
| 3 | POST as CARETAKER | 403 | 403 FORBIDDEN | PASS |
| 4 | POST unauthenticated | 401 | 401 UNAUTHORIZED | PASS |
| 5 | POST with garbage applicationId as LANDLORD | 404 | 404 NOT_FOUND "Application not found" (scope in the same query — no existence leak) | PASS |

### State machine (the 409 family — conversion is exactly-once)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 6 | LANDLORD re-converts the already-converted application | 409 | 409 CONFLICT "This applicant has already been moved in" | PASS |
| 7 | Move-in on a CONTACTED (unapproved) application | 409 | 409 CONFLICT "Only an approved applicant can be moved in — approve them first" | PASS |
| 8 | Approve Brian then move him into the now-occupied B3 | 409 | 409 CONFLICT "That unit is not vacant — end the current tenancy first" (double-guarded: unit status column + ACTIVE-tenancy existence check) | PASS |

### Money / validation (integer KES minor — ADR-0004)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 9 | monthlyRentMinor `2500000.5` | 400 | 400 VALIDATION "expected int, received number" | PASS |
| 10 | monthlyRentMinor `0` | 400 | 400 VALIDATION "Too small: >0" | PASS |
| 11 | depositHeldMinor `-1` | 400 | 400 VALIDATION "Too small: ≥0" | PASS |
| 12 | startDate `"not-a-date"` | 400 | 400 VALIDATION "Enter a valid date" | PASS |

**Battery verdict: 12/12 probe groups PASS, 0 defects found.**

---

## Part 2 — Full-flow E2E (agent-browser, 375×812, session `p8qa`)

| Step | Verified | Evidence |
|---|---|---|
| Landlord home after reseed | amber pending card "2 application(s) awaiting your decision" (Joyce left pending when she moved to APPROVED) | snapshot |
| Applicants queue → Joyce | Approved chip + "Open move-in" hint line on the row; detail shows MoveInCard "Move them in — Joyce Muthoni", timeline 4 events | p8-14 |
| MoveInSheet | prefilled from the listing of record: rent 25,000 · deposit 25,000 (one-month default) · today's date; trust-summary card ("What happens when you confirm") renders | snapshot |
| Submit | POST 200 · toast "Tenancy NEST-B3-1005 opened — Joyce Muthoni can now pay rent" · timeline 4→5 · sheet closes | dev.log line `POST /api/move-ins 200` |
| Converted detail | "Moved In" chip (primary solid) · ConvertedSummary card "Tenancy NEST-B3-1005 opened · rent KSh 25,000/mo · deposit KSh 25,000 held · starts 2026-10-09" · CONVERTED timeline pill + house dot | p8-18 |
| Joyce logs in (manual phone `+254701555666`) | home: "Hi, Joyce" · Pay now · **Deposit: KSh 25,000** · charges breakdown exactly "Oct 2026 · KSh 25,000" · 1 unread | p8-15 |
| Joyce's welcome notification | "Move-in completed" heading (translated template) + "NEST: Karibu Baraka Court B3! Your tenancy NEST-B3-1005 is active…" | p8-16 (VLM-verified) |
| Cross-role flip visibility | caretaker units: B3 → OCCUPIED (5/5 occupied) · landlord home: Vacancies (0), occupancy 100%, funnel card "All listings closed — the units are rented" · listings tab: LET chip | API + snapshots |
| Server log across the whole gate | zero `[api] unhandled error`, zero 500s | dev.log scan |

**Console:** zero page errors (one transient `[error] en.ts:686` was a mid-edit HMR artifact from editing i18n while the server ran — never re-fired after the reload; the file compiles clean).

---

## Part 3 — The 11-point DB transaction audit (read straight off SQLite)

| # | Invariant | Result |
|---|---|---|
| 1 | Application status CONVERTED, timeline NEW → CONTACTED → VIEWING → APPROVED → CONVERTED | ✓ |
| 2 | Tenancy NEST-B3-1005 ACTIVE · rent 2,500,000 minor · deposit 2,500,000 · start 2026-10-09 | ✓ |
| 3 | Tenant Profile auto-created: Joyce Muthoni +254701555666, role TENANT | ✓ |
| 4 | Unit B3 → OCCUPIED | ✓ |
| 5 | Deposit 2,500,000 HELD + HOLD movement 2,500,000 with actor set | ✓ |
| 6 | First charge RENT · 2026-10 · 2,500,000 · UNPAID | ✓ |
| 7 | Listing → LET | ✓ |
| 8 | MOVE_IN notification to the tenant (welcome, accountRef, pay instruction) | ✓ |
| 9 | APPLICATION_STATUS notification to the agent (who moved whom, where, rent) | ✓ |
| 10 | AuditLog MOVE_IN with full detail JSON (application, tenant, phone, unit, property, accountRef, amounts, dates, actor) | ✓ |
| 11 | Exactly 5 tenancies (4 seeded + 1 new — no duplicates) | ✓ |

## Part 4 — Close-out

| Check | Result |
|---|---|
| Defect found & fixed during gate | custom note REPLACED the machine summary in the CONVERTED event → route now prefixes the landlord's note and always appends the tenancy facts (accountRef stays on every surface) |
| Pre-existing defect fixed en route | `fixtures.ts pushNotification` missing `readAt` (Phase 7 leftover, breaks `tsc --noEmit` on main) → `readAt: null` (new notifications are unread) |
| `bunx tsc --noEmit` | 0 errors |
| `bun run lint` | 0 findings |
| `bun run db:seed` post-gate | 8 profiles · 1 listing PUBLISHED · 3 applications (Joyce APPROVED move-in-ready, Brian NEW, Faith CONTACTED) · 4 tenancies · counts stable |
| Dev server | healthy on :3000 throughout |

**GATE VERDICT: PASS.** Phase 8 (move-in) is QA-gated. Screenshots: `download/qa-screens/p8-13..18`.
