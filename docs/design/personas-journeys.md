# NEST — Personas & Phase 1 Journeys

**Owner:** UX Researcher & Content Designer (Task 1-b, issue captainEdins/nest#6)
**Status:** Approved for Phase 1 build
**Audience:** Frontend Engineer (2-b), Backend Engineer (2-a), QA
**Related:** `src/lib/i18n/en.ts`, `src/lib/i18n/sw.ts`, `src/lib/i18n/index.tsx`, `DECISIONS.md` D-010/D-011

> How to use this document: personas set the constraint envelope (device, network,
> language, literacy). Journeys are the numbered flows the Phase 1 UI must support.
> Test scripts are the moderated sessions QA (agent-browser E2E, D-009) and any
> human tester should mirror. §6 is the approved Kiswahili glossary — the
> `sw.ts` dictionary must never contradict it. §7 is the i18n API cheat sheet
> for the Frontend Engineer.

---

## 1. Personas

### 1.1 John Mwangi — Caretaker (THE most important user)

- **Age / role:** 46, caretaker of Baraka Court, a 12-unit plot in Kahawa Wendani, Nairobi.
- **Device:** Tecno Spark 10 — 2GB RAM, 32GB storage, cracked screen protector. Android Go edition.
- **Connectivity:** Safaricom 500MB/month bundles, mostly slow 3G (H+). Top-ups data with small KSh 20 bundles when he must.
- **Language:** Kiswahili-first. Reads English slowly; writes it reluctantly. Numbers and money are comfortable in either language.
- **Daily reality:** Collects cash door-to-door in the evening, chases tenants by phone, reports to the landlord (Grace) on Sunday. Currently keeps a paper receipt book and an exercise book ledger. Half his disputes end in the sentence *"aliniambia amenilipa"* ("they told me they paid me").
- **Motivations:** Finish collections by 8pm; look organized in front of the landlord; keep his KSh 15,000/month job.
- **Fears:** **Being accused of stealing rent money.** He has been shouted at twice over a KSh 2,500 discrepancy that was actually a tenant's delayed M-Pesa. NEST's timestamped receipts are his defense — every collection leaves a trail that says exactly who paid, when, and who recorded it.
- **Trust moment:** A tenant disputes a payment at 9pm. John opens NEST and shows the receipt number in under 30 seconds — on 3G.
- **Design implications:** Home screen = today's job list, nothing else. Cash collection in ≤3 taps. Works when the network doesn't (offline queue, D-012). Kiswahili as first-class, not a dropdown afterthought.

### 1.2 Grace Wanjiru — Landlord

- **Age / role:** 52, owner of Baraka Court. Also runs a fabric stall at Gikomba; reachable mostly after 6pm.
- **Device:** Samsung Galaxy A14 — 3GB RAM. Comfortable with WhatsApp and M-Pesa; suspicious of anything that asks for many permissions.
- **Connectivity:** Home Wi-Fi in the evening, 4G during the day.
- **Language:** Fluent Kiswahili and English; prefers English for business documents, Kiswahili for conversations.
- **Daily reality:** Twelve tenants, three of them chronically late. She reconciles M-Pesa statements against a handwritten ledger on Sunday nights and still ends up calling John to ask "ni nani alituma hii pesa?" ("who sent this money?").
- **Motivations:** Collect ≥90% by the 10th; know within a day when a tenant goes quiet; fill the two vacant units; stop evening phone calls that eat her rest.
- **Fears:** A tenant claiming *"nilituma pesa juzi"* (I sent money the other day) with no way to verify; discovering arrears only when they're already three months deep; a caretaker she can't check on.
- **Trust moment:** An M-Pesa payment lands with a wrong account reference. She matches it to a tenant in under a minute and the arrears list updates in front of her.
- **Design implications:** Dashboard = income, arrears, vacancies at a glance. The unmatched-payments queue must be a first-class KPI badge, not a hidden tab. Every number shows its month ("This month") so she never doubts what she's looking at.

### 1.3 Peter Otieno — Agent

- **Age / role:** 34, property manager running 6 plots for 4 landlords across Nairobi (Kasarani, Ruai, Umoja).
- **Devices:** Infinix Hot 30i (4GB) in the field; a 2019 HP laptop at home for owner reports.
- **Connectivity:** 4G most of the day; fibre at home.
- **Language:** English-first in reports; Kiswahili with caretakers and tenants. Sheng with the younger ones.
- **Daily reality:** WhatsApp groups per plot, a spreadsheet per landlord, monthly PDFs built by copy-paste. Landlords churn when a bad month surprises them.
- **Motivations:** One dashboard proving his value ("collection rate 94% this month") so no landlord leaves; spot problems across all plots without driving to each one.
- **Fears:** Arrears spiraling silently on a plot he hasn't visited in two weeks; being blamed for a caretaker's miscount.
- **Trust moment:** A landlord asks "how is Ruai doing?" and Peter answers from a live number, not last month's PDF.
- **Phase 1 scope:** Portfolio overview only. Phase 1 must be honest about it (see §3.6) — Peter would rather see "this module arrives in the next phase" than a dead button.

### 1.4 Amina Hassan — Tenant

- **Age / role:** 26, nurse at KNH on rotating shifts; rents bedsitter B4 at Baraka Court.
- **Device:** Tecno Camon 20 — 4GB RAM, WhatsApp-heavy, storage always nearly full.
- **Connectivity:** 1GB/month bundles; hospital Wi-Fi on night shifts.
- **Language:** English and Kiswahili equally; has never used a rental app.
- **Daily reality:** Pays rent by M-Pesa on payday (5th), screenshots the confirmation SMS, and has still been asked twice to "prove" a payment. Her deposit (KSh 8,500) is a verbal memory.
- **Motivations:** Pay in under a minute from her bed after a night shift; have every receipt on her phone so disputes end before they start; see exactly what the balance is — rent, water, garbage — not a mystery total.
- **Fears:** Losing an M-Pesa SMS when she changes phones; being accused of not paying when she did; her deposit quietly disappearing at move-out.
- **Trust moment:** She pays at 06:40 after a night shift and the receipt is on her screen before she locks the phone.
- **Design implications:** Pay Now is the primary action, pre-filled amount, pre-filled phone. Receipt is instant, shareable to WhatsApp, and shows the allocation ("rent Nov, water Nov") in plain words.

### 1.5 David Barasa — Guard

- **Age / role:** 58, night guard at Baraka Court. Lives in the caretaker's former storeroom at the gate.
- **Device:** Itel A60s — 1GB RAM, 16GB storage, screen brightness kept low to save battery.
- **Connectivity:** ~300MB/month; often out of bundle for days.
- **Language:** Kiswahili and Bukusu at home; school English. Reads better than he types — types slowly with one thumb.
- **Daily reality:** Logs visitors in a worn exercise book that the rain got into once. When a tenant's gas cylinder went missing on his shift, he had no proof of who came in.
- **Motivations:** Proof he did his job: every visitor written down with a time.
- **Fears:** Something going missing on his watch with no record to defend him; apps that update themselves and eat his bundle.
- **Phase 1 scope:** Login + assigned property + an honest phase notice (§3.7). He is in the system from day one so his account and the trust habit start now; the visitor log arrives in a later phase.
- **Design implications:** When his screens arrive (Phase 3): gigantic tap targets, no typing where a tap can do it, Kiswahili default. Phase 1 must at minimum never crash on 1GB RAM and must never auto-download anything.

### Persona constraint envelope (build target)

| Persona | RAM floor | Network floor | Data budget | Primary language |
|---|---|---|---|---|
| John (caretaker) | 2GB | 3G (H+) | 500MB/mo | Kiswahili |
| Grace (landlord) | 3GB | 4G | generous | EN/SW mixed |
| Peter (agent) | 4GB | 4G | generous | English |
| Amina (tenant) | 4GB | 3G evenings | 1GB/mo | EN/SW mixed |
| David (guard) | 1GB | 3G, sometimes none | 300MB/mo | Kiswahili |

**The build target is David's phone on John's network.** If it works there, it works everywhere.

---

## 2. Research → design principles

1. **Trust is the product.** Every screen answers "can I prove this happened?" — timestamp, receipt number, who recorded it. No proof, no feature.
2. **Caretaker-first performance.** John's flows must complete on a 2GB Tecno over 3G: budgets are ≤200KB per dashboard load, ≤3 taps for cash collection, offline queue when the network drops.
3. **Kiswahili is first-class.** Default by profile preference, persisted, and written the way Kenyans speak it — not textbook translation (§6).
4. **Honest software.** Simulated money is labeled simulated (`footer.sandboxNotice`, `mpesa.sandboxNotice`); future modules say so plainly (`misc.phaseNotice`). Nothing fakes being live.
5. **Numbers are never baked into copy.** Amounts, counts and names arrive as `{vars}` from `t()` — money pre-formatted via `formatKes()` (D-007).
6. **Write for a bad day.** Errors and empty states are calm, specific, and offer the next step ("Retry", "Check your connection"). Nobody is scolded for a failed transaction.

---

## 3. Phase 1 journeys (numbered)

All journeys start from the role's demo login (phone-number entry, D-005). Screen names below map to the SPA components the Frontend Engineer builds; copy keys referenced as `key.name` exist in `src/lib/i18n/en.ts`.

### 3.1 Tenant pays rent via M-Pesa (Amina)

1. Amina signs in with her phone number; NEST opens on **Tenant Home** showing `tenant.yourRent`, `tenant.currentBalance`, `tenant.nextPaymentDue` (amount + date).
2. She taps **Pay now** (`tenant.payNow`) → **M-Pesa Pay screen**.
3. `mpesa.enterAmount` is **pre-filled** with `tenant.amountDue`; `mpesa.phoneNumber` pre-filled from her profile (editable).
4. She taps **Send payment request** (`mpesa.sendPaymentRequest`). NEST creates the STK push (Daraja sim, D-006) and shows `mpesa.checkYourPhone` + `mpesa.enterPin` with a `mpesa.waitingForConfirmation` state (polling).
5. She enters her M-Pesa PIN **on her own phone**, exactly as in real life.
6. Callback arrives (simulated): payment reconciled against her charges **oldest-first** (`money.ts splitWaterfall`), status → `status.completed`.
7. Success: `mpesa.paymentConfirmed` + instant receipt (`receipt.receiptNumber`, `NEST-R-######`) + notification `notifications.receiptIssued`. Balance and arrears update on the spot.
8. From the receipt she can `receipt.shareReceipt` or copy it.
- **Failure paths:** PIN wrong/cancelled on the phone → `mpesa.transactionCancelled` (offer Retry). Push times out or fails → `mpesa.paymentFailed` (offer Retry; nothing was charged). Payment lands with a bad account reference → routed to the unmatched queue (§3.4), tenant sees `mpesa.waitingForConfirmation` resolve to a "needs review" state — never a silent loss.
- **Trust moment:** step 7 — receipt on screen before she locks the phone.

### 3.2 Caretaker records a cash collection (John)

1. John signs in; **Caretaker Home** shows `caretaker.todaysCollections`, `caretaker.expectedToday`, `caretaker.collectedToday` and his unit list.
2. Tenant Mary hands him KSh 5,000 cash for a part-payment. He taps **Record cash** (`caretaker.recordCash`).
3. He picks unit **B4** from his `caretaker.units` list (tenant name + `caretaker.perUnitBalance` shown per row — no typing names).
4. He types **5000** into `caretaker.amountReceived` (whole shillings; `money.partiallyPaid` will result). Optional `caretaker.noteOptional`, e.g. "part payment".
5. He taps **Save** (`common.save`).
6. Success: `caretaker.collectionRecorded` toast + receipt number issued instantly; Mary gets a receipt notification (`notifications.receiptIssued`, simulated SMS, D-013); `caretaker.recentCollections` and today's totals update.
7. **No network?** The record is `offline.queuedForSync` locally and John still sees his receipt number — it syncs via idempotent `clientRef` when connectivity returns (D-012), with `offline.itemsSynced` confirmation.
- **Trust moment:** step 6 — the receipt exists the second the money changes hands, with John's name on it as recorder (`PaymentDto.recordedByName`).

### 3.3 Caretaker requests M-Pesa from a tenant (John)

1. At B7's door, the tenant says "nitatuma M-Pesa sasa hivi" (I'll send M-Pesa right now). John opens **Caretaker Home** → taps the unit → **Request M-Pesa** (`caretaker.requestMpesa`).
2. `mpesa.enterAmount` (defaulted to that unit's `caretaker.perUnitBalance`) and `mpesa.phoneNumber` (defaulted to the tenant's phone on file).
3. He taps **Send payment request** (`mpesa.sendPaymentRequest`) — the STK push goes to the **tenant's** phone, not John's.
4. The tenant enters their PIN on their own phone; John sees `mpesa.waitingForConfirmation`, then `mpesa.paymentConfirmed` on his screen.
5. The payment reconciles automatically; the tenant gets the receipt; John's `caretaker.recentCollections` and the landlord's dashboard update.
- **Failure paths:** wrong number typed → `errors.phoneLooksWrong` before sending. Tenant ignores the push → timeout with `mpesa.transactionCancelled` and a clean Retry. Tenant pays but with wrong/absent reference → unmatched queue (§3.4) — the money is never lost, it waits for review.
- **Trust moment:** step 4 — both parties watch the same confirmation, so nobody's word is needed.

