# NEST — Role & Scope Matrix

**The security source of truth.** This is the RLS-equivalent policy matrix that the
Backend Engineer MUST enforce in **every** API route handler. It mirrors the
Supabase/Postgres RLS policies 1:1 (see D-002 in `DECISIONS.md`), so porting to
real RLS later is mechanical: each "Exact condition" below becomes a
`USING (...)` clause.

| | |
|---|---|
| Owner | Database & Security Architect (Task 1-a, issue captainEdins/nest#5) |
| Consumers | Backend Engineer (route guards), Security/QA (adversarial probes), Frontend (expects 403/404 semantics) |
| Status | **Binding for Phase 1.** Phase 2/3/4 rows are pre-committed policy. |
| Change control | Any change to this file requires a new ADR + PR review. Roles are never widened in a patch. |

---

## 1. Enforcement model

1. Every request carries the httpOnly signed session cookie
   (`nest_session = profileId.hmac`). `requireSession()` resolves
   `session.profile.id` and `session.profile.role` **server-side**.
2. **Role is never read from the client** (not from JSON bodies, query params,
   or headers). It is always re-derived from the session's Profile row.
3. Every Prisma query in a handler must embed the **Exact condition** from this
   matrix (as a `where` filter, or as a re-fetch of the target row *with* the
   filter before mutating). Filtering in the UI is cosmetic; this matrix is
   the boundary.
4. **Deny by default:** any route/resource not covered by this matrix is
   accessible to **no** role until a row is added here.

### Response semantics (all handlers, uniformly)

| Situation | Response |
|---|---|
| No session / bad cookie | `401 UNAUTHORIZED` |
| Role has `NONE` for the resource (endpoint is categorically wrong for the role) | `403 FORBIDDEN` |
| Role is allowed but the row is outside the role's scope | `404 NOT_FOUND` (existence must not leak) |
| Valid scope, invalid payload | `400 VALIDATION` (Zod, `src/lib/types.ts` DTOs) |

### Append-only (money) rules — apply to every role, no exceptions

- `Payment`, `PaymentAllocation`, `DepositMovement`, `AuditLog` rows are
  created, never edited in `amountMinor`/`receiptNo`, never deleted.
  Corrections are new reversing entries (D-008).
- `RentCharge.paidMinor` is **system-computed** as the sum of the charge's
  `PaymentAllocation` rows. No route ever writes `paidMinor` directly.
- Every financial/deposit mutation writes an `AuditLog` row
  (`MPESA_CALLBACK`, `PAYMENT_CASH_RECORDED`, `UNMATCHED_MATCHED`, ...).
- Money is integer KES minor units (cents) end-to-end — floats never touch
  money (D-007).

---

## 2. Scope primitives

| Primitive | Definition (SQL-ish) |
|---|---|
| `landlordScope(P)` | `P.landlordId = session.profile.id` |
| `caretakerScope(P)` | `P.caretakerId = session.profile.id` |
| `agentScope(P)` | `P.agentId = session.profile.id` |
| `ownTenancy(T)` | `T.tenantId = session.profile.id` |
| `unitProperty(U)` | `U.propertyId → Property P` (the row's property, via `tenancy.unit.property`) |

A money/tenancy row is **"in X's scope"** when its property satisfies the
primitive above, e.g. caretaker:
`tenancy.unit.property.caretakerId = session.profile.id`.

`session.profile.id` is written as **SELF** below for brevity.

---

## 3. Compact matrix

`R` = scoped READ · `W` = scoped WRITE · `N` = NONE (any access → 403).
`R*` = restricted read (own-row or public-subset, see detail tables).

| Resource | LANDLORD | AGENT | CARETAKER | TENANT | GUARD |
|---|---|---|---|---|---|
| profiles | R | R | R | R* (self) | R* (self) |
| properties | RW | R | R | R* (own tenancy's) | R* (P3, guarded) |
| units | RW | R | R + W(status) | R* (own unit) | R* (P3 labels) |
| tenancies | RW | R | RW | R (own) | N |
| charges (money) | R + W(generate) | R | R + W(generate) | R (own) | N |
| payments (money) | R + W(cash, match) | R | R + W(cash, match) | R (own) | N |
| receipts (money) | R | R | R | R (own) | N |
| notifications | R (own) + W(read-state, P7) | R (own) + W(read-state, P7) | R (own) + W(read-state, P7) | R (own) + W(read-state, P7) | R (own) + W(read-state, P7) |
| mpesa transactions (money) | R | R | R | R (own pushes) | N |
| unmatched queue (money) | R + W(match) | R | R + W(match) | N | N |
| audit log | N | N | N | N | N |
| deposits + movements (P2, money) | R | R | R + W(release/deduct) | R (own) | N |
| maintenance tickets + updates (P2) | RW | RW | RW | R(own) + W(create) | N |
| condition reports (P2) | R | R | RW | R (own) | N |
| visitor logs (P3) | R | R | R | N | RW |
| incident reports (P3) | R | R | R | N | RW |
| guard shifts (P3) | R | R | R | N | RW (own) |
| listings (P4) | RW | RW | N | R* (PUBLISHED only) | N |

---

## 4. Detail by role (exact conditions)

### 4.1 LANDLORD — *owns the money* (demo: Amina Barasa)

| Resource | Access | Exact condition |
|---|---|---|
| profiles | READ | `profile.id = SELF` OR `profile.id IN (caretakerId, agentId of Properties WHERE landlordId = SELF)` OR `profile.id IN (tenantId of Tenancies WHERE unit.property.landlordId = SELF)` |
| profiles | WRITE | `profile.id = SELF` — only `fullName`, `language`. `role`/`phone` are never self-service. |
| properties | READ, WRITE | `property.landlordId = SELF` |
| units | READ, WRITE | `unit.property.landlordId = SELF` (WRITE includes `status`, `rentAmountMinor`, `depositAmountMinor`) |
| tenancies | READ, WRITE | `tenancy.unit.property.landlordId = SELF` (WRITE = create, `NOTICE`, `ENDED`; tenancies are never deleted — financial history) |
| charges | READ | `charge.tenancy.unit.property.landlordId = SELF` |
| charges | WRITE (generate only) | monthly generation for Tenancies `WHERE unit.property.landlordId = SELF`. `amountMinor` immutable after creation; `paidMinor`/`status` system-computed. |
| payments | READ | `payment.tenancy.unit.property.landlordId = SELF` OR `payment.status = 'UNMATCHED'` (owner of record for unattributable cash — see §6) |
| payments | WRITE | record CASH for `tenancy.unit.property.landlordId = SELF`; match an UNMATCHED payment to such a tenancy. Never edit `amountMinor`/`receiptNo`/allocations. |
| receipts | READ | `receipt.payment.tenancy.unit.property.landlordId = SELF` (derived data — no role ever writes receipts) |
| notifications | READ | `notification.profileId = SELF` (WRITE, P7: mark read — own rows only, sets `readAt`). |
| mpesa transactions | READ | `mpesaTransaction.tenancy.unit.property.landlordId = SELF` (WRITE: never — only the callback pipeline) |
| unmatched queue | READ, WRITE(match) | queue rows: `payment.status = 'UNMATCHED'`. Match target must satisfy `tenancy.unit.property.landlordId = SELF`. |
| audit log | NONE | admin/server-side only (written by the system on every financial mutation) |
| deposits, movements (P2) | READ / WRITE | `deposit.tenancy.unit.property.landlordId = SELF`; movements only via append-only release/deduct flows with `actorId = SELF` |
| maintenance tickets, updates (P2) | READ, WRITE | `ticket.propertyId IN (Properties WHERE landlordId = SELF)` |
| condition reports (P2) | READ | `report.tenancy.unit.property.landlordId = SELF` |
| visitor logs, incident reports, guard shifts (P3) | READ | `record.propertyId IN (Properties WHERE landlordId = SELF)` |
| listings (P4) | READ, WRITE | `listing.propertyId IN (Properties WHERE landlordId = SELF)` |
| listing applications + events (P4) | READ, WRITE(decide) | `application.propertyId IN (Properties WHERE landlordId = SELF)`. WRITE limited to APPROVED/REJECTED decisions (sets `decidedById/At`); pipeline moves are the agent's. |
| move-ins (P8) | WRITE(convert) | `POST /api/move-ins` on an application satisfying 4.1's scope (miss ⇒ 404). Guards: application APPROVED (409 otherwise / 409 if already CONVERTED), unit VACANT with no ACTIVE tenancy (409), applicant phone must not belong to a staff account (409). The single transaction creates the tenancy + tenant profile (find-or-create) + deposit (HOLD, actor = SELF) + first RENT charge, flips unit → OCCUPIED and listing → LET, appends the CONVERTED event. |

### 4.2 AGENT — *manages the portfolio, not the ledger* (demo: Wanjiku Kamau)

| Resource | Access | Exact condition |
|---|---|---|
| profiles | READ | `profile.id = SELF` OR `profile.id IN (landlordId, caretakerId of Properties WHERE agentId = SELF)` OR `profile.id IN (tenantId of Tenancies WHERE unit.property.agentId = SELF)` |
| profiles | WRITE | `profile.id = SELF` — `fullName`, `language` only |
| properties | READ | `property.agentId = SELF`. WRITE: NONE in Phase 1 (Phase 4: listing-facing fields only, per new AC). |
| units | READ | `unit.property.agentId = SELF`. WRITE: NONE (rent changes are the landlord's). |
| tenancies | READ | `tenancy.unit.property.agentId = SELF`. WRITE: NONE in Phase 1. |
| charges | READ | `charge.tenancy.unit.property.agentId = SELF`. WRITE: NONE. |
| payments | READ | `payment.tenancy.unit.property.agentId = SELF` (money-endpoint rule §5 lets agents READ scoped money). WRITE: NONE in Phase 1 — agents neither record cash nor match. |
| receipts | READ | `receipt.payment.tenancy.unit.property.agentId = SELF` |
| notifications | READ | `notification.profileId = SELF` (WRITE, P7: mark read — own rows only, sets `readAt`). |
| mpesa transactions | READ | `mpesaTransaction.tenancy.unit.property.agentId = SELF` |
| unmatched queue | READ | `payment.status = 'UNMATCHED' AND payment.phone IN (tenant phones of Properties WHERE agentId = SELF)` — i.e. an agent only sees unmatched money plausibly belonging to their portfolio. WRITE(match): NONE in Phase 1. |
| audit log | NONE | |
| deposits, movements (P2) | READ | `deposit.tenancy.unit.property.agentId = SELF`. WRITE: NONE. |
| maintenance tickets, updates (P2) | READ, WRITE | `ticket.propertyId IN (Properties WHERE agentId = SELF)` |
| condition reports (P2) | READ | `report.tenancy.unit.property.agentId = SELF` |
| visitor logs, incident reports, guard shifts (P3) | READ | `record.propertyId IN (Properties WHERE agentId = SELF)` |
| listings (P4) | READ, WRITE | `listing.propertyId IN (Properties WHERE agentId = SELF)` (their core Phase 4 module). CREATE only from a VACANT unit in scope; status moves DRAFT→PUBLISHED↔PAUSED→LET. |
| listing applications + events (P4) | READ, WRITE(record/pipeline) | `application.propertyId IN (Properties WHERE agentId = SELF)`. Agent records applicants and moves NEW→CONTACTED→VIEWING (+WITHDRAWN). APPROVED/REJECTED are the LANDLORD's alone — agents never decide. Events are append-only. |

### 4.3 CARETAKER — *runs one plot, records cash* (demo: John Mwangi)

| Resource | Access | Exact condition |
|---|---|---|
| profiles | READ | `profile.id = SELF` OR `profile.id IN (tenantId of Tenancies WHERE unit.property.caretakerId = SELF)` (tenant phones needed for reminders) |
| profiles | WRITE | `profile.id = SELF` — `fullName`, `language` only |
| properties | READ | `property.caretakerId = SELF`. WRITE: NONE — a caretaker can never change `landlordId`/`agentId`/`caretakerId`. |
| units | READ | `unit.property.caretakerId = SELF`. WRITE: `status` only (VACANT/OCCUPIED/NOTICE) — never `rentAmountMinor`. |
| tenancies | READ, WRITE | `tenancy.unit.property.caretakerId = SELF` (create at move-in, **execute move-out → ENDED** at move-out — Phase 11; notice INITIATION is the lease parties' decision: TENANT or LANDLORD only, D-024) |
| charges | READ | `charge.tenancy.unit.property.caretakerId = SELF` |
| charges | WRITE (generate only) | monthly generation for `tenancy.unit.property.caretakerId = SELF`. Never `paidMinor`. |
| payments | READ | `payment.tenancy.unit.property.caretakerId = SELF` OR scoped unmatched (below) |
| payments | WRITE (cash) | record CASH **only** where `tenancy.unit.property.caretakerId = SELF`, with `recordedById = SELF`, idempotent by `clientRef`. Never edit/delete existing rows. |
| receipts | READ | `receipt.payment.tenancy.unit.property.caretakerId = SELF` |
| notifications | READ | `notification.profileId = SELF` (WRITE, P7: mark read — own rows only, sets `readAt`). |
| mpesa transactions | READ | `mpesaTransaction.tenancy.unit.property.caretakerId = SELF` |
| unmatched queue | READ | `payment.status = 'UNMATCHED' AND payment.phone IN (tenant phones of Properties WHERE caretakerId = SELF)`. WRITE(match): target tenancy must satisfy `tenancy.unit.property.caretakerId = SELF`. |
| audit log | NONE | |
| deposits, movements (P2) | READ | `deposit.tenancy.unit.property.caretakerId = SELF`. WRITE: append-only `REFUND`/`DEDUCT`/`ADJUST` movements with `actorId = SELF` via the release flow. |
| maintenance tickets, updates (P2) | READ, WRITE | `ticket.propertyId IN (Properties WHERE caretakerId = SELF)` — caretaker's core Phase 2 module |
| lease exit (P11) | WRITE (execute only) | `POST /api/tenancies/[id]/move-out` on NOTICE tenancies in scope, on/after the date on record; `DELETE notice` + `POST notice` → 403 (initiation is the parties') |
| condition reports (P2) | READ, WRITE | `report.tenancy.unit.property.caretakerId = SELF` (`recordedById = SELF`) |
| visitor logs, incident reports, guard shifts (P3) | READ | `record.propertyId IN (Properties WHERE caretakerId = SELF)` |
| listings (P4) | NONE | |

### 4.4 TENANT — *sees only their own money* (demo: Grace, David, Sarah)

| Resource | Access | Exact condition |
|---|---|---|
| profiles | READ, WRITE(self) | `profile.id = SELF`; WRITE only `fullName`, `language` |
| properties | READ (limited) | the property of an ACTIVE tenancy: `EXISTS Tenancy T WHERE T.tenantId = SELF AND T.status = 'ACTIVE' AND T.unit.propertyId = property.id` — name/location only, never portfolio financial rollups |
| units | READ | own unit: `unit.id IN (Tenancies WHERE tenantId = SELF AND status = 'ACTIVE')`. WRITE: NONE. |
| tenancies | READ | `tenancy.tenantId = SELF`. WRITE: NONE (a tenant never edits own rent/status/accountRef). |
| charges | READ | `charge.tenancy.tenantId = SELF AND charge.tenancy.status = 'ACTIVE'` |
| payments | READ | `payment.tenancy.tenantId = SELF AND payment.tenancy.status = 'ACTIVE'` |
| receipts | READ | `receipt.payment.tenancy.tenantId = SELF AND receipt.payment.tenancy.status = 'ACTIVE'` |
| notifications | READ | `notification.profileId = SELF` (WRITE, P7: mark read — own rows only; delivery state stays system-owned). |
| mpesa transactions | READ | `mpesaTransaction.tenancyId IN (Tenancies WHERE tenantId = SELF AND status = 'ACTIVE')` — their own STK pushes only |
| mpesa transactions | WRITE (initiate) | create an STK push for `tenancy.tenantId = SELF AND tenancy.status = 'ACTIVE'` — the ONLY money write a tenant can cause, and it completes only via the M-Pesa callback pipeline |
| unmatched queue | NONE | |
| audit log | NONE | |
| deposits, movements (P2) | READ | `deposit.tenancy.tenantId = SELF`. WRITE: NONE. |
| maintenance tickets (P2) | READ, WRITE(create) | READ: `ticket.tenancyId IN (Tenancies WHERE tenantId = SELF)`; CREATE: for own unit/tenancy only |
| condition reports (P2) | READ | `report.tenancy.tenantId = SELF` |
| visitor/incident logs, guard shifts (P3) | NONE | |
| listings (P4) | READ (public) | `listing.status = 'PUBLISHED'` (marketing surface, no scope needed) |

### 4.5 GUARD — *never touches money* (demo: Peter Njoroge)

| Resource | Access | Exact condition |
|---|---|---|
| profiles | READ, WRITE(self) | `profile.id = SELF`; WRITE only `fullName`, `language` |
| properties | READ (P3) | `EXISTS GuardShift S WHERE S.guardId = SELF AND S.propertyId = property.id` — name/location only. Phase 1 (no shifts seeded): `GuardOverviewDto.property = null`. WRITE: NONE. |
| units | READ (P3) | unit labels of the guarded property (for visitor-log unit pickers). WRITE: NONE. |
| tenancies | NONE | |
| charges / payments / receipts / mpesa transactions / unmatched queue / deposits | **NONE — categorically, by role, with no parameter that can override** | |
| notifications | READ | `notification.profileId = SELF` (WRITE, P7: mark read — own rows only). |
| audit log | NONE | |
| visitor logs (P3) | READ, WRITE | READ: `visitorLog.propertyId = guarded property`; WRITE: create/exit with `guardId = SELF` |
| incident reports (P3) | READ, WRITE | `incidentReport.propertyId = guarded property AND guardId = SELF` for writes |
| guard shifts (P3) | READ, WRITE | own shifts: `guardShift.guardId = SELF` (start/end own shift) |
| listings (P4) | NONE | |

---

## 5. Money endpoints rule (binding)

**"Money endpoints"** = every route that reads or writes an amount, a total,
or a financial rollup: charges, payments, receipts, M-Pesa transactions, the
unmatched queue, deposits/deposit movements (P2), and every dashboard
`*Minor` / `arrears` / `collected` field.

1. **LANDLORD, AGENT, CARETAKER** may read money data — each strictly limited
   to rows whose property satisfies their scope primitive (§2).
2. **TENANT** may read money data **only for their own ACTIVE tenancy**
   (own charges, own payments, own receipts, own deposit, own STK pushes).
3. **GUARD: none.** A guard session calling any money endpoint is a **403 by
   role**, before any scope evaluation. There is no query parameter, path
   parameter, or payload field that can grant a guard money access.
4. Money **writes** are narrower than reads: only LANDLORD and CARETAKER can
   cause money writes in Phase 1 (cash recording, matching); TENANT can only
   *initiate* an STK push; AGENT has no money writes in Phase 1. All money
   writes flow through the reconciliation pipeline (append-only + audit log).

---

## 6. Forbidden examples (must be covered by adversarial probes)

**GUARD (Peter) — money is invisible, period**
- `GET /api/payments`, `GET /api/charges`, `GET /api/receipts/:id`,
  `GET /api/mpesa/transactions`, `GET /api/unmatched`, `GET /api/deposits`
  → **403 FORBIDDEN** every time, regardless of any property/tenancy id passed.
- `POST /api/payments/cash` or `POST /api/unmatched/:id/match` as guard → **403**.
- Guard dashboard payload (`GuardOverviewDto`) must contain **no** `*Minor`
  field — a UI leak is a policy violation even if the API is correct.

**TENANT (Grace/David/Sarah) — own money only, no neighbourhood**
- `GET /api/charges?tenancyId=<someone else's>` → **404** (not 403 — role is
  valid, row is out of scope).
- `GET /api/tenancies` must return exactly the rows with
  `tenantId = SELF` — never other tenants of the same property.
- `GET /api/profiles?phone=+254711000004` (another tenant) → **403/404**;
  tenant profile reads are self-only.
- `POST /api/payments/cash` as tenant → **403** (money enters via M-Pesa or
  staff cash recording only — a tenant can never "record" a payment).
- `POST /api/unmatched/:id/match` as tenant → **403**.
- Tenant reading a property's totals (expected/collected/arrears) → **403**
  (the property read allowed in §4.4 is name/location only).

**CARETAKER (Mwangi) — only the plot they run**
- Any tenancy/payment/charge whose `unit.property.caretakerId ≠ SELF` → **404**.
- `PATCH /api/payments/:id` with `{ amountMinor }` or `{ receiptNo }` → **403**
  (append-only; even the LANDLORD cannot do this).
- Writing `unit.rentAmountMinor` → **403** (status field only).
- `GET /api/audit-log` → **403** (no staff role reads the audit trail in
  Phase 1).
- Recording cash for a tenancy in a property they do not run → **404/403**.

**AGENT (Wanjiku) — reads scoped, writes none (Phase 1)**
- Property where `agentId ≠ SELF` → **404**.
- `POST /api/payments/cash` or match-unmatched as agent → **403** in Phase 1
  (deferred to Phase 4 with explicit ACs).
- Unmatched payments whose phone matches no tenant of their scoped properties
  → invisible (**404/empty**), e.g. the seeded `+254722000999`.

**LANDLORD (Amina) — owner, still not omnipotent**
- Any resource of another landlord's property → **404**.
- Editing/deleting a payment, allocation, or deposit movement → **403**
  (append-only domain; corrections are reversing entries).
- `GET /api/audit-log` → **403** (audit trail is admin/server-side).
- Changing own `role` or `phone` via `PATCH /api/profile` → **403** (re-auth
  required; role changes are an admin operation).

---

## 7. Cross-cutting implementation notes (Backend Engineer)

1. **One guard helper** (`requireRole(...)` / `requireSession()`), imported by
   every route — never copy-paste conditions. Suggested shape:
   `withScope(role, resource)` returning the Prisma `where` fragment straight
   from this matrix.
2. **Scope on writes:** load the target row *with* the scope filter in the
   same request (`findUnique({ where: { id }, ...scopeWhere })`); a miss ⇒ 404.
   Never check scope against an id the client sent without re-fetching.
3. **M-Pesa callback** (`/api/mpesa/callback`) is authenticated by the Daraja
   signature (`MPESA_CALLBACK_SECRET`), **not** by session — it is the one
   non-session money write path, keyed idempotently on `checkoutRequestId`.
   Everything else in this matrix is session-scoped.
4. **Unmatched queue design note:** Phase 1 uses a single paybill shortcode,
   so truly unattributable money (seeded example: `NEST-ZZ-9999`) is surfaced
   to the LANDLORD as owner of record, and to caretakers/agents only when the
   payer phone matches one of their tenants. **Known hardening item (Phase 5):**
   per-property shortcodes must route unattributable money to exactly that
   property's staff. Multi-landlord deployments must not skip this.
5. **Tenant read conditions deliberately require `tenancy.status = 'ACTIVE'`**
   for money rows; a former tenant's session must see money history go dark.
   (Whether ENDED tenancy history remains readable is a Phase 2 AC decision —
   until then: NOT visible.)
6. **Profiles:** no role can list the full profile table. Staff reads are
   limited to profiles connected to their scoped properties; tenant/guard
   reads are self-only.
7. **Audit log** has no read API in Phase 1 — it is written by the system and
   read by server-side tooling only. Introducing an audit-read route requires
   a new row in §4 with an admin role.
8. **QA hooks:** every forbidden example in §6 maps to an adversarial probe
   (cross-role 403/404 checks) per D-009.

---

## 8. Seeded demo identities (for E2E probes)

| Role | Name | Phone (login) | Expected surface |
|---|---|---|---|
| LANDLORD | Amina Barasa | +254711000001 | full Baraka Court money graph + unmatched queue |
| CARETAKER | John Mwangi | +254711000002 | Baraka Court operations + cash recording |
| TENANT | Grace Wanjiku | +254711000003 | own charges PAID this month, 1 receipt, prev-month balance KSh 9,000 |
| TENANT | David Otieno | +254711000004 | arrears case: KSh 31,000 (2 months), 0 payments |
| TENANT | Sarah Achieng | +254711000005 | partial: RENT 600000/1200000 PART |
| GUARD | Peter Njoroge | +254711000006 | no money, phase notice |
| AGENT | Wanjiku Kamau | +254711000007 | portfolio stats only (occupancy), no money writes |

Unmatched payment for the queue: KSh 5,000 from `+254722000999`,
ref `NEST-ZZ-9999`, `tenancyId = null`, `receiptNo = null`.
