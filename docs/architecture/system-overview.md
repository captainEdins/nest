# NEST — System Overview

Audience: engineers onboarding to the codebase. This document complements the
investor-facing `README.md` (market, roadmap) and `DECISIONS.md` (why); it
covers what the system is and how it behaves. The authorization policy source
of truth is [role-scope-matrix.md](role-scope-matrix.md); the wire contract is
`src/lib/types.ts`.

| | |
|---|---|
| Owner | Technical Writer (Task 4-a) |
| Status | Accurate as of Phase 1 (auth/roles, rent charges, M-Pesa sim + reconciliation, cash collections, receipts, notifications, audit) |
| Verified against | Code in `src/**` (money semantics, route names, guards), `prisma/schema.prisma`, ADRs 0001–0008, DECISIONS.md |

---

## 1. What NEST is

NEST is a rental operating system built around one idea: trust as the product.
Rent in Kenya typically runs on verbal agreements, exercise books and WhatsApp
screenshots between a landlord who is often in another city, a caretaker who
collects cash daily, tenants who need proof of every payment, and an agent and
guard at the edges. NEST turns each of those verbal claims into a timestamped,
verifiable record — a payment is matched to a tenant, a unit and a specific
charge, produces a shareable receipt, and is never edited afterwards. NEST
records; it does not judge.

The plot is shared by five roles on one record: **landlord** (owns the money
graph), **caretaker** (runs one plot and records cash), **tenant** (pays and
keeps receipts), **agent** (watches the portfolio), and **guard** (gates and
incidents — Phase 3). Phase 1 delivers the wedge: rent charges, M-Pesa STK
Push collection with an automatic reconciliation engine, cash collections in
three taps with offline tolerance, instant receipts, arrears with aging, and
an audit trail behind every auth and money action.

## 2. Stack & constraints

| Layer | Choice | Constraint / decision |
|---|---|---|
| Framework | Next.js 16, App Router, TypeScript strict | Single user-visible route `/` — a SPA: session gate → role shell; "screens" are components, navigation is client state (D-004) |
| Mutations | API route handlers only (`src/app/api/**`) | No Server Actions (platform rule, D-003); Zod-validated bodies |
| Data | Prisma + SQLite (`src/lib/db.ts`) | D-002: RLS-equivalent enforced server-side via `requireProfile` + scoped queries; production path is Supabase with the same route guards (D-016: activation awaits a service-role key) |
| Client data | TanStack Query | One `["overview"]` query per signed-in role; all tabs read the cache; 30s refetch + refetch on focus (D-014) |
| UI | shadcn/ui + Tailwind CSS 4 (`@theme inline` oklch tokens) | Green primary (oklch, M-Pesa association), Poppins 400/500/600/700 only, amber for attention, red destructive-only |
| i18n | `src/lib/i18n` — EN + Kiswahili | 233 flat dotted keys per language, full parity enforced by `Record<TranslationKey, string>` at compile time |
| Money | `src/lib/money.ts` | Integer KES minor units end to end; floats never touch money (D-007) |

## 3. Request lifecycle

Role is never trusted from the client. Every request re-derives it from the
database.

```
 Browser (SPA at "/", TanStack Query cache)
    |
    |  apiGet/apiPost (src/lib/api.ts — typed client, 30s AbortSignal timeout)
    |  every response: ApiOk<T> = { data: T } | ApiError = { error, code, details? }
    v
 API route handler (src/app/api/**/route.ts)
    |
    |  1. Zod validation of body/query ....... 400 VALIDATION
    |  2. requireProfile() (src/lib/auth-guard.ts)
    |       - reads httpOnly cookie nest_session = <profileId>.<HMAC-SHA256>
    |       - timing-safe signature check, then re-loads the Profile row from
    |         the DB: role is re-derived every request ............ 401 UNAUTHORIZED
    |  3. requireRole(...) where the matrix says a role is
    |     categorically excluded ................... 403 FORBIDDEN
    |  4. Prisma query with the role-scope `where` fragment
    |     (tenancyScopeWhere / paymentChainWhere / unmatchedVisibleWhere —
    |     the matrix's exact conditions; a miss is a 404 so out-of-scope
    |     existence never leaks)
    v
 Prisma -> SQLite (money writes ONLY via src/lib/reconciliation.ts)
    |
    v
 { data } envelope -> api.ts unwrap -> TanStack Query cache -> screens
    (src/components/nest/**)
```

