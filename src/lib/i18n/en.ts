/**
 * NEST — English dictionary (source of truth for all UI copy).
 *
 * RULES for every key added here:
 * 1. Flat, dotted keys, grouped by screen/domain — no nesting.
 * 2. Values are plain, short, warm, specific. No numbers baked into copy:
 *    amounts, counts, names and dates are ALWAYS interpolated via `{name}`
 *    placeholders (see `t()` in src/lib/i18n/index.tsx).
 * 3. Every key MUST get a Kiswahili twin in src/lib/i18n/sw.ts in the same
 *    commit — `Record<TranslationKey, string>` fails the build otherwise.
 * 4. Money strings are pre-formatted with src/lib/money.ts `formatKes()`
 *    before being passed in as vars — never store currency in the dict.
 * 5. Approved terminology lives in docs/design/personas-journeys.md §6.
 *
 * This file is authored by the UX Researcher & Content Designer (Task 1-b).
 * It is production code the Frontend Engineer imports, not documentation.
 * Every Phase 1 string the UI needs is in here — request additions, don't fork.
 */

export const en = {
  // ----- App ----------------------------------------------------------------
  "app.name": "NEST",
  "app.tagline": "Rent records you can trust",

  // ----- Footer -------------------------------------------------------------
  "footer.sandbox": "Sandbox demo — payments are simulated",
  "footer.madeFor": "Made for Kenyan rentals",

  // ----- Roles (names + one-line descriptions) ------------------------------
  "role.landlord": "Landlord",
  "role.agent": "Agent",
  "role.caretaker": "Caretaker",
  "role.tenant": "Tenant",
  "role.guard": "Guard",
  "roleDesc.landlord": "Track income, arrears and vacancies",
  "roleDesc.agent": "Watch over a portfolio of plots",
  "roleDesc.caretaker": "Collect rent and handle the day-to-day",
  "roleDesc.tenant": "Pay rent and keep your receipts",
  "roleDesc.guard": "Log visitors and incidents",

  // ----- Login --------------------------------------------------------------
  "login.heading": "Welcome to NEST",
  "login.phoneLabel": "Phone number",
  "login.phonePlaceholder": "Enter your phone number",
  "login.signIn": "Sign in",
  "login.signingIn": "Signing you in…",
  "login.demoNote": "Demo mode — pick an account below to walk in as that person.",

  // ----- Language names (native labels, never translated) -------------------
  "lang.en": "English",
  "lang.sw": "Kiswahili",

  // ----- Navigation ---------------------------------------------------------
  "nav.home": "Home",
  "nav.arrears": "Arrears",
  "nav.payments": "Payments",
  "nav.receipts": "Receipts",
  "nav.properties": "Properties",
  "nav.units": "Units",
  "nav.notifications": "Notifications",
  "nav.more": "More",

  // ----- Common -------------------------------------------------------------
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.retry": "Retry",
  "common.back": "Back",
  "common.done": "Done",
  "common.today": "Today",
  "common.thisMonth": "This month",
  "common.amount": "Amount",
  "common.total": "Total",
  "common.date": "Date",
  "common.status": "Status",
  "common.search": "Search",
  "common.share": "Share",
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.loading": "Loading…",
  "common.signOut": "Sign out",
  "common.installApp": "Install app",
  "common.greeting": "Hi, {name}",

  // ----- Money labels -------------------------------------------------------
  "money.rent": "Rent",
  "money.water": "Water",
  "money.garbage": "Garbage",
  "money.deposit": "Deposit",
  "money.balance": "Balance",
  "money.paid": "Paid",
  "money.unpaid": "Unpaid",
  "money.partiallyPaid": "Partially paid",
  "money.monthlyRent": "Monthly rent",
  "money.expected": "Expected",
  "money.collected": "Collected",

  // ----- Statuses -----------------------------------------------------------
  "status.paid": "Paid",
  "status.unpaid": "Unpaid",
  "status.partial": "Partial",
  "status.vacant": "Vacant",
  "status.occupied": "Occupied",
  "status.onNotice": "On notice",
  "status.active": "Active",
  "status.inArrears": "In arrears",
  "status.unmatched": "Unmatched",
  "status.matched": "Matched",
  "status.completed": "Completed",
  "status.pending": "Pending",
  "status.queued": "Queued",

  // ----- Landlord dashboard & KPIs ------------------------------------------
  "landlord.collectedThisMonth": "Collected this month",
  "landlord.expectedThisMonth": "Expected this month",
  "landlord.collectionRate": "Collection rate",
  "landlord.arrears": "Arrears",
  "landlord.tenantsInArrears": "Tenants in arrears",
  "landlord.occupancyRate": "Occupancy rate",
  "landlord.vacantUnits": "Vacant units",
  "landlord.unmatchedPayments": "Unmatched payments",
  "landlord.recentPayments": "Recent payments",
  "landlord.vacancies": "Vacancies",
  "landlord.properties": "Properties",
  "landlord.sendReminder": "Send reminder",
  "landlord.reminderSent": "Reminder sent",

  // ----- Caretaker ----------------------------------------------------------
  "caretaker.todaysCollections": "Today's collections",
  "caretaker.expectedToday": "Expected today",
  "caretaker.collectedToday": "Collected today",
  "caretaker.recordCash": "Record cash",
  "caretaker.requestMpesa": "Request M-Pesa",
  "caretaker.units": "Units",
  "caretaker.perUnitBalance": "Balance",
  "caretaker.recentCollections": "Recent collections",
  "caretaker.collectionRecorded": "Collection recorded",
  "caretaker.noteOptional": "Note (optional)",
  "caretaker.amountReceived": "Amount received",

  // ----- Tenant -------------------------------------------------------------
  "tenant.yourRent": "Your rent",
  "tenant.currentBalance": "Current balance",
  "tenant.nextPaymentDue": "Next payment due",
  "tenant.payNow": "Pay now",
  "tenant.payViaMpesa": "Pay via M-Pesa",
  "tenant.yourReceipts": "Your receipts",
  "tenant.chargesBreakdown": "Charges breakdown",
  "tenant.depositHeld": "Deposit held",
  "tenant.allCaughtUp": "You're all caught up",
  "tenant.amountDue": "Amount due",

  // ----- M-Pesa flow --------------------------------------------------------
  "mpesa.enterAmount": "Enter amount",
  "mpesa.phoneNumber": "Phone number",
  "mpesa.sendPaymentRequest": "Send payment request",
  "mpesa.checkYourPhone": "Check your phone",
  "mpesa.enterPin": "Enter your M-Pesa PIN on your phone",
  "mpesa.waitingForConfirmation": "Waiting for confirmation",
  "mpesa.paymentConfirmed": "Payment confirmed",
  "mpesa.paymentFailed": "Payment failed",
  "mpesa.transactionCancelled": "Transaction cancelled",
  "mpesa.sandboxNotice": "Sandbox simulation — no real money moves",

  // ----- Receipts -----------------------------------------------------------
  "receipt.receipt": "Receipt",
  "receipt.receiptNumber": "Receipt number",
  "receipt.receivedFrom": "Received from",
  "receipt.forUnit": "Unit",
  "receipt.property": "Property",
  "receipt.accountReference": "Account reference",
  "receipt.paymentMethod": "Payment method",
  "receipt.allocatedTo": "Allocated to",
  "receipt.shareReceipt": "Share receipt",

  // ----- Unmatched payments queue -------------------------------------------
  "unmatched.title": "Unmatched payments",
  "unmatched.needsReview": "Needs review",
  "unmatched.matchToTenant": "Match to tenant",
  "unmatched.selectTenant": "Select tenant",
  "unmatched.matchedSuccessfully": "Matched successfully",
  "unmatched.unknownAccountRef": "Unknown account reference",
  "unmatched.paidFrom": "Paid from",

  // ----- Notifications ------------------------------------------------------
  "notifications.title": "Notifications",
  "notifications.receiptIssued": "Receipt issued",
  "notifications.arrearsReminder": "Arrears reminder",
  "notifications.paymentNeedsReview": "Payment needs review",
  "notifications.empty": "No notifications yet",

  // ----- Empty states -------------------------------------------------------
  "empty.payments": "No payments yet",
  "empty.arrears": "No arrears — all caught up",
  "empty.receipts": "No receipts yet",
  "empty.unmatched": "No unmatched payments",
  "empty.units": "No units",

  // ----- Errors -------------------------------------------------------------
  "errors.somethingWrong": "Something went wrong",
  "errors.couldNotLoad": "Could not load data",
  "errors.network": "Network error",
  "errors.checkConnection": "Check your connection and try again",
  "errors.invalidAmount": "Enter a valid amount",
  "errors.phoneLooksWrong": "That phone number doesn't look right",
  "errors.notAuthorized": "You're not allowed to do that",
  "errors.sessionExpired": "Your session has expired — please sign in again",

  // ----- Offline / sync -----------------------------------------------------
  "offline.youAreOffline": "You're offline",
  "offline.willSync": "Will sync when back online",
  "offline.queuedForSync": "Queued for sync",
  "offline.syncComplete": "Sync complete",
  "offline.itemsSynced": "{count} items synced",

  // ----- Misc / settings ----------------------------------------------------
  "misc.offline": "Offline",
  "misc.online": "Online",
  "misc.darkMode": "Dark mode",
  "misc.lightMode": "Light mode",
  "misc.language": "Language",
  "misc.settings": "Settings",
  "misc.phaseNotice": "This module arrives in {phase}",
} as const

/** Every dotted key above, as a literal union. sw.ts must cover all of them. */
export type TranslationKey = keyof typeof en