### 3.4 Landlord reviews arrears and matches an unmatched payment (Grace)

1. Sunday evening: Grace signs in on her phone. **Landlord Home** shows `landlord.collectedThisMonth` vs `landlord.expectedThisMonth`, `landlord.collectionRate`, `landlord.arrears`, `landlord.tenantsInArrears`, `landlord.occupancyRate`, `landlord.vacantUnits` — and a badge: `landlord.unmatchedPayments`: 1.
2. She opens **Arrears**: rows per tenancy with balance, `status.inArrears`, months behind, oldest unpaid period. She taps `landlord.sendReminder` on the worst one → `landlord.reminderSent` (simulated SMS, D-013).
3. She taps the **Unmatched payments** badge → queue (`unmatched.title`) shows one payment: KSh 8,500, `unmatched.paidFrom` 07•• (payer phone), `unmatched.unknownAccountRef` "B4A", `unmatched.needsReview` (`status.unmatched`).
4. She taps **Match to tenant** (`unmatched.matchToTenant`) → `unmatched.selectTenant` (search by name/unit/phone) → picks **Baraka Court B4 — Amina Hassan**.
5. Confirmation: `unmatched.matchedSuccessfully`. The payment allocates to B4's outstanding charges oldest-first, a receipt is issued and notified, the queue clears, `status.matched`.
6. Back on Home the badge reads 0; arrears and `landlord.recentPayments` reflect the matched payment.
- **Failure paths:** she matches the **wrong** tenant — Phase 1 guardrail: confirm screen shows amount + selected tenant before Save; mismatch correction is a documented Phase 2 reversing entry (D-008), not an edit.
- **Trust moment:** step 5 — the money was never "lost", just waiting, and the record shows who resolved it.

