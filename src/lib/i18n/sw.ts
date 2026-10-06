/**
 * NEST — Kiswahili dictionary (Kenyan conversational register).
 *
 * This is NOT word-by-word translation. It is copy written for how Kenyans
 * actually talk about rent: "Lipa Kodi", "Risiti", "Makusanyo ya leo",
 * "pesa taslimu", "namba ya simu". Words Kenyans keep in English (M-Pesa,
 * PIN, app, sandbox) stay English — we translate concepts, not vocabulary.
 *
 * The approved glossary lives in docs/design/personas-journeys.md §6 —
 * if you change a term here, update the glossary in the same commit.
 *
 * The `Record<TranslationKey, string>` type is the completeness contract:
 * every key in en.ts must appear here, no extras, no gaps. TypeScript fails
 * the build otherwise — add EN and SW keys together, never separately.
 *
 * Grammar note: `{count}` placeholders cannot inflect Swahili noun classes
 * (vitu viwili vs. kitu kimoja); we use class-neutral phrasing and accept
 * "Vitu 3 vimetumwa" as the documented trade-off, per personas-journeys.md §5.
 */

import type { TranslationKey } from "./en"

export const sw: Record<TranslationKey, string> = {
  // ----- App ----------------------------------------------------------------
  "app.name": "NEST",
  "app.tagline": "Rekodi za kodi unazoweza kuamini",

  // ----- Footer -------------------------------------------------------------
  "footer.sandbox": "Demo ya sandbox — malipo ni ya mazoezi",
  "footer.madeFor": "Imetengenezwa kwa nyumba za Kenya",

  // ----- Roles --------------------------------------------------------------
  "role.landlord": "Mmiliki",
  "role.agent": "Wakala",
  "role.caretaker": "Msimamizi",
  "role.tenant": "Mpangaji",
  "role.guard": "Mlinzi",
  "roleDesc.landlord": "Fuatilia mapato, madeni na vyumba vilivyo wazi",
  "roleDesc.agent": "Simamia mali zote kwa mahali pamoja",
  "roleDesc.caretaker": "Kusanya kodi na kufuatilia kazi za kila siku",
  "roleDesc.tenant": "Lipa kodi na hifadhi risiti zako",
  "roleDesc.guard": "Sajili wageni na matukio",

  // ----- Login --------------------------------------------------------------
  "login.heading": "Karibu NEST",
  "login.phoneLabel": "Namba ya simu",
  "login.phonePlaceholder": "Weka namba yako ya simu",
  "login.signIn": "Ingia",
  "login.signingIn": "Tunakuingiza…",
  "login.demoNote": "Hii ni demo — chagua akaunti hapa chini kuingia kama yule mtu.",

  // ----- Language names (native labels, never translated) -------------------
  "lang.en": "Kiingereza",
  "lang.sw": "Kiswahili",

  // ----- Navigation ---------------------------------------------------------
  "nav.home": "Nyumbani",
  "nav.arrears": "Madeni",
  "nav.payments": "Malipo",
  "nav.receipts": "Risiti",
  "nav.properties": "Mali",
  "nav.units": "Vyumba",
  "nav.notifications": "Taarifa",
  "nav.more": "Zaidi",

  // ----- Common -------------------------------------------------------------
  "common.save": "Hifadhi",
  "common.cancel": "Ghairi",
  "common.retry": "Jaribu tena",
  "common.back": "Rudi",
  "common.done": "Tayari",
  "common.today": "Leo",
  "common.thisMonth": "Mwezi huu",
  "common.amount": "Kiasi",
  "common.total": "Jumla",
  "common.date": "Tarehe",
  "common.status": "Hali",
  "common.search": "Tafuta",
  "common.share": "Shiriki",
  "common.copy": "Nakili",
  "common.copied": "Imenakiliwa",
  "common.loading": "Inapakia…",
  "common.signOut": "Toka",
  "common.installApp": "Sakinisha app",
  "common.greeting": "Habari, {name}",

  // ----- Money labels -------------------------------------------------------
  "money.rent": "Kodi",
  "money.water": "Maji",
  "money.garbage": "Takataka",
  "money.deposit": "Amana",
  "money.balance": "Salio",
  "money.paid": "Imelipwa",
  "money.unpaid": "Haijalipwa",
  "money.partiallyPaid": "Imelipwa kwa sehemu",
  "money.monthlyRent": "Kodi ya kila mwezi",
  "money.expected": "Inayotarajiwa",
  "money.collected": "Makusanyo",

  // ----- Statuses -----------------------------------------------------------
  "status.paid": "Imelipwa",
  "status.unpaid": "Haijalipwa",
  "status.partial": "Sehemu",
  "status.vacant": "Tupu",
  "status.occupied": "Imekaliwa",
  "status.onNotice": "Imepewa notisi",
  "status.active": "Amilifu",
  "status.inArrears": "Ana deni",
  "status.unmatched": "Haikutambuliwa",
  "status.matched": "Imeunganishwa",
  "status.completed": "Imekamilika",
  "status.pending": "Inasubiri",
  "status.queued": "Iko kwenye foleni",

  // ----- Landlord dashboard & KPIs ------------------------------------------
  "landlord.collectedThisMonth": "Makusanyo ya mwezi huu",
  "landlord.expectedThisMonth": "Inayotarajiwa mwezi huu",
  "landlord.collectionRate": "Kiwango cha ukusanyaji",
  "landlord.arrears": "Madeni",
  "landlord.tenantsInArrears": "Wapangaji wenye madeni",
  "landlord.occupancyRate": "Asilimia ya vyumba vilivyokaliwa",
  "landlord.vacantUnits": "Vyumba tupu",
  "landlord.unmatchedPayments": "Malipo yasiyotambuliwa",
  "landlord.recentPayments": "Malipo ya hivi karibuni",
  "landlord.vacancies": "Vyumba vilivyo wazi",
  "landlord.properties": "Mali",
  "landlord.sendReminder": "Tuma kumbusho",
  "landlord.reminderSent": "Kumbusho limetumwa",

  // ----- Caretaker ----------------------------------------------------------
  "caretaker.todaysCollections": "Makusanyo ya leo",
  "caretaker.expectedToday": "Inayotarajiwa leo",
  "caretaker.collectedToday": "Yaliyokusanywa leo",
  "caretaker.recordCash": "Rekodi pesa taslimu",
  "caretaker.requestMpesa": "Omba M-Pesa",
  "caretaker.units": "Vyumba",
  "caretaker.perUnitBalance": "Salio",
  "caretaker.recentCollections": "Makusanyo ya hivi karibuni",
  "caretaker.collectionRecorded": "Mkusanyo umerekodiwa",
  "caretaker.noteOptional": "Maelezo (hiari)",
  "caretaker.amountReceived": "Kiasi kilichopokelewa",

  // ----- Tenant -------------------------------------------------------------
  "tenant.yourRent": "Kodi yako",
  "tenant.currentBalance": "Salio lako la sasa",
  "tenant.nextPaymentDue": "Malipo yanayofuata",
  "tenant.payNow": "Lipa sasa",
  "tenant.payViaMpesa": "Lipa kwa M-Pesa",
  "tenant.yourReceipts": "Risiti zako",
  "tenant.chargesBreakdown": "Maelezo ya gharama",
  "tenant.depositHeld": "Amana iliyoshikiliwa",
  "tenant.allCaughtUp": "Umelipa yote",
  "tenant.amountDue": "Kiasi cha kulipa",

  // ----- M-Pesa flow --------------------------------------------------------
  "mpesa.enterAmount": "Weka kiasi",
  "mpesa.phoneNumber": "Namba ya simu",
  "mpesa.sendPaymentRequest": "Tuma ombi la malipo",
  "mpesa.checkYourPhone": "Angalia simu yako",
  "mpesa.enterPin": "Weka PIN ya M-Pesa kwenye simu yako",
  "mpesa.waitingForConfirmation": "Tunasubiri uthibitisho",
  "mpesa.paymentConfirmed": "Malipo yamethibitishwa",
  "mpesa.paymentFailed": "Malipo yameshindikana",
  "mpesa.transactionCancelled": "Muamala umeghairiwa",
  "mpesa.sandboxNotice": "Hii ni sandbox — malipo ni ya mazoezi, hakuna pesa halisi inayotembea",

  // ----- Receipts -----------------------------------------------------------
  "receipt.receipt": "Risiti",
  "receipt.receiptNumber": "Namba ya risiti",
  "receipt.receivedFrom": "Imepokelewa kutoka",
  "receipt.forUnit": "Chumba",
  "receipt.property": "Mali",
  "receipt.accountReference": "Namba ya akaunti",
  "receipt.paymentMethod": "Njia ya malipo",
  "receipt.allocatedTo": "Imegawiwa kwa",
  "receipt.shareReceipt": "Shiriki risiti",

  // ----- Unmatched payments queue -------------------------------------------
  "unmatched.title": "Malipo yasiyotambuliwa",
  "unmatched.needsReview": "Inahitaji uhakiki",
  "unmatched.matchToTenant": "Unganisha na mpangaji",
  "unmatched.selectTenant": "Chagua mpangaji",
  "unmatched.matchedSuccessfully": "Imeunganishwa",
  "unmatched.unknownAccountRef": "Namba ya akaunti haijulikani",
  "unmatched.paidFrom": "Imelipwa kutoka",

  // ----- Notifications ------------------------------------------------------
  "notifications.title": "Taarifa",
  "notifications.receiptIssued": "Risiti imetolewa",
  "notifications.arrearsReminder": "Kumbusho la deni",
  "notifications.paymentNeedsReview": "Malipo yanahitaji uhakiki",
  "notifications.empty": "Hakuna taarifa bado",

  // ----- Empty states -------------------------------------------------------
  "empty.payments": "Hakuna malipo bado",
  "empty.arrears": "Hakuna madeni — kila kitu kiko sawa",
  "empty.receipts": "Hakuna risiti bado",
  "empty.unmatched": "Hakuna malipo yasiyotambuliwa",
  "empty.units": "Hakuna vyumba",

  // ----- Errors -------------------------------------------------------------
  "errors.somethingWrong": "Samahani, kuna hitilafu",
  "errors.couldNotLoad": "Taarifa hazikuweza kupakiwa",
  "errors.network": "Kuna shida ya mtandao",
  "errors.checkConnection": "Angalia muunganisho wako, kisha ujaribu tena",
  "errors.invalidAmount": "Weka kiasi sahihi",
  "errors.phoneLooksWrong": "Namba hii ya simu hainaonekana sahihi",
  "errors.notAuthorized": "Hauruhusiwi kufanya hilo",
  "errors.sessionExpired": "Kikao chako kimeisha — tafadhali ingia tena",

  // ----- Offline / sync -----------------------------------------------------
  "offline.youAreOffline": "Hakuna mtandao",
  "offline.willSync": "Kila kitu kitatumwa ukirudi mtandaoni",
  "offline.queuedForSync": "Iko kwenye foleni ya kutumwa",
  "offline.syncComplete": "Kila kitu kimetumwa",
  "offline.itemsSynced": "Vitu {count} vimetumwa",

  // ----- Misc / settings ----------------------------------------------------
  "misc.offline": "Nje ya mtandao",
  "misc.online": "Mtandaoni",
  "misc.darkMode": "Hali ya giza",
  "misc.lightMode": "Hali ya mwanga",
  "misc.language": "Lugha",
  "misc.settings": "Mipangilio",
  "misc.phaseNotice": "Sehemu hii itafika katika {phase}",
  "misc.nextPhase": "Awamu ifuatayo",

  // ----- Arrears (aging buckets, reminders) [2-b] ---------------------------
  "arrears.sendReminder": "Tuma kumbusho",
  "arrears.sent": "Imetumwa",
  "arrears.reminderSent": "Kumbusho limetumwa kwa {name}",
  "arrears.monthBehind": "Mwezi 1 nyuma",
  "arrears.monthsBehind": "Nyuma kwa miezi {count}",
  "arrears.viewAll": "Ona zote",
  "arrears.tenantsBehind": "Wapangaji {count} wana deni",
  "arrears.aging.current": "Mwezi huu",
  "arrears.aging.1_30": "Siku 1–30",
  "arrears.aging.31_60": "Siku 31–60",
  "arrears.aging.61plus": "Siku 61+",

  // ----- Cash collection flow (S-06) ----------------------------------------
  "cash.confirm": "Thibitisha",

  // ----- M-Pesa flow extras (S-07/S-09) --------------------------------------
  "mpesa.waiting": "Tunasubiri uthibitisho…",
  "mpesa.failed": "Ombi la M-Pesa halikufaulu",
  "mpesa.reason": "Sababu: {reason}",
  "mpesa.stillWaiting": "Bado tunasubiri — rudi kidogo baadaye",
  "mpesa.askTenantPin": "Mwombe {name} aingize PIN ya M-Pesa kwenye simu yake.",
  "mpesa.cancelRequest": "Ghairi ombi",

  // ----- Unmatched queue extras (S-04) ---------------------------------------
  "unmatched.review": "Kagua",
  "unmatched.matchPayment": "Unganisha malipo",
  "unmatched.matchConfirm": "Thibitisha uunganishaji",

  // ----- Tenant extras (S-08/S-09) -------------------------------------------
  "tenant.openCharges": "Gharama hazijalipwa",
  "tenant.allPaidUp": "Kodi yote imelipwa",
  "tenant.confirmPayment": "Thibitisha malipo",
  "tenant.receiptReady": "Risiti iko tayari",

  // ----- Phase notices (S-12/S-13) -------------------------------------------
  "phase.agentNotice": "Zana za wakala — orodha za nyumba, usajili wa wapangaji na ripoti — zitafika katika {phase}.",
  "phase.guardNotice": "Kumbukumbu za wageni na ripoti za matukio zitafika katika {phase}.",
  "guard.visitorLog": "Kumbukumbu za wageni",
  "guard.incidents": "Matukio",
  "guard.visitorLogDesc": "Maingizo ya kila siku",
  "guard.incidentsDesc": "Ripoti na ufuatiliaji",

  // ----- Offline queue (S-06) ------------------------------------------------
  "offline.queued": "Imehifadhiwa — itatumwa ukirudi mtandaoni.",

  // ----- Common extras -------------------------------------------------------
  "common.viewAll": "Ona zote",
  "common.viewReceipt": "Angalia risiti",
  "common.continue": "Endelea",
  "common.stepOf": "Hatua {current} kati ya {total}",
  "common.searchTenantUnit": "Tafuta mpangaji au chumba…",
  "common.ofUnits": "Vyumba {occupied} kati ya {total}",
  "common.filterAll": "Zote",

  // ----- Notifications day groups (S-14) --------------------------------------
  "notifications.today": "Leo",
  "notifications.yesterday": "Jana",

  // ----- Receipt extras (S-10) -------------------------------------------------
  "receipt.linkCopied": "Maelezo ya risiti yamenakiliwa",

  // ----- More / settings sheet (S-15) -----------------------------------------
  "more.theme": "Muonekano",
  "more.themeLight": "Mwanga",
  "more.themeDark": "Giza",

  // ----- Statuses added for lists ----------------------------------------------
  "status.sent": "Imetumwa",
  "status.failed": "Imeshindikana",
  "status.reversed": "Imerekebishwa",

  // ----- Payment source badges -------------------------------------------------
  "source.mpesa": "M-Pesa",
  "source.cash": "Pesa taslimu",
  "source.bank": "Benki",

  // ----- Unit types ------------------------------------------------------------
  "unitType.BEDSITTER": "Bedsitter",
  "unitType.SINGLE": "Single",
  "unitType.ONE_BR": "One bedroom",
  "unitType.TWO_BR": "Two bedroom",
  "unitType.THREE_BR": "Three bedroom",
  "unitType.SHOP": "Duka",

  // ----- Property captions -------------------------------------------------------
  "property.unitsSummary": "Vyumba {units} · {occupied} vimekaliwa · {vacant} tupu",
  "property.caretaker": "Msimamizi: {name}",

  // ----- PWA -----------------------------------------------------------------------
  "pwa.installed": "Imesakinishwa",

  // ----- Extra errors ---------------------------------------------------------------
  "errors.needOnline": "Unahitaji mtandao kufanya hili",

  // ----- Nav (caretaker collections tab, S-02) ----------------------------------------
  "nav.collections": "Makusanyo",

  // ----- Empty states ---------------------------------------------------------------
  "empty.properties": "Hakuna mali bado",

  // ----- Frontend additions (Task 2-b) ------------------------------------------
  "mpesa.simulateConfirm": "Onyesha uthibitisho wa M-Pesa (sandbox)",
  "cash.partialAllowed": "Malipo ya sehemu yanaruhusiwa",
  "cash.overpaymentCredited": "Kiasi kinachozidi salio kinaekwa kama krediti",
  "more.signOutConfirm": "Toka kwenye NEST?",
  "more.signOutDescription": "Unaweza kuingia tena wakati wowote kwa namba yako ya simu.",
  "channel.sms": "SMS",
  "channel.whatsapp": "WhatsApp",
  "channel.inApp": "Ndani ya app",
  "cash.receiptFollows": "Risiti itatumwa ukirudi mtandaoni",
  "arrears.monthsBehindShort": "Miezi nyuma",
  "arrears.bucketTenants": "Wapangaji {count}",
}