Response semantics (uniform across all routes, role-scope-matrix §1): 401 no
session/bad cookie; 403 role is categorically wrong for the resource; 404 row
out of the role's scope (existence must not leak); 400 invalid payload;
409 conflict (e.g. matching an already-matched payment).

## 4. The money model (read this twice)

This is the part that must never regress. All of it lives in
`src/lib/reconciliation.ts` — the single append-only write path for money
(D-008). Route handlers never create or edit `Payment`/`PaymentAllocation`
rows directly.

1. **Integer minor units.** Money is stored, transported and computed as
   integer KES minor units (cents). Floats never touch a shilling; only
   `formatKes()` converts to a display string. The waterfall splitter
   (`splitWaterfall` in `money.ts`) preserves cents exactly.

2. **`RentCharge.paidMinor` is derived, never set.** After every allocation
   the engine recomputes each touched charge's `paidMinor` as the SQL SUM of
   its `PaymentAllocation` rows and derives status `PAID`/`PART` from it. No
   route ever writes `paidMinor` directly (ledger invariant).

3. **Payments are append-only.** `Payment.amountMinor` and `receiptNo` are
   never edited after being set; rows are never deleted. The only status
   updates are the two designed lifecycle transitions:
   - an M-Pesa payment that cannot be attributed to any tenancy flips
     `COMPLETED → UNMATCHED` (money is recorded, nothing is allocated, no
     receipt; it joins the manual review queue);
   - a manual match flips `UNMATCHED → COMPLETED` and sets `receiptNo` once
     (only `UNMATCHED` payments can be matched — anything else is 409).
   Pending STK state never creates a `Payment` row — it lives in
   `MpesaTransaction` only, so failed and cancelled pushes leave no money
   row behind.

4. **Receipts are deterministic.** `receiptNoFor(paymentId)` =
   `NEST-R-` + the Payment autoincrement id zero-padded to 6 (`NEST-R-000001`).
   Set once, never changed. Because the id is a database autoincrement, the
   number is race-free by construction.

5. **Reconciliation is a waterfall.** A matched payment allocates across the
   tenancy's open charges (status ≠ PAID) ordered by **dueDate ascending**,
   and within the same date **RENT before WATER before GARBAGE** — the oldest
   unpaid charge is settled first. Allocation = one `PaymentAllocation` row
   per charge; `Σ allocations ≤ payment.amountMinor` always.

6. **Overpayment is tenant credit.** Money beyond all open charges creates no
   negative allocation: the remainder is recorded in `payment.note` and shows
   as a **negative tenancy balance** (charges Σ − payments Σ) until Phase 2's
   wallet ledger refines it.

7. **Tenancy resolution** (M-Pesa path): accountReference exact-match to an
   ACTIVE Tenancy's `accountRef`, else payer phone → tenant profile → their
   ACTIVE tenancy (E.164 exact, then last-9-digits fallback). No match → the
   payment goes to the unmatched queue.

8. **Idempotency.** STK callback processing is keyed on `CheckoutRequestID` +
   `callbackProcessedAt` (checked before AND inside the transaction — replays
   return without re-crediting). Cash collections are idempotent on
   `clientRef`. SQLite write-lock contention is retried inside
   `withTransaction`, which re-checks the idempotency key so a retry after an
   ambiguous timeout can never double-credit.

Money-write entry points (everything else is read-only):
`processStkCallback` (the single non-session path), `recordCashCollection`,
`matchUnmatchedPayment`.

## 5. The M-Pesa boundary (ADR-0005)