### 3.5 Tenant views receipts (Amina)

1. The landlord's caretaker asks about November. Amina opens NEST → **Receipts** (`tenant.yourReceipts`).
2. List of receipts, newest first (amount, date, `receipt.receiptNumber`); empty state `empty.receipts` if none.
3. She taps a receipt → full detail: `receipt.receivedFrom`, `receipt.forUnit`, `receipt.property`, `receipt.accountReference`, `receipt.paymentMethod`, and the allocation breakdown (`tenant.chargesBreakdown` / `receipt.allocatedTo` — rent, water, garbage by period).
4. She taps `receipt.shareReceipt` → WhatsApp share sheet, or copies the details (`common.copy` → `common.copied`).
- **Trust moment:** step 3 — the receipt shows *what the payment covered*, not just an amount.

### 3.6 Agent — Phase 1 (honest scope)

1. Peter signs in → **Portfolio overview**: `landlord.properties` list with units/occupancy per plot, `landlord.occupancyRate` across the portfolio.
2. Any deeper tool (owner reports, cross-plot arrears) shows `misc.phaseNotice`: "This module arrives in {phase}" — parameterized by the real phase name, never a dead button or fake screen.
3. He can switch language (`misc.language`) and sign out (`common.signOut`).

### 3.7 Guard — Phase 1 (honest scope)

