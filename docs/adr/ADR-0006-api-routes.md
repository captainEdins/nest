# ADR-0006 — API route handlers for mutations (not Server Actions)

Date: 2026-02-11 · Status: Accepted · Reviewer: Principal Engineer

## Context
The product brief prefers Server Actions; the deployment platform requires API routes for mutations.

## Decision
All mutations are typed `POST /api/*` route handlers with Zod validation and session scoping. Client mutations go through one typed api client.

## Consequences
- ✅ M-Pesa callbacks are native HTTP anyway; offline sync becomes idempotent POSTs by `clientRef`; the same handlers serve app, WhatsApp channel (Phase 1+), and partner webhooks (Phase 4).
- ⚠️ Slightly more client code than Server Actions — offset by TanStack Query caching.
