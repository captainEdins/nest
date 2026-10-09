# Phase 11 QA Gate — Lease Exit Arc (notice → move-out → deposit settlement unblocked)

**Task ID:** P11 · **Issue:** #78 · **Gate date:** 9 Oct 2026 (demo clock) · **App version:** Phase 11 · v0.11.0
**Scope under test:** `POST/DELETE /api/tenancies/[id]/notice`, `POST /api/tenancies/[id]/move-out`, `TenancyLifecycleDto` contract, `UnitDto.tenancy.{moveOutDate,tenancyStatus}` extensions, `TenantOverviewDto.tenancy.{status,moveOutDate}`, tenant notice banner + give-notice sheet, landlord/caretaker move-out dialog, move-out inspection sheet (first consumer of `useCreateConditionReport`), ENDED+HELD settle-row retention, i18n `notice.*` (40 keys EN+SW), 3 new notification template headings, footer Phase 11 · v0.11.0.
**Method:** 12 API probes (curl, cookie sessions, 2 roles + anonymous + cross-tenant) + full agent-browser E2E lifecycle sweep + console/dev.log monitoring + `bunx tsc --noEmit` + `bun run lint`. No test files per platform rule. Seed: Kevin/B1 story (NOTICE, endDate=today, MOVE_OUT report, HELD deposit, NOTICE_GIVEN audit+notifications) so the demo chain is live on every reseed.

---

## Part 1 — API guard rails (the trust boundary)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | POST notice as TENANT (David, ACTIVE tenancy, 2026-11-05) | 200 TenancyLifecycleDto: tenancyStatus NOTICE, unitStatus NOTICE, moveOutDate set | exact | PASS |
| 2 | POST notice again (replay) | 409 CONFLICT "Notice already given for this tenancy" | exact | PASS |
| 3 | POST move-out before the notice date (as LANDLORD) | 400 VALIDATION "Move-out date has not been reached yet" | exact | PASS |
| 4 | POST move-out as TENANT | 403 FORBIDDEN "Role TENANT may not access this resource" | exact | PASS |
| 5 | DELETE notice (withdraw, as TENANT) | 200: tenancyStatus ACTIVE, unitStatus OCCUPIED, moveOutDate null | exact | PASS |
| 6 | POST notice with past date (2020-01-01) | 400 VALIDATION "Move-out date cannot be in the past" | exact | PASS |
| 7 | POST notice > 120 days out (2027-06-01) | 400 VALIDATION "Move-out date must be within 120 days" | exact | PASS |
| 8 | POST notice reason "no" (< 3 chars) | 400 VALIDATION + zod details path=reason | exact | PASS |
| 9 | Cross-tenant: Grace posts notice on David's tenancy | 404 NOT_FOUND (existence must not leak) | exact | PASS |
| 10 | Unauthenticated POST notice | 401 UNAUTHORIZED | exact | PASS |
| 11 | Notification fan-out after tenant notice + move-out chain | tenant: NOTICE_GIVEN → MOVE_OUT_RECORDED → TENANCY_ENDED (IN_APP+SMS) → DEPOSIT_SETTLED (IN_APP+SMS) | all present, correct order | PASS |
| 12 | Audit rows | NOTICE_GIVEN (who/date/reason/givenBy), TENANCY_ENDED (executedBy/note), CONDITION_REPORT_RECORDED, DEPOSIT_SETTLED | all in AuditLog | PASS |

## Part 2 — E2E lifecycle (agent-browser, the golden path)

