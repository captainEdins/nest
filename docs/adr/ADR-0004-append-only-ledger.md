# ADR-0004 — Money is integer KES minor units; ledgers are append-only

Date: 2026-02-11 · Status: Accepted · Reviewer: Principal Engineer, DB & Security Architect

## Context
Kenyan rental money passes through M-Pesa (integer shillings in Daraja APIs) and cash. Float arithmetic is prohibited by the product brief.

## Decision
- Every amount is `Int` minor units (cents) in the DB, APIs, and UI. One formatter (`src/lib/money.ts`).
- `Payment` rows are created **only for completed money events** (M-Pesa success callbacks, confirmed cash). STK pending state lives in `MpesaTransaction` — failed pushes never create money rows.
- Payments are never edited. Corrections are new reversing entries (`status=REVERSED`, Phase 2 ledger refinement). Receipt numbers derive from an auto-increment id — race-free.
- Every financial mutation writes an `AuditLog` row.

## Consequences
- ✅ Reconciliation totals are exact; replay-safe; dispute-auditable.
- ⚠️ SQLite cannot enforce append-only at the DB layer — guardrail is the single write path (`reconciliation.ts`) + audit trail; the Supabase port adds triggers.

## Rejected
- Decimal/float columns, mutable payment rows, receipt numbers from timestamps (collision-prone).
