# Phase 12 QA Gate — Money-out: the expense ledger + property P&L

**Task ID:** P12 · **Issue:** #82 · **Gate date:** 12 Oct 2026 (demo clock) · **App version:** Phase 12 · v0.12.0
**Scope under test:** `Expense` model (append-only, 7 categories, integer minor units), `GET/POST /api/expenses`, `POST /api/expenses/[id]/reverse`, `expenseScopeWhere` (matrix §4/§5.5), `ExpenseDto`/`CreateExpenseRequest`/`ExpensesResponseDto` contracts, `AnalyticsMonthDto.{expensesMinor,netMinor}` + analytics extension, Money-out tab (landlord + caretaker), record-expense sheet, reverse dialog, caretaker home quick action, analytics P&L hero + 3-bar trend + net column, KRA expenses note, i18n `expenses.*` + `analytics.moneyOut/net*` + `kra.expensesNote` (EN+SW), 2 notification template headings (map now 16), footer Phase 12 · v0.12.0.
**Method:** 13 API probes (curl, cookie sessions, 4 roles + anonymous) + agent-browser E2E (caretaker record → landlord notification → reverse → P&L reflects) + console/dev.log monitoring + `bunx tsc --noEmit` + `bun run lint`. No test files per platform rule.

---

## Part 1 — API guard rails (the trust boundary)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | POST expense as TENANT | 403 FORBIDDEN "Role TENANT may not access this resource" | exact | PASS |
| 2 | POST future occurredAt (2027-01-01) | 400 VALIDATION, path=occurredAt "cannot be in the future" | exact | PASS |
| 3 | POST bad category (RENT) | 400 VALIDATION, path=category, enum listed | exact | PASS |
| 4 | GET /api/expenses as GUARD | 403 FORBIDDEN by role (before scope) | exact | PASS |
| 5 | GET ?month=2026-13 | 400 VALIDATION "month must look like YYYY-MM" | exact | PASS |
| 6 | POST anonymous | 401 UNAUTHORIZED | exact | PASS |
| 7 | POST bogus propertyId (existence must not leak) | 404 NOT_FOUND "Property not found" | exact (after error-shape fix) | PASS |
| 8 | REVERSE as CARETAKER | 403 FORBIDDEN (reversal is landlord-only) | exact | PASS |
| 9 | REVERSE note "no" (<3) | 400 VALIDATION, path=note | exact | PASS |
| 10 | REVERSE as LANDLORD (valid note) | 201, negative row, reversalOfId set, category/property preserved | exact | PASS |
| 11 | REVERSE replay (same id) | 409 CONFLICT "This expense has already been reversed" | exact (after error-shape fix) | PASS |
| 12 | REVERSE the reversal row | 400 VALIDATION "A reversal cannot be reversed" | exact | PASS |
| 13 | Totals math after reversal | net = Σ signed rows; 8 rows in ledger | exact | PASS |

**Defects found & fixed during the gate (review round 1):**
- `Object.assign(new Error, {status})` did not match the route error contract → 500s instead of 404/409 (probes 7, 11). Fixed with the shared `notFound()` / `conflict()` / `ApiHttpError` helpers (same shape as every other route).
- Stale Prisma Client in the running dev server after `db:push` (`db.expense` undefined → 500). Fixed by dev-server restart; root cause documented in worklog (schema pushes require a restart, same as any prisma generate).

## Part 2 — E2E golden path (agent-browser)

| # | Step | Checks | Verdict |
|---|---|---|---|
| 14 | Caretaker home | "Record expense" quick action present (replaces redundant Units tile — Units stays in bottom nav) | PASS |
| 15 | Record-expense sheet | 7-category radiogroup (44px tiles), KES amount input, native date (default today, max today), note ≤140 with live counter, offline guard | PASS |
| 16 | Form validation | confirm disabled until category+amount+date valid | PASS |
| 17 | Confirm AlertDialog | states the exact money: "Water · KSh 1,200 · 2026-10-12 · Baraka Court" + trust copy; description linked (PR #81 a11y bar) | PASS |
| 18 | Submit | toast "Expense recorded — the P&L is updated"; sheet closes; dev.log POST /api/expenses 201 | PASS |
| 19 | Money-out tab (caretaker) | Total money out KSh 16,500 (+267% MoM), **Net −KSh 1,500** (15,000 collected − 16,500 = math exact), category chips sorted by spend, day-grouped ledger with my new row ("Recorded by John Mwangi") | PASS |
| 20 | Landlord bell | 10 unread → EXPENSE_RECORDED heading "Expense recorded" + body "NEST: John Mwangi recorded a water expense of KSh 1,200…" (IN_APP + SMS rows) | PASS |
| 21 | Money-out (landlord) | same ledger + Reverse buttons ONLY on unreversed original rows | PASS |
| 22 | Reverse dialog | trust copy ("both stay on the record"), exact context line "Reversing: Repairs · KSh 2,500 · 9 Oct 2026", note required (3+), Reverse disabled until valid | PASS |
| 23 | Submit reversal | toast "Expense reversed — both rows stay on the ledger"; row flips to "Reversed" chip; ledger shows both rows | PASS |
| 24 | Analytics (landlord) | **P&L hero: Net this month KSh 1,000** (15,000 − 14,000 after reversal — verified against seed math); 3-bar trend groups (billed/collected/money-out legend); exact-values table has Money out + Net columns (net signed: success/destructive tones) | PASS |
| 25 | Notifications modal re-open | Dialog warning gone (notifications + receipt-detail now carry descriptions — 2 follow-up a11y fixes) | PASS |
| 26 | Browser console | 0 errors; 0 warnings after the a11y fixes | PASS |
| 27 | dev.log during the sweep | POST expenses 201 → reverse 201 → replay 409; zero unhandled errors after the fixes | PASS |

## Part 3 — Regression guards

| # | Check | Verdict |
|---|---|---|
| 28 | `bunx tsc --noEmit` | 0 errors |
| 29 | `bun run lint` | 0 errors |
| 30 | i18n completeness | `Record<TranslationKey, string>`: all new keys in BOTH en.ts and sw.ts (type-enforced) |
| 31 | Sign-out reset | recordExpenseOpen + reverseExpenseId reset in the more-sheet sign-out handler |
| 32 | AnalyticsMonthDto | fixtures unaffected (analytics has no dev fallback); all consumers updated (chart + table + hero) |
| 33 | Notification heading map | 16 keys (EXPENSE_RECORDED, EXPENSE_REVERSED added) |
| 34 | Seed | 16 notifications (+1), 36 audit rows (+2: EXPENSE_RECORDED, EXPENSE_REVERSED); reversal pair live |
| 35 | Footer | "Phase 12 · v0.12.0" |
| 36 | Money-in untouched | cash collection flow re-verified post-restart (receipt NEST-R-000005 in the earlier sweep); MRI estimate unchanged (gross) |