| # | Step | Checks | Verdict |
|---|---|---|---|
| 13 | Login Grace (TENANT) → Statement | "Give notice to vacate" button (ACTIVE lease only) | PASS |
| 14 | Open sheet | date input (min=today), reason field, trust summary stating the exact date, submit disabled until valid | PASS |
| 15 | Confirm AlertDialog | "Your move-out date is 9 Oct 2026…" — exact date stated before commit | PASS |
| 16 | Submit notice | sheet closes → banner "Moving out on 9 Oct 2026" on Statement AND Home; toast fired | PASS |
| 17 | Withdraw dialog | exact-date body ("The move-out on 9 Oct 2026 will be cancelled… Both decisions stay on the record"), Cancel keeps banner | PASS |
| 18 | More sheet (tenant) | "Give notice to vacate" entry visible pre-notice; hidden post-notice (banner replaces it) | PASS |
| 19 | Login Amina (LANDLORD) → Properties | B2 row: "On notice · 9 Oct 2026" chip + Complete move-out (primary) + Settle deposit (outline) | PASS |
| 20 | Move-out dialog | full context (unit · tenant · date reached statement), handover note field, inspection chip, cancel/complete | PASS |
| 21 | Inspection entry (from dialog chip) | InspectionSheet with B2 · Grace anchor + "On notice · 9 Oct 2026"; notes 10-char minimum enforced | PASS |
| 22 | Record inspection | sheet closes → back on move-out dialog; settle modal's warning card gone (report on record) | PASS |
| 23 | Complete move-out (with note) | B2 → "Vacant", tenant line "—", toast "Move-out completed — B2 is now vacant" | PASS |
| 24 | Settle on the ENDED row | B2 row retained (ENDED + deposit HELD): "Settle deposit" action still present — the money decision survives the exit | PASS |
| 25 | Full settle | deduction 2,000 (repaint) → refund 6,500 → released ledger summary (−2,000 DEDUCT, −6,500 REFUND) | PASS |
| 26 | Post-settle row | B2 row drops off the units list (ENDED + RELEASED no longer matches the include filter) | PASS |
| 27 | dev.log during the sweep | POST notice 200 → condition-reports 200 → move-out 200 → settle 200; zero errors | PASS |
| 28 | Browser console | 0 errors, 0 warnings after the whole chain | PASS |
| 29 | Reseed | Kevin/B1 story live: NOTICE + move-out date today + MOVE_OUT report + HELD deposit + NOTICE_GIVEN audit/notifications (15 notifications, 34 audit logs) | PASS |

## Part 3 — Regression guards

| # | Check | Verdict |
|---|---|---|
| 30 | `bunx tsc --noEmit` | 0 errors |
| 31 | `bun run lint` | 0 errors |
| 32 | Fixtures (dev fallback) updated for new DTO fields | tenantOverview tenancy.status/moveOutDate; units tenancy.moveOutDate/tenancyStatus |
| 33 | i18n completeness | `Record<TranslationKey, string>`: 40 new keys in BOTH en.ts and sw.ts (same commit) |
| 34 | Sign-out reset | giveNoticeOpen, moveOutFlow, moveOutContext, inspectionFlow reset in BOTH unauthorized handler + more-sheet sign-out + (store default) |
| 35 | Caretaker units tab | NOTICE rows show on-notice chip + exit executor; ENDED+HELD rows show deposit cell read-only (settle stays landlord-only — shell gate) |
| 36 | Analytics/overview | occupancy unchanged (NOTICE counts occupied, ENDED frees the unit — same non-VACANT logic) |
| 37 | Footer | "Phase 11 · v0.11.0" |

**Known non-defects (documented to avoid re-triage):**
- The settle modal's inspection entry opens the sheet while the modal stays mounted beneath (ResponsiveModal z-order) — intentional: on success the invalidation refetches the deposit and the warning card disappears in place.
- The AlertDialogContent a11y console warnings seen in an earlier browser session did NOT reproduce on fresh sessions — all AlertDialogs in the tree carry `AlertDialogDescription` (audited 7 consumer files, balanced). Historical buffer, not a defect.
- Native date input rendering (spinbuttons in the a11y tree) is the platform's own picker; typed/eval-set values dispatch real React onChange events.

---

## Part 4 — Independent review round (QA + PE agents, PR #79)

Two-pass independent review (QA reviewer, then Principal Engineer) against the first revision. Verdicts: **QA REQUEST CHANGES** (1 major, 8 minor, 4 nits) · **PE REQUEST CHANGES** (2 major, 4 minor, 6 nits). All majors + actionable minors fixed in-branch:

