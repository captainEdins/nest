# Security Policy

## Reporting a vulnerability

Email the maintainer via the GitHub account listed on this repository, or open a **private** security advisory (Security → Advisories → New draft advisory). Do not open public issues for vulnerabilities.

## What we treat as security-sensitive

- Anything in `src/lib/reconciliation.ts`, `src/lib/mpesa.ts`, session handling, or `prisma/schema.prisma` (append-only ledgers).
- Callback replay, idempotency, and cross-role access (the role-scope matrix in `docs/architecture/role-scope-matrix.md` is the source of truth).
- Secrets handling: `.env` is gitignored; service keys never reach the client or logs.

## Guarantees we test adversarially

- A tenant cannot read another tenant's charges, payments or receipts.
- A caretaker cannot access properties they are not assigned to.
- Replaying an M-Pesa callback any number of times credits a tenant exactly once.
- Append-only records cannot be tampered with through any API route.
- Role escalation attempts are denied server-side and audited.

## Scope note

The demo environment uses a simulated M-Pesa sandbox and demo session auth. Production deployment requires Supabase Auth (phone OTP) + RLS, Daraja credentials, and provider secrets — see `.env.example`.