`src/lib/mpesa.ts` is the only module that talks to Safaricom Daraja, and it
switches on `MPESA_MODE`:

- **`sim` (default):** `/api/payments/stk-push` fabricates CheckoutRequestIDs
  locally and makes no network call. `/api/mpesa/simulate` then builds a REAL
  Daraja-shaped callback body (`Body.stkCallback`, `CallbackMetadata` on
  ResultCode 0, receipt number, payer phone, transaction date) and feeds it
  DIRECTLY to `processStkCallback` — the exact same pipeline as a live
  callback: idempotency, allocation, receipting, notification, audit. No
  self-HTTP, no shortcut around the engine. Every simulated push is labelled
  "Sandbox simulation" in the UI, and every simulate call writes an
  `MPESA_STK_SIMULATED` audit row.
- **`live`:** real Daraja OAuth + STK Push using env keys/passkey/shortcode.
  In live mode the simulate endpoint **403s** — it must not exist in
  production; the only real money path is Safaricom's callback.

**`/api/mpesa/callback`** is the single non-session money-write path
(role-scope-matrix §7.3), authenticated by the Daraja signature, never by a
session cookie. Contract rules:

- Reads the RAW request body (`request.text()`) so signature verification and
  replay comparison are byte-exact.
- Signature: when the `x-mpesa-signature` header is present it verifies
  HMAC-SHA256(`MPESA_CALLBACK_SECRET`) over the raw body (timing-safe). The
  hook is active whenever the secret is configured; if the secret is unset
  (sim default) verification is skipped with a warning + audit note — never
  silently. Invalid signature → callback not processed, still 200.
- **Always returns `200 { ResultCode: 0, ResultDesc: "Accepted" }`** —
  including for tampered, unknown or malformed callbacks — because Daraja
  retries on non-200. Errors are logged + audited, never surfaced as 5xx.
- Idempotency is keyed on `CheckoutRequestID` inside `processStkCallback`;
  replays get a 200 with NO re-crediting.

ResultCode 0 → one Payment row (amount = callback Amount × 100, source
MPESA) → match → waterfall → receipt → notifications. Non-zero ResultCode →
`MpesaTransaction` FAILED (1037 → TIMEOUT) and no money row is ever created.
The client polls `GET /api/mpesa/status?checkoutRequestId=` every 3s for up
to 120s.

## 6. Offline & field resilience (D-012)

Built for caretakers on low-end Android over 3G:

- **30s request timeout** — every fetch goes out with
  `AbortSignal.timeout(REQUEST_TIMEOUT_MS)` so a dead socket (open, no
  bytes — common on rural networks) can never trap a money mutation in a
  pending UI state; the action fails fast into the offline outbox instead.
- **`navigator.onLine` pre-check** — the cash-collection mutation checks
  connectivity before POSTing, so a known-offline recording queues instantly
  instead of waiting for a timeout.
- **localStorage outbox** (`nest-outbox`) — queued cash entries are keyed by
  `clientRef` (a `crypto.randomUUID()` generated when the flow opens). On
  replay the server treats `clientRef` as the idempotency key: the same
  collection can be submitted any number of times and credits the tenant
  exactly once. The outbox flushes on the `online` event and on demand; a
  badge shows the queued count.
- **Tenancy picker fallback** — the picker (`useTenancies`) falls back to
  rows derived from the cached role overview, so a caretaker who walks into a
  dead-signal basement still gets a tenant list to record against.

## 7. Audit

Every auth and money action writes an `AuditLog` row (actor, action, entity,
JSON detail) via `src/lib/audit.ts`: `MPESA_CALLBACK`, `PAYMENT_CASH_RECORDED`,
`UNMATCHED_MATCHED`, `MPESA_STK_SIMULATED`, `REMINDER_SENT`, callback
rejections and handler crashes. Audit rows are written post-commit so money
integrity is never hostage to audit failures, and there is no audit-read API
in Phase 1 — the trail is written by the system and read by server-side
tooling only (matrix §7.7).

## 8. Where things live

