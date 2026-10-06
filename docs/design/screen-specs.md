# NEST Phase 1 — Screen Specs

| | |
|---|---|
| **Owner** | UI/UX Designer (Task 1-c, issue captainEdins/nest#7) |
| **Status** | BINDING build spec for Phase 1. Companion: `docs/design/design-system.md` (tokens, states, components). |
| **Data contracts** | All shapes from `src/lib/types.ts`. Endpoint paths shown as **(hint)** — Backend (Task 2-a) owns final routes; DTO names are binding. |
| **Copy** | Every label is an i18n key from `src/lib/i18n/en.ts` (+ `sw.ts`). Keys marked **[gap]** don't exist yet — Appendix A proposes them for Task 1-b. |
| **Wireframes** | ASCII at 375px mobile. `[...]` = icon button, `▓░` = progress, `·` = separator. |

Conventions applying to **every** screen (not repeated below): shell header + nav per design-system §6; offline banner slot under header; footer per S-16; loading = skeletons, empty/error per design-system §8; money via `formatKes`, dates "12 Feb 2026"; screens are components in the single-route SPA (D-004), not routes.

---

## S-01 · Role Select (demo login)

**Purpose**: Pick a demo identity and enter the app as that role. Production phone-OTP flow lives behind the same entry later (D-005).
**Data**: none (static demo cards; seeded phones from README: Amina Barasa +254711000001 · John Mwangi +254711000002 · Grace Wanjiku +254711000003 · Wanjiku Kamau +254711000007 · Peter Njoroge +254711000006). **(hint)** `POST /api/auth/login {phone}` → `SessionDto`.
**Primary action**: tap a role card → app shell (S-02).

```
375px ─────────────────────────────────────────
│ (logo) NEST                       [EN ▾]    │
│                                            │
│   Rent records you can trust               │
│   (display, centered, logo mark above)     │
│                                            │
│   Welcome to NEST                          │
│   Demo mode — pick a profile below to      │
│   walk in as that person.                  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ (AB)  Amina Barasa          Landlord │  │
│  │       +254 711 000 001               │  │
│  │       Track income, arrears and      │  │
│  │       vacancies                      │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ (JM)  John Mwangi        Caretaker  │  │
│  │       +254 711 000 002               │  │
│  │       Collect rent and handle        │  │
│  │       day-to-day                     │  │
│  └──────────────────────────────────────┘  │
│  … 5 cards: Tenant, Agent, Guard …        │
│                                            │
│  ⚠ Sandbox demo — payments are simulated, │
│    no real money moves                     │
└────────────────────────────────────────────
```

- Card: `Card` `p-4`, row = avatar initials (design-system §7) + name (`text-h3`) + role badge (§9.2 secondary) + phone (`text-caption tabular-nums`) + role line (`text-caption text-muted-foreground`). Whole card is the button (`min-h-16`, focus ring, `aria-label` = "{name}, {role}").
- **Order**: Landlord, Caretaker, Tenant, Agent, Guard (demo-story order). Only one card per role.
- **Loading**: tapped card shows inline `Loader2` on the avatar + all cards disable; label `login.signingIn` replaces the role line of the tapped card.
- **Error**: toast (`errors.network` / `errors.notAuthorized`); cards re-enable.
- **Desktop ≥sm**: max-w-md centered column, cards in 2-col grid `sm:grid-cols-2`; language toggle top-right of the page.
- **Copy**: `app.tagline`, `login.heading`, `login.demoProfilesNote`, `role.<x>`, `roleDesc.<x>`, `login.signingIn`, `footer.sandboxNotice`.
- **A11y**: `<main>`, `h1` = app tagline block, language dropdown has `sr-only` label.

---

## S-02 · App Shell

**Purpose**: Role-aware frame — header, navigation, content slot, footer. All screens below render inside it.
**Data**: `SessionDto` (profile → role, name, phone, language). Language seeded into `I18nProvider`.
**Primary action**: switch tabs; each tab renders its screen.

```
375px ─────────────────────────────────────────
│ (⌂) NEST  [Landlord]      [G] [☾] [◉]    │  56px header, border-b
│────────────────────────────────────────────│
│ ⚠ You're offline — what you record will    │  amber banner (only offline)
│   send when you're back on.                │
│────────────────────────────────────────────│
│                                            │
│  <active tab screen, px-4, pb-24>          │  scrollable main
│  …                                         │
│  NEST — Made for Kenyan rentals            │  footer S-16
│  Sandbox demo — payments are simulated…    │
│                                            │
│────────────────────────────────────────────│
│   ⌂        ⚠        ▤        ⌂        ⋯    │  56px bottom nav
│  Home   Arrears  Payments  Props    More   │  +safe-area
└────────────────────────────────────────────
```

- **Tab sets per role** (binding; max 5; icons in design-system §6.1): Landlord [Home, Arrears, Payments, Properties, More] · Caretaker [Home, Units, Collections, More] · Tenant [Home, Receipts, Notifications, More] · Agent [Home, More] · Guard [Home, More].
- Collections tab = the Payments list screen (S-17a) with caretaker copy (`nav.collections` **[gap]**).
- Header right: language (Globe → dropdown `lang.en`/`lang.sw`, radio) · theme (Sun/Moon) · bell (8px `bg-primary` unread dot → S-14). All `h-11 w-11` + `sr-only`.
- Role badge next to logo: `role.<x>`, secondary badge.
- **Desktop ≥lg**: sidebar 264px replaces bottom nav (items + icons, active = secondary fill, unread count chip); content `lg:pl-[264px]`, `max-w-7xl`, `px-8`; header loses the logo (sidebar carries it).
- **Session loading**: full-shell skeleton (header + nav chrome + content skeleton) — never a spinner.
- **401/expired**: return to S-01 with a neutral toast (no error noise).
- **Polling**: dashboards refetch on window focus + 30s (D-014); toasts announce only changes the user caused.

---

## S-03 · Landlord Home

**Purpose**: The money answer at a glance — how much collected vs expected, who owes, what needs review.
**Data**: `LandlordOverviewDto` — **one call**. **(hint)** `GET /api/landlord/overview`.
**Primary actions**: ① review unmatched payments (amber alert) ② Send reminder on an arrears row.

```
375px ─────────────────────────────────────────
│ Hi, Amina                      Feb 2026    │
│  ┌──────────────────────────────────────┐  │
│  │ COLLECTED THIS MONTH                 │  │ KPI 1
│  │ KSh 148,500              (text-kpi)   │  │
│  │ Expected KSh 210,000                 │  │
│  │ Collection rate  71%                  │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ (h-2 progress) │  │
│  └──────────────────────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐    │ KPI 2 (sm:grid-cols-2)
│  │ ARREARS        │  │ OCCUPANCY      │    │
│  │ KSh 41,500 ⚠   │  │ 86%            │    │
│  │ 7 tenants      │  │ 24 of 28 units │    │
│  └────────────────┘  └────────────────┘    │
│  ┌──────────────────────────────────────┐  │
│  │ (?) 3 unmatched payments   Review → │  │ amber tint card → S-04
│  └──────────────────────────────────────┘  │
│                                            │
│  ARREARS (7)                    View all → │ h2 + link → S-11
│  ┌──────────────────────────────────────┐  │
│  │ David Otieno            ⚠ KSh 18,000 │  │
│  │ B4 · Baraka Plot · 2 months behind   │  │
│  │                    [Send reminder]    │  │ ghost button
│  └──────────────────────────────────────┘  │
│  … top 5 by balance …                      │
│                                            │
│  RECENT PAYMENTS                           │ h2
│  ┌──────────────────────────────────────┐  │
│  │ Grace Wanjiku · B1        KSh 12,000 │  │
│  │ ▤ M-PESA · 12 Feb 2026              │  │
│  └──────────────────────────────────────┘  │
│  … 5 rows …                                │
│                                            │
│  VACANCIES (4)                             │ h2
│  [A2 · Baraka · KSh 9,500] [C1 ·…] →      │ horizontal scroll chips
│                                            │
│  PROPERTIES (3)                            │ h2
│  ┌──────────────────────────────────────┐  │
│  │ Baraka Plot · Ruai                   │  │
│  │ 12 units · 11 occupied · 1 vacant    │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────
```

- Greeting: `common.greeting {name}` (`text-h3`); month chip right (`text-caption`, "Feb 2026" from `month`). No `h1` text duplication — greeting is the `h1`.
- **Unmatched alert card** (amber tint `bg-warning/15 dark:bg-warning/10`, `HelpCircle` icon, `text-attention`): count from `totals.unmatchedPayments`; hidden when 0. Whole card navigates to S-04.
- Arrears row: name (`text-body font-medium`) + unit·property + months behind (`arrears.monthsBehind` **[gap]**); balance `text-attention font-semibold tabular-nums`; `Send reminder` ghost (→ toast `arrears.reminderSent` **[gap]**, button → `arrears.sent` **[gap]** disabled 60s).
- Recent payments row: `matchedLabel` · unit, amount right (`tabular-nums`), source badge + date caption. Row tap → receipt detail (S-10b) when receiptNo exists.
- Vacancy chip: `label` · `propertyName` · rent; tap → Units/property context.
- **Desktop xl (12-col)**: KPI1 spans 12; KPI2 pair spans 6+6 or Arrears 4 / Occupancy 4 / Unmatched 4; arrears list col-span-8; right rail col-span-4 = unmatched alert, recent payments, vacancies (stacked); properties full width (3-col grid).
- **States**: loading — KPI skeletons `h-28`, 5 list-row skeletons, chip skeletons; empty arrears → inline success-tinted line (`empty.arrears` + `CheckCircle2`); empty payments → `empty.payments` mini-empty; zero unmatched → alert card hidden (never a "0" alert); error — each section keeps its own retry (`errors.couldNotLoad`).
- **Copy**: `landlord.*`, `common.thisMonth`, `status.arrears`, `arrears.*` **[gap]**, `empty.arrears`, `empty.payments`.

---

## S-04 · Unmatched Payments Queue + Match flow

**Purpose**: Resolve M-Pesa money that arrived with an unknown account reference.
**Data**: `PaymentDto[]` (status `UNMATCHED`). **(hint)** `GET /api/payments?status=UNMATCHED`. Match: `MatchUnmatchedRequest` → **(hint)** `POST /api/payments/{id}/match`.
**Primary action**: Match to tenant.

```
375px ─────────────────────────────────────────
│ Unmatched payments                    (3)  │ h1
│  ┌──────────────────────────────────────┐  │
│  │ KSh 5,500                    ⚠ badge │  │
│  │ from +254 712 345 678                │  │
│  │ ref  NEST-B7-0031  (uppercase,       │  │
│  │      tabular-nums, tracking-wide)    │  │
│  │ 12 Feb 2026 · Unknown account        │  │
│  │      reference                       │  │
│  │           [Match to tenant]          │  │ outline button
│  └──────────────────────────────────────┘  │
│  …                                          │
└────────────────────────────────────────────

MATCH DRAWER (<sm) / DIALOG (≥sm), step 1:
│  Match payment                             │
│  [🔍 Search tenant or unit… ]             │
│  ┌──────────────────────────────────────┐  │
│  │ Grace Wanjiku · B1 · Baraka          │  │
│  │ NEST-B1-0025      ⚠ KSh 12,000      │  │
│  └──────────────────────────────────────┘  │
│  … selectable tenancy cards …              │

step 2 (confirm):
│  Match KSh 5,500                           │
│  from +254 712 345 678                     │
│  ref NEST-B7-0031                          │
│  → to Grace Wanjiku · B1 · Baraka Plot     │
│  → ref NEST-B1-0025                        │
│           [Cancel]  [Confirm match]        │
```

- Tenancy list = active tenancies (tenant name, unit, `accountRef`, balance amber if >0) — search matches name/unit/ref; list is `Command` (cmdk) inside the responsive modal.
- Confirm → success toast `unmatched.matchedSuccessfully` + row animates out (≤200ms); queue count in S-03 alert updates via query invalidation. Match result announced `aria-live="polite"`.
- **Desktop ≥sm**: queue renders as a `Table` (Date, Amount, Phone, Reference, action) — mobile stacked cards only, per design-system §9.1.
- **States**: loading — 5 card skeletons; empty — `empty.unmatched` **[gap]** ("No unmatched payments — every shilling is matched") + `CheckCircle2` success icon; error — section Alert + retry; offline — read-only (match requires online; button disabled with caption `common.offlineBanner`).
- **Copy**: `unmatched.title`, `unmatched.matchToTenant`, `unmatched.unknownAccountRef`, `unmatched.matchedSuccessfully`, `common.search`, `common.cancel`, `common.date`.

---

## S-05 · Caretaker Home

**Purpose**: "What do I need to collect today?" — then do it in taps.
**Data**: `CaretakerOverviewDto` — **one call**. **(hint)** `GET /api/caretaker/overview`.
**DTO delta (binding request, Appendix B)**: add `totals.todayExpectedMinor` / `totals.todayCollectedMinor`. Fallback if backend ships only month totals: render the hero with month numbers labelled `common.thisMonth`.
**Primary action**: Record cash (S-06).

```
375px ─────────────────────────────────────────
│ Hi, John · Baraka Plot       Feb 2026      │
│  ┌──────────────────────────────────────┐  │
│  │ TODAY                                 │  │ hero card (primary-tinted
│  │ Collected  KSh 32,000                 │  │  bg-secondary)
│  │ of KSh 54,000 expected                │  │
│  │ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░  59%              │  │
│  │ ⚠ 7 tenants in arrears     View →     │  │
│  └──────────────────────────────────────┘  │
│  ┌───────────────┐  ┌───────────────┐      │ quick actions 2×2
│  │ ▣ Record cash │  │ ▤ Request     │      │ Record cash = solid
│  │   (primary)   │  │   M-Pesa      │      │ primary; rest
│  ├───────────────┤  ├───────────────┤      │ secondary cards
│  │ ⌂ Units       │  │ ⚠ Arrears     │      │
│  └───────────────┘  └───────────────┘      │
│                                            │
│  UNITS (12)                                │ h2 → full list S-17c
│  ┌──────────────────────────────────────┐  │
│  │ B1  Grace Wanjiku   [OCCUPIED ✓]     │  │
│  │     ⚠ KSh 12,000 balance             │  │
│  ├──────────────────────────────────────┤  │
│  │ A2  —               [VACANT]         │  │
│  └──────────────────────────────────────┘  │
│  … occupied first, then vacant …          │
│                                            │
│  RECENT COLLECTIONS                        │ h2
│  ┌──────────────────────────────────────┐  │
│  │ David Otieno · B4       KSh 6,000    │  │
│  │ ▣ Cash · recorded by you · 12 Feb    │  │
│  └──────────────────────────────────────┘  │
│  … 5 rows (recentPayments) …              │
└────────────────────────────────────────────
```

- Hero: `caretaker.collectedToday` **[gap]** value `text-kpi`, expected line, progress (bg-secondary/indicator bg-primary), arrears chip `text-attention` → S-11.
- Quick actions: 2×2 `gap-4` grid; Record cash solid primary (`caretaker.collectCash`, icon `Banknote`); Request M-Pesa outline (`caretaker.requestMpesa`, `Smartphone`) → S-07; Units → S-17c; Arrears → S-11. Each cell `min-h-20`.
- Unit row: `label` semibold + tenant name or "—" · status badge (§9.2) · balance `text-attention` only when >0. Tap occupied row → S-06 picker pre-filtered to that tenancy (still 2 taps to confirm).
- Recent collections: `recentPayments` (source CASH/MPESA badge, `recordedByName` caption).
- **Desktop lg**: hero + quick actions in a 2-col band (hero spans 8, actions 4); units table ≥sm; recent collections right rail.
- **States**: loading — hero skeleton `h-36`, unit row skeletons ×5; empty units → `empty.units` **[gap]**; empty collections → `empty.payments`; error per section; offline — quick actions stay enabled (cash queues offline, S-06).
- **Copy**: `common.greeting`, `common.today`, `caretaker.*` (+ **[gap]** `caretaker.expectedToday`, `caretaker.collectedToday`, `caretaker.recentCollections`), `status.occupied`, `status.vacant`, `nav.units`.

---

## S-06 · Cash Collection Flow (≤3 taps)

**Purpose**: Caretaker records money received in cash, receipt issued instantly. Works offline (D-012 queue).
**Data**: tenancies from `CaretakerOverviewDto.units[].tenancy` or **(hint)** `GET /api/units`. Submit: `CashCollectionRequest` (with `clientRef`) → returns `PaymentDto` + receiptNo.
**Tap budget**: ① "Record cash" ② tenancy card ③ "Confirm". Amount is pre-filled = balance.

```
STEP 1 — TENANCY PICKER (drawer <sm / dialog ≥sm, full-height)
│  Record cash                        (1/3)  │
│  [🔍 Search tenant or unit… ]             │
│  ┌──────────────────────────────────────┐  │
│  │ Grace Wanjiku · B1 · Baraka          │  │
│  │ ⚠ Balance KSh 12,000                 │  │
│  ├──────────────────────────────────────┤  │
│  │ David Otieno · B4 · Baraka           │  │
│  │ ⚠ Balance KSh 18,000                 │  │
│  └──────────────────────────────────────┘  │
│  (balance 0 tenancies last, tinted ✓)     │

STEP 2 — AMOUNT
│  Record cash                       (2/3)  │
│  David Otieno · B4 · Baraka Plot          │
│  Balance KSh 18,000                        │
│  ┌──────────────────────────────────────┐  │
│  │ KES   18,000        (text-kpi,       │  │ pre-filled = balance,
│  │                    inputMode=numeric)│  │ editable, tabular-nums
│  └──────────────────────────────────────┘  │
│  (caption: partial payments allowed)      │
│  Note (optional)                           │
│  […………………………………… ]  (textarea, 200 max) │
│           [Cancel]  [Confirm]  (primary)  │

STEP 3 — SUCCESS (auto-dismiss ~2.5s)
│  ✓ (CheckCircle2, success, size-40)       │
│  Cash collection recorded                 │
│  ┌──────────────────────────────────────┐  │
│  │ NEST-R-000042   (text-kpi, tracking) │  │
│  │ KSh 18,000 · David Otieno · B4       │  │
│  └──────────────────────────────────────┘  │
│  [Share receipt]      [Done]              │
```

- Validation (zod): amount integer > 0 and ≤ 999,999 KES; note ≤ 200 chars. Amount input is `inputMode="numeric"`, digits only.
- Confirm button: inline spinner + `aria-busy`; double-submit blocked.
- **Offline**: submit queues to local outbox (`clientRef`); success screen shows amber `Saved offline` badge (`offline.queued` **[gap]**) instead of receiptNo ("Receipt follows when online"); list updates on sync.
- **Share**: `navigator.share` with receipt text (receipt no, amount, tenant, unit, date); fallback → clipboard + toast `receipt.linkCopied` **[gap]**.
- **Auto-dismiss**: 2.5s → back to origin; query invalidation refreshes balances; `aria-live="polite"` announces success.
- **Desktop ≥sm**: same 3 steps in a Dialog; picker = searchable list; amount step side-by-side with tenancy summary.
- **States**: picker loading — 5 row skeletons; no tenancies — `empty.units`; submit error — toast `errors.somethingWrong` + stay on step 2; amount > balance — allowed (overpayment credited), caption notes it.
- **Copy**: `cash.recordCash`, `cash.amountReceived`, `cash.note`, `cash.collectionRecorded`, `cash.receiptNumber`, `common.cancel` / `common.done`, `receipt.shareReceipt`, `money.balance`.

---

## S-07 · M-Pesa Request Flow (caretaker)

**Purpose**: Caretaker pushes an STK prompt to a tenant's phone and watches it resolve.
**Data**: `StkPushRequest` → `StkPushResponseDto`. **(hint)** `POST /api/mpesa/stk-push`, poll `GET /api/mpesa/status/{checkoutRequestId}` (3s interval, ≤120s).
**Primary action**: Send M-Pesa request → confirm.

```
STEPS 1–2: same picker + amount pattern as S-06 (header "Request M-Pesa",
amount defaults to balance; no note field).

STEP 3 — STATUS CARD (live, role="status" aria-live="polite")
│  Request M-Pesa                           │
│  ┌──────────────────────────────────────┐  │
│  │ (spinner)  Waiting for               │  │ amber tint
│  │ confirmation…                         │  │
│  │ Ask David to enter the M-Pesa PIN     │  │
│  │ on their phone.                       │  │
│  │ KSh 18,000 · David Otieno · B4        │  │
│  │ Sandbox demo — no real money moves.   │  │ caption
│  └──────────────────────────────────────┘  │
│         [Cancel request]                  │

CONFIRMED (final):
│  ✓ Confirmed                              │
│  KSh 18,000 received from David Otieno    │
│  [View receipt]  (→ S-10b)               │

FAILED (final):
│  ✗ M-Pesa request failed                  │
│  Reason: {reason from callback}            │
│  [Retry]  [Done]                          │
```

- Waiting card = amber tint + `Clock` icon + `mpesa.checkYourPhone`/`mpesa.enterPin` phrasing for caretaker ("ask the tenant to enter PIN"); Cancel = gentle abandon (no reversal needed — pending M-Pesa rows never become money, D-008).
- Confirmed → green success card + receipt link; Failed → amber (not red) with `XCircle` + `common.retry` (restarts at amount step with same tenancy).
- Timeout after 120s → "Still waiting" state (`mpesa.stillWaiting` **[gap]**) + Done; status re-polls when the screen regains focus.
- **Copy**: `caretaker.requestMpesa`, `mpesa.enterAmount`, `mpesa.sendStkPush`, `mpesa.checkYourPhone`, `mpesa.enterPin`, `mpesa.sandboxNotice`, `tenant.waitingMpesa`, `tenant.paymentConfirmed`, `mpesa.failed` **[gap]**, `mpesa.reason` **[gap]**, `common.retry`/`common.done`.

---

## S-08 · Tenant Home

**Purpose**: "What do I owe, when, and can I pay right now?"
**Data**: `TenantOverviewDto` — **one call**. **(hint)** `GET /api/tenant/overview`.
**Primary action**: Pay now (S-09).

```
375px ─────────────────────────────────────────
│ Hi, Grace                                  │
│  ┌──────────────────────────────────────┐  │
│  │ BARAKA PLOT · RUAI           (caption)│  │ hero card
│  │ Unit B1                     (text-h2) │  │
│  │ Balance                                 │  │
│  │ KSh 12,000        (text-kpi, ⚠ amber) │  │ success green if 0
│  │ Next due 5 Mar 2026 · KSh 12,000       │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │          Pay now    (solid primary)   │  │ h-12 full-width
│  └──────────────────────────────────────┘  │
│  ┌──────────┐┌──────────┐┌──────────┐      │ stats row (3-col)
│  │ Deposit  ││ Receipts ││ Open     │      │
│  │ KSh 12k  ││ 14       ││ charges 3│      │
│  └──────────┘└──────────┘└──────────┘      │
│                                            │
│  YOUR RECEIPTS                    View all→│ h2 → S-10a
│  ┌──────────────────────────────────────┐  │
│  │ NEST-R-000041        KSh 12,000      │  │
│  │ ▤ M-PESA · 12 Feb 2026              │  │
│  └──────────────────────────────────────┘  │
│  … 3 rows …                                │
│                                            │
│  CHARGES (accordion, default: latest open) │
│  ▾ Feb 2026 · KSh 12,500 due               │
│  │  Rent      KSh 12,000  [PART ⚠]       │
│  │   paid KSh 6,000                      │
│  │  Water     KSh 300     [PAID ✓]       │
│  │  Garbage   KSh 200     [UNPAID ⚠]     │
│  ▸ Jan 2026 · …                            │
│                                            │
│  NOTIFICATIONS                     View all→│
│  ┌──────────────────────────────────────┐  │
│  │ ▤ Receipt issued: NEST-R-000041      │  │
│  │    Yesterday · SMS                   │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────
```

- Hero: property caption, unit `text-h2`; Balance label (`money.balance`, `text-label muted`); amount `text-kpi tabular-nums` — `text-attention` if >0, `text-success` + `tenant.allPaidUp` **[gap]** if 0; next due line hidden when balance >0? No — always show `tenant.nextDue` + date + amount when known.
- Pay now: solid primary, full-width `h-12`, always reachable without scroll (hero + button above the fold at 375×667).
- Stats row: deposit held (`money.deposit`), receipts count (`tenant.yourReceipts`), open charges (`tenant.openCharges` **[gap]** = charges with status ≠ PAID). Compact `text-body` values.
- Charges accordion: grouped by `periodMonth` (label "Feb 2026"), rows kind (`money.rent/water/garbage`) + amount + status badge + paid amount caption when PART. Older months collapsed.
- Notifications preview: 3 latest (`NotificationDto`), tap → S-14.
- **Desktop lg**: hero+Pay now left (col-span-7), stats + receipts right rail (col-span-5); charges full width in 2-col rows.
- **States**: loading — hero `h-40` skeleton, accordion skeletons; balance 0 → success variant hero + Pay now becomes secondary "View receipts"; empty receipts `empty.receipts`; empty charges — impossible (tenancy active); error — Alert + retry (screen-level); offline — Pay now disabled w/ offline caption (M-Pesa needs network).
- **Copy**: `common.greeting`, `tenant.yourRent`? (hero uses unit title; "Your rent" heading optional), `tenant.balance`, `tenant.nextDue`, `tenant.payNow`, `money.*`, `status.*`, `empty.receipts`, `notifications.receiptIssued`.

---

## S-09 · Tenant Pay Flow

**Purpose**: Tenant pays via M-Pesa STK and gets an instant receipt.
**Data**: `StkPushRequest` → `StkPushResponseDto`; poll as S-07. **(hint)** `POST /api/mpesa/stk-push`.
**Primary action**: Confirm payment.

```
STEP 1 — AMOUNT (drawer <sm / dialog ≥sm)
│  Pay via M-Pesa                            │
│  Balance KSh 12,000 · Next due 5 Mar       │
│  ┌──────────────────────────────────────┐  │
│  │ KES  12,000    (text-kpi, pre-filled │  │
│  │                = balance, numeric)   │  │
│  └──────────────────────────────────────┘  │
│                          [Continue]        │

STEP 2 — PHONE
│  M-Pesa phone number                       │
│  [+254 711 000 003]  (default tenant phone,│
│  inputMode=numeric, autocomplete=tel)      │
│  Sandbox demo — no real money moves.       │
│           [Back]  [Confirm payment]        │

STEP 3 — STATUS (role="status" aria-live="polite")
│  (spinner) Waiting for M-Pesa confirmation │
│  Check your phone — enter your M-Pesa PIN. │
│  KSh 12,000 → NEST-B1-0025 · Baraka Plot   │
│  Sandbox demo — no real money moves.        │
│  → Confirmed ✓ KSh 12,000 · [View receipt] │
│  → Failed ✗ (reason) · [Retry] [Done]      │
```

- Phone step: defaults to `tenancy.tenantPhone`… (ProfileDto phone); editable; zod: Kenyan MSISDN `+2547XXXXXXXX` / `07XX`; error `errors.phoneLooksWrong`.
- Amount: defaults to balance; partial allowed (caption); overpayment blocked (max = balance) — caption explains.
- Status transitions announced politely; Confirmed shows accountRef + receipt link (S-10b); Failed amber with reason + `common.retry` (returns to amount step).
- Sandbox notice line always present in step 2/3 (`mpesa.sandboxNotice`) — sim mode honesty (D-006).
- **Copy**: `tenant.payViaMpesa`, `mpesa.enterAmount`, `mpesa.phoneNumber`, `mpesa.sendStkPush`, `tenant.confirmPayment`, `tenant.waitingMpesa`, `mpesa.checkYourPhone`, `mpesa.enterPin`, `tenant.paymentConfirmed`, `tenant.receiptReady`, `mpesa.sandboxNotice`, `mpesa.failed` **[gap]**, `mpesa.reason` **[gap]**, `errors.invalidAmount`, `errors.phoneLooksWrong`.

---

## S-10 · Receipts List (a) + Receipt Detail (b)

**Purpose**: Proof of payment a tenant can keep and share; ledger for landlord/caretaker.
**Data**: `ReceiptDto[]` / `ReceiptDto` (incl. `allocations`). **(hint)** `GET /api/receipts` (+ `?tenancyId=` for tenant scope), detail by `receiptNo`.
**Primary action**: share a receipt.

```
(a) LIST — 375px
│ Receipts                                   │
│  ┌──────────────────────────────────────┐  │
│  │ NEST-R-000042        KSh 18,000      │  │
│  │ David Otieno · B4 · Baraka Plot      │  │
│  │ ▣ CASH · 12 Feb 2026                 │  │
│  ├──────────────────────────────────────┤  │
│  │ NEST-R-000041        KSh 12,000      │  │
│  │ Grace Wanjiku · B1 · Baraka Plot     │  │
│  │ ▤ M-PESA · 12 Feb 2026              │  │
│  └──────────────────────────────────────┘  │
│  (tenant view: "from" line omitted)       │

(b) DETAIL — receipt card (max-w-sm centered, print-like)
│  NEST                       Receipt        │
│  NEST-R-000042            (text-kpi)      │
│  ────────────────────────────────────────  │
│  Received from   David Otieno              │
│  Unit            B4 · Baraka Plot          │
│  Account ref     NEST-B4-0031              │
│  Date            12 Feb 2026               │
│  Source          [▣ CASH]                  │
│  Total           KSh 18,000 (semibold)     │
│  ────────────────────────────────────────  │
│  Applied to                                 │
│   Rent · Feb 2026          KSh 17,700      │
│   Water · Feb 2026            KSh 300      │
│  ────────────────────────────────────────  │
│  [Share receipt]  (primary, full-width)    │
```

- List row: receiptNo (`text-body font-semibold tabular-nums`), from/unit/property caption (tenant view omits "from"), amount right, source badge + date caption. Row → detail.
- Detail: definition list rows (`text-label` label left muted, `text-body` value right, money right-aligned `tabular-nums`); allocations use `money.rent/water/garbage` + period label; `accountRef` uppercase tracking-wide.
- Share: `navigator.share` text (NEST, receiptNo, from, unit, amount, date); fallback copy → toast `receipt.linkCopied` **[gap]**. `sr-only` button label.
- **Desktop lg**: list left (col-span-5) / detail right (col-span-7, sticky) master-detail; list also as `Table` ≥sm.
- **States**: loading — 6 row skeletons; empty — `empty.receipts` + (tenant) "Pay now" action; error — Alert + retry; detail missing receiptNo → never linked (rows without receiptNo don't navigate).
- **Copy**: `receipt.receipt`, `receipt.receiptNo`, `receipt.receivedFrom`, `receipt.forUnit`, `receipt.property`, `receipt.accountRef`, `receipt.shareReceipt`, `money.rent/water/garbage`, `common.total`, `empty.receipts`.

---

## S-11 · Arrears (Landlord + Caretaker)

**Purpose**: Who owes, how long they've owed, and a one-tap nudge.
**Data**: `ArrearsRowDto[]`. **(hint)** `GET /api/arrears`. Buckets derived client-side from `oldestUnpaidPeriod` (days overdue vs today).
**Primary action**: Send reminder (per row).

```
375px ─────────────────────────────────────────
│ Arrears                       KSh 41,500    │
│  7 tenants across 4 buckets                 │
│  ┌──────┐┌──────┐┌──────┐┌──────┐           │ aging chips (scroll-x
│  │Now 2 ││1–30  ││31–60 ││61+   │           │ on <sm, grid ≥sm)
│  │KSh 6k││KSh 9k││KSh 12k││KSh 14k│         │
│  │2 tenants│1   ││2     ││2     │           │
│  └──────┘└──────┘└──────┘└──────┘           │
│  CURRENT (2)                                │ h3 + count
│  ┌──────────────────────────────────────┐  │
│  │ Mary Achieng · A1 · Baraka           │  │
│  │ Current month              ⚠ KSh 6k  │  │
│  │                     [Send reminder]   │  │
│  └──────────────────────────────────────┘  │
│  1–30 DAYS (1)                              │
│  ┌──────────────────────────────────────┐  │
│  │ David Otieno · B4 · Baraka           │  │
│  │ 1 month behind            ⚠ KSh 18k │  │
│  │                     [Send reminder]   │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────
```

- Buckets **[gap keys]**: `arrears.aging.current` "Current" (oldest unpaid period = current month) · `arrears.aging.1_30` "1–30 days" · `arrears.aging.31_60` "31–60 days" · `arrears.aging.61plus` "61+ days" (computed from days past `oldestUnpaidPeriod` due date). Chip: amount `text-attention font-semibold` + tenant count caption. 61+ chip can add `border-warning` emphasis (still amber — never red).
- Rows grouped under bucket headings, sorted by balance desc; row = S-03 arrears card (name, unit·property, `arrears.monthsBehind` **[gap]**, balance amber, Send reminder ghost → `arrears.reminderSent` **[gap]** toast; button → "Sent" disabled 60s to prevent spam).
- Tap row (not button) → tenant detail not in Phase 1 — rows are non-navigating; reminder is the action.
- **Desktop ≥sm**: `Table` — Tenant · Unit · Property · Months behind · Balance (right, amber) · Bucket · Action. Mobile: grouped cards.
- **States**: loading — 4 chip + 6 row skeletons; empty — `empty.arrears` centered with `CheckCircle2` success icon (a *good* state); error — Alert + retry; offline — read-only, Send reminder disabled with offline caption; reminder failure → toast `errors.somethingWrong`.
- **Copy**: `landlord.arrears`, `landlord.tenantsInArrears`, `arrears.*` **[gap]**, `common.total`, `empty.arrears`, `status.arrears`.

---

## S-12 · Agent Home

**Purpose**: Portfolio pulse + explicit "full tools come later" honesty.
**Data**: `AgentOverviewDto` — **one call**. **(hint)** `GET /api/agent/overview`.
**Primary action**: none in Phase 1 (browse properties).

```
375px ─────────────────────────────────────────
│ Hi, Wanjiku                                │
│  ┌──────────┐┌──────────┐┌──────────┐       │ KPI row (3)
│  │ Properties│ Units    ││ Occupancy │       │
│  │ 6        ││ 94       ││ 88%       │       │
│  └──────────┘└──────────┘└──────────┘       │
│  ┌──────────────────────────────────────┐  │
│  │ ⓘ  Agent tools arrive in Phase 2.    │  │ phase-notice card
│  │ Listings, tenant onboarding and      │  │ (amber tint, info
│  │ reports are on the way.              │  │  icon, non-urgent)
│  └──────────────────────────────────────┘  │
│  PROPERTIES (6)                            │
│  ┌──────────────────────────────────────┐  │
│  │ Baraka Plot · Ruai                    │  │
│  │ 12 units · 11 occupied · 1 vacant    │  │
│  │ Caretaker: John Mwangi               │  │
│  └──────────────────────────────────────┘  │
│  … cards, occupancy-sorted …              │
└────────────────────────────────────────────
```

- Phase notice: parameterized i18n `phase.agentNotice` **[gap]** ("Agent tools — listings, onboarding and reports — arrive in Phase {phase}."). `AgentOverviewDto.phaseNotice` (server string) is the fallback if i18n key unavailable; never render both.
- Property card: name (`text-h3`) · location caption · `occupied/unitCount` + vacant count · caretaker caption. Non-navigating in Phase 1.
- **Desktop**: KPI row 3-col; properties 2-col grid; notice card full width.
- **States**: loading — KPI + card skeletons; empty properties — `empty.properties` **[gap]**; error — Alert + retry.
- **Copy**: `common.greeting`, `nav.properties`, `landlord.occupancy`, `landlord.vacancies`, `phase.agentNotice` **[gap]**.

---

## S-13 · Guard Home

**Purpose**: Honest Phase-1 preview of the guard module.
**Data**: `GuardOverviewDto` — **one call**. **(hint)** `GET /api/guard/overview`.
**Primary action**: none (Phase 3 preview only).

```
375px ─────────────────────────────────────────
│ Hi, Peter · Baraka Plot                    │
│  ┌──────────────────────────────────────┐  │
│  │ ⓘ  Guard tools arrive in Phase 3.    │  │ phase-notice card
│  │ Visitor log and incident reports     │  │ (amber tint)
│  │ are on the way.                      │  │
│  └──────────────────────────────────────┘  │
│  COMING NEXT PHASE            (h2 caption) │
│  ┌──────────────────┐┌──────────────────┐  │
│  │ ▤ Visitor log    ││ ⛨ Incidents      │  │ preview tiles
│  │ Daily entries    ││ Report & track   │  │ opacity-60,
│  │ NEXT PHASE       ││ NEXT PHASE       │  │ pointer-events-none
│  └──────────────────┘└──────────────────┘  │
└────────────────────────────────────────────
```

- Phase notice: `phase.guardNotice` **[gap]** ("Visitor log and incident reports arrive in Phase {phase}."); `GuardOverviewDto.phaseNotice` fallback as S-12.
- Preview tiles: `opacity-60 pointer-events-none`, caption badge "NEXT PHASE" (muted); meet contrast — muted, not invisible.
- **States**: loading — notice + tile skeletons; error — silent degradation (notice card still renders from i18n; property name omitted).
- **Copy**: `common.greeting`, `phase.guardNotice` **[gap]**.

---

## S-14 · Notifications

**Purpose**: One feed of what NEST sent (SMS/WhatsApp/in-app) — receipts, reminders, review requests.
**Data**: `NotificationDto[]`. **(hint)** `GET /api/notifications`.
**Primary action**: open (tenant) / jump to related entity where linkable.

```
375px ─────────────────────────────────────────
│ Notifications                              │
│  TODAY                                     │ group header (caption)
│  ●┌──────────────────────────────────────┐  │ ● = unread dot
│   │ [▤ SMS]  Receipt issued:              │  │   (bg-primary, 8px)
│   │ NEST-R-000041 · Grace Wanjiku        │  │
│   │ 14:32 · status SENT                  │  │
│  └──────────────────────────────────────┘  │
│  YESTERDAY                                 │
│  ┌──────────────────────────────────────┐  │
│   │ [◉ IN-APP] Payment needs review:    │  │
│   │ KSh 5,500 ref NEST-B7-0031 → Match  │  │
│   │ 09:14                                │  │
│  └──────────────────────────────────────┘  │
│  12 Feb 2026                               │ date group
│  …                                         │
└────────────────────────────────────────────
```

- Group by calendar day (`notifications.today`/`notifications.yesterday` **[gap]**, then "12 Feb 2026" date labels); rows: channel badge (`SMS` `MessageSquare` · `WHATSAPP` `MessageCircle` · `IN_APP` `Bell`, secondary badge), body `text-body`, time + status `text-caption`.
- Unread dot on the row's left edge; `templateKey` maps to a leading line: `receiptIssued` / `arrearsReminder` / `paymentNeedsReview` (existing keys).
- `paymentNeedsReview` rows show a `Match` inline action → S-04 (landlord/caretaker only).
- **Desktop**: simple list, max-w-2xl; ≥sm no table needed.
- **States**: loading — 6 row skeletons; empty — `empty.notifications` + Bell icon; error — Alert + retry; offline — cached feed + banner.
- **Copy**: `notifications.title`, `notifications.receiptIssued`, `notifications.arrearsReminder`, `notifications.paymentNeedsReview`, `empty.notifications`, `notifications.today`/`notifications.yesterday` **[gap]**, `unmatched.matchToTenant`.

---

## S-15 · More / Settings Sheet

**Purpose**: Language, theme, install, sign out — the only settings in Phase 1.
**Data**: `SessionDto.profile` (language); localStorage `nest-lang`; PWA install prompt state.
**Entry**: More tab (bottom nav / sidebar user chip). Mobile = full-width bottom Drawer; desktop = popover from sidebar user chip.

```
375px (drawer) ──────────────────────────────
│  (GW) Grace Wanjiku                        │
│       +254 711 000 003 · Tenant            │
│  ────────────────────────────────────────  │
│  Language                                  │
│  [ English ✆ | Kiswahili ]  (segmented)    │
│  Theme                                     │
│  [ Light | Dark | System ]  (segmented)    │
│  Install app                       [⬇ Get] │
│  ────────────────────────────────────────  │
│  Sign out                    (destructive  │
│                               outline)     │
│  → AlertDialog: "Sign out of NEST?"        │
│    [Cancel] [Sign out]                     │
```

- Language: two-segment control, labels `lang.en`/`lang.sw` (native names), sets `setLang` (persists, syncs `<html lang>`).
- Theme: three-segment (Light/Dark/System) via next-themes; `sr-only` labels.
- Install: row with `Download` icon + button; states: available → "Get" / installed → `pwa.installed` (disabled) / unsupported → row hidden.
- Sign out: destructive **outline** button (design-system §4 dark rule) → `AlertDialog` confirm → **(hint)** `POST /api/auth/logout` → S-01.
- **States**: drawer always instant (no fetch); sign-out error → toast; offline — language/theme work offline, sign out allowed (clears local state).
- **Copy**: `login.languageSwitch`, `login.signOut`, `lang.en`, `lang.sw`, `pwa.installApp`, `pwa.installed`, `common.cancel`, `more.theme` **[gap]**, `more.themeLight/Dark/System` **[gap]**.

---

## S-16 · Footer (all screens, inside shell)

**Purpose**: Brand line + sandbox honesty on every scroll.
**Data**: none.

```
│  NEST — Made for Kenyan rentals            │  text-caption, centered
│  Sandbox demo — payments are simulated,    │  text-caption muted
│  no real money moves                       │
```

- `mt-auto` inside the shell's `min-h-dvh flex flex-col` content column: **sticky to the bottom of the viewport on short pages, pushed to the end of scroll on long pages**. Never `position: fixed`, never interactive.
- Mobile: sits above the bottom nav (`pb-24` content padding keeps it clear); desktop: end of content column, inside `max-w-7xl`.
- **Copy**: `footer.madeForKenyanRentals`, `footer.sandboxNotice`.

---

## S-17 · Secondary Tab Screens (list patterns)

Three list screens share one pattern: `h1` + search/filter + Card rows (mobile) / `Table` (≥sm) + standard states. Spec deltas only:

### S-17a · Payments / Collections (Landlord, Caretaker)
- **Data**: `PaymentDto[]` (all statuses). **(hint)** `GET /api/payments`.
- Filter chips (caption pills): All · M-Pesa · Cash · `UNMATCHED` (amber outline chip). Rows: `matchedLabel` or phone, unit, amount right (`tabular-nums`), source + status badge + date. UNMATCHED rows tinted `bg-warning/10` + inline `Match` action (→ S-04 dialog). Row tap → S-10b when receiptNo exists.
- Desktop table: Date · From · Unit · Amount (right) · Source · Status · (action).
- Empty: `empty.payments`. Copy: `nav.payments`/`nav.collections` **[gap]**, `status.*`.

### S-17b · Properties (Landlord)
- **Data**: `PropertyDto[]` (from `LandlordOverviewDto.properties`). **(hint)** `GET /api/properties`.
- Card: name (`text-h3`) + location caption + `occupiedCount/unitCount` + occupancy progress + caretaker caption. Phase 1: non-navigating.
- Empty: `empty.properties` **[gap]**. Copy: `nav.properties`, `landlord.occupancy`.

### S-17c · Units (Caretaker)
- **Data**: `UnitDto[]`. **(hint)** `GET /api/units`.
- Search (unit label / tenant name) + status filter chips (All/Occupied/Vacant). Row: `label` semibold + tenant or "—" · type caption · status badge · balance amber (via tenancy). Tap occupied → S-06 picker preselected (Record cash).
- Empty: `empty.units` **[gap]**. Copy: `nav.units`, `status.occupied`, `status.vacant`, `money.balance`.

---

## Appendix A · Copy gaps → proposed i18n keys

These keys are referenced above but don't exist in `src/lib/i18n/en.ts` yet. Task 1-b (or frontend with 1-b review) must add them **with Kiswahili twins** (`Record<TranslationKey, string>` enforces parity):

| Key | EN value |
|---|---|
| `nav.collections` | "Collections" |
| `offline.queued` | "Saved offline — it will send when you're back on." |
| `arrears.sendReminder` | "Send reminder" |
| `arrears.sent` | "Sent" |
| `arrears.reminderSent` | "Reminder sent to {name}" |
| `arrears.monthBehind` | "1 month behind" |
| `arrears.monthsBehind` | "{count} months behind" |
| `arrears.viewAll` | "View all" |
| `arrears.aging.current` | "Current" |
| `arrears.aging.1_30` | "1–30 days" |
| `arrears.aging.31_60` | "31–60 days" |
| `arrears.aging.61plus` | "61+ days" |
| `caretaker.expectedToday` | "Expected today" |
| `caretaker.collectedToday` | "Collected today" |
| `caretaker.recentCollections` | "Recent collections" |
| `cash.confirm` | "Confirm" |
| `mpesa.failed` | "M-Pesa request failed" |
| `mpesa.reason` | "Reason: {reason}" |
| `mpesa.stillWaiting` | "Still waiting — check back shortly" |
| `unmatched.review` | "Review" |
| `empty.unmatched` | "No unmatched payments — every shilling is matched" |
| `empty.properties` | "No properties yet" |
| `empty.units` | "No units yet" |
| `tenant.openCharges` | "Open charges" |
| `tenant.allPaidUp` | "All paid up" |
| `phase.agentNotice` | "Agent tools — listings, onboarding and reports — arrive in Phase {phase}." |
| `phase.guardNotice` | "Visitor log and incident reports arrive in Phase {phase}." |
| `notifications.today` | "Today" |
| `notifications.yesterday` | "Yesterday" |
| `receipt.linkCopied` | "Receipt link copied" |
| `more.theme` | "Theme" |
| `more.themeLight` | "Light" |
| `more.themeDark` | "Dark" |
| `more.themeSystem` | "System" |

Note: no `{count}`-pluralization machinery exists — `arrears.monthBehind`/`arrears.monthsBehind` split handles the only plural case in Phase 1.

## Appendix B · Data-contract deltas (for Backend, Task 2-a)

1. **`CaretakerOverviewDto.totals` += `todayExpectedMinor: number`, `todayCollectedMinor: number`** — required by S-05 hero. Fallback documented (month totals + `common.thisMonth` labels) if the delta lands post-build.
2. **`AgentOverviewDto.phaseNotice` / `GuardOverviewDto.phaseNotice`** — UI renders i18n `phase.*Notice` with `{phase}`; treat the DTO string as fallback only. Backend may return `null` safely.
3. Everything else in Phase 1 screens maps 1:1 to existing DTOs in `src/lib/types.ts` — no other changes requested.

## Appendix C · Screen inventory (review map)

| Screen | Data (one call) | Primary action |
|---|---|---|
| S-01 Role select | — | Sign in as role |
| S-02 Shell | `SessionDto` | Switch tab |
| S-03 Landlord home | `LandlordOverviewDto` | Review unmatched / Send reminder |
| S-04 Unmatched queue | `PaymentDto[]` (UNMATCHED) | Match to tenant |
| S-05 Caretaker home | `CaretakerOverviewDto` | Record cash |
| S-06 Cash flow | `UnitDto[]` → `CashCollectionRequest` | Confirm (3rd tap) |
| S-07 M-Pesa request | `StkPushRequest/ResponseDto` | Send request |
| S-08 Tenant home | `TenantOverviewDto` | Pay now |
| S-09 Tenant pay flow | `StkPushRequest/ResponseDto` | Confirm payment |
| S-10 Receipts list/detail | `ReceiptDto[]` / `ReceiptDto` | Share receipt |
| S-11 Arrears | `ArrearsRowDto[]` | Send reminder |
| S-12 Agent home | `AgentOverviewDto` | — (browse) |
| S-13 Guard home | `GuardOverviewDto` | — (preview) |
| S-14 Notifications | `NotificationDto[]` | Open / Match |
| S-15 More sheet | `SessionDto` + local state | Sign out |
| S-16 Footer | — | — |
| S-17a Payments/Collections | `PaymentDto[]` | Match unmatched |
| S-17b Properties | `PropertyDto[]` | — |
| S-17c Units | `UnitDto[]` | Record cash (via row) |
