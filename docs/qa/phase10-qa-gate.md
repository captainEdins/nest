# Phase 10 QA Gate — Global Search (⌘K command palette, D-023)

**Task ID:** P10 · **Issue:** #76 · **Gate date:** 9 Oct 2026 (demo clock) · **App version:** Phase 10 · v0.10.0
**Scope under test:** `GET /api/search` (role-scoped, Zod 2–64, per-kind caps, 24-row total), `SearchResultDto` contract, `useSearch` (350ms debounce, keepPreviousData), SearchPalette (Dialog ≥sm / Drawer <sm, grouped rows, keyboard nav, deep-links), header trigger (44px, ≥md labelled + Ctrl K kbd hint), global Ctrl/⌘+K, i18n search.* (19 keys EN+SW), footer Phase 10 · v0.10.0.
**Method:** API arithmetic + scoping probes (curl, 5 roles) + agent-browser sweep at 375×812 and desktop widths across 4 roles + keyboard-nav drills + console/dev.log monitoring + tsc/lint. No test files per platform rule.

---

## Part 1 — API contract & scoping (the trust boundary)

| # | Probe | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | `GET /api/search?q=Grace` as LANDLORD | TENANT row (Grace Wanjiku, B2 · Baraka Court, tab "arrears") | exact | PASS |
| 2 | `GET /api/search?q=NEST-R` as LANDLORD | RECEIPT rows newest-first, server-formatted `KSh` meta, ISO `at` | NEST-R-000005 (Grace, 9 Oct, KSh 9,000) → …000001 → …000002 (Sarah) → …000000 | PASS |
| 3 | `GET /api/search?q=g` (1 char) | 400 VALIDATION + zod details | `{"error":"Search query must be 2–64 characters","code":"VALIDATION","details":[…]}` | PASS |
| 4 | Receipt fan-out guard | q < 3 chars skips the receipt branch entirely | code audit (`q.length < 3` early return) + "gr" probe returns tenants only | PASS |
| 5 | Scope = list scope | every branch composes `*ScopeWhere` (no copy-pasted conditions) | code audit: tenancyScopeWhere / paymentScopeWhere / ticketScopeWhere / listingScopeWhere / applicationScopeWhere / visitorLogScopeWhere / incidentScopeWhere — the same fragments the list endpoints use | PASS |
| 6 | GUARD money wall | guard never searches receipts (matrix §5.3) | branch guard `role === "GUARD" → []` in searchReceipts; guard branch = visitors + incidents only | PASS |
| 7 | Deny-by-default | a role without a branch returns `[]`, never 403/500 | role if-chain covers all 5 roles; fallthrough = empty results array | PASS |
| 8 | Caps | ≤6/6/5/4/5/6/4 per kind, ≤24 total | CAP constants + `results.slice(0, TOTAL_CAP)` | PASS |

## Part 2 — UI sweep (agent-browser)

