# DECISIONS.md — NEST

Recorded by the Principal Engineer. Every entry: context, decision, trade-offs, rejected alternatives.

---

## D-001 — External conversation link could not be reviewed
- **Context**: User linked a Claude share conversation (`386ea717-...`) as project background.
- **Decision**: Proceed on the brief embedded in the task message (self-sufficient and highly detailed).
- **Evidence**: Browser navigation → "App unavailable in region"; direct fetch → 404 marketing page; reader proxy → IP blocked.
- **Rejected**: Blocking on this input. The brief contains the full product spec.
- **Needs user**: If the linked conversation contains changes to scope, share them and we re-plan.

## D-002 — Supabase (Postgres/RLS/Auth) → Prisma + SQLite with server-side role scoping
- **Context**: The brief mandates Supabase. This sandbox has no Supabase credentials/project, and the platform stack mandates Prisma + SQLite.
- **Decision**: Build on Prisma + SQLite. Security boundary = httpOnly signed-session cookie + per-route server-side role scoping in every API handler (never trusting the client), implemented through one shared guard (`requireRole`) — a direct analog of RLS policies. A Role/Scope matrix (docs) defines who can read/write what, mirroring RLS policies 1:1 so porting to Supabase RLS later is mechanical.
- **Rejected**: (a) Fake Supabase client shims that would silently diverge from real RLS semantics; (b) blocking delivery on missing credentials.
- **Needs user**: To go live on Supabase, provide project URL + service key; the schema and scope matrix map directly.

## D-003 — Server Actions → API Route Handlers
- **Context**: Brief prefers Server Actions; platform rule requires API routes for mutations.
- **Decision**: All mutations go through typed `/api/*` route handlers with Zod validation. This also future-proofs the M-Pesa callback (a native HTTP endpoint anyway) and the offline sync queue (idempotent POSTs by `clientRef`).
- **Trade-off**: Slightly more client code than Server Actions; offset by TanStack Query caching + a single typed api client module.

## D-004 — Single visible route `/` (SPA)
- **Context**: Platform constraint — only `/` is user-visible.
- **Decision**: One page app: session gate → role-specific shell (bottom nav mobile / sidebar desktop). Deep "screens" are components. All data via `/api`.
- **Trade-off**: No URL-based navigation; acceptable for the sandbox preview and consistent with PWA app-shell model.

## D-005 — Auth: Supabase phone OTP → demo HMAC cookie session behind an adapter
- **Context**: Phone OTP is the product's primary login. No Supabase in sandbox.
- **Decision**: `/api/auth/login` (phone-based, demo profiles) sets an httpOnly cookie `nest_session = profileId.hmac(SESSION_SECRET)`. Login UI is a phone-OTP-shaped flow (enter phone → tap "sign in" simulating OTP) so the UX pattern is the real one; the provider boundary is one file. In production, swap to Supabase phone OTP.
- **Rejected**: Building real OTP SMS — no provider credentials; would be a fake anyway.

## D-006 — M-Pesa Daraja: real integration boundary, simulated network
- **Context**: Daraja sandbox credentials not provided.
- **Decision**: `src/lib/mpesa.ts` implements the real Daraja flow shapes — OAuth token fetch, STK Push request, STK Callback body (`Body.stkCallback` with `CallbackMetadata`), C2B validation/result shapes, HMAC callback verification hook (`x-mpesa-signature` over raw body with `MPESA_CALLBACK_SECRET`). Network calls switch on `MPESA_MODE` (`live` uses `MPESA_ENV`, keys, passkey; `sim` default fabricates CheckoutRequestIDs locally and routes callbacks through the exact same processing pipeline). Every simulated artifact is labeled "Sandbox simulation".
- **Idempotency**: Callback processing is keyed on `checkoutRequestId` (unique constraint + processed flag); replays return `200 OK` with no double-crediting (this is a QA-verified behavior, not a claim).
- **Needs user**: For live sandbox testing, provide Daraja Consumer Key/Secret/Passkey + shortcode; set `MPESA_MODE=live`.

