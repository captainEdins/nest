# ADR-0002 — Supabase is the production data plane; Prisma + SQLite in the dev sandbox

Date: 2026-02-11 · Status: Accepted · Reviewer: Principal Engineer, DB & Security Architect

## Context
Product target: Supabase (Postgres + RLS + Auth + Storage + Realtime). The dev sandbox has no Supabase service access but has Prisma + SQLite wired into the platform. A real Supabase project URL + publishable key are now bound (env vars), but no service-role key or migration access yet.

## Decision
1. The **domain contract** is Prisma's `schema.prisma` + the **role-scope matrix** (`docs/architecture/role-scope-matrix.md`). Every access rule is expressed as a predicate ("TENANT reads payments WHERE tenancy.tenantId = session profile"), implemented once server-side.
2. In the sandbox, predicates are enforced in API route guards (`requireRole` + scoped queries). In production, the same predicates become RLS policies — the matrix is written so each row maps to one policy.
3. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are bound in env; Supabase wiring activates when a service key + DB migration access are provided.

## Consequences
- ✅ Product direction preserved; no fake Supabase shims with divergent semantics.
- ✅ Security model is testable now (adversarial probes per role), portable later.
- ⚠️ Two enforcement layers exist across environments; the matrix is the single source of truth keeping them aligned.

## Rejected
- Mocking the Supabase client: silent semantic drift from real RLS.
- Blocking on credentials: the wedge (reconciliation UX) does not need them.
