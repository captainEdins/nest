# Contributing to NEST

NEST is built as a **multi-agent engineering organization** with one rule above all: *evidence over claims*. This document is the operating model.

## The organization

| Role | Responsibility |
|---|---|
| Principal Engineer | Final accountability, contracts (types/schema/API/design tokens), integration, merge authority |
| Solution Architect | ADRs, data model, integration design, reviews every schema/payments/security PR |
| Solution Manager | Scope, backlog, acceptance criteria, phase go/no-go |
| UX Research & Content | Personas, journeys, EN/Kiswahili copy |
| UI/UX Designer | Design system, screen specs, rejects screens that drift |
| DB & Security Architect | Schema, indexes, role-scope matrix, seed |
| Backend & Payments | Daraja integration, reconciliation, receipts, audit |
| Frontend | shadcn/Poppins implementation exactly to spec |
| Field Experience | PWA, offline queue, caretaker/guard flows |
| QA Lead | Test strategy, deep QA per PR, **veto power** |
| Security Engineer | Threat model, adversarial testing |
| Technical Writer | README, architecture docs, role guides (EN/SW) |

## Workflow

1. **Issues first.** No feature code without an approved issue meeting the Definition of Ready (user story, Given/When/Then acceptance criteria including at least one negative and one permission case, test plan, security notes, out-of-scope).
2. **One issue, one PR.** The PR description must contain `Closes #<issue>`.
3. **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Branches: `feat/<issue>-short-name`.
4. **Peer review by a different specialist.** No agent approves its own work. CODEOWNERS require the Solution Architect on schema/payments/security paths.
5. **QA gate.** Acceptance criteria walked, negative + permission cases attempted, mobile-viewport checks, money edge cases (replays, part-payments, unmatched flows). QA applies `qa-passed` or `qa-failed`.
6. **Squash merge** with the conventional-commit title.
7. **Phase gates.** A phase closes only when lint, type-check, E2E flows, security probes and accessibility checks all pass with shown output — recorded in `docs/qa/`.

## Non-negotiable rules

- Money is **integer KES minor units**. Never floats.
- Payments, wallet entries, deposit movements are **append-only**. Corrections are reversing entries.
- Every financial action writes an **audit log** row.
- **Never trust the client** — every route is session-scoped server-side.
- No secrets in code, logs or chat. `.env` is gitignored; `.env.example` is the contract.
- Tests are never skipped, weakened or deleted to get green. If a check cannot run, say so explicitly and list what must be run.
- If a requirement is ambiguous, record the assumption in an ADR and keep moving.

## Local setup

See the [README](README.md#run-it-locally). `bun install && bun run db:push && bun run db:seed && bun run dev`.