| Concern | Location |
|---|---|
| API routes | `src/app/api/**` (auth: login/logout/me/profiles; overview; tenancies; payments: cash, stk-push, unmatched, unmatched/match; mpesa: callback, status, simulate; receipts; notifications + reminders; health) |
| Reconciliation engine (money pipeline) | `src/lib/reconciliation.ts` |
| Session cookie (HMAC) | `src/lib/session.ts` |
| Route guards + scope fragments + error envelope | `src/lib/auth-guard.ts` |
| DTO mapping (Prisma row → wire shape) | `src/lib/dto.ts` |
| Overview builders (per-role dashboards) | `src/lib/overview.ts` |
| M-Pesa Daraja boundary | `src/lib/mpesa.ts` |
| Money utils (formatKes, splitWaterfall) | `src/lib/money.ts` |
| Typed client + offline outbox | `src/lib/api.ts` |
| Query hooks (session, overview, receipts, notifications) | `src/hooks/use-overview.ts`, `src/hooks/use-outbox.ts` |
| Screens (S-01…S-17) | `src/components/nest/**` (landlord/, caretaker/, tenant/, agent/, guard/) |
| Shared UI kit (rows, badges, KPI cards, modals, states) | `src/components/nest/shared/` |
| i18n (233 keys EN/SW parity) | `src/lib/i18n/` |
| Schema + seed (Baraka Court demo money graph) | `prisma/schema.prisma`, `prisma/seed.ts` |

## 9. Testing strategy (honest)

There is no test code in Phase 1 — a platform constraint, not an oversight
(D-009). Quality gates actually in place:

- **Static:** `bun run lint` (eslint) and `bunx tsc --noEmit` (strict) — both
  must exit 0; they run in CI on GitHub Actions
  (`.github/workflows/ci.yml`: install → prisma generate/push/seed →
  type-check → lint, on every push/PR to main).
- **Contract discipline:** one `types.ts` shared by backend and frontend —
  the DTO shapes fail to compile if they drift; the i18n dictionary fails to
  build if EN and SW keys drift.
- **E2E (QA, agent-browser):** documented flows covering all 5 role logins,
  the tenant pay journey including the sim confirmation step, caretaker cash
  recording + the offline queue, the landlord match flow, the 375px mobile
  viewport, dark mode, and 401 session invalidation.
- **Adversarial security battery (Security agent):** 16 probes — cross-role
  403/404 checks (guard on money endpoints, tenant on other tenants' rows,
  caretaker out-of-plot, agent writes), callback replay, append-only
  tampering — all passing (evidence: issue captainEdins/nest#13).

**Planned for Phase 2:** Vitest (unit: reconciliation waterfall, money,
phones), Playwright (browser E2E), pgTAP (Postgres/RLS on Supabase) — with a
real CI runner, replacing the scripted-QA approach.

## 10. Known limits / roadmap pointer

- **Single demo property.** The seed creates one plot (Baraka Court) with 3
  tenancies; multi-property UX is exercised only through the landlord's
  aggregate views.
- **Supabase activation awaits a service-role key** (D-016) — the Prisma +
  SQLite stack with server-side scoping is the running system; the Supabase
  URL + publishable key are already bound in `.env`.
- **Guard and agent modules are previews.** Their home screens render phase
  notices with no money actions (Phase 3/4 respectively).
- **Per-property paybill shortcodes are required before multi-landlord
  unmatched attribution** (role-scope-matrix §7.4): Phase 1 uses a single
  shortcode, so truly unattributable money is surfaced to the landlord as
  owner of record.
- M-Pesa runs in `MPESA_MODE=sim`; live mode needs Daraja credentials
  (D-006). Notifications are simulated (dev adapter, D-013). The name "NEST"
  is a codename pending brand clearance (ADR-0008).

Roadmap: see the `README.md` phase table (Phase 2: maintenance, deposits,
KRA assistant; Phase 3: guard module; Phase 4: agent module, rent score;
Phase 5: hardening/pilot).
