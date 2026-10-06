# ADR-0007 — Reconciliation: account-reference match + waterfall allocation + review queue

Date: 2026-02-11 · Status: Accepted · Reviewer: Principal Engineer, Backend & Payments Engineer

## Context
M-Pesa payments arrive with an AccountReference and a phone number; tenants may part-pay, over-pay, or typo the reference. NEST must never lose a cent or double-credit.

## Decision
1. **Match**: account reference exact-match to `Tenancy.accountRef`; fallback phone-number match to the tenant's active tenancy.
2. **Allocate**: oldest-due-date-first waterfall across the tenancy's open charges (rent, water, garbage) — cents are preserved exactly (`splitWaterfall` in `money.ts`).
3. **Receipt**: deterministic receipt number, issued instantly, shareable.
4. **Unmatched**: no match → `status=UNMATCHED` in a manual-review queue; a landlord/agent matches it to a tenancy later (audited).
5. **Idempotency**: callback processing keyed on `CheckoutRequestID` (unique + processed flag). Replays return 200 OK and credit nothing further.

## Consequences
- ✅ Part-payments, over-payments (credit balance) and typos all have defined paths.
- ✅ Ledger invariant: Σ allocations = payment amount, always.
- ⚠️ Over-payment credit beyond open charges is carried as tenant credit (shown as negative balance) until Phase 2's wallet ledger refines it.

## Rejected
- Auto-refunding unmatched payments (NEST records facts; humans decide outcomes).
- FIFO-by-charge-kind instead of due-date ordering (ageing would mislead).
