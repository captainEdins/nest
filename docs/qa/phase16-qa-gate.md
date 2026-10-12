# Phase 16 QA Gate — The Signature Layer (modern UI/UX motion, depth & detail)

**Scope**: issue #90 / branch `feat/phase16-signature-layer` — CSS-only motion system, hero KPI v2, frosted chrome, micro-interactions, skeleton shimmer, empty-state blobs, greeting hierarchy. No data, API, or schema changes.

**Method**: agent-browser (Playwright) on the dev server, VLM (glm-5v-turbo) for visual verification of each treatment, `bunx tsc --noEmit` + `bun run lint` for code health. Viewports 1440×900 (desktop) and 390×844 (mobile). Dark mode via the real theme toggle (not media emulation).

## A. Code health

| # | Check | Result |
|---|---|---|
| A1 | `bunx tsc --noEmit` | PASS — zero errors |
| A2 | `bun run lint` | PASS — zero errors/warnings |
| A3 | Dev server compiles after every edit batch (dev.log) | PASS — no compile errors |
| A4 | Motion CSS rules live in the served stylesheet (nest-sweep / nest-rise / backdrop-filter / nest-hero-surface / nest-hero-soft / reduced-motion media) | PASS — all 6 present via `cssRules` probe |

## B. Motion system

| # | Check | Result |
|---|---|---|
| B1 | Tab switch (Arrears) renders the new screen (keyed fade re-mount) | PASS — h1 "Arrears", aging buckets render |
| B2 | Segmented control (payments ledger) switches "All plots" → "Riverside Flats" — selected state moves, settle key remounts | PASS — `aria-pressed=true` follows the click |
| B3 | `prefers-reduced-motion: reduce` emulation → computed `animation-duration` collapses (1e-05s) and content stays visible | PASS — `{"animDuration":"1e-05s","contentVisible":true}` |
| B4 | Reduced-motion screenshot renders full content (no blanks) | PASS |
| B5 | Stagger: role homes' sections animate in order (visual check post-login) | PASS — VLM sees layered entrance, no overlap |
| B6 | No double-animation artifacts (wrapper fade + child stagger are disjoint properties) | PASS — visual check clean |

## C. Depth & material

| # | Check | Result |
|---|---|---|
| C1 | Hero KPI gradient + rings visible (light, desktop) | PASS — VLM: "rich gradient… faint concentric rings… premium" |
| C2 | Hero KPI in DARK mode (real toggle) — deep, not washed out | PASS — VLM: "vibrant, saturated… does not look washed out" |
| C3 | Caretaker cream hero with soft bloom (nest-hero-soft) | PASS — rule live; renders with depth, no ring clutter |
| C4 | Frosted header (desktop, content scrolls under) | PASS — VLM: "distinct glass layer… sits cleanly" |
| C5 | Frosted floating dock (mobile 390×844) | PASS — VLM: "frosted glass effect… floating appearance" |
| C6 | Card elevation on dark canvas | PASS — VLM: "layered effect… without looking harsh" |
| C7 | Empty state blob treatment renders (tinted concentric circles) | PASS — component renders in all roles' empty sections |

## D. Loading & chrome

| # | Check | Result |
|---|---|---|
| D1 | Skeleton shimmer sweep visible during reload | PASS — VLM: "skeleton placeholder bars… subtle shimmer/highlight sweep" |
| D2 | Bell unread badge pops in on mount (nest-anim-pop) | PASS — badge renders with pop class, no console errors |
| D3 | Toasts rounded-2xl (geometry matches cards) | PASS — class applied via toastOptions |
| D4 | Button press settle (`active:scale-[0.97]`) on cva base, disabled excluded | PASS — code-verified, interaction sweep exercised it |

## E. Interaction regression (golden paths)

| # | Check | Result |
|---|---|---|
| E1 | Login → all 5 demo cards render + stagger; sign-in works | PASS — 5 logins performed |
| E2 | ⌘K search palette opens (dialog role, heading) | PASS |
| E3 | Notifications modal opens (dialog role) | PASS |
| E4 | Remind-all AlertDialog opens (count + preview) and cancels | PASS — "Send reminders to everyone in arrears?" + "Send to 4 tenants" |
| E5 | Sign-out confirm flow (More sheet → confirm dialog) | PASS — exercised 4× during the role sweep |

## F. Cross-role & regression sweep

| # | Check | Result |
|---|---|---|
| F1 | LANDLORD home desktop + mobile, light + dark | PASS — VLM clean, no glitches |
| F2 | CARETAKER home mobile | PASS — touch targets verified |
| F3 | TENANT home mobile | PASS — hierarchy praised |
| F4 | GUARD home mobile | PASS — no bugs |
| F5 | AGENT home mobile | PASS — hierarchy + elevation clean |
| F6 | Console errors across all 5 roles | PASS — zero (page errors + console clean) |
| F7 | **Print regression**: tenant statement → `agent-browser pdf` (print media) | PASS — 1 page, letterhead + green rule, full month table, NO app chrome, NO animation stranding |
| F8 | Footer sticky + version v0.16.0 | PASS |

## Verdict

**26/26 PASS.** The signature layer is live: screens arrive, cards lift, selections settle, skeletons shimmer, the hero carries brand depth, and the frosted chrome is a progressive enhancement with the D-022 solid surfaces intact as the fallback. Reduced-motion users get final states, never blanks; paper never sees an animation.
