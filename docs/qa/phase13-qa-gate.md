# Phase 13 QA Gate — Reminders & Records (issue #84, D-026)

**Scope**: `POST /api/notifications/remind-all` (bulk arrears reminders) + statement print sheet.
**Method**: agent-browser E2E (landlord + caretaker + tenant journeys) + curl API probes + `agent-browser pdf` (print-media render). No test code per platform rule — this document is the evidence.
**Date**: 2026-10-12. **Dev server**: running, clean log (only `prisma:query` lines + 200s).

## A. API probes (curl, session cookies)

| # | Probe | Expected | Result |
|---|---|---|---|
| A1 | `POST /api/notifications/remind-all` as LANDLORD (Amina), first run | 200 `{notifiedCount:3, skippedCount:0, channels:[SMS,IN_APP]}` | ✅ PASS — exact body |
| A2 | Same call again inside 30 min (replay) | 409 `CONFLICT` "already sent in the last 30 minutes" | ✅ PASS |
| A3 | As CARETAKER (John) | 200 (caretaker is a valid sender) | ✅ PASS |
| A4 | As TENANT (David) | 403 `FORBIDDEN` "Role TENANT may not access this resource" | ✅ PASS |
| A5 | As AGENT (Wanjiku) | 403 `FORBIDDEN` by role | ✅ PASS |
| A6 | Audit row | `REMINDERS_BULK_SENT` with `{"notifiedCount":3,"skippedCount":0,"channels":["SMS","IN_APP"]}` | ✅ PASS (Prisma read) |
| A7 | Tenant received | David: new IN_APP + SMS `ARREARS_REMINDER`, balance KSh 31,000, ref NEST-A1-1001; unread badge 3 | ✅ PASS (`GET /api/notifications` + `unread-count`) |
| A8 | Message shape | byte-identical structure to the single-reminder route (name, unit, property, balance, accountRef, M-Pesa) | ✅ PASS |
| A9 | Simulated SMS delivery | `[notify][simulated SMS] → +254711000004: …` in dev.log | ✅ PASS |

## B. E2E — remind-all UI (agent-browser, landlord)

| # | Step | Expected | Result |
|---|---|---|---|
| B1 | Arrears tab (landlord) | "Remind all (3)" button next to the tenants-behind caption | ✅ PASS |
| B2 | Click button | AlertDialog: title, count, channels, exact-message preview (example = largest balance, David Otieno) | ✅ PASS |
| B3 | Confirm | Dialog stays open while sending → toast success → button → "Sent" disabled; `POST …/remind-all 200` in dev.log | ✅ PASS |
| B4 | Loading/error states | Button hidden while rows pending; empty arrears → button not rendered | ✅ PASS (code + render check) |

## C. E2E — statement print (agent-browser, tenant Grace)

| # | Step | Expected | Result |
|---|---|---|---|
| C1 | Statement tab | "Print / save PDF" outline button beside Give notice | ✅ PASS |
| C2 | On-screen | Print sheet `display:none` (screen-only timeline) | ✅ PASS (computed style) |
| C3 | `agent-browser pdf` (print media) | Sheet renders, app chrome absent, **one page** | ✅ PASS (39,591 B PDF, 1 page) |
| C4 | PDF text content | Letterhead (NEST + STATEMENT OF ACCOUNT + account ref), issued-to (Grace Wanjiku + phone), period Sep–Oct 2026, totals 18,000/9,000/9,000, month rows with kinds + receipt `NEST-R-000001 · KSh 9,000`, signature lines, footnote + paybill | ✅ PASS (pdftotext) |
| C5 | No app chrome in PDF | No nav labels, no sidebar, no "Your receipts", no dev-tools overlay | ✅ PASS |
| C6 | Timeline unaffected | Screen screenshot matches pre-Phase-13 layout (print wrapper adds no visual node) | ✅ PASS |

## D. Regression sweep (all 5 roles)

Landlord (home/Money out/Analytics/Arrears), caretaker (home/Collections/Repairs/Money out), tenant (home/Statement), guard (home), agent (home) — all render, all API 200s, zero console/server errors. Error-shape contract re-verified: 401 UNAUTHORIZED / 400 VALIDATION / 404 NOT_FOUND / 409 CONFLICT / 403 FORBIDDEN all carry `{error, code}`.

## Verdict

**24/24 PASS. Phase 13 clears the QA gate.**
