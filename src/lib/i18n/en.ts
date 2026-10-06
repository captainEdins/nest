/**
 * NEST — English dictionary (source of truth for all UI copy).
 *
 * RULES for every key added here:
 * 1. Flat, dotted keys, grouped by screen/domain — no nesting.
 * 2. Values are plain, short, warm, specific. No numbers baked into copy:
 *    amounts, counts, names and dates are ALWAYS interpolated via `{name}`
 *    placeholders (see `t()` in src/lib/i18n/index.tsx).
 * 3. Every key MUST get a Kiswahili twin in src/lib/i18n/sw.ts the same
 *    commit — `Record<TranslationKey, string>` fails the build otherwise.
 * 4. Money strings are pre-formatted with src/lib/money.ts `formatKes()`
 *    before being passed in as vars — never store currency in the dict.
 *
 * This file is authored by the UX Researcher & Content Designer (Task 1-b).
 * It is production code the Frontend Engineer imports, not documentation.
 */

export const en = {
  // ----- App ---------------------------------------------------------------
  "app.name": "NEST",
  "app.tagline": "Rent records you can trust",

  // ----- Roles -------------------------------------------------------------
  "role.landlord": "Landlord",
  "role.agent": "Agent",
  "role.caretaker": "Caretaker",
  "role.tenant": "Tenant",
  "role.guard": "Security guard",
  "roleDesc.landlord": "Track income, arrears and vacancies",
  "roleDesc.agent": "Watch over a portfolio of plots",
  "roleDesc.caretaker": "Collect rent and handle day-to-day",
  "roleDesc.tenant": "Pay rent and keep your receipts",
  "roleDesc.guard": "Log visitors and incidents",

  // ----- Login -------------------------------------------------------------
  "login.heading": "Welcome to NEST",
  "login.phoneLabel": "Phone number",
  "login.signIn": "Sign in",
  "login.signingIn": "Signing you in…",
  "login.demoProfilesNote": "Demo mode — pick a profile below to walk in as that person.",
  "login.languageSwitch": "Language",
  "login.signOut": "Sign out",

  // ----- Navigation --------------------------------------------------------
  "nav.home": "Home",
  "nav.arrears": "Arrears",
  "nav.payments": "Payments",
  "nav.receipts": "Receipts",
  "nav.properties": "Properties",
  "nav.units": "Units",
  "nav.notifications": "Notifications",
  "nav.more": "More",

  // ----- Common ------------------------------------------------------------
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.retry": "Retry",
  "common.loading": "Loading…",
  "common.offlineBanner": "You're offline — what you record will send when you're back on.",
  "common.back": "Back",
  "common.done": "Done",
  "common.today": "Today",
  "common.thisMonth": "This month",
  "common.amount": "Amount",
  "common.total": "Total",
  "common.date": "Date",
  "common.status": "Status",
  "common.search": "Search",
  "common.greeting": "Hi, {name}",

  // ----- Money labels ------------------------------------------------------
  "money.rent": "Rent",
  "money.water": "Water",
  "money.garbage": "Garbage",
  "money.deposit": "Deposit",
  "money.balance": "Balance",
  "money.paid": "Paid",
  "money.unpaid": "Unpaid",
  "money.partial": "Partial",

  // ----- Statuses ----------------------------------------------------------
  "status.paid": "Paid",
  "status.unpaid": "Unpaid",
  "status.partial": "Partial",
  "status.vacant": "Vacant",
  "status.occupied": "Occupied",
  "status.arrears": "In arrears",
  "status.unmatched": "Unmatched",
  "status.completed": "Completed",
  "status.pending": "Pending",

  // ----- Landlord dashboard ------------------------------------------------
  "landlord.collectedThisMonth": "Collected this month",
  "landlord.expected": "Expected",
  "landlord.collectionRate": "Collection rate",
  "landlord.arrears": "Arrears",
  "landlord.tenantsInArrears": "Tenants in arrears",
  "landlord.occupancy": "Occupancy",
  "landlord.vacancies": "Vacancies",
  "landlord.unmatchedPayments": "Unmatched payments",
  "landlord.recentPayments": "Recent payments",
  "landlord.vacanciesList": "Vacant units",

  // ----- Caretaker dashboard -----------------------------------------------
  "caretaker.todaysTasks": "Today's tasks",
  "caretaker.todaysCollections": "Today's collections",
  "caretaker.collectCash": "Collect cash",
  "caretaker.requestMpesa": "Request M-Pesa",
  "caretaker.units": "Units",
  "caretaker.arrearsPerUnit": "Arrears by unit",

  // ----- Tenant dashboard --------------------------------------------------
  "tenant.yourRent": "Your rent",
  "tenant.balance": "Balance",
  "tenant.nextDue": "Next due",
  "tenant.payNow": "Pay now",
  "tenant.yourReceipts": "Your receipts",
  "tenant.payViaMpesa": "Pay via M-Pesa",
  "tenant.confirmPayment": "Confirm payment",
  "tenant.paymentSent": "Payment sent",
  "tenant.waitingMpesa": "Waiting for M-Pesa confirmation",
  "tenant.paymentConfirmed": "Payment confirmed",
  "tenant.receiptReady": "Receipt ready",

  // ----- M-Pesa flow -------------------------------------------------------
  "mpesa.enterAmount": "Enter amount",
  "mpesa.phoneNumber": "M-Pesa phone number",
  "mpesa.sendStkPush": "Send M-Pesa request",
  "mpesa.checkYourPhone": "Check your phone",
  "mpesa.enterPin": "Enter your M-Pesa PIN on your phone",
  "mpesa.sandboxNotice": "Sandbox demo — no real money moves.",

  // ----- Cash collection ---------------------------------------------------
  "cash.recordCash": "Record cash",
  "cash.amountReceived": "Amount received",
  "cash.note": "Note (optional)",
  "cash.collectionRecorded": "Cash collection recorded",
  "cash.receiptNumber": "Receipt no",

  // ----- Receipts ----------------------------------------------------------
  "receipt.receipt": "Receipt",
  "receipt.receiptNo": "Receipt no",
  "receipt.receivedFrom": "Received from",
  "receipt.forUnit": "Unit",
  "receipt.property": "Property",
  "receipt.accountRef": "Account ref",
  "receipt.shareReceipt": "Share receipt",

  // ----- Unmatched payments queue ------------------------------------------
  "unmatched.title": "Unmatched payments",
  "unmatched.matchToTenant": "Match to tenant",
  "unmatched.matchedSuccessfully": "Matched successfully",
  "unmatched.unknownAccountRef": "Unknown account reference",

  // ----- Notifications -----------------------------------------------------
  "notifications.title": "Notifications",
  "notifications.receiptIssued": "Receipt issued",
  "notifications.arrearsReminder": "Arrears reminder",
  "notifications.paymentNeedsReview": "Payment needs review",

  // ----- Empty states ------------------------------------------------------
  "empty.payments": "No payments yet",
  "empty.arrears": "No arrears — all caught up",
  "empty.receipts": "No receipts yet",
  "empty.notifications": "No notifications yet",

  // ----- Errors ------------------------------------------------------------
  "errors.somethingWrong": "Something went wrong",
  "errors.couldNotLoad": "Could not load this — try again",
  "errors.network": "Network error — check your connection",
  "errors.invalidAmount": "Enter a valid amount",
  "errors.phoneLooksWrong": "That phone number doesn't look right",
  "errors.notAuthorized": "You're not allowed to do that",

  // ----- PWA ---------------------------------------------------------------
  "pwa.installApp": "Install app",
  "pwa.installed": "Installed",

  // ----- Language names ----------------------------------------------------
  "lang.en": "English",
  "lang.sw": "Kiswahili",

  // ----- Footer ------------------------------------------------------------
  "footer.madeForKenyanRentals": "Made for Kenyan rentals",
  "footer.sandboxNotice": "Sandbox demo — payments are simulated, no real money moves",
}

/** Every dotted key above, as a literal union. sw.ts must cover all of them. */
export type TranslationKey = keyof typeof en