## D-007 — Money: integer KES minor units everywhere
- **Context**: Brief rule.
- **Decision**: All amounts are `Int` minor units (cents) in Prisma, APIs, and UI. One `money.ts` util (format/parse). Floats never touch money. Receipt numbers are `NEST-R-######` derived from an auto-increment payment id (race-free).

## D-008 — Append-only financial records
- **Context**: Payments and deposit movements must never be edited.
- **Decision**: `Payment` rows are created only for completed collections; STK pending state lives in `MpesaTransaction` (so failed pushes never create money rows). Corrections = reversing entries (Phase 2 ledger refinement documented). SQLite has no native append-only enforcement; guardrails = single write path through `reconciliation.ts` + `AuditLog` on every financial mutation. Supabase port adds DB triggers.

## D-009 — Automated test suites cannot be authored here; verification is scripted E2E
- **Context**: Brief mandates Vitest/Playwright/pgTAP/axe/Lighthouse CI. Platform rule prohibits test code, and no CI runner exists in the sandbox.
- **Decision**: No test files in the repo. Quality is enforced by: (1) `bun run lint` zero errors; (2) TypeScript strict via shared DTO contracts; (3) agent-browser scripted golden-path E2E per role at 375px mobile viewport + desktop, dark mode, a11y spot checks (contrast via design tokens, tap targets, semantic roles) — results captured in the gate report; (4) adversarial API probing (cross-role 403s, callback replay, tampering) by the Security agent. The exact suites the user must run locally (Vitest/Playwright/pgTAP/LHCI + GitHub Actions workflow spec) are documented in docs/ARCHITECTURE.md and the gate report.
- **Rejected**: Shipping non-runnable CI YAML that would falsely signal coverage.

## D-010 — Typography & color
- **Poppins** (400/500/600/700) via `next/font/google`, globally — no other font. **Primary color: deep green** (trust/M-Pesa association, Kenyan identity). No indigo/blue per design constraints. Warm neutral background, amber for arrears/warnings, red only for destructive.

## D-011 — i18n
- Lightweight dictionary layer (`src/lib/i18n`) — EN + Kiswahili, natural copy (not literal translation), language toggle persisted in `localStorage`, `<html lang>` kept in sync. `next-intl` is available but full routing-based i18n is impossible with the single-route constraint.

## D-012 — PWA / offline
- Manifest + install always. Service worker registered **in production only** (Turbopack HMR breaks under SW caching in dev). Offline tolerance in preview = localStorage mutation queue (`clientRef` idempotency) + `navigator.onLine` banner; the queue syncs through the same Zod-validated APIs.

## D-013 — Notification providers
- `src/lib/notify.ts`: provider-agnostic adapters. Dev adapter logs + marks `Notification` rows `SENT (simulated)`. Africa's Talking / Twilio / WhatsApp adapters documented (env-driven selection). On payment success → receipt SMS queued; arrears reminders manual in Phase 1, scheduled in Phase 4.

## D-014 — Realtime
- Supabase Realtime unavailable → poll-on-focus via TanStack Query (`refetchOnWindowFocus`, 30s intervals on dashboards). Documented as a Phase 5 upgrade path (socket.io mini-service available if needed).

---

## D-015 — GitHub repository created (public, `captainEdins/nest`)
- **Context**: User provided a GitHub PAT (repo scope) and requested a repo named `nest` with an investor- and recruiter-facing README.
- **Decision**: Public repo. Token bound to gh CLI via `GH_TOKEN` env (stored in gitignored `.secrets/gh-token`, never echoed in chat after binding). Platform scaffolding (db, uploads, examples, skills, logs) excluded via `.gitignore`. `.env` untracked from the scaffold's initial commit (verified history contains no secrets — only a local DB path).
- **Security note**: the PAT was shared in plaintext chat by the user; rotation recommended. It lacks `read:org` scope, so gh uses `GH_TOKEN` env auth instead of `gh auth login`.
- Operating model (from the master prompt): labels, milestones Phase 0–5, issue templates, PR template, CODEOWNERS, CI workflow (lint + type-check + prisma on GitHub runners), branch protection on `main`, issue-first backlog.

