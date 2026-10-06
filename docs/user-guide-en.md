# NEST User Guide — English

A plain guide to using NEST for landlords, caretakers and tenants. Everything
here works in the demo exactly as described — payments in the demo are
simulated (sandbox), and the app tells you so.

Demo names used in this guide: Baraka Court (the property), Amina Barasa
(landlord), John Mwangi (caretaker), Grace Wanjiku (tenant).

## Getting started

1. Open NEST. The sign-in screen shows a card for each role.
2. Tap your card to sign in as that person. (You can also type a phone number
   from the table at the bottom of this guide.)
3. You land on your home screen. Everything you need is one or two taps away.

**Language.** Open the More sheet (top right) and switch between English and
Kiswahili at any time. Your choice is remembered.

**Light and dark.** In the same More sheet you can switch between light and
dark appearance. On a phone with a dark mode setting, NEST looks good either
way.

**Signing out.** More sheet, then Sign out. You can install NEST on your
phone's home screen from the same sheet — it works like an app.

## For tenants

### See what you owe

Your home screen shows your balance for this month at the top, in big
numbers. Below it, each charge is listed separately — rent, water, garbage —
with what is due and what you have already paid. Older months are listed in
the same list, oldest first.

### Pay with M-Pesa

1. Tap **Pay now**.
2. Enter the amount. The amount due is shown to help you; you can pay part
   of it or pay extra — NEST handles all three.
3. Check the phone number the M-Pesa prompt will go to (it defaults to your
   number on file) and tap confirm.
4. Your phone buzzes with the M-Pesa request. **Enter your M-Pesa PIN on
   your phone** to approve it.
5. NEST updates itself automatically within a few seconds and your receipt
   appears on screen.

**About the demo:** this build runs in sandbox mode, so no real money moves.
Where a real M-Pesa prompt would appear, the screen shows a clearly marked
"Sandbox simulation" confirm button — tapping it stands in for entering your
PIN. Everything after that (matching, receipt, notification) is the real
pipeline. In live mode, that button does not exist; only Safaricom's real
confirmation does.

If the payment fails or you cancel it, NEST says so and offers **Retry**.
Nothing is charged and nothing is recorded until M-Pesa confirms.

### Your receipts

Every completed payment gets a receipt with a number like `NEST-R-000004`.
Open **Receipts** to see them all. A receipt shows the amount, the date, your
name, your unit, and exactly which charges the money settled (for example,
rent KSh 8,500, water KSh 300, garbage KSh 200). Use **Share** to send it to
your landlord on WhatsApp or SMS — the receipt is your proof, and it works
even where you only have a screenshot.

### Notifications

The bell icon shows messages sent to you — for example, a receipt
confirmation, or a reminder when rent falls past due.

## For caretakers

### Today's collections

Your home screen opens with **Today's collections** — how much money has
come in since midnight (M-Pesa and cash together) — and the month's progress
against what the plot expects.

### Record a cash payment in 3 taps

1. Tap **Record cash**.
2. Pick the tenant (the list shows name, unit and current balance; you can
   search).
3. Enter the amount and tap confirm.

That's it. The money is recorded, the tenant's charges are settled oldest
first (rent before service charges), and the receipt number follows
immediately. You can share the receipt with the tenant from the confirmation
screen — the receipt protects you as much as the landlord.

### What happens when there is no network

The collection is saved on your phone the moment you confirm — you do not
wait for a signal. When the phone is back online, NEST syncs it
automatically, and the receipt number is issued then. Even if the phone
tries to send it twice, the tenant is only ever credited once. The offline
badge in the More sheet shows how many collections are waiting to sync.

### Ask a tenant to pay by M-Pesa

Tap **Request M-Pesa**, pick the tenant, enter the amount and confirm. An
M-Pesa prompt is pushed to the tenant's phone — they approve it with their
PIN, and the payment lands in NEST by itself. You can watch the status on
screen until it succeeds or fails.

### Arrears

The arrears list shows every tenant who owes money, how much, and for how
long — oldest balances first. From a tenant's row you can send them a
reminder.

## For landlords

### The numbers that matter

Your home screen shows this month at a glance: expected vs collected, the
collection rate, how much is in arrears and how many tenants that is,
occupancy, and today's collections. One glance, before the first call of
the day.

### Unmatched payments (and matching them)

Sometimes money arrives that NEST cannot automatically attach to a tenant —
for example, someone paid through the paybill but the reference did not
match. This money is never lost: it waits in the **unmatched** queue and
your home screen flags it.

To resolve one:

1. Open the unmatched queue (the amber alert on your home screen, or the
   payments ledger filtered to "Unmatched").
2. Check the amount and the phone number that paid.
3. Tap **Match payment** and pick the tenant it belongs to.
4. Confirm — NEST shows you the match once more before it commits.

The payment is allocated to that tenant's charges oldest first, the receipt
is issued, and the tenant is notified. The confirm step exists because a
match is a money decision; NEST never guesses for you.

### Arrears and reminders

The arrears screen groups tenants by how far behind they are. From any row,
tap **Send reminder** — the tenant gets an SMS and an in-app notification
with their balance and their M-Pesa account reference.

### Vacancies

Vacant units appear on your home screen with their rent, so an empty room is
a number, not a surprise.

### Payments ledger and receipts

The payments tab is the full ledger — every M-Pesa and cash payment, with
filters by status. Any completed payment opens its receipt with the full
allocation breakdown.

## Trust and receipts

- Every shilling that enters NEST is matched to **a tenant, a unit and a
  specific charge** — or it waits in the unmatched queue until a person
  matches it. Money is never loosely "received".
- Money records are **append-only**: a payment is never edited and never
  deleted after it is recorded. If something needs correcting, a reversing
  entry is made — the original stays, with its history.
- An amount is either paid or it is not: NEST recomputes what each charge
  has received from the payments against it, every time. Nothing is typed in
  by hand.
- Behind every sign-in and every money action, NEST writes an **audit
  record**: who did it, what they did, when. Records you can defend.

## Questions people ask

**I paid but no M-Pesa prompt came to my phone.**
Check that your phone has signal and that the number shown on the confirm
screen is yours. Cancel and try again — nothing is charged until M-Pesa
confirms.

**My payment failed or I cancelled the prompt.**
Nothing was recorded. Tap **Retry** on the screen and approve the prompt
when it comes.

**I recorded cash while offline. Did it count?**
Yes. It is saved on the phone and syncs automatically when the network
returns; the receipt number is issued on sync. The tenant is never credited
twice, even if the phone sends it more than once.

**Why did the app sign me out?**
Your session had expired (it lasts 30 days). Sign in again from the cards —
your data is untouched; NEST simply requires you to prove who you are.

**What is "sandbox simulation"?**
This build simulates the M-Pesa leg — no real money moves. The accounting,
receipts and matching are the real system. In live mode the simulation
controls disappear.

**I paid more than I owed.**
The extra is kept as your credit and shows as a negative balance; it counts
against your next charges.

## Demo phone numbers

Sign in as any of these by typing the number on the sign-in screen (or tap
the cards).

| Phone | Person | Role |
|---|---|---|
| +254711000001 | Amina Barasa | Landlord |
| +254711000002 | John Mwangi | Caretaker |
| +254711000003 | Grace Wanjiku | Tenant |
| +254711000004 | David Otieno | Tenant (arrears) |
| +254711000005 | Sarah Achieng | Tenant (partial payment) |
| +254711000006 | Peter Njoroge | Guard (Phase 3 preview) |
| +254711000007 | Wanjiku Kamau | Agent (Phase 4 preview) |