1. David signs in (phone number he memorizes; large keypad) → assigned property view.
2. His home shows `misc.phaseNotice` for the visitor log/incidents module. The copy is plain Kiswahili and states exactly what is coming, so trust starts before the feature exists.
3. He stays reachable for notifications in later phases; nothing auto-downloads on his bundle.

---

## 4. Usability test scripts (Phase 1)

**Method for all sessions:** moderated, in-person, participant's own phone (or the Tecno Spark 10 loaner for caretaker/guard realism). Throttle to slow 3G where noted. Moderate in the participant's stronger language; the app language starts as *their* default. Sessions ~25 minutes. Never say the names of buttons — read tasks as written.

**Scoring:** each task = 2 (clean, no assist), 1 (hesitation, self-recovered), 0 (moderator assist or fail). Record time-on-task, misclicks, and every spontaneous quote about trust/money/language. **Pass bar per script: mean ≥1.5 with no task failing for >1 of 5 participants, plus all comprehension questions answered correctly.**

### 4.1 Caretaker — John profile (loaner Tecno Spark 10, 3G throttled)

| # | Task (read aloud) | Success criteria |
|---|---|---|
| 1 | "Sign in with your phone number." | Enters number, taps sign in, reaches Caretaker Home unaided; ≤60s |
| 2 | "How much are you expected to collect today, and how much have you collected so far?" | Reads both numbers from home screen correctly, unprompted |
| 3 | "Mary from B4 just gave you 5,000 in cash. Record it." | Record cash → picks B4 (not by typing) → amount 5000 → Save; sees receipt number; ≤3 taps past home; ≤90s |
| 4 | "Show me what you just recorded, and prove when it happened." | Finds it in recent collections; receipt shows a time and his name; says something confirming the proof |
| 5 | "The tenant in B7 wants to pay by M-Pesa right now. Ask them for the money." | Requests M-Pesa for B7, amount defaults sensibly, sends to the tenant's number; sees the waiting state; ≤90s |
| 6 | (Moderator quietly enables airplane-mode) "Another tenant gives you 2,000 cash. Record it." | Records offline without panic; sees the queued/Will-sync indication; collection appears with a receipt number |
| 7 | "Switch the app to Kiswahili." | Finds the language switch; entire UI re-renders; ≤30s |
| 8 | "You're done for the day. Sign out." | Signs out cleanly |

