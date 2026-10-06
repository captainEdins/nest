# ADR-0003 — Auth: demo HMAC cookie session behind a phone-OTP-shaped boundary

Date: 2026-02-11 · Status: Accepted · Reviewer: Principal Engineer, Auth engineer brief

## Context
Primary login is Supabase phone OTP. No SMS provider/OTP credentials exist in the sandbox.

## Decision
`POST /api/auth/login` (phone) sets an httpOnly cookie `nest_session = <profileId>.<hmac(SESSION_SECRET)>`; every API route verifies it server-side. The login UI is phone-first ("enter your number") so the UX pattern matches production. The provider boundary is one module (`src/lib/session.ts`); production swaps it for Supabase phone OTP while route guards stay unchanged.

## Consequences
- ✅ Role scoping testable end-to-end today; tokens never in client storage.
- ⚠️ Demo accounts are seeded — acceptable for a sandbox demo, unacceptable for production (documented in README + SECURITY.md).

## Rejected
- Client-side role switching without server scoping (never — violates "never trust the client").