| # | Finding (severity) | Fix | Re-verified |
|---|---|---|---|
| R1 | **[PE major]** NOTICE severed every money-in path (STK/cash/match filtered `status:"ACTIVE"`; picker dropped notice tenancies) — final rent unpayable | widened to `status in [ACTIVE, NOTICE]` in the 3 write paths + tenancies picker; caretaker `canCollect` includes NOTICE units | probe below (P13) |
| R2 | **[both major]** Seed wrote an INSTANT (`daysAgo(0)`) as endDate; route compares UTC midnight → Kevin/B1 demo move-out server-blocked (client gate disagreed) | seed writes UTC-midnight calendar day; route compares CALENDAR DAYS (`calendarDayUtc`, robust to any legacy instant); client gates use the shared `calendarDayReached` twin | Kevin/B1 move-out probe + E2E |
| R3 | [PE minor] Caretaker-executed move-out never notified the landlord | move-out fans out to tenant + the OTHER staff party (landlord when caretaker executes, vice versa) | probe P14 |
| R4 | [PE minor] settle-at-NOTICE → withdraw would leave ACTIVE lease with RELEASED deposit | withdraw guard: deposit RELEASED → 409 "complete the move-out instead" | probe P15 |
| R5 | [both minor] tenancy flips were blind updates + dead post-checks; real guard misattributed | real compare-and-set (`updateMany` keyed on prior status) on all three transitions; dead checks removed | code + replay probes |
| R6 | [QA minor] withdraw failure fully silent | `toast.error` with the server message | code |
| R7 | [QA minor] notice toast interpolated raw ISO | `formatDate` (design-system: no ISO in UI) | code |
| R8 | [QA minor] "On notice · date" chip rendered on ENDED rows | chip gated on `tenancyStatus === "NOTICE"` | E2E |
| R9 | [QA minor] impossible dates ("2026-11-31") rolled silently to Dec 1 | zod round-trip refine (parsed day === typed day) | probe P16 |
| R10 | [QA minor] caretaker move-out disabled without explanation | `notice.moveOutNotReached` caption under the button (parity with landlord row) | E2E |
| R11 | [QA minor] ENDED-tenant home 404 rendered retry-forever error state | dedicated "No active tenancy" empty state (receipts/history stay honest) | probe P17 |
| R12 | [PE minor] `tenancies[0]` fallback nondeterministic | include `orderBy: { startDate: "desc" }` | code |
| R13 | [QA nits] dead i18n keys; inspection success toast unwired; move-out dialog offline caption; inspection sheet context null from settle modal | `unitsOnNotice` dropped; `inspectionRecordedToast` wired; offline caption added; `openInspection` takes its own context (set by both entry points) | E2E |
| R14 | [PE nit] `accountRef` dead weight on TenancyLifecycleDto | removed | code |
| R15 | [QA nit] phase10 gate row 33 counts stale | annotated as superseded (15/34) | doc |

**Post-fix probes:**

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| P13 | Kevin (NOTICE tenancy) STK push | STK session created (final rent payable through the notice window) | 200, checkoutRequestId issued | PASS |
| P14 | Caretaker-executed move-out → landlord notifications | TENANCY_ENDED IN_APP rows for tenant + landlord + caretaker (minus actor) | exact | PASS |
| P15 | Withdraw after deposit RELEASED | 409 "Deposit already settled — complete the move-out instead" | exact | PASS |
| P16 | Notice with "2026-11-31" | 400 VALIDATION "must be a real calendar date" | exact | PASS |
| P17 | Tenant with ENDED lease: GET /api/overview → home | 404 "no active tenancy" → friendly empty state (no retry loop) | exact | PASS |
| P18 | Kevin/B1 seeded demo move-out (the R2 regression) | move-out executable on the reseed day; settle then works | 200 → ENDED → VACANT → settle 200 | PASS |

Review verdict after fixes: **QA APPROVE · PE APPROVE — mergeable** (PE follow-ups recorded in the PR thread + worklog backlog).