**Comprehension check:** "If a tenant says they paid you and you disagree, what would you show them?" — must reference the receipt/record. **Kiswahili check:** "Soma hii kwa sauti" — reads `caretaker.todaysCollections` ("Makusanyo ya leo") aloud naturally.

### 4.2 Tenant — Amina profile (own phone, 3G throttled on payment task)

| # | Task | Success criteria |
|---|---|---|
| 1 | "Sign in with your phone number." | Reaches Tenant Home; ≤45s |
| 2 | "How much rent do you owe right now, and when is it due?" | Reads balance and due date correctly from home; notices if it says "all caught up" |
| 3 | "Pay your rent with M-Pesa." | Pay now → amount/phone pre-filled → sends request → knows to check her own phone for the PIN prompt; reaches confirmation; ≤2 min |
| 4 | (Moderator pre-arranges a cancelled simulation) "You changed your mind and cancelled on your phone. What does the app show, and what do you do?" | Sees 'transaction cancelled' without alarm; finds Retry; does not re-pay blindly |
| 5 | "Your landlord asks for November's receipt. Show them." | Opens receipts, taps the right one, identifies amount/date/receipt number; shares or copies it; ≤60s |
| 6 | "What exactly does your rent money cover?" | Opens charges breakdown and names rent/water/garbage items correctly |
| 7 | "Switch the app to Kiswahili, then switch it back." | Completes both; UI fully re-renders each time; ≤45s |
| 8 | "Sign out." | Signs out cleanly |

