<div align="center">

<img src="public/nest-logo.svg" width="96" alt="NEST logo" />

# NEST

**The rental operating system for Kenya.**
One plot. Five roles. One record of truth.

[![CI](https://github.com/captainEdins/nest/actions/workflows/ci.yml/badge.svg)](https://github.com/captainEdins/nest/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0B6B3A.svg)](LICENSE)
[![Made for Kenya](https://img.shields.io/badge/made%20for-Kenya-CE1126.svg)](docs/architecture/overview.md)

*Rent in Kenya runs on trust between people who rarely meet. NEST turns every verbal claim into a timestamped, verifiable record — and never plays judge.*

</div>

---

## 📊 For investors — the one-pager

**The problem.** A typical Kenyan rental plot involves a landlord (often in another city), an agent, a caretaker collecting cash, tenants who want receipts, and a guard at the gate. Rent is tracked in exercise books and WhatsApp messages. Arrears are invisible until they're large. Deposits vanish in disputes. The caretaker — the person who actually runs the plot — is the least tooled and the most accused.

**The wedge.** *Caretaker + M-Pesa: "who has paid, and can they prove it?"* NEST starts at the exact moment money changes hands: STK Push and C2B rent collection, an automatic reconciliation engine that matches every payment to tenant, unit and charge, and instant shareable receipts. Cash collections by caretakers are recorded in under 3 taps — with a receipt that protects *them* as much as the landlord.

**The moat.** Parity features (M-Pesa reconciliation, SMS/WhatsApp reminders) are table stakes. NEST differentiates on data no one else accumulates in one place: payment history, repair trails, move-in condition reports, an append-only deposit ledger, and plot reputation — across **all five roles**, not just landlord-and-tenant. That record underwrites the Phase 4+ products: rent scores for lenders (tenants *and* landlords), rent advances via partner financiers, and embedded insurance.

**The tailwind.** KRA's eRITS platform and the draft Residential Rental Income Tax Regulations are pushing landlords toward digital, audit-ready records. Monthly Rental Income tax (7.5% of gross residential rent) is filed monthly by the 20th. Compliance becomes a feature, not a chore. *(NEST's tax tooling is record-keeping assistance, never tax advice — verified against final regulations before build.)*

**The honest risks.** A Kenyan fintech ("nesti") already operates in rent payments — brand clearance is tracked as a blocking issue; "NEST" is a codename until cleared. Incumbents ship broad suites; NEST wins by being field-first (offline, low-end Android, Kiswahili) and by making the caretaker the hero.

### What is shipped in this repo (Phase 0 → 7)

| Capability | Status |
|---|---|
| Five role-based home screens (landlord / agent / caretaker / tenant / guard) | ✅ shipped |
| Demo auth with role switching (Supabase phone-OTP adapter boundary) | ✅ shipped |
| M-Pesa **STK Push** + Daraja-format callbacks (simulated sandbox, live-ready boundary) | ✅ shipped |
| **Automatic reconciliation engine** — waterfall allocation, idempotent callbacks, unmatched-payment review queue | ✅ shipped |
| Instant receipts + shareable record; cash collections in ≤3 taps | ✅ shipped |
| Arrears with aging; occupancy & collection-rate KPIs | ✅ shipped |
| Append-only money ledger (integer KES minor units) + audit log on every financial action | ✅ shipped |
| **Maintenance tickets** — tenant reporting → caretaker queue → landlord view → resolution timeline | ✅ shipped |
| **Move-in condition reports** with per-room condition grading | ✅ shipped |
| **Deposit ledger** — append-only movements, landlord settlement flow, tenant deposit detail | ✅ shipped |
| **Guard module** — visitor gate register, incident reporting with acknowledgement, shift lifecycle | ✅ shipped |
| **Agent funnel** — listings → applicants → landlord approve/reject, append-only event timelines | ✅ shipped |
| **PWA** — installable, service worker (production registration), offline-tolerant collections | ✅ shipped |
| **Landlord analytics** — 6-month collection trend, arrears-by-age buckets, occupancy donuts (hand-rolled SVG, zero deps) | ✅ shipped |
| **KRA/MRI tax assistant** — monthly rent summary, 7.5% MRI estimate, CSV export (record-keeping only, never tax advice) | ✅ shipped |
| **Tenant monthly statement** — brought-forward → billed → settled → carried-forward per month; cross-month payments shown where they landed | ✅ shipped |
| **Rent Score (tenant + staff views)** — 0–800 from four documented factors, factor breakdown on the card, same engine output on arrears rows | ✅ shipped |
| **Notification Center** — read state per row, unread badge on the bell (every role), All/Unread filters, mark-one/mark-all read, translated headings for all 11 event types | ✅ shipped |
| **Move-in** — approved applicant → active tenancy in one transaction: tenant profile (find-or-create), deposit HELD with append-only movement, first rent charge raised, unit flips OCCUPIED, listing closes LET, CONVERTED timeline event, agent + tenant notified, audited | ✅ shipped |
| **Monty-inspired visual refresh + MoM deltas** — Soft-SaaS execution layer (2xl radius, layered shadows, pastel chips, segmented controls, floating bottom dock, login hero) and month-over-month KPI deltas computed server-side in the same overview call | ✅ shipped |
| English & Kiswahili, light/dark | ✅ shipped |
| Consent-gated external Rent Score API, financing & insurance partners, load/security hardening | 🗺 next tail (see [roadmap](#-roadmap)) |

### Business-model hooks (Phase 4+, by design)

- **Rent Score API** — consent-based scoring for partner lenders, underwritten on NEST's accumulated record.
- **Rent advance & landlord bridge financing** — via licensed partners; NEST never lends from its own balance sheet.
- **Embedded insurance** — tenant contents, landlord rent guarantee.
- Transaction take-rate on collections; SaaS per-unit pricing; white-label for property companies and SACCOs.

---

## 🛠️ For engineers & recruiters — how this is built

This repo was built as a **simulated engineering organization**, not a solo sprint: a Principal Engineer sets contracts (types, schema, API, design tokens), specialist agents build against them, and *different* specialists review the work. Nothing merges without a peer review and a QA pass. Every significant trade-off is a written [ADR](docs/adr/); every platform adaptation is recorded in [DECISIONS.md](DECISIONS.md).

### Architecture at a glance

```
┌──────────────────────────── Next.js 16 (App Router, TS strict) ───────────────────────────┐
│  /                     single app shell: role gate → role dashboard (mobile-first PWA)    │
│  src/components/nest   role dashboards · pay flows · receipts · arrears · review queue    │
│  src/lib/i18n          English + Kiswahili dictionaries, typed keys                      │
└───────────────┬───────────────────────────────────────────────────────────────────────────┘
                │ typed DTOs (src/lib/types.ts) — the contract seam
┌───────────────▼───────────────────────────────────────────────────────────────────────────┐
│  API layer (route handlers, Zod-validated, session-scoped)                                │
│  /api/auth /api/overview /api/payments/* /api/mpesa/callback /api/receipts /api/notify    │
└──────┬──────────────────────┬──────────────────────────────┬──────────────────────────────┘
       │                      │                              │
┌──────▼────────┐   ┌─────────▼──────────┐   ┌───────────────▼──────────────┐
│ Prisma domain │   │ M-Pesa Daraja      │   │ Reconciliation engine        │
│ (SQLite dev / │   │ boundary: STK Push │   │ match → waterfall allocate → │
│  Supabase in  │   │ + callbacks, HMAC  │   │ receipt → notify → audit     │
│  production)  │   │ verification,      │   │ (idempotent by checkout id)  │
│ append-only   │   │ idempotent replay- │   │ unmatched → manual review    │
│ money ledger  │   │ safe processing    │   │ queue                        │
└───────────────┘   └────────────────────┘   └──────────────────────────────┘
```

### Engineering discipline you can audit in this repo

- **Money is integer KES minor units, end to end.** No float ever touches a shilling. Receipts are derived from an auto-increment sequence — race-free by construction. ([money.ts](src/lib/money.ts), [ADR-0004](docs/adr/ADR-0004-append-only-ledger.md))
- **Append-only financial records.** Payments are never edited; failed pushes never create money rows; corrections are reversing entries. Every financial action writes an audit-log row.
- **Idempotent payment processing.** Replaying the same Daraja callback any number of times credits a tenant exactly once (verified behavior, not a claim).
- **Server-side role scoping on every route** — a role-scope matrix ([docs/architecture/role-scope-matrix.md](docs/architecture/role-scope-matrix.md)) defines who sees what; the client is never trusted. This maps 1:1 onto Supabase RLS policies for production.
- **Typed contract seam.** One `types.ts` is the source of truth for every API boundary — frontend, backend and tests all import it.
- **Quality gates per phase** (lint + typecheck zero errors, scripted E2E per role on mobile viewport, adversarial security probes: cross-role access, callback replay, append-only tampering) with evidence in [docs/qa/](docs/qa/).
- **Design system before screens.** Tokens, type scale (Poppins 400/500/600/700 — the only font), states and component rules are specified in [docs/design/](docs/design/), then implemented, then audited against spec.

### Run it locally

```bash
git clone https://github.com/captainEdins/nest.git && cd nest
bun install
cp .env.example .env        # fill SESSION_SECRET; Supabase/Daraja keys optional
bun run db:push             # create the SQLite schema
bun run db:seed             # demo plot: 5 roles, 3 tenancies, arrears + unmatched payment
bun run dev                 # http://localhost:3000
```

**Demo identities** (seeded — sign in as any role from the home screen):

| Role | Phone | What to try |
|---|---|---|
| 👑 Landlord — Amina Barasa | +254711000001 | KPIs, arrears aging **with rent-score chips**, match the unmatched payment, **Analytics charts, Tax assistant + CSV** |
| 🧰 Caretaker — John Mwangi | +254711000002 | Record a cash collection in 3 taps, request M-Pesa, repairs queue |
| 🏠 Tenant — Grace Wanjiku | +254711000003 | Pay rent via M-Pesa (sandbox sim), get instant receipt, report a repair, **see your Rent Score + monthly Statement (More tab)** |
| 🏠 Tenant — David Otieno | +254711000004 | See arrears balance + reminder |
| 🔒 Guard — Peter Njoroge | +254711000006 | Log a visitor, report an incident, start/end shift |
| 🤝 Agent — Wanjiku Kamau | +254711000007 | Publish a listing, record applicants, run the pipeline |

> M-Pesa runs in `MPESA_MODE=sim` — a full Daraja-shaped sandbox (real STK callback JSON, real idempotency path) with the network call stubbed and clearly labelled. Set Daraja keys + `MPESA_MODE=live` to hit the real sandbox.

### Repository map

```
src/app/            Next.js App Router — single-shell route + API handlers
src/components/nest Role dashboards and flows (shadcn/ui primitives)
src/lib/            contracts (types, money), session, reconciliation, mpesa, i18n
prisma/             schema + seed (one demo plot, all five roles)
docs/               adr/ · architecture/ · design/ · guides/ (EN+SW) · qa/
.github/            issue templates · PR template · CODEOWNERS · CI workflow
DECISIONS.md        every assumption, trade-off and rejected alternative
```

---

## 🗺 Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundations: repo, contracts, design system, schema, CI | ✅ |
| 1 | **The wedge**: auth+roles, M-Pesa collection, reconciliation, receipts, arrears, dashboards | ✅ |
| 2 | Maintenance tickets, condition reports with photos, deposit ledger, KRA/MRI assistant | ✅ |
| 3 | Guard module (visitors, incidents, shifts), caretaker fraud detection (unmatched-payment review), offline hardening | ✅ |
| 4 | Agent module, listings funnel, landlord approvals, PWA service worker | ✅ |
| 5-wedge | Landlord analytics (trend/aging/occupancy), KRA/MRI assistant + CSV export, a11y polish | ✅ v0.5.0 |
| 6-wedge | **Tenant monthly statement** (portable payment record) + **Rent Score** (0–800, four documented factors, tenant card + staff chips) | ✅ v0.6.0 (this repo) |
| 7-wedge | **Notification Center** — read state (readAt), unread bell badges, All/Unread filters, mark-read, full template-heading coverage (11 keys, EN+SW) | ✅ v0.7.0 (this repo) |
| 8-wedge | **Move-in** — the funnel's closing transaction: approved applicant → active, money-ready tenancy (deposit HELD, first charge raised, unit OCCUPIED, listing LET, CONVERTED event, notifications, audit — all in one atomic POST /api/move-ins) | ✅ v0.8.0 (this repo) |
| 9-wedge | **Monty-inspired visual refresh** — Soft-SaaS execution layer on the dictated green brand (D-022): 2xl cards + layered shadows, pastel status chips, uppercase micro-label KPI cards with 28px tabular values + **server-computed month-over-month deltas** (`monthCollectedPrevMinor`, zero extra queries), Monty SegmentedControl, floating bottom dock, login hero, chart polish | ✅ v0.9.0 (this repo) |
| 6-tail | Consent-gated external Rent Score API, financing & insurance partners, load/security/a11y hardening, pilot readiness | planned |

## 📚 Documentation

- [DECISIONS.md](DECISIONS.md) — assumptions, trade-offs, rejected alternatives
- [docs/adr/](docs/adr/) — architecture decision records
- [docs/architecture/](docs/architecture/) — data model, reconciliation flow, role-permission matrix
- [docs/design/](docs/design/) — design system and screen specifications
- [docs/user-guide-en.md](docs/user-guide-en.md) · [docs/user-guide-sw.md](docs/user-guide-sw.md) — user guides in English and Kiswahili
- [docs/qa/](docs/qa/) — phase test reports with evidence
- [CONTRIBUTING.md](CONTRIBUTING.md) — the engineering operating model
- [SECURITY.md](SECURITY.md) — reporting and security practices

## ⚖️ License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
<sub>Built as a multi-agent engineering organization: contracts first, peer review always, evidence over claims.</sub><br/>
<sub>🇰🇪 <i>NEST ni kwa wale wote wanaoishi na kodi — kirafiki, kilaini, na kilithi.</i></sub>
</div>