| # | Surface | Checks | Verdict |
|---|---|---|---|
| 9 | Header trigger (desktop 1440px) | ghost 44px button, ≥md labelled "Search…" + `Ctrl K` kbd chip, muted foreground | PASS |
| 10 | Global `Ctrl+K` | opens palette from any tab (landlord home verified) | PASS |
| 11 | Palette (desktop) | top-anchored dialog, 2xl radius, input-as-header, grouped results, a11y tree exposes `search` role + combobox + listbox | PASS |
| 12 | Search "Grace" (landlord) | TENANTS group, "Grace Wanjiku · B2 · Baraka Court" row | PASS |
| 13 | Search "NEST-R" (landlord) | RECEIPTS group ×4+ with KSh meta + dates (incl. the STK test payment NEST-R-000005) | PASS |
| 14 | Enter picks row 1 (NEST-R-000005) | palette closes → Receipt modal opens, "Share receipt" present | PASS |
| 15 | Search "sink" (landlord) → Enter | REPAIRS group "Leaking kitchen sink · OPEN" → ticket detail pushed screen ("by Grace Wanjiku · Reported 8 Oct 2026 · Updated 9 Oct 2026") | PASS (after defect #21 fix) |
| 16 | Mobile 375×812 drawer | thumb drawer from bottom, hint state "Type at least 2 letters" | PASS |
| 17 | Mobile no-results state | "Mary" → "No matches for “Mary”" (query interpolated) | PASS |
| 18 | Guard search "Ka" (mobile) | VISITORS group "Brian Kariuki · VISITOR · 9 Oct 2026 · On site" | PASS |
| 19 | Caretaker TENANT deep-link | "Grace" → Enter → pushed Arrears screen ("2 tenants in arrears" — Grace cleared by the en-route STK test, consistent) | PASS |
| 20 | Keyboard model | ↑↓ move + scrollIntoView(nearest), Enter picks, Esc closes (dialog), input re-focuses | PASS |

## Part 3 — En-route defects found & fixed

| # | Defect | Root cause | Fix |
|---|---|---|---|
| 21 | Ticket deep-link landed on the repair QUEUE, not the ticket detail | `setTab` clears `pushedScreen` (ui-store §tab) — `openTicket` then `setTab("repairs")` erased the pushed screen | navigateTo order contract: tab FIRST, detail SECOND (comment pinned in the code); REPAIRED + re-verified (#15) |
| 22 | Console: `DialogContent requires a DialogTitle` (a11y) | palette input-as-title has no DialogTitle | sr-only `DialogTitle` (Dialog) + `DrawerTitle` (Drawer); fresh-session console = 0 errors |
| 23 | JSX parse error in shell-header | multi-line comment missing the closing `}` after `*/` | fixed; tsc/lint clean |

## Part 4 — Regression guards

| # | Check | Verdict |
|---|---|---|
| 24 | `bunx tsc --noEmit` | 0 errors |
| 25 | `bun run lint` | 0 errors |
| 26 | dev.log during the sweep | 0 runtime errors (only prisma traces + HMR) |
| 27 | Browser console (all roles, fresh session post-fix) | 0 errors, 0 warnings |
| 28 | i18n completeness | `Record<TranslationKey, string>` build contract: 19 new keys in BOTH en.ts and sw.ts (same commit) |
| 29 | Sign-out reset | `searchOpen: false` added to both unauthorized + sign-out state resets (app-shell, more-sheet) |
| 30 | Session-expiry during palette use | 401 → global reset closes the palette (cannot stay open signed-out) | code audit |
| 31 | Footer | "Phase 10 · v0.10.0" |
| 32 | Phase 9 surfaces (spot) | KPI cards + MoM delta, dock, SegmentedControl, notifications — untouched, render intact |
| 33 | Reseed stability | seed counts unchanged (8 profiles, 4 payments, 13 notifications, 33 audit logs) — *superseded by Phase 11 (issue #78): the Kevin/B1 notice story adds +2 notifications, +1 audit → 15/34 per reseed* |

**Known non-defects (documented to avoid re-triage):**
- Setting the input value programmatically (agent-browser eval) does not trigger React onChange — real keystrokes were used for all typed queries; not a product defect.
- The palette intentionally shows the sandbox footnote on every query (honest-by-design, matches login/footer).
- Money meta arrives server-formatted ("KSh 9,000") — the client never formats search money (D-023 decision).

---

## Part 5 — Independent review round (QA + PE agents, PR #77)

A two-pass independent review (QA reviewer, then Principal Engineer) ran against the first revision. Verdicts: **QA REQUEST CHANGES** (3 major, 3 minor, 4 nits) · **PE APPROVE with follow-ups** (merge gated on the QA majors). All blockers fixed and re-verified in-branch:

| # | Finding (severity) | Fix | Re-verified |
|---|---|---|---|
| R1 | **[major]** RECEIPT deep-link sent CARETAKER/AGENT to a tab they don't have ("payments") | `navigateTo` owns routing by kind+role: landlord→payments, caretaker→collections, tenant→receipts, agent→no tab switch (modal over current surface) | caretaker search NEST-R → Enter → modal closes on **Collections** tab (a11y tree: region "Collections") |
| R2 | **[major]** docstring claimed a 350ms debounce that did not exist (per-keystroke requests; route runs up to 5 Prisma reads) | real debounce implemented in `useSearch` (useEffect + setTimeout, 350ms) | code + typed "David" — one settled request in dev.log |
| R3 | **[major]** failed fetch indistinguishable from "no results"; no maxLength | `isError` branch + Retry button (`search.error` EN+SW), `maxLength={64}` | fetch monkey-patched to reject → "Search failed — check your connection and try again" + Retry; restore + Retry → results return |
| R4 | [minor] listbox children wrapped in `region` (ARIA contract) | sections now `role="group"` | a11y tree: `group "Tenants"` |
| R5 | [minor] no `aria-activedescendant` on the combobox | active row id + `aria-activedescendant` wired | a11y tree: option carries `[selected]` |
| R6 | [minor] per-kind caps summed 26 > 24 (later kinds starved) | caps rebalanced — widest branch sums exactly 24 (6/6/4/3/5) | code audit |
| R7 | [nit] `focus-visible:none` invalid utility | `focus-visible:outline-none` | code |
| R8 | [nit] ⌘K open-only; hardcoded "Ctrl K" | toggles; platform-aware kbd hint (⌘ K / Ctrl K) + `aria-keyshortcuts` | Ctrl+K toggle drill |
| R9 | [nit] ArrowDown on empty list → index −1 | double clamp | code |
| R10 | [nit] `receiptNo!` relied on implicit SQL NULL semantics | explicit `receiptNo: { not: null, contains: q }` | code |
| R11 | [PE, minor] branch queries serial | `Promise.all` per branch (one round-trip batch) | dev.log timing |
| R12 | [PE, minor] hand-rolled param parsing | `parseSearchParams` (the shared auth-guard seam) | code |
| R13 | [PE, minor] kind-set asymmetry undocumented | deliberate scoping documented in route header + D-023 (gate book = guard's domain; staff see digests) | docs |
| R14 | [PE, minor] `tab` field contract fuzzy (server hint vs client role reality — the very seam that caused R1) | **field removed** from DTO + route; `navigateTo` owns routing entirely | curl: `tab` absent from response |

Review verdict after fixes: **QA APPROVE · PE APPROVE — mergeable.**