## D-016 — Supabase project bound (URL + publishable key) — pending service access
- **Context**: User provided `NEXT_PUBLIC_SUPABASE_URL` and a publishable key.
- **Decision**: Bound in the gitignored `.env`; placeholders in `.env.example`. Publishable keys are public by design. Phase 1 demo continues on Prisma/SQLite per D-002; Supabase activation (migrations + RLS + phone OTP) requires a service-role key or DB password.
- **Needs user**: `SUPABASE_SERVICE_ROLE_KEY` (or project DB password) to run migrations and flip auth to phone OTP.

## D-017 — Full master prompt (from uploaded file) absorbed into the operating model
- **Context**: User uploaded the complete NEST master prompt (17-agent org, GitHub issue-first workflow, QA merge gates, feature catalog P0–P5, market context).
- **Decision**: Adopted. Deviations from it (single app vs monorepo, sandbox platform constraints, no test-code rule) are recorded as ADRs 0001–0008 and DECISIONS.md entries, per the master prompt's own rule ("record the assumption in an ADR and continue").
- **Notable**: name risk (nesti) → ADR-0008 + blocking brand-clearance issue; landlord wallet/payouts and WhatsApp in Phase 1 are catalogued in the roadmap as soon-after-wedge items for the first post-gate iteration.

---

## D-018 — Phase 5 wedge decisions (analytics + KRA/MRI)
- **Context**: Post-Phase-4 gate, the Phase 5 wedge round shipped landlord analytics (issue #57/PR #58), the KRA/MRI tax assistant promised since Phase 2 (issue #59/PR #60), and close-out polish (issue #61/PR #62).
- **Decisions**:
  - Analytics charts are **hand-rolled inline SVG with zero new dependencies** — chart libraries cost bundle weight the low-end-Android persona cannot afford.
  - The KRA/MRI assistant is **record-keeping assistance only, never tax advice** (disclaimer ships as the first UI element); the 7.5% MRI estimate is integer minor units with documented `Math.round(base × 75 / 1000)` rounding.
  - Analytics + KRA routes are **read-only** — no AuditLog rows (audit trails track financial mutations, not reads).
  - A shared `kra.ts` rollup seam means the screen and CSV export can never disagree, and all three landlord money views (home arrears, analytics, KRA) use one balance math.
  - README's shipped table + roadmap are synced at every phase gate (was stale since Phase 2 — caught in this round's audit).

---