**Comprehension check:** "After you paid, how long did the receipt take, and where does it live?" — expects instant + on her phone.

### 4.3 Landlord — Grace profile (own phone)

| # | Task | Success criteria |
|---|---|---|
| 1 | "Sign in." | Reaches Landlord Home; ≤45s |
| 2 | "How much have you collected this month against what you expected?" | Reads both KPIs and the collection rate; states the month label unprompted ("this month") |
| 3 | "Who owes you the most, and by how many months?" | Opens arrears, identifies the worst row + months behind; ≤45s |
| 4 | "Send that tenant a reminder." | Sends reminder; sees 'reminder sent' confirmation |
| 5 | "One payment came in without a name on it. Review it." | Finds the unmatched badge/queue; reads the amount and payer phone; ≤60s |
| 6 | "Attach it to the right tenant." | Match to tenant → selects the correct tenancy → sees 'matched successfully'; queue clears; ≤90s |
| 7 | "Prove to me the money was never lost." | Explains the review state in her own words ("it was waiting for review") |
| 8 | "Sign out." | Signs out cleanly |

**Comprehension check:** "Which number on this screen would you check first every Sunday?" — any of collected/expected/arrears with a reason.

### 4.4 Agent — Peter profile (laptop or phone)

| # | Task | Success criteria |
|---|---|---|
| 1 | "Sign in." | Reaches portfolio overview; ≤45s |
| 2 | "How many plots do you manage, and how full are they overall?" | Reads property count and occupancy rate correctly |
| 3 | "You want the cross-plot arrears report. What do you find?" | Encounters the phase notice; states accurately what is coming and does not hunt further; ≤60s |
| 4 | "Is the app being honest about what's simulated?" | Points to a sandbox/simulation notice and can paraphrase it |
| 5 | "Switch the language to Kiswahili, then sign out." | Both complete; ≤45s |

### 4.5 Guard — David profile (loaner Itel-class 1GB phone)

| # | Task | Success criteria |
|---|---|---|
| 1 | "Sign in with your phone number." | Uses the keypad; reaches his home; ≤90s (allowed one memory prompt on the number itself, not the UI) |
| 2 | "Which plot are you assigned to?" | Reads property name correctly |
| 3 | "What does the app say about the visitor book?" | Reads/paraphrases the phase notice in Kiswahili accurately |
| 4 | "Switch the app to English, then back to Kiswahili." | Completes both; taps are sure; ≤60s |
| 5 | "Sign out." | Signs out cleanly |

**Extra observation for David:** any lag, crash, or layout break on 1GB RAM is an automatic script failure regardless of task scores.

---

## 5. Voice & copy rules

1. **Plain, short, warm.** Grade-school sentence length. "Something went wrong" beats "An unexpected error occurred". Warm ≠ chatty: no exclamation marks, no jokes about money.
2. **Sentence case** for labels and buttons ("Pay now", not "Pay Now").
3. **Numbers never live in copy.** `t("offline.itemsSynced", { count: 3 })` — amounts arrive via `formatKes()` (D-007). No "KSh 8,500" in any dictionary value.
4. **English words Kenyans use in Kiswahili stay English:** M-Pesa, PIN, SIM, app, sandbox, sync context. We translate concepts, not vocabulary showing off.
5. **Kenyan spellings/registers:** "namba ya simu" (not "namba ya simu" vs "numba" — pick standard), "pesa taslimu" for cash, "muamala" for transaction (bank-app familiar).
6. **Errors offer the next step.** Every error string pairs with Retry or Back in the UI.
7. **Honesty strings are features, not disclaimers.** `mpesa.sandboxNotice`, `footer.sandboxNotice`, `misc.phaseNotice` must be visually present, not footnote-grey.

---

## 6. Approved Kiswahili glossary

Single source of truth for terminology. Changing a term here requires the same-commit update to `sw.ts`.

