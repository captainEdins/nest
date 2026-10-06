# NEST Design System — Binding Spec

| | |
|---|---|
| **Owner** | UI/UX Designer (Task 1-c, issue captainEdins/nest#7) |
| **Status** | BINDING for Phase 1. Implementation drift = review rejection. |
| **Stack** | shadcn/ui + Tailwind CSS 4 (`@theme inline` tokens) + Radix primitives + lucide-react |
| **Audience** | Frontend Engineer (Task 2-b). QA uses §12 as the compliance checklist. |
| **Sources** | Color/type values dictated by Principal (DECISIONS.md D-010) — documented here verbatim. Derivations and completions are marked **[derived]** or **[completion]** with rationale. |

Design constraints that shape every rule below:

1. **Low-end Android on slow 3G first.** No backdrop-blur, no raster images, no full-page spinners, skeletons before data, one API call per dashboard.
2. **Money must be unambiguous.** `tabular-nums`, right-aligned in tables, KES formatting via `src/lib/money.ts`, never color-only status.
3. **Green = trust** (M-Pesa association, Kenyan identity). Amber = attention, never alarm. Red = destructive only.
4. **EN/Kiswahili parity** — every string comes from `src/lib/i18n` dictionaries. No hardcoded copy.
5. **One font, one radius family, one component vocabulary** — no bespoke widgets.

---

## 1. Color tokens

### 1.1 Implementation contract

Tokens live in `src/app/globals.css` as CSS variables in `:root` (light) and `.dark`, and are exposed to Tailwind through the existing `@theme inline` block. This is the canonical delta the Frontend Engineer applies:

```css
@theme inline {
  /* map every token to a Tailwind color utility */
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-attention: var(--attention);

  /* type scale (see §2) */
  --text-display: 1.875rem;    --text-display--line-height: 2.25rem;
  --text-h2: 1.375rem;         --text-h2--line-height: 1.75rem;
  --text-h3: 1.125rem;         --text-h3--line-height: 1.5rem;
  --text-body-lg: 1rem;        --text-body-lg--line-height: 1.5rem;
  --text-body: 0.9375rem;      --text-body--line-height: 1.5rem;
  --text-label: 0.8125rem;     --text-label--line-height: 1rem;
  --text-caption: 0.75rem;     --text-caption--line-height: 1rem;
  --text-kpi: 1.625rem;        --text-kpi--line-height: 2rem;
}

:root {
  /* attention = amber *as text* (derived — see §1.5) */
  --attention: oklch(0.25 0.05 75);
}
.dark {
  --attention: oklch(0.78 0.14 75);
}
```

Body sets `font-family: var(--font-poppins)`. `--radius: 0.625rem` is already correct in the scaffold — do not change it.

### 1.2 Light mode (dictated)

| Token | Value | Primary use |
|---|---|---|
| `--background` | `oklch(0.985 0.005 95)` | Page background (warm off-white) |
| `--foreground` | `oklch(0.22 0.02 150)` | Body text, headings |
| `--card` | `oklch(1 0 0)` | Cards, sheets, popovers surface |
| `--card-foreground` | `oklch(0.22 0.02 150)` | Text on card |
| `--popover` | `oklch(1 0 0)` | Popover/dialog surface |
| `--popover-foreground` | `oklch(0.22 0.02 150)` | Text on popover |
| `--primary` | `oklch(0.52 0.12 155)` | Actions, active nav, focus ring, links |
| `--primary-foreground` | `oklch(0.985 0.01 95)` | Text/icons on primary |
| `--secondary` | `oklch(0.95 0.015 120)` | Soft fills, secondary buttons, nav active bg |
| `--secondary-foreground` | `oklch(0.32 0.03 150)` | Text on secondary |
| `--muted` | `oklch(0.955 0.01 100)` | Muted chips, skeleton base |
| `--muted-foreground` | `oklch(0.52 0.02 120)` | Captions, secondary labels, empty icons |
| `--accent` | `oklch(0.93 0.04 85)` | Selected/hover fill (warm tan) |
| `--accent-foreground` | `oklch(0.3 0.04 85)` | Text on accent |
| `--destructive` | `oklch(0.55 0.19 27)` | Destructive buttons, error alerts |
| `--destructive-foreground` | `oklch(0.985 0.01 95)` | Text on destructive |
| `--warning` | `oklch(0.72 0.15 75)` | Amber fills: badges, banners (NOT body-size text in light) |
| `--warning-foreground` | `oklch(0.25 0.05 75)` | Text on warning; amber-as-text in light (via `--attention`) |
| `--success` | `oklch(0.55 0.12 155)` | Success fills, badges, icons |
| `--success-foreground` | `oklch(1 0 0)` | **[completion]** Text on success (pure white: 4.58:1 vs cream's 4.39:1 — AA) |
| `--border` | `oklch(0.9 0.01 100)` | Hairlines |
| `--input` | `oklch(0.9 0.01 100)` | Input borders |
| `--ring` | `oklch(0.52 0.12 155)` | Focus rings (green) |
| `--radius` | `0.625rem` | Base radius; shadcn derives sm/md/lg/xl |

### 1.3 Dark mode (dictated)

| Token | Value | Primary use |
|---|---|---|
| `--background` | `oklch(0.19 0.015 150)` | Page background (deep green-black) |
| `--foreground` | `oklch(0.95 0.008 100)` | Body text |
| `--card` | `oklch(0.235 0.015 150)` | Cards |
| `--card-foreground` | `oklch(0.95 0.008 100)` | **[completion]** same as `--foreground` (brief omitted; obvious pair) |
| `--popover` | `oklch(0.235 0.015 150)` | Popovers/dialogs |
| `--popover-foreground` | `oklch(0.95 0.008 100)` | **[completion]** same as `--foreground` |
| `--primary` | `oklch(0.72 0.13 155)` | Actions, active nav, links |
| `--primary-foreground` | `oklch(0.16 0.02 150)` | Text on primary |
| `--secondary` | `oklch(0.28 0.015 140)` | Soft fills |
| `--secondary-foreground` | `oklch(0.9 0.01 100)` | Text on secondary |
| `--muted` | `oklch(0.27 0.015 140)` | Muted chips |
| `--muted-foreground` | `oklch(0.68 0.02 110)` | Captions |
| `--accent` | `oklch(0.32 0.03 80)` | Selected/hover fill |
| `--accent-foreground` | `oklch(0.92 0.04 85)` | Text on accent |
| `--destructive` | `oklch(0.65 0.18 27)` | Destructive (see §4 for button rule) |
| `--destructive-foreground` | `oklch(0.985 0.01 95)` | **[completion]** cream pair |
| `--warning` | `oklch(0.78 0.14 75)` | Amber fills; amber-as-text in dark (via `--attention`) |
| `--warning-foreground` | `oklch(0.25 0.05 75)` | **[completion]** dark text on light amber (7.89:1) |
| `--success` | `oklch(0.72 0.13 155)` | Success fills |
| `--success-foreground` | `oklch(0.16 0.02 150)` | **[completion]** dark text on light green (8.24:1) |
| `--border` | `oklch(0.32 0.015 140)` | Hairlines |
| `--input` | `oklch(0.32 0.015 140)` | Input borders |
| `--ring` | `oklch(0.72 0.13 155)` | Focus rings |

**Sidebar aliases [completion]** (shadcn sidebar component expects these): set `--sidebar: var(--background)`, `--sidebar-foreground: var(--foreground)`, `--sidebar-primary: var(--primary)`, `--sidebar-primary-foreground: var(--primary-foreground)`, `--sidebar-accent: var(--secondary)`, `--sidebar-accent-foreground: var(--secondary-foreground)`, `--sidebar-border: var(--border)`, `--sidebar-ring: var(--ring)` in both modes.

### 1.4 Chart palette (green / amber / teal / warm-gray)

**[derived]** — brief dictates the hues; values harmonized to the tokens. Phase 1 uses progress bars only; tokens land now for Phase 2 charts.

| Token | Light | Dark |
|---|---|---|
| `--chart-1` (green) | `oklch(0.52 0.12 155)` | `oklch(0.72 0.13 155)` |
| `--chart-2` (amber) | `oklch(0.72 0.15 75)` | `oklch(0.78 0.14 75)` |
| `--chart-3` (teal) | `oklch(0.58 0.08 185)` | `oklch(0.7 0.09 185)` |
| `--chart-4` (warm gray) | `oklch(0.72 0.02 100)` | `oklch(0.62 0.02 100)` |
| `--chart-5` (soft green) | `oklch(0.65 0.1 165)` | `oklch(0.6 0.09 165)` |

**NO indigo, NO blue, no purple, no violet** — anywhere, any mode, any chart, any icon. QA greps the token files for `blue|indigo|violet|purple` (exception: none).

### 1.5 Amber-as-text: the `attention` utility **[derived]**

Amber `oklch(0.72 0.15 75)` on a light card is **2.54:1 — fails WCAG AA**. Amber semantics (arrears, pending, offline) still need to appear as *text* (amounts, labels). Therefore one derived alias:

```css
:root  { --attention: oklch(0.25 0.05 75); } /* = light --warning-foreground */
.dark  { --attention: oklch(0.78 0.14 75); } /* = dark --warning */
```

- **Amber text** (arrears balances, "pending", offline banner text): `text-attention` → 16.09:1 (light) / 8.13:1 (dark) on card. Never `text-warning` in light mode.
- **Amber tint backgrounds** (banners, highlight rows): `bg-warning/15 dark:bg-warning/10` + `text-attention`.
- **Solid amber badges**: `bg-warning text-warning-foreground` (6.34:1 light / 7.89:1 dark).

## 2. Semantic color rules

| Meaning | Token | Allowed on | Never |
|---|---|---|---|
| Trust, primary actions, active state, links | `primary` | Buttons "Pay now / Record cash / Confirm", active nav tab, progress fill, focus ring | Never for errors |
| Arrears, pending, offline, attention | `warning` / `attention` | Arrears amounts, PENDING & UNPAID badges, offline banner, unmatched alerts | Never red |
| Success, money received, paid, occupied | `success` | PAID badge, balance KSh 0, collection rate icon | — |
| Destructive, irreversible, error | `destructive` | Sign-out confirm, error alerts, destructive buttons | **NEVER plain "arrears" text or arrears icons** |
| Neutral, vacant, disabled | `muted` / `secondary` | VACANT badge, source badges, skeletons | — |

**Red is destructive-only.** An arrears balance, a failed payment, a pending state — none of them are red. Failure states on status cards use `attention` (amber) with an `XCircle` icon; red is reserved for actions that destroy data and for load errors (`errors.*`).

## 3. Typography

**Poppins only.** Loaded via `next/font/google`:

```ts
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
})
```

`layout.tsx` applies `className={poppins.variable}` and `globals.css` sets `--font-sans: var(--font-poppins)`. **No other font, no fallback stacks beyond the system tail, no monospace** — "code-like" references (account refs, receipt numbers) are Poppins `font-medium tabular-nums tracking-wide uppercase` instead of a mono font.

| Token | Weight | Size / line | Tailwind class | Usage |
|---|---|---|---|---|
| `display` | 700 | 30 / 36 | `text-display font-bold` | Screen title — **one per screen** |
| `h2` | 600 | 22 / 28 | `text-h2 font-semibold` | Section headings ("Arrears", "Recent payments") |
| `h3` | 600 | 18 / 24 | `text-h3 font-semibold` | Card titles, dialog titles |
| `body-lg` | 400 | 16 / 24 | `text-body-lg` | Reading text **below sm only**; pair with `sm:text-body` |
| `body` | 400 | 15 / 24 | `text-body` | Default body/paragraph/table text (all sizes) |
| `label` | 500 | 13 / 16 | `text-label font-medium` | Form labels, KPI captions, nav labels, button text |
| `caption` | 400 | 12 / 16 | `text-caption` | Timestamps, sub-labels, footnotes, badge text |
| `kpi` | 700 | 26 / 32 | `text-kpi font-bold tabular-nums` | KPI numbers, big balances, amounts on success screens |

Rules:

- Body copy that a user *reads* (tenant charges explanation, empty states): `text-body-lg sm:text-body`. Dense UI copy (card rows, table cells) stays `text-body`.
- **All numbers that can change width (money, counts) get `tabular-nums`.** Money in tables is additionally right-aligned.
- Long names (tenant, property): `truncate` on a `min-w-0` flex child; full value in `title` attr.
- No italics. No ALL-CAPS except account references. No letterspacing except references.
- Headings are text, never images; each screen's `h1` is `display` and visually can double as the header title.

## 4. Contrast compliance (measured on final tokens)

Computed OKLCH→sRGB→WCAG ratios; QA re-verifies via the token contrast check in the issue test plan.

| Pair (light) | Ratio | Pair (dark) | Ratio |
|---|---|---|---|
| foreground / background | 16.5:1 | foreground / background | 15.92:1 |
| foreground / card | 17.22:1 | foreground / card | 14.35:1 |
| muted-foreground / card (captions) | 5.48:1 | muted-foreground / card | 5.78:1 |
| primary / background (links) | 4.98:1 | primary / background | 7.84:1 |
| primary-foreground / primary (buttons) | 4.98:1 | primary-foreground / primary | 8.24:1 |
| success-foreground / success (badge) | 4.58:1 | success-foreground / success | 8.24:1 |
| warning-foreground / warning (badge) | 6.34:1 | warning-foreground / warning | 7.89:1 |
| destructive-foreground / destructive (button) | 5.12:1 | foreground / destructive | 3.04:1 ✗ |
| `text-attention` / card (arrears text) | 16.09:1 | `text-attention` / card | 8.13:1 |
| success as text / card | 4.58:1 | warning/success as text / card | 8.13 / 7.07:1 |
| destructive as text / card | 5.34:1 | destructive as text / card | 4.72:1 |

**Dark-mode destructive rule (from the ✗ above):** in dark mode, destructive buttons render as **outline** — `border-destructive text-destructive bg-transparent` (4.72:1 ✓). Solid destructive buttons are light-mode only. Error *text* is `text-destructive` on card in both modes (5.34 / 4.72 ✓). Sonner error toasts use `bg-card` with `text-destructive` icon, not a solid red surface.

## 5. Spacing & layout

| Concern | Rule |
|---|---|
| Card padding | `p-4` mobile → `sm:p-6` desktop |
| Grid/list gaps | `gap-4` → `sm:gap-6` |
| Screen padding | `px-4` → `sm:px-6` → `lg:px-8`; content `max-w-7xl mx-auto` |
| Section spacing | `space-y-4` mobile → `sm:space-y-6` |
| Dashboard grids | 1 column base → `sm:grid-cols-2` (KPI pairs) → `xl:grid-cols-12` (landlord dashboard: KPIs span 12/6/4/3, lists span 8, side column 4) |
| Row height (lists) | `min-h-14` (56px) — thumb-friendly |
| Component spacing | shadcn defaults; do not invent intermediate steps (4/8/12/16/24/32/48 only) |
| Breakpoints | Tailwind defaults: `sm 640`, `lg 1024` (sidebar appears), `xl 1280` (12-col) |
| Z-index | header `z-40`; bottom nav `z-40`; drawer/dialog `z-50`; toast `z-50`; offline banner `z-30` |

Bottom nav sits **outside** scroll (fixed) with `padding-bottom: env(safe-area-inset-bottom)`; content `<main>` gets `pb-24` (nav 56 + breathing room + safe area).

## 6. Navigation

### 6.1 Mobile — fixed bottom tab bar (< lg)

- Height **56px** + safe-area inset; `bg-card` `border-t` `fixed bottom-0 inset-x-0 z-40`.
- **Max 5 tabs.** Each tab: flex-1, `min-h-11` (44px target minimum), lucide icon `size={20}` + label `text-label` (500).
- Active: `text-primary` + 2px top indicator `bg-primary`; inactive: `text-muted-foreground`.
- Focus: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-card` on the tab; the bar is `<nav aria-label="Primary">`.

| Role | Tabs (label key → icon) |
|---|---|
| LANDLORD | `nav.home` Home · `nav.arrears` AlertTriangle · `nav.payments` Receipt · `nav.properties` Building2 · `nav.more` MoreHorizontal |
| CARETAKER | `nav.home` Home · `nav.units` DoorOpen · `nav.collections` Receipt · `nav.more` MoreHorizontal |
| TENANT | `nav.home` Home · `nav.receipts` Receipt · `nav.notifications` Bell · `nav.more` MoreHorizontal |
| AGENT | `nav.home` Home · `nav.more` MoreHorizontal |
| GUARD | `nav.home` Home · `nav.more` MoreHorizontal |

### 6.2 Desktop — left sidebar (≥ lg)

- Fixed left, **264px**, `bg-background` `border-r`; logo + role badge on top; nav items `h-10 px-3 rounded-md` (icon 20 + `text-body`), active = `bg-secondary text-secondary-foreground`; unread badge count on Notifications.
- Bottom of sidebar: user chip (avatar initials + name + role caption) → opens More sheet.
- Content area gets `lg:pl-[264px]`.

### 6.3 Header (all roles, all sizes) — 56px

`sticky top-0 z-40 h-14 bg-background border-b` — **solid background, no backdrop-blur** (low-end GPU).

Left → right: NEST logo (SVG mark + wordmark, `h-7`; mobile shows mark only below sm) · role badge (`bg-secondary text-secondary-foreground text-caption px-2 py-0.5 rounded-full`, label `role.<x>`) · spacer · language toggle (Globe icon, dropdown: `lang.en` / `lang.sw`, radio-checked) · theme toggle (Sun/Moon, cycles light→dark via next-themes) · notification bell (Bell + 8px `bg-primary` unread dot; Tenant → same view as its Notifications tab).

All icon-only buttons: `h-11 w-11` (44px target) with `sr-only` labels. The offline banner (§8) renders directly under the header, `z-30`.

## 7. Iconography, avatars, motion

- **lucide-react only.** Inline `16` (caption rows) / `20` (nav, buttons) / `40` (empty states). No filled icons, no emoji in UI.
- Key icons: cash `Banknote` · M-Pesa `Smartphone` · bank `Landmark` · arrears `AlertTriangle` · unmatched `HelpCircle` · share `Share2` · success `CheckCircle2` · fail `XCircle` · offline `WifiOff` · search `Search` · send `Send`.
- **Avatars = initials only** (no photos on 3G): `h-10 w-10 rounded-full bg-primary text-primary-foreground text-label font-semibold`, two letters from `fullName`.
- **Motion ≤200ms**, `transform`/`opacity` only. Respect `prefers-reduced-motion` (tw-animate-css provides the media query; do not add keyframe animations not gated by it). Drawer/sheet easing = vaul default.

## 8. States — exact treatments

| State | Treatment | Copy |
|---|---|---|
| **Loading (lists/cards)** | `Skeleton` blocks matching final layout: list rows `h-16 rounded-lg`, KPI card `h-28 rounded-xl`, text `h-4 w-2/3`. Never a full-page spinner. | — |
| **Loading (buttons)** | Inline `Loader2 size-4 animate-spin` + label, `disabled` + `aria-busy` | `common.loading` |
| **Empty** | `py-12` centered: lucide icon `size-10 text-muted-foreground` → `text-body-lg font-medium` headline → `text-caption text-muted-foreground` line → primary action (if any) | `empty.*` |
| **Error (section)** | `Alert variant="destructive"` + destructive `Retry` button; section keeps other content | `errors.couldNotLoad`, `common.retry` |
| **Error (screen)** | Centered Alert + Retry; nav remains usable | `errors.somethingWrong` |
| **Offline** | Banner under header: `bg-warning/15 dark:bg-warning/10 border-y border-warning/40 text-attention`, `WifiOff size-4`, full-width; visible while `navigator.onLine === false` | `common.offlineBanner` |
| **Offline-queued** | Sonner warning toast when a mutation is queued to the local outbox | `offline.queued` **[gap]** |

## 9. Components

### 9.1 Card / Table / lists

- **Card** is the universal container for KPIs and rows. Money rows: label (`text-label text-muted-foreground`) left, value (`text-body font-semibold tabular-nums`) right.
- **Table only ≥sm.** The same data renders as stacked cards on mobile (one list component, two presentations — never a horizontally-scrolling table).
- Lists: `divide-y` inside a `Card`, rows `min-h-14 p-4`, chevron/tap affordance right-aligned when rows navigate.

### 9.2 Badge — exact status mapping (shadcn `Badge` with custom variants)

| Status | Classes | Icon (never color-only) |
|---|---|---|
| `PAID` | `bg-success text-success-foreground` | `CheckCircle2` |
| `PART` / `UNPAID` / `PENDING` | `bg-warning text-warning-foreground` | `AlertTriangle` / `Clock` |
| `UNMATCHED` | `border border-warning text-attention bg-transparent` | `HelpCircle` |
| `VACANT` | `bg-muted text-muted-foreground` | `DoorOpen` |
| `OCCUPIED` | `border border-success text-success bg-transparent` | `CheckCircle2` |
| `NOTICE` (unit/tenancy) | `border border-warning text-attention bg-transparent` | `Flag` |
| Source (`MPESA`/`CASH`/`BANK`) | `bg-secondary text-secondary-foreground` | `Smartphone`/`Banknote`/`Landmark` |
| **Arrears amount (text, not badge)** | `text-attention font-semibold tabular-nums` | — |

### 9.3 Flows: Dialog vs Drawer

- Any multi-step flow or form (match payment, amount entry, settings): **Drawer (vaul) below sm** (thumb-reachable, snap points allowed) — **Dialog ≥sm**. One component, `<ResponsiveModal>` wrapper, is the approved pattern.
- Confirmations (sign out): `AlertDialog` on desktop / vaul drawer sheet on mobile.
- Step headers inside flows: `h3` title + `common.back` ghost button; steps numbered "1 of 3" via `text-caption`.

### 9.4 Toasts — Sonner

`<Toaster>` mounted once in the shell. Position: `bottom-center` on mobile (offset `80px`, above the tab bar), `bottom-right` ≥sm. Theme via sonner CSS vars mapped to tokens (`--normal-bg: var(--card)`, `--normal-text: var(--card-foreground)`, `--normal-border: var(--border)`). Variants: success (CheckCircle2, default), error (XCircle, `text-destructive` icon), warning (offline queue). Duration 4s; success flows 6s. No stacking >3.

### 9.5 Tabs / forms / inputs

- Section switching (receipts/charges) = shadcn `Tabs`; `text-label` labels, active tab `text-primary` with `border-b-2 border-primary`.
- Inputs: shadcn `Form` + `react-hook-form` + `zod` (messages from `errors.*` keys). Input height `h-11` mobile → `sm:h-10`; labels `text-label`; helper/error text `text-caption text-destructive`.
- **Money/phone fields: `inputMode="numeric"`** (+ `autocomplete="tel"` on phone). Amount inputs: large `text-kpi` display when single-purpose; KES prefix from `formatKes` context.
- Disabled/preview tiles (Guard): `opacity-60 pointer-events-none` + `text-caption` "next phase" note — still meet contrast, just muted.

### 9.6 Money, dates, phone

- Money: `formatKes()` from `src/lib/money.ts` — "KSh 18,000". KPI numbers `text-kpi`; table values `tabular-nums text-right`; arrears amber (`text-attention`); zero balance `text-success`.
- Dates: **"12 Feb 2026"** — `format(date, "d MMM yyyy")` (date-fns). Never ISO strings in UI. Month labels on charge rows: "Feb 2026".
- Phones display `+254 711 000 001` (space-grouped), stored E.164.

## 10. Accessibility (binding checklist)

1. Body text ≥4.5:1 — guaranteed by §4 pairs; flag any new pair to the Designer before use.
2. `focus-visible` ring on **every** interactive element (`ring-2 ring-ring ring-offset-2`); never remove outlines without replacement.
3. All tap targets ≥**44px** (buttons `h-11` mobile; icon buttons `h-11 w-11`; list rows `min-h-14`).
4. Landmarks per screen: `<header>` (app header) · `<main id="main">` · `<nav aria-label="Primary">` (bottom bar **or** sidebar) · `<footer>`. One `h1` per screen.
5. Icon-only buttons: `sr-only` accessible name (language, theme, bell, share, back).
6. **Payment status changes** (STK polling card, match success): container `role="status" aria-live="polite"` so screen readers announce Waiting → Confirmed.
7. **Never color-only status**: every badge carries an icon + text label (§9.2); arrears rows show the amount AND "months behind" text.
8. `prefers-reduced-motion` honored globally (§7).
9. Keyboard: flows (drawer/dialog) trap focus, `Esc` closes, focus returns to trigger. `aria-expanded` on accordions.
10. Touch: no hover-only affordances — every hover state has an equivalent tap state.

## 11. Performance (binding)

1. **Skeletons before data** — every async region renders its skeleton on first paint; no full-page spinners, ever.
2. **One API call per dashboard** — each role home is a single overview endpoint (see `src/lib/types.ts` `*OverviewDto`). No N+1 fetching in the shell.
3. Animations ≤200ms, transform/opacity only; **no backdrop-blur**; no parallax.
4. No raster images in Phase 1 (SVG logo + initials avatars only). Font subsets: latin, 4 weights, `display: swap`.
5. Charts in Phase 1 are progress bars and counts — **no chart library on the critical path** (recharts reserved for Phase 2+).

## 12. Drift-rejection checklist (QA gate)

Reviewer rejects a build that violates any of these:

1. Any color value not in §1 (or any blue/indigo/violet/purple anywhere).
2. Any font that is not Poppins 400/500/600/700.
3. Money rendered as float, without `tabular-nums`, or right-alignment missing in a table.
4. Red used for arrears/pending anywhere.
5. Amber body-size text via `text-warning` in light mode (must be `text-attention`).
6. Full-page spinner instead of skeletons; >1 API call on a role home.
7. Bottom-nav targets <44px, or >5 tabs, or missing safe-area padding.
8. A status conveyed by color alone (no icon/label).
9. Hardcoded UI copy not from `src/lib/i18n` dictionaries.
10. Animation >200ms or any backdrop-blur.
