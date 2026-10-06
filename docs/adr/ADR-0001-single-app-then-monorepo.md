# ADR-0001 — Single Next.js application now, monorepo extraction later

Date: 2026-02-11 · Status: Accepted · Reviewer: Principal Engineer

## Context
The org brief specifies a monorepo (`apps/web`, `packages/db`, `packages/payments`, …). The build platform runs a single Next.js app from the repo root with a fixed dev-server contract.

## Decision
Ship Phase 0–1 as a single Next.js app with **package-level discipline instead of package boundaries**: `src/lib/reconciliation.ts`, `src/lib/mpesa.ts`, `src/lib/i18n/`, `prisma/` are written as self-contained modules with no upward imports, so extraction into `packages/*` is a file move, not a rewrite.

## Consequences
- ✅ Zero build-tooling overhead for the MVP; faster gate cycles.
- ✅ Extraction point is already encoded (CODEOWNERS lanes match future package boundaries).
- ⚠️ Enforcement is by convention + review until extraction (Phase 3+ or first external consumer).

## Rejected
- Full monorepo now: adds tooling risk with no Phase-1 consumer; Turborepo workspace overhead vs. one app.
