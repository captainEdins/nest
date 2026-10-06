<!-- One issue, one PR. This description MUST contain "Closes #<issue>". -->

## Summary

Closes #<issue>

## What changed

-

## Acceptance criteria walked (from the issue)

- [ ] Every Given/When/Then verified — including the negative and permission cases
- [ ] Mobile viewport (375px) checked in light and dark mode

## Test evidence

Paste actual command/output — lint, type-check, E2E flow transcripts, API probes. Claims without output are rejected.

## Money & ledger impact (if any)

- [ ] Integer minor units only; no float arithmetic
- [ ] Append-only preserved (corrections = reversing entries)
- [ ] Audit-log entries written for every financial action
- [ ] Callback replay idempotent (replayed N times → credited once)

## Security & privacy impact

- [ ] Route scoping matches docs/architecture/role-scope-matrix.md
- [ ] No secrets, PII or tokens in logs or client code

## Screenshots / recordings

Mobile viewport recordings for field flows.

## Rollout / rollback

-