| English | Kiswahili | Notes |
|---|---|---|
| Pay rent | Lipa kodi | Verb-first, as spoken |
| Receipt / receipt number | Risiti / namba ya risiti | Universal in Kenya |
| Today's collections | Makusanyo ya leo | Collections = makusanyo |
| Arrears (singular/plural) | Deni / madeni | Row-level: "ana deni" |
| Balance | Salio | Bank-app familiar |
| Amount | Kiasi | |
| Cash | Pesa taslimu | |
| Vacant | Tupu | "Chumba tupu" |
| Occupied | Imekaliwa | |
| Partial / partially paid | Sehemu / imelipwa kwa sehemu | |
| Monthly rent | Kodi ya kila mwezi | |
| Deposit | Amana | |
| Water / garbage | Maji / takataka | |
| Property | Mali | |
| Unit (room) | Chumba | Plural: vyumba |
| Landlord | Mmiliki | |
| Agent | Wakala | |
| Caretaker | Msimamizi | Kenyan daily word; "caretaker" also common |
| Tenant | Mpangaji | Plural: wapangaji |
| Guard | Mlinzi | |
| Phone number | Namba ya simu | |
| Transaction | Muamala | M-Pesa app familiar |
| Notifications | Taarifa | |
| Reminder | Kumbusho | |
| Sign in / sign out | Ingia / toka | |
| Save / cancel / retry | Hifadhi / ghairi / jaribu tena | |
| Share / copy / copied | Shiriki / nakili / imenakiliwa | |
| Loading | Inapakia… | |
| Settings | Mipangilio | |
| Language | Lugha | |
| Online / offline | Mtandaoni / nje ya mtandao | Banner: "hakuna mtandao" |
| Install app | Sakinisha app | |
| Dark / light mode | Hali ya giza / hali ya mwanga | |
| Phase (roadmap) | Awamu | For phase notices |
| Expected / collected | Inayotarajiwa / yaliyokusanywa | |
| Unmatched | Haitambuliwi / haijaunganishwa | Payment queue context |
| Paid from | Imelipwa kutoka | + payer phone |
| English / Kiswahili | Kiingereza / Kiswahili | Language names |

---

## 7. i18n integration guide (for the Frontend Engineer)

```tsx
import { I18nProvider, useI18n, LANGS, type Lang } from "@/lib/i18n"
// also exported: en, sw, type TranslationKey

// 1) Wrap the app ONCE (inside the session gate, outside any screen):
<I18nProvider initialLang={session.profile.language}>  // optional; "en" default
  <App />
</I18nProvider>

// 2) Anywhere below the provider:
const { lang, setLang, t } = useI18n()

t("app.name")                                   // "NEST"
t("common.greeting", { name: "John" })          // "Hi, John" / "Habari, John"
t("offline.itemsSynced", { count: 3 })          // "3 items synced" / "3 vitu vimetumwa"
t("misc.phaseNotice", { phase: "Phase 2" })     // "This module arrives in Phase 2"

// 3) Language switcher (native labels, `value` is the Lang):
LANGS.map(({ value, label }) => ...)            // [{ value: "en", label: "English" },
                                                //  { value: "sw", label: "Kiswahili" }]
```

**Rules that keep this layer healthy:**

- Keys are flat dotted strings grouped by domain (`app.`, `role.`, `login.`, `nav.`, `common.`, `money.`, `status.`, `landlord.`, `caretaker.`, `tenant.`, `mpesa.`, `receipt.`, `unmatched.`, `notifications.`, `empty.`, `errors.`, `offline.`, `misc.`, `footer.`, `lang.`). Full catalog in `en.ts` — **every Phase 1 string the UI needs is already there; request additions, don't fork.**
- Adding a key: add to `en.ts` **and** `sw.ts` in the same commit — `Record<TranslationKey, string>` fails the type-check otherwise.
- Money: format with `formatKes(minor)` from `@/lib/money` *before* interpolation. Never build "KSh …" strings by hand.
- `t()` is synchronous and pure — safe in render; values are looked up from the active dictionary with an English fallback.
- Persistence is handled: `localStorage["nest-lang"]` + `document.documentElement.lang` sync are built into the provider. Hydration-safe: first render uses `initialLang ?? "en"`, stored preference applies in an effect.