## D-019 — Phase 6 wedge decisions (statement + rent score)
- **Context**: Post-Phase-5 close (PR #64), the next wedge came from the README moat narrative and open assumption #5: the tenant-side record products. Shipped as PR #67 (issues #65, #66).
- **Decisions**:
  - The **statement's month attribution follows the waterfall ledger, not the payment date**: a payment made in October that clears September rent appears on September's row, with its allocated slice. Cross-month payments appear on every month they touched. This is where a human looks during a dispute; the ledger stays untouched (read-only derivation, no AuditLog rows, D-018).
  - The **rent score is a pure function with named constants** (weights 300/250/150/100, saturation 24 months, depth floor 2 rent-months, streak floor 3 months, trend window 3) — every number is documented in code and the card ships an expandable one-sentence-per-factor explainer. Never a black box; the score reflects the NEST record only.
  - **Tenant and staff views share one engine** (`lib/rent-score.ts`): the arrears chip and the tenant's card cannot diverge because they are the same function over the same facts.
  - Score arc + statement timeline are **hand-rolled inline SVG/CSS, zero new dependencies** (D-018 discipline continues).
  - Strict on-time rule: a charge counts on-time only when fully paid within its own billed month; RECENT_TREND divides by 3 even with fewer billed months. Deliberate — short or late records earn visibly less, and the explainer says so.
  - Tenant `?tenancyId=` params are **ignored** (own ACTIVE tenancy is always resolved server-side); staff ids are re-fetched inside `tenancyScopeWhere` (miss ⇒ 404).

## D-020 — Phase 7 wedge: notification read state (Notification Center)
- **Context**: Phase 6 closed with PR #69. The notification surface is the most-touched cross-role UI, but rows had no read state and the bell badge keyed off delivery status (IN_APP rows are SENT on creation, so the old QUEUED dot almost never showed). Opened as issue #70.
- **Decisions**:
  - **Read state is first-class data**: `Notification.readAt DateTime?` (null = unread), set only via `POST /api/notifications/read` (`{ids}` | `{all}`) scoped to `profileId = SELF`. Delivery state (QUEUED/SENT/FAILED) stays system-owned — read and delivered are different facts, and marking read is not a money action, so no AuditLog row (D-008 discipline).
  - **Idempotent append-only spirit**: rows already read keep their original `readAt` (the first read time is the record); re-marking is a no-op, and foreign ids match nothing (existence must not leak).
  - **The badge polls cheap**: `GET /api/notifications/unread-count` returns one integer from one COUNT, polled every 30s by every role — never a list fetch. The write returns the after-count so the client updates in one round-trip.
  - **Tenant and modal surfaces share one feed component** (`NotificationsFeed`) — filters, mark-one/mark-all, and the day-grouped list cannot diverge between the tab and the bell modal; the tenant home preview keeps a controls-free variant.
  - **Full template coverage**: all 11 emitted templateKeys now map to typed i18n headings (EN+SW) via one record, not a chain of ifs. New emitters add one key + two dictionary lines.
  - Unread styling is a left accent bar + `bg-primary/[0.045]` tint + dot (not a color-only signal — a11y), 44px mark-read targets, and a `.nest-scrollbar` utility (thin, theme-aware) lands in globals.css for long-list surfaces.

## D-021 — Phase 8 wedge: move-in (approved applicant → active tenancy)
- **Context**: Phase 7 closed with PR #71. Audit found the funnel dead-ends at APPROVED — an approved applicant never becomes a tenant in NEST, forcing paper leases exactly at move-in day, the highest-stakes moment of "trust as product". Opened as issue #72.
- **Decisions**:
  - **One transaction, whole backbone**: `POST /api/move-ins` (LANDLORD only) writes tenant Profile (find-or-create by phone) + Tenancy (ACTIVE, `NEST-<unit>-<seq>` accountRef continuing the seed's 1001-series) + Deposit with append-only HOLD movement (actor stamped) + first RENT charge (start month, due at start date — the `@@unique(tenancy,kind,period)` constraint makes double-raising impossible) + Unit → OCCUPIED + Listing → LET + Application → CONVERTED + timeline event, atomically. Partial move-ins cannot exist.
  - **CONVERTED is a terminal application status** (added to `APPLICATION_STATUSES`): conversion is exactly-once — a second attempt 409s "already been moved in". No new schema tables or columns: the Phase 1–4 contracts already anticipated this (Listing. status already had LET).
  - **Phone is the tenant identity seam**: existing TENANT profile on that phone → reused (no duplicates); a staff phone → hard 409 (a caretaker cannot become a tenant by move-in); otherwise a TENANT profile is created whose name of record is the applicant's own.
  - **Money discipline continues**: integer KES minor only (zod int, rent > 0, deposit ≥ 0). The deposit is HELD, never "paid" — move-in moves no rent money; the first charge simply exists for the waterfall (ADR-0004/ADR-0007).
  - **The timeline note is the receipt of record**: the CONVERTED event always carries the machine summary (`Tenancy NEST-X-#### opened · rent … · deposit … held · starts …`) — a landlord's custom note is prefixed, never replaces it, so every surface (agent, landlord, tenant) shows the lease facts without a join.
  - **Trust trail**: MOVE_IN AuditLog row + two notifications — the agent who recorded the applicant (APPLICATION_STATUS) and the new tenant (MOVE_IN template, EN+SW heading, "Karibu" welcome with the accountRef and pay-from-home instruction).
  - **UI**: green "ready to move in" funnel card on the landlord home (below amber pending-decisions in priority), MoveInCard on APPROVED application details, a prefilled sheet (listing rent + one-month deposit default — the Kenya standard), ConvertedSummary card on CONVERTED details, and timeline dots/pills for the new status. All 44px targets, EN+SW.
- **Rejected alternatives**: a two-step wizard (lease → deposit) — splits the atomic moment and invites drift; auto-converting on APPROVE — removes the landlord's deliberate move-in action (the deposit + start date are real decisions); a `Tenancy.applicationId` back-reference — derivable from the timeline event and would leak the marketing module into the lease contract.

## D-022 — Phase 9 wedge: Monty-inspired visual refresh (Soft-SaaS execution layer + MoM KPI deltas)
- **Context**: Phase 8 closed with PR #73. User directive: study the Monty dashboard (Behance 256155715, Valeria Gutsu — "Simplifying Affiliate Management") and translate its design language onto NEST. Opened as issue #74.
- **Decisions**:
  - **Translate, never transplant**: Monty's electric-violet/Blue accents, Inter font, and glassmorphism are rejected — NEST's dictated brand holds (deep green primary, Poppins, no blue/indigo, no backdrop-blur for the caretaker's low-end Android). What NEST adopts is Monty's *execution layer*: soft geometry, layered shadows, pastel chips, uppercase micro-labels, tabular KPI scale, segmented controls, floating dock.
  - **Tokens**: `--radius` 10px → 12px (lg/xl/2xl = 12/16/20); background shifts warm-cream → cool green-tinted off-white; borders one step softer; `--text-kpi` 26 → 28px. Two shadow utilities in globals.css — `.nest-card-shadow` (1px contact + 16px diffuse) and `.nest-float-shadow` (dock/popovers) — replace flat `shadow-sm`; dark-mode variants included.
  - **KPI cards (Monty's biggest signature)**: uppercase 11px tracked micro-labels, 28px bold tabular values, icons in tinted round containers, optional `highlight` hero (solid primary surface — the "Revenue card" pattern), and a **month-over-month delta** row (arrow chip + `vs last month`).
  - **MoM delta is a server fact, not client math**: `monthCollectedPrevMinor` added to Landlord/Caretaker overview totals — computed from the *same* payments array already fetched by `computeMoneyRollup` (zero extra round trips; strictly `COMPLETED` matched money, received in the previous calendar month). `momDeltaPct` returns null when there is no baseline (prev = 0) and the UI shows a muted "First full month on NEST" note instead of a lying "+∞%". Deltas: integer minor in, rounded integer pct out.
  - **Pastel chips everywhere**: StatusBadge/listing chips move from solid fills to `/opacity` tints with deep semantic text (success/15+success, warning/15+attention, destructive/10) — the icon+label pair stays (never color-only). Payment-source badges become neutral muted pills (a source is a fact, not a status).
  - **SegmentedControl (new shared component)**: muted pill container + card-surface selected pill with contact shadow, `aria-pressed` semantics, 44px mobile targets, optional count + amber attention accent (UNMATCHED/UNREAD). Replaces the bespoke pill rows in the notification feed controls and the payments/collections ledger filter.
  - **Floating bottom dock**: the mobile nav detaches from the screen edge (inset + rounded-2xl + `nest-float-shadow`), active tab sits in a `primary/10` rounded pill. Solid `bg-card` — no backdrop-blur by design. Footer's `pb-24` already clears the taller dock.
  - **Login hero**: display-scale tagline (2rem/2.4rem), logo in a `primary/10` rounded-3xl tile, static radial green wash via `color-mix` (pure CSS, zero GPU), role chips in the pastel family, hover-lift cards.
  - **Charts**: bar corner radius 3 → 4, billed bars drop their stroke (softer), non-baseline gridlines dashed `3 4`.
  - **Row affordance**: receipt/payment rows gain `hover:bg-muted/50` transitions (the table's shadcn hover already matched).
  - **Seed**: Sarah gains a coherent last-month partial payment (NEST-R-000000, 600k against PREV RENT) so the delta demo is real (+150% on the hero card) while every existing arrears story keeps its shape.
- **Rejected alternatives**: adopting Monty's violet or lime accents (brand breach); backdrop-blur dock (GPU cost on low-end Android); computing deltas client-side from cached analytics (a second API call + cache-stale numbers); rendering "+∞%" when prev = 0 (dishonest math).

## D-023 — Phase 10 wedge: Global Search (the ⌘K command palette)
- **Context**: Phase 9 shipped the Monty visual layer (PR #75). The landlord nav has 9 tabs; the pilot-readiness gap is wayfinding — "find Grace's receipt" should not be a tab-by-tab hunt. Monty's signature top-bar global search is the pattern. Opened as issue #76.
- **Decisions**:
  - **Search is a scoped read, not a new capability**: `GET /api/search?q=` composes the SAME `*ScopeWhere` fragments the list endpoints use (auth-guard §7.1 — routes never copy-paste conditions). A record you cannot list, you cannot find. No audit row, no notification (read-only, matrix grants what it already grants).
  - **Role surfaces**: LANDLORD/CARETAKER → tenants (via ACTIVE tenancy, name/phone), receipts (receiptNo), tickets (title/description), listings (title), applicants (name/phone); TENANT → own receipts + own tickets; AGENT → listings, applicants, receipts (chain); GUARD → visitors (name/phone), incidents (description). Deny-by-default fallthrough.
  - **Matching is honest about the platform**: Prisma `contains` on SQLite compiles to `LIKE` — ASCII-case-insensitive (names, NEST-R numbers, phones). No `mode:"insensitive"` (Postgres-only), no fuzzy matching, no indexing — deliberate non-goals recorded in the issue. Receipt lookup requires q ≥ 3 chars (NEST-R- is 7; shorter prefixes fan out over the ledger).
  - **Guardrails**: q trimmed 2–64 (else 400 VALIDATION with details), per-kind take caps (4–6), 24-row total cap, `force-dynamic`.
  - **Result rows are routing hints, not views**: `SearchResultDto` carries kind/id/title/subtitle/meta/tab/at. The palette never renders its own record view — picking a row routes into EXISTING surfaces (tab switch + detail modal/pushed screen). Meta (status, KSh amount) is server-formatted from integer minors via `formatKes` — money never crosses the wire as a number.
  - **UI**: one palette, two presentations — top-anchored Radix Dialog (≥sm, 2xl radius, `nest-card-shadow`, 10vh) / vaul thumb drawer (<sm). Grouped rows under uppercase micro-label headers (D-022 family), pastel icon tiles hue-matched per domain, 44px rows, `max-h-[60vh]` scroll with `.nest-scrollbar`, full keyboard nav (Ctrl/⌘+K global, ↑↓ move, Enter picks, Esc closes), input-as-title with sr-only DialogTitle (Radix a11y contract), debounce 350ms via TanStack Query (`keepPreviousData` so refined queries don't flash empty).
  - **Deep-link order matters**: `setTab` clears `pushedScreen` (ui-store §tab) — every pushed-screen deep-link switches the tab FIRST, then opens the detail. Caretaker's arrears is a pushed screen (S-18a), landlord's is a tab: the client maps by role, not by the server's tab hint.
  - **i18n**: 19 new keys (search.*), EN + SW in the same commit — "Tafuta wapangaji, risiti, maombi…", groups "Wapangaji/Risiti/Matengenezo/Matangazo/Wanaotafuta nyumba/Wageni/Matukio".
- **Rejected alternatives**: server-side fuzzy/trigram search (SQLite, tiny data — unnecessary); a search results screen instead of a palette (extra navigation, Monty's pattern is instant); client-side filtering of cached lists (stale caches + roles without a list endpoint for the kind); opening detail modals directly from server DTOs (would duplicate record views).

## Open assumptions awaiting user input
1. Supabase service-role key or DB password — to run migrations, RLS, and phone OTP.
2. Daraja sandbox credentials — for live M-Pesa testing (sim mode until then).
3. SMS/WhatsApp provider credentials — to send real notifications.
4. Brand clearance for "NEST" (vs existing fintech "nesti") before public marketing.
5. Phase 6-tail scope confirmation: consent-gated external Rent Score API (the tenant/staff views shipped in PR #67), financing & insurance partners, load/security/a11y hardening, pilot readiness.
