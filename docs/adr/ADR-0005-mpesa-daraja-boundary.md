# ADR-0005 — M-Pesa Daraja: real integration boundary, simulated network

Date: 2026-02-11 · Status: Accepted · Reviewer: Principal Engineer, Backend & Payments Engineer

## Context
Daraja sandbox credentials were not provided. The wedge depends on the STK Push + callback flow being real.

## Decision
`src/lib/mpesa.ts` implements the real Daraja contract — OAuth token, STK Push request, STK Callback body (`Body.stkCallback.CallbackMetadata`), C2B validation/result shapes, and an HMAC callback-verification hook (`x-mpesa-signature`, HMAC-SHA256 over the raw body with `MPESA_CALLBACK_SECRET`). Network calls switch on `MPESA_MODE`:
- `sim` (default): fabricates `CheckoutRequestID`s locally and routes simulated callbacks through the **exact same processing pipeline** as live ones — idempotency, allocation, receipting, audit all execute for real.
- `live`: calls Daraja using env keys/passkey/shortcode.

Simulated artifacts are labelled in the UI ("Sandbox simulation").

## Consequences
- ✅ The reconciliation engine is exercised against real payload shapes today.
- ✅ Going live = env vars, no code change.
- ⚠️ No real money movement in the demo (a feature, not a bug, for a sandbox).

## Rejected
- Hardcoding a stubbed "success" path that skips the callback pipeline (would leave idempotency untested).
