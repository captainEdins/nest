/**
 * NEST — Kiswahili dictionary (Kenyan conversational register).
 *
 * This is NOT word-by-word translation. It is copy written for how Kenyans
 * actually talk about rent: "Lipa Kodi", "Risiti", "Makusanyo ya leo",
 * "pesa taslimu", "namba ya simu". Approved glossary lives in
 * docs/PERSONAS-JOURNEYS.md §6 — if you change a term here, update the
 * glossary in the same commit.
 *
 * The `Record<TranslationKey, string>` type is the completeness contract:
 * every key in en.ts must appear here, no extras, no gaps. TypeScript will
 * fail the build otherwise.
 */

import type { TranslationKey } from "./en"

export const sw: Record<TranslationKey, string> = {
  // ----- App ---------------------------------------------------------------
  "app.name": "NEST",
  "app.tagline": "Rekodi za kodi unazoweza kuamini",

  // ----- Roles -------------------------------------------------------------
  "role.landlord": "Mmiliki",
  "role.agent": "Wakala",
  "role.caretaker": "Msimamizi",
  "role.tenant": "Mpangaji",
  "role.guard": "Mlinzi",
  "roleDesc.landlord": "Fuatilia mapato, madeni na vyumba vilivyo wazi",
  "roleDesc.agent": "Simamia mali nyingi kwa urahisi",
  "roleDesc.caretaker": "Kusanya kodi na kufuatilia kazi za kila siku",
  "roleDesc.tenant": "Lipa kodi na hifadhi risiti zako",
  "roleDesc.guard": "Sajili wageni na matukio",

  // ----- Login -------------------------------------------------------------
  "login.heading": "Karibu NEST",
  "login.phoneLabel": "Namba ya simu",
  "login.signIn": "Ingia",
  "login.signingIn": "Tunakuingiza…",
  "login.demoProfilesNote": "Hii ni demo — chagua akaunti hapa chini kuingia kama mtumiaji yeyote.",
  "login.languageSwitch": "Lugha",
  "login.signOut": "Toka",

  // ----- Navigation --------------------------------------------------------
  "nav.home": "Nyumbani",
  "nav.arrears": "Madeni",
  "nav.payments": "Malipo",
  "nav.receipts": "Risiti",
  "nav.properties": "Mali",
  "nav.units": "Vyumba",
  "nav.notifications": "Taarifa",
  "nav.more": "Zaidi",

  // ----- Common ------------------------------------------------------------
  "common.save": "Hifadhi",
  "common.cancel": "Ghairi",
  "common.retry": "Jaribu tena",
  "common.loading": "Inapakia…",
  "common.offlineBanner": "Hakuna mtandao — kile unachorekodi kitatumwa ukirudi mtandaoni.",
  "common.back": "Rudi",
  "common.done": "Tayari",
  "common.today": "Leo",
  "common.thisMonth": "Mwezi huu",
  "common.amount": "Kiasi",
  "common.total": "Jumla",
  "common.date": "Tarehe",
  "common.status": "Hali",
  "common.search": "Tafuta",
  "common.greeting": "Habari, {name}",

  // ----- Money labels ------------------------------------------------------
  "money.rent": "Kodi",
  "money.water": "Maji",
  "money.garbage": "Takataka",
  "money.deposit": "Amana",
  "money.balance": "Salio",
  "money.paid": "Imelipwa",
  "money.unpaid": "Haijalipwa",
  "money.partial": "Imelipwa sehemu",

  // ----- Statuses ----------------------------------------------------------
  "status.paid": "Imelipwa",
  "status.unpaid": "Haijalipwa",
  "status.partial": "Imelipwa sehemu",
  "status.vacant": "Wazi",
  "status.occupied": "Imekaliwa",
  "status.arrears": "Ana deni",
  "status.unmatched": "Haikutambuliwa",
  "status.completed": "Imekamilika",
  "status.pending": "Inasubiri",

  // ----- Landlord dashboard ------------------------------------------------
  "landlord.collectedThisMonth": "Makusanyo ya mwezi huu",
  "landlord.expected": "Inatarajiwa",
  "landlord.collectionRate": "Kiwango cha ukusanyaji",
  "landlord.arrears": "Madeni",
  "landlord.tenantsInArrears": "Wapangaji wenye madeni",
  "landlord.occupancy": "Vyumba vilivyokaliwa",
  "landlord.vacancies": "Vyumba wazi",
  "landlord.unmatchedPayments": "Malipo yasiyotambuliwa",
  "landlord.recentPayments": "Malipo ya hivi karibuni",
  "landlord.vacanciesList": "Vyumba vilivyo wazi",

  // ----- Caretaker dashboard -----------------------------------------------
  "caretaker.todaysTasks": "Kazi za leo",
  "caretaker.todaysCollections": "Makusanyo ya leo",
  "caretaker.collectCash": "Kusanya pesa taslimu",
  "caretaker.requestMpesa": "Omba M-Pesa",
  "caretaker.units": "Vyumba",
  "caretaker.arrearsPerUnit": "Madeni kwa kila chumba",

  // ----- Tenant dashboard --------------------------------------------------
  "tenant.yourRent": "Kodi yako",
  "tenant.balance": "Salio",
  "tenant.nextDue": "Kodi ijayo",
  "tenant.payNow": "Lipa sasa",
  "tenant.yourReceipts": "Risiti zako",
  "tenant.payViaMpesa": "Lipa kwa M-Pesa",
  "tenant.confirmPayment": "Thibitisha malipo",
  "tenant.paymentSent": "Malipo yametumwa",
  "tenant.waitingMpesa": "Tunasubiri uthibitisho wa M-Pesa",
  "tenant.paymentConfirmed": "Malipo yamethibitishwa",
  "tenant.receiptReady": "Risiti iko tayari",

  // ----- M-Pesa flow -------------------------------------------------------
  "mpesa.enterAmount": "Weka kiasi",
  "mpesa.phoneNumber": "Namba ya simu ya M-Pesa",
  "mpesa.sendStkPush": "Tuma ombi la M-Pesa",
  "mpesa.checkYourPhone": "Angalia simu yako",
  "mpesa.enterPin": "Weka PIN ya M-Pesa kwenye simu yako",
  "mpesa.sandboxNotice": "Hii ni demo ya sandbox — hakuna pesa halisi inayotembea.",

  // ----- Cash collection ---------------------------------------------------
  "cash.recordCash": "Rekodi pesa taslimu",
  "cash.amountReceived": "Kiasi kilichopokelewa",
  "cash.note": "Maelezo (hiari)",
  "cash.collectionRecorded": "Mkusanyo umerekodiwa",
  "cash.receiptNumber": "Namba ya risiti",

  // ----- Receipts ----------------------------------------------------------
  "receipt.receipt": "Risiti",
  "receipt.receiptNo": "Namba ya risiti",
  "receipt.receivedFrom": "Imepokelewa kutoka",
  "receipt.forUnit": "Chumba",
  "receipt.property": "Mali",
  "receipt.accountRef": "Namba ya akaunti",
  "receipt.shareReceipt": "Shiriki risiti",

  // ----- Unmatched payments queue ------------------------------------------
  "unmatched.title": "Malipo yasiyotambuliwa",
  "unmatched.matchToTenant": "Unganisha na mpangaji",
  "unmatched.matchedSuccessfully": "Imeunganishwa",
  "unmatched.unknownAccountRef": "Namba ya akaunti haijulikani",

  // ----- Notifications -----------------------------------------------------
  "notifications.title": "Taarifa",
  "notifications.receiptIssued": "Risiti imetolewa",
  "notifications.arrearsReminder": "Kumbusho la deni",
  "notifications.paymentNeedsReview": "Malipo yanahitaji kupitiwa",

  // ----- Empty states ------------------------------------------------------
  "empty.payments": "Hakuna malipo bado",
  "empty.arrears": "Hakuna deni — kila kitu kiko sawa",
  "empty.receipts": "Hakuna risiti bado",
  "empty.notifications": "Hakuna taarifa bado",

  // ----- Errors ------------------------------------------------------------
  "errors.somethingWrong": "Kuna hitilafu",
  "errors.couldNotLoad": "Haikuweza kupakiwa — jaribu tena",
  "errors.network": "Kuna shida ya mtandao — angalia muunganisho wako",
  "errors.invalidAmount": "Weka kiasi sahihi",
  "errors.phoneLooksWrong": "Namba hii ya simu hainaonekana sahihi",
  "errors.notAuthorized": "Hauruhusiwi kufanya hilo",

  // ----- PWA ---------------------------------------------------------------
  "pwa.installApp": "Sakinisha app",
  "pwa.installed": "Imesakinishwa",

  // ----- Language names ----------------------------------------------------
  "lang.en": "Kiingereza",
  "lang.sw": "Kiswahili",

  // ----- Footer ------------------------------------------------------------
  "footer.madeForKenyanRentals": "Imetengenezwa kwa nyumba za Kenya",
  "footer.sandboxNotice": "Demo ya sandbox — malipo yanajoripotiwa, hakuna pesa halisi",
}
