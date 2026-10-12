# Phase 18 QA Gate — The detail sweep (design language v2 across every desk)

**Issue**: #94 · **Branch**: `feat/phase18-detail-sweep` · **Decision**: D-031 (design-system §1.2 note + §9.1)

Trigger: the user reported "the ui in some areas does not look good." A VLM design audit of every role surface scored the caretaker home 6.5/10, arrears 6/10, collections 6.5/10, agent 7.5/10, guard 8.5/10 (landlord home, post-Phase-17: 9/10) — the v2 warm-canvas language had landed only on the landlord's surfaces.

Scope: caretaker home asymmetric split (briefing panel + today pill / action tiles + KPI quad), global table v2 (uppercase micro-label headers + airy cells in `ui/table.tsx`), tight list cards (`divide-y gap-0 py-0` sweep — 30 sites / 22 files), action-tile quick actions, urgency-as-tint (border-l-4 rails retired), pastel RentScoreChip, deepest-bucket arrears tint, amber selected attention segment, soft destructive HIGH-severity badge, guard amber report-incident tile, agent KpiCell v2 + tinted funnel states, payments-ledger tint pills, login press feedback, hairline footer, arrears skeleton shimmer.

## Verification matrix

| # | Check | Result |
|---|---|---|
| 1 | `bunx tsc --noEmit` | PASS (0 errors) |
| 2 | `bun run lint` | PASS (0 errors) |
| 3 | Caretaker home v2 (desktop): briefing panel (h1 time-aware greeting "Good evening, John", property · month caption, heroContext "5 units · KSh expected", amber arrears alert row, TODAY pill) / 3 action tiles (Record cash solid primary) / KPI quad (month collected highlight + MoM delta + progress, arrears amber, open repairs, unmatched); Units + Recent collections side-by-side ≥xl | PASS (a11y tree + visual) |
| 4 | VLM critique — caretaker home BEFORE 6.5/10 → AFTER 8.5/10 ("polished, high-fidelity proptech dashboard"); a 7.5 re-run's "Security card uses a full border" claim disproved by targeted crop check (borderless + soft shadow confirmed) | PASS |
| 5 | VLM critique — caretaker home MOBILE 390×844: 8/10 — first-fold usefulness excellent (actions immediately reachable, arrears alert high-priority, no horizontal scroll, no clipped text) | PASS |
| 6 | Caretaker golden paths: Record cash tile → dialog opens; Request M-Pesa tile → dialog; Record expense tile → dialog; unmatched KPI → Collections tab with UNMATCHED filter `aria-pressed=true`; arrears KPI → pushed arrears screen; briefing arrears row → arrears | PASS (6/6) |
| 7 | Arrears v2: aging buckets render borderless white cards w/ soft shadows (VLM: yes); DEEPEST non-empty bucket amber-tinted ("31-60 Days, KSh 53,000, distinct amber tint" — John's scope); rent-score chips render as soft tinted pills, not empty outlines (VLM: yes); total amber, larger (VLM: yes) | PASS |
| 8 | Collections ledger (John + Amina): table headers uppercase micro-labels (VLM verified), rows breathing, property pills tinted no-border (VLM: "fitting the modern chip aesthetic perfectly"), SegmentedControl UNMATCHED selected = amber tint | PASS |
| 9 | Agent home: KpiCell borderless v2 (uppercase micro-labels, soft shadow), funnel state 2 tinted surface (no left rail), quiet state muted; VLM 7.5 → 8.5 | PASS |
| 10 | Guard home: report-incident tile amber surface (emergency affordance — "never red" is the documented D-031 rejected alternative), on-duty tinted surface without border-l-4, log-visitor solid primary tile | PASS |
| 11 | SecurityCard: HIGH-severity line renders as soft destructive badge (bg-destructive/10 chip, not bare red text); eyebrow uppercase micro-label | PASS (visual) |
| 12 | Landlord home REGRESSION after the divide-y sweep: VLM 9/10 — "no broken layout elements or spacing leaks", hairline dividers intact, hairline footer clean | PASS |
| 13 | Dark mode (landlord home + payments): VLM 9/10 — "rich deep charcoal, no washed-out trap", amber/green accents vibrant, contrast solid | PASS |
| 14 | Print regression: statement → `agent-browser pdf` → ONE page, letterhead, no app chrome, tabular money, signature lines, traceability footnote (VLM 4/4 yes) | PASS |
| 15 | ⌘K search palette: opens, "grace" → Grace Wanjiku option; notifications modal opens; ESC closes both | PASS |
| 16 | Console error sweep: console hooked (error+warn), full reload as Amina → 0 entries; dev.log during sweep shows only 200 responses | PASS |
| 17 | Scope isolation spot-check: John's Collections w/ UNMATCHED filter → "No unmatched payments" (the seed's unmatched payment sits outside John's scope — Amina sees it portfolio-wide) | PASS |

## In-round findings (design smells caught by the audit loop)

- **THE `divide-y` CARD GAP DEFECT**: `<Card className="divide-y">` inherited the Card base's `gap-6 py-6` — dividers floated mid-way inside 48px of row spacing on EVERY list card in the app (the "cramped vs airy inconsistency" two audits kept flagging). Fixed globally: 30 call sites → `divide-y gap-0 py-0` (tight hairline lists).
- **RentScoreChip neutral outline**: read as a broken/empty container by two independent VLM audits (flagged as "critical rendering failure" — it was a style, not a bug). Pastel-tint treatment mirrors StatusBadge; the false-positive rendered as a real design smell.
- **Aging urgency inversion**: the pre-v2 code styled the EMPTY 61+ bucket's border amber while debt sat untinted in 31-60. Urgency now lives on the deepest non-empty bucket.
- **Selected attention filter invisible**: white selected pill inside a muted container read near-invisible; the selected UNMATCHED segment now wears the amber tint.

## Known honest non-defects

- **VLM scoring variance**: the same caretaker-home state scored 8.5 and 7.5 across runs; the low run's specific claims (border on SecurityCard) were disproved by crop-level verification. Averages accepted; concrete claims verified individually.
- **Guard "incident should be red"**: rejected by design (D-031) — red stays reserved for destructive confirmations; amber is NEST's urgency language (D-022).
- **Unmatched-filter empty state on the caretaker ledger**: honest — the unmatched payment sits in Amina's portfolio scope, not John's.
- **nextjs-portal dev overlay** covers the bottom dock in dev only (documented ops note; not a product defect).
