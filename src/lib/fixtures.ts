/**
 * NEST — typed demo fixtures (Baraka Court).
 *
 * Purpose: let the frontend build and verify every screen BEFORE the backend
 * routes land (parallel work, task 2-a). The api client (src/lib/api.ts) uses
 * these ONLY when `NEXT_PUBLIC_DEV_FIXTURES === "1"` AND the real fetch fails
 * (network error) or 404s (route not implemented yet). Real responses always
 * win. The flag must NEVER be committed in .env — it is a build-time dev gate.
 *
 * Data mirrors prisma/seed.ts (the "seeded numbers"):
 *   7 profiles · 1 property (Baraka Court) · 5 units · 3 tenancies
 *   18 charges (prev + current month) · Grace paid-in-full (NEST-R-000001),
 *   Sarah partial (NEST-R-000002), David in arrears KSh 31,000 · 1 UNMATCHED.
 *
 * The store is mutable in memory: cash collections, STK confirmations, payment
 * matches and reminders all update it, so query invalidation + refetch (which
 * re-runs fixtureRespond) reflects the change — the demo flows are live.
 * The demo session is persisted in sessionStorage ("nest-fixture-session").
 */

import { format, subMonths, addMonths, setDate } from "date-fns";
import { splitWaterfall } from "./money";
import type {
  AgentOverviewDto,
  ApplicationSource,
  ApplicationStatus,
  ArrearsRowDto,
  CaretakerOverviewDto,
  CashCollectionRequest,
  ChargeDto,
  ChargeKind,
  GuardOverviewDto,
  GuardShiftDto,
  IncidentReportDto,
  LandlordOverviewDto,
  ListingApplicationDto,
  ListingDetailDto,
  ListingDto,
  ListingStatus,
  NotificationDto,
  PaymentAllocationDto,
  PaymentDto,
  PaymentSource,
  ProfileDto,
  PropertyDto,
  ReceiptDto,
  Role,
  SecurityDigestDto,
  SessionDto,
  StkPushResponseDto,
  TenantOverviewDto,
  UnitDto,
  VisitorLogDto,
} from "./types";

/** Build gate — read once at module load (Next inlines it at build time). */
export const DEV_FIXTURES = process.env.NEXT_PUBLIC_DEV_FIXTURES === "1";

/** Session shape the fixture login persists client-side. */
const SESSION_KEY = "nest-fixture-session";

// ---------------------------------------------------------------------------
// Local wire types shared with src/lib/api.ts (not in types.ts yet)
// ---------------------------------------------------------------------------

/** Tenancy list item for pickers (match flow, cash collection, STK request). */
export interface TenancySummaryDto {
  tenancyId: string
  tenantName: string
  tenantPhone: string
  unitLabel: string
  propertyName: string
  accountRef: string
  balanceMinor: number
}

/** M-Pesa STK status polling response. */
/** Wire contract of GET /api/mpesa/status (mirrors the engine's StkStatus). */
export interface MpesaStatusDto {
  status: "INITIATED" | "PUSHED" | "SUCCESS" | "FAILED"
  resultCode: string | null
  resultDesc: string | null
  paymentId: string | null
  receiptNo: string | null
}

// ---------------------------------------------------------------------------
// Clock / calendar helpers (fixtures always show "current month" truthfully)
// ---------------------------------------------------------------------------

const now = new Date()
const CUR = format(now, "yyyy-MM")
const PREV = format(subMonths(now, 1), "yyyy-MM")
const NEXT = format(addMonths(now, 1), "yyyy-MM")

function periodDueDate(period: string): Date {
  const [y, m] = period.split("-").map(Number)
  return setDate(new Date(y, m - 1, 1), 5)
}

function daysAgoIso(days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  d.setHours(10, 32, 0, 0)
  return d.toISOString()
}

function monthsAgoIso(months: number): string {
  return subMonths(now, months).toISOString()
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const WATER_MINOR = 30_000
const GARBAGE_MINOR = 20_000

interface FxProfile extends ProfileDto {
  id: string
}
const PROFILES: FxProfile[] = [
  { id: "p-amina", phone: "+254711000001", fullName: "Amina Barasa", role: "LANDLORD", language: "en" },
  { id: "p-mwangi", phone: "+254711000002", fullName: "John Mwangi", role: "CARETAKER", language: "en" },
  { id: "p-grace", phone: "+254711000003", fullName: "Grace Wanjiku", role: "TENANT", language: "en" },
  { id: "p-david", phone: "+254711000004", fullName: "David Otieno", role: "TENANT", language: "en" },
  { id: "p-sarah", phone: "+254711000005", fullName: "Sarah Achieng", role: "TENANT", language: "en" },
  { id: "p-peter", phone: "+254711000006", fullName: "Peter Njoroge", role: "GUARD", language: "sw" },
  { id: "p-wanjiku", phone: "+254711000007", fullName: "Wanjiku Kamau", role: "AGENT", language: "en" },
]

/** The five demo identities offered on the role-select screen (S-01). */
const DEMO_ROLE_ORDER: Role[] = ["LANDLORD", "CARETAKER", "TENANT", "AGENT", "GUARD"]
const DEMO_PROFILE_IDS = ["p-amina", "p-mwangi", "p-grace", "p-wanjiku", "p-peter"]

const PROPERTY: PropertyDto = {
  id: "prop-baraka",
  name: "Baraka Court",
  location: "Kahawa Wendani, Nairobi",
  landlordId: "p-amina",
  caretakerId: "p-mwangi",
  unitCount: 5,
  occupiedCount: 3,
}

type FxUnit = UnitDto
const UNITS: FxUnit[] = [
  {
    id: "u-a1", propertyId: PROPERTY.id, propertyName: PROPERTY.name, label: "A1", type: "ONE_BR",
    status: "OCCUPIED", rentAmountMinor: 1_500_000, depositAmountMinor: 1_500_000,
    tenancy: {
      id: "t-a1", tenantId: "p-david", tenantName: "David Otieno", tenantPhone: "+254711000004",
      accountRef: "NEST-A1-1001", monthlyRentMinor: 1_500_000, startDate: monthsAgoIso(4),
      balanceMinor: 3_100_000,
    },
  },
  {
    id: "u-a2", propertyId: PROPERTY.id, propertyName: PROPERTY.name, label: "A2", type: "SHOP",
    status: "OCCUPIED", rentAmountMinor: 1_200_000, depositAmountMinor: 1_200_000,
    tenancy: {
      id: "t-a2", tenantId: "p-sarah", tenantName: "Sarah Achieng", tenantPhone: "+254711000005",
      accountRef: "NEST-A2-1002", monthlyRentMinor: 1_200_000, startDate: monthsAgoIso(4),
      balanceMinor: 1_900_000,
    },
  },
  {
    id: "u-b1", propertyId: PROPERTY.id, propertyName: PROPERTY.name, label: "B1", type: "BEDSITTER",
    status: "VACANT", rentAmountMinor: 850_000, depositAmountMinor: 850_000, tenancy: null,
  },
  {
    id: "u-b2", propertyId: PROPERTY.id, propertyName: PROPERTY.name, label: "B2", type: "BEDSITTER",
    status: "OCCUPIED", rentAmountMinor: 850_000, depositAmountMinor: 850_000,
    tenancy: {
      id: "t-b2", tenantId: "p-grace", tenantName: "Grace Wanjiku", tenantPhone: "+254711000003",
      accountRef: "NEST-B2-1003", monthlyRentMinor: 850_000, startDate: monthsAgoIso(4),
      balanceMinor: 900_000,
    },
  },
  {
    id: "u-b3", propertyId: PROPERTY.id, propertyName: PROPERTY.name, label: "B3", type: "TWO_BR",
    status: "VACANT", rentAmountMinor: 2_500_000, depositAmountMinor: 2_500_000, tenancy: null,
  },
]

const TENANCY_META = [
  { tenancyId: "t-a1", tenantId: "p-david", unitId: "u-a1", unitLabel: "A1", accountRef: "NEST-A1-1001", monthlyRentMinor: 1_500_000, depositHeldMinor: 1_500_000, tenantName: "David Otieno", tenantPhone: "+254711000004" },
  { tenancyId: "t-a2", tenantId: "p-sarah", unitId: "u-a2", unitLabel: "A2", accountRef: "NEST-A2-1002", monthlyRentMinor: 1_200_000, depositHeldMinor: 1_200_000, tenantName: "Sarah Achieng", tenantPhone: "+254711000005" },
  { tenancyId: "t-b2", tenantId: "p-grace", unitId: "u-b2", unitLabel: "B2", accountRef: "NEST-B2-1003", monthlyRentMinor: 850_000, depositHeldMinor: 850_000, tenantName: "Grace Wanjiku", tenantPhone: "+254711000003" },
]

const CHARGE_KINDS: ChargeKind[] = ["RENT", "WATER", "GARBAGE"]

type FxCharge = ChargeDto
const CHARGES: FxCharge[] = []
{
  let cid = 1
  for (const t of TENANCY_META) {
    for (const period of [PREV, CUR]) {
      for (const kind of CHARGE_KINDS) {
        const amountMinor = kind === "RENT" ? t.monthlyRentMinor : kind === "WATER" ? WATER_MINOR : GARBAGE_MINOR
        CHARGES.push({
          id: `c-${cid++}`,
          tenancyId: t.tenancyId,
          kind,
          periodMonth: period,
          dueDate: periodDueDate(period).toISOString(),
          amountMinor,
          paidMinor: 0,
          status: "UNPAID",
          unitLabel: t.unitLabel,
          tenantName: t.tenantName,
        })
      }
    }
  }
}

interface FxPayment extends PaymentDto {
  allocations: PaymentAllocationDto[]
}
const PAYMENTS: FxPayment[] = [
  {
    id: "pay-1",
    receiptNo: "NEST-R-000001",
    amountMinor: 900_000,
    source: "MPESA",
    status: "COMPLETED",
    receivedAt: daysAgoIso(2),
    tenancyId: "t-b2",
    accountReference: "NEST-B2-1003",
    phone: "+254711000003",
    matchedLabel: "Grace Wanjiku · B2",
    recordedByName: null,
    allocations: [
      { chargeId: chargeIdOf("t-b2", "RENT", CUR), chargeKind: "RENT", chargePeriod: CUR, amountMinor: 850_000 },
      { chargeId: chargeIdOf("t-b2", "WATER", CUR), chargeKind: "WATER", chargePeriod: CUR, amountMinor: WATER_MINOR },
      { chargeId: chargeIdOf("t-b2", "GARBAGE", CUR), chargeKind: "GARBAGE", chargePeriod: CUR, amountMinor: GARBAGE_MINOR },
    ],
  },
  {
    id: "pay-2",
    receiptNo: "NEST-R-000002",
    amountMinor: 600_000,
    source: "MPESA",
    status: "COMPLETED",
    receivedAt: daysAgoIso(6),
    tenancyId: "t-a2",
    accountReference: "NEST-A2-1002",
    phone: "+254711000005",
    matchedLabel: "Sarah Achieng · A2",
    recordedByName: null,
    allocations: [
      { chargeId: chargeIdOf("t-a2", "RENT", CUR), chargeKind: "RENT", chargePeriod: CUR, amountMinor: 600_000 },
    ],
  },
  {
    id: "pay-3",
    receiptNo: null,
    amountMinor: 500_000,
    source: "MPESA",
    status: "UNMATCHED",
    receivedAt: daysAgoIso(1),
    tenancyId: null,
    accountReference: "NEST-ZZ-9999",
    phone: "+254722000999",
    matchedLabel: null,
    recordedByName: null,
    allocations: [],
  },
]

function chargeIdOf(tenancyId: string, kind: ChargeKind, period: string): string {
  const c = CHARGES.find((x) => x.tenancyId === tenancyId && x.kind === kind && x.periodMonth === period)
  if (!c) throw new Error(`fixture charge missing: ${tenancyId} ${kind} ${period}`)
  return c.id
}

// Apply seeded allocations to charges (Grace full, Sarah partial).
{
  for (const p of PAYMENTS) {
    if (p.status !== "COMPLETED") continue
    for (const a of p.allocations) {
      const c = CHARGES.find((x) => x.id === a.chargeId)
      if (!c) continue
      c.paidMinor += a.amountMinor
      c.status = c.paidMinor >= c.amountMinor ? "PAID" : "PART"
    }
  }
}

type FxNotification = NotificationDto
const NOTIFICATIONS: FxNotification[] = [
  {
    id: "n-1",
    channel: "IN_APP",
    templateKey: "RECEIPT_ISSUED",
    body: "NEST Receipt NEST-R-000001 — KSh 9,000 received from Grace Wanjiku for unit B2, Baraka Court. Rent KSh 8,500, Water KSh 300, Garbage KSh 200. Outstanding balance: KSh 9,000.",
    status: "SENT",
    createdAt: daysAgoIso(2),
    sentAt: daysAgoIso(2),
  },
  {
    id: "n-2",
    channel: "SMS",
    templateKey: "ARREARS_REMINDER",
    body: "NEST: Hi David, rent for unit A1 (Baraka Court) is past due. Balance KSh 31,000. Pay via M-Pesa using account ref NEST-A1-1001.",
    status: "QUEUED",
    createdAt: daysAgoIso(1),
    sentAt: null,
  },
  {
    id: "n-3",
    channel: "IN_APP",
    templateKey: "UNMATCHED_PAYMENT",
    body: "NEST: Unmatched M-Pesa payment of KSh 5,000 from +254722000999 (ref NEST-ZZ-9999) needs to be matched to a tenancy.",
    status: "QUEUED",
    createdAt: daysAgoIso(1),
    sentAt: null,
  },
]

/** Which profile owns each seeded notification (recipient). */
const NOTIFICATION_OWNER: Record<string, string> = {
  "n-1": "p-grace",
  "n-2": "p-david",
  "n-3": "p-amina",
}

// ---------------------------------------------------------------------------
// Mutable state
// ---------------------------------------------------------------------------

let receiptSeq = 3
let notifSeq = 4
let paymentSeq = 4
const MPESA_TX = new Map<
  string,
  { status: MpesaStatusDto["status"]; resultCode: string | null; resultDesc: string | null; paymentId: string | null; receiptNo: string | null }
>()
const SEEN_CLIENT_REFS = new Set<string>()

function sessionPhone(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function setSessionPhone(phone: string | null) {
  memorySessionPhone = phone
  if (typeof window === "undefined") return
  try {
    if (phone) window.sessionStorage.setItem(SESSION_KEY, phone)
    else window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* private mode — in-memory demo session only */
  }
}
let memorySessionPhone: string | null = null

function currentProfile(): FxProfile | null {
  const phone = memorySessionPhone ?? sessionPhone()
  if (!phone) return null
  return PROFILES.find((p) => p.phone === phone) ?? null
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

function tenancyOf(tenancyId: string) {
  return TENANCY_META.find((t) => t.tenancyId === tenancyId)
}

function chargesOf(tenancyId: string) {
  return CHARGES.filter((c) => c.tenancyId === tenancyId)
}

function outstandingMinor(charge: FxCharge): number {
  return Math.max(0, charge.amountMinor - charge.paidMinor)
}

function balanceOf(tenancyId: string): number {
  return chargesOf(tenancyId).reduce((s, c) => s + outstandingMinor(c), 0)
}

function oldestUnpaidPeriod(tenancyId: string): string | null {
  const periods = chargesOf(tenancyId)
    .filter((c) => outstandingMinor(c) > 0)
    .map((c) => c.periodMonth)
    .sort()
  return periods[0] ?? null
}

function monthsBehindOf(tenancyId: string): number {
  const periods = new Set(chargesOf(tenancyId).filter((c) => outstandingMinor(c) > 0).map((c) => c.periodMonth))
  return periods.size
}

function arrearsRows(): ArrearsRowDto[] {
  return TENANCY_META.filter((t) => balanceOf(t.tenancyId) > 0)
    .map((t) => ({
      tenancyId: t.tenancyId,
      tenantName: t.tenantName,
      tenantPhone: t.tenantPhone,
      unitLabel: t.unitLabel,
      propertyName: PROPERTY.name,
      accountRef: t.accountRef,
      balanceMinor: balanceOf(t.tenancyId),
      oldestUnpaidPeriod: oldestUnpaidPeriod(t.tenancyId),
      monthsBehind: monthsBehindOf(t.tenancyId),
    }))
    .sort((a, b) => b.balanceMinor - a.balanceMinor)
}

function receiptsOf(tenancyId?: string): ReceiptDto[] {
  const rows: ReceiptDto[] = []
  for (const p of PAYMENTS) {
    if (p.status !== "COMPLETED" || !p.receiptNo || !p.tenancyId) continue
    if (tenancyId && p.tenancyId !== tenancyId) continue
    const t = tenancyOf(p.tenancyId)
    if (!t) continue
    rows.push({
      receiptNo: p.receiptNo,
      paymentId: p.id,
      amountMinor: p.amountMinor,
      source: p.source,
      receivedAt: p.receivedAt,
      tenancyId: p.tenancyId,
      tenantName: t.tenantName,
      tenantPhone: t.tenantPhone,
      unitLabel: t.unitLabel,
      propertyName: PROPERTY.name,
      accountRef: t.accountRef,
      allocations: p.allocations,
    })
  }
  return rows.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
}

function notificationsOf(profileId: string): NotificationDto[] {
  return NOTIFICATIONS.filter((n) => NOTIFICATION_OWNER[n.id] === profileId)
    .concat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function nextReceiptNo(): string {
  return `NEST-R-${String(receiptSeq++).padStart(6, "0")}`
}

function unitDtos(): UnitDto[] {
  return UNITS.map((u) => ({
    ...u,
    tenancy: u.tenancy ? { ...u.tenancy, balanceMinor: balanceOf(u.tenancy.id) } : null,
  })).sort((a, b) => {
    const rank = (u: UnitDto) => (u.status === "OCCUPIED" ? 0 : 1)
    return rank(a) - rank(b)
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Waterfall-allocate an amount across a tenancy's outstanding charges. */
function allocate(tenancyId: string, amountMinor: number): PaymentAllocationDto[] {
  const outstanding = chargesOf(tenancyId)
    .filter((c) => outstandingMinor(c) > 0)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    .map((c) => ({ chargeId: c.id, outstandingMinor: outstandingMinor(c) }))
  const allocs = splitWaterfall(amountMinor, outstanding)
  for (const a of allocs) {
    const c = CHARGES.find((x) => x.id === a.chargeId)
    if (!c) continue
    c.paidMinor += a.amountMinor
    c.status = c.paidMinor >= c.amountMinor ? "PAID" : "PART"
  }
  return allocs.map((a) => {
    const c = CHARGES.find((x) => x.id === a.chargeId)!
    return { chargeId: a.chargeId, chargeKind: c.kind, chargePeriod: c.periodMonth, amountMinor: a.amountMinor }
  })
}

function pushNotification(profileId: string, channel: "SMS" | "WHATSAPP" | "IN_APP", templateKey: string, body: string): NotificationDto {
  const n: FxNotification = {
    id: `n-${notifSeq++}`,
    channel,
    templateKey,
    body,
    status: "SENT",
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
  }
  NOTIFICATION_OWNER[n.id] = profileId
  NOTIFICATIONS.push(n)
  return n
}

function recordCompletedPayment(input: {
  tenancyId: string
  amountMinor: number
  source: PaymentSource
  recordedByName: string | null
  phone: string | null
  accountReference: string
}): FxPayment {
  const t = tenancyOf(input.tenancyId)!
  const allocations = allocate(input.tenancyId, input.amountMinor)
  const p: FxPayment = {
    id: `pay-${paymentSeq++}`,
    receiptNo: nextReceiptNo(),
    amountMinor: input.amountMinor,
    source: input.source,
    status: "COMPLETED",
    receivedAt: new Date().toISOString(),
    tenancyId: input.tenancyId,
    accountReference: input.accountReference,
    phone: input.phone,
    matchedLabel: `${t.tenantName} · ${t.unitLabel}`,
    recordedByName: input.recordedByName,
    allocations,
  }
  PAYMENTS.push(p)
  pushNotification(
    t.tenantId,
    "IN_APP",
    "RECEIPT_ISSUED",
    `NEST Receipt ${p.receiptNo} — payment received from ${t.tenantName} for unit ${t.unitLabel}, ${PROPERTY.name}. Outstanding balance updated.`,
  )
  return p
}

function fixtureCash(req: CashCollectionRequest): PaymentDto {
  if (req.clientRef && SEEN_CLIENT_REFS.has(req.clientRef)) {
    const existing = PAYMENTS.find((p) => p.id === `cash-${req.clientRef}`)
    if (existing) return existing
  }
  const profile = currentProfile()
  const t = tenancyOf(req.tenancyId)!
  const p = recordCompletedPayment({
    tenancyId: req.tenancyId,
    amountMinor: req.amountMinor,
    source: "CASH",
    recordedByName: profile?.fullName ?? "John Mwangi",
    phone: t.tenantPhone,
    accountReference: t.accountRef,
  })
  if (req.clientRef) {
    SEEN_CLIENT_REFS.add(req.clientRef)
    p.id = `cash-${req.clientRef}`
  }
  return p
}

function fixtureStkPush(body: { tenancyId: string; amountMinor: number; phone?: string }): StkPushResponseDto {
  const t = tenancyOf(body.tenancyId)!
  const checkoutRequestId = `ws_CO_SIM_${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  MPESA_TX.set(checkoutRequestId, { status: "PUSHED", resultCode: null, resultDesc: null, paymentId: null, receiptNo: null })
  return {
    checkoutRequestId,
    merchantRequestId: `${Math.random().toString(36).slice(2, 10).toUpperCase()}-api-0000000`,
    amountMinor: body.amountMinor,
    phone: body.phone ?? t.tenantPhone,
    accountReference: t.accountRef,
    mode: "sim",
    customerMessage: "Sandbox simulation — no real money moves. Confirm to proceed.",
  }
}

function fixtureSimulate(body: { checkoutRequestId: string; outcome: string }): MpesaStatusDto {
  const tx = MPESA_TX.get(body.checkoutRequestId)
  if (!tx)
    return {
      status: "FAILED",
      resultCode: "1",
      resultDesc: "Unknown request",
      paymentId: null,
      receiptNo: null,
    }
  if (tx.status === "PUSHED" && body.outcome === "SUCCESS") {
    // Attribute to the most recent pending money: the flow knows the tenancy;
    // the simulator stores it at push time via the body tenancyId.
    const pushBody = SIM_PUSH_BODIES.get(body.checkoutRequestId)
    if (pushBody) {
      const p = recordCompletedPayment({
        tenancyId: pushBody.tenancyId,
        amountMinor: pushBody.amountMinor,
        source: "MPESA",
        recordedByName: null,
        phone: pushBody.phone ?? null,
        accountReference: tenancyOf(pushBody.tenancyId)!.accountRef,
      })
      tx.status = "SUCCESS"
      tx.resultCode = "0"
      tx.resultDesc = "The service request is processed successfully."
      tx.paymentId = String(p.id)
      tx.receiptNo = p.receiptNo
    } else {
      tx.status = "FAILED"
      tx.resultCode = "1"
      tx.resultDesc = "No pending request"
    }
  } else if (body.outcome === "FAILED" || body.outcome === "CANCELLED" || body.outcome === "TIMEOUT" || body.outcome === "INSUFFICIENT") {
    tx.status = "FAILED"
    tx.resultCode = body.outcome === "TIMEOUT" ? "1037" : "1032"
    tx.resultDesc =
      body.outcome === "TIMEOUT" ? "The service request has timed out" : "Request cancelled by user"
  }
  return fixtureStatus(body.checkoutRequestId)
}

/** tenancy/amount context captured at push time so simulate can credit it. */
const SIM_PUSH_BODIES = new Map<string, { tenancyId: string; amountMinor: number; phone?: string }>()

function fixtureStatus(checkoutRequestId: string): MpesaStatusDto {
  const tx = MPESA_TX.get(checkoutRequestId)
  if (!tx)
    return { status: "FAILED", resultCode: "1", resultDesc: "Unknown request", paymentId: null, receiptNo: null }
  return { ...tx }
}

function fixtureMatch(body: { paymentId: string; tenancyId: string }): PaymentDto {
  const p = PAYMENTS.find((x) => x.id === body.paymentId)
  if (!p) throw new Error("payment not found")
  if (p.status !== "UNMATCHED") return p
  const t = tenancyOf(body.tenancyId)!
  p.tenancyId = body.tenancyId
  p.status = "COMPLETED"
  p.receiptNo = nextReceiptNo()
  p.matchedLabel = `${t.tenantName} · ${t.unitLabel}`
  p.accountReference = t.accountRef
  p.allocations = allocate(body.tenancyId, p.amountMinor)
  pushNotification(
    t.tenantId,
    "IN_APP",
    "RECEIPT_ISSUED",
    `NEST Receipt ${p.receiptNo} — payment of KSh matched to ${t.tenantName} (unit ${t.unitLabel}).`,
  )
  return p
}

function fixtureReminder(body: { tenancyId: string }): NotificationDto {
  const t = tenancyOf(body.tenancyId)!
  return pushNotification(
    t.tenantId,
    "SMS",
    "ARREARS_REMINDER",
    `NEST: Hi ${t.tenantName.split(" ")[0]}, rent for unit ${t.unitLabel} (${PROPERTY.name}) is past due. Pay via M-Pesa using account ref ${t.accountRef}.`,
  )
}

// ---------------------------------------------------------------------------
// Overviews
// ---------------------------------------------------------------------------

function propertyTotals() {
  const units = unitDtos()
  const occupied = units.filter((u) => u.status === "OCCUPIED").length
  const vacant = units.length - occupied
  const monthExpected = CHARGES.filter((c) => c.periodMonth === CUR).reduce((s, c) => s + c.amountMinor, 0)
  const monthCollected = PAYMENTS.filter((p) => p.status === "COMPLETED").reduce(
    (s, p) => s + p.allocations.filter((a) => a.chargePeriod === CUR).reduce((x, a) => x + a.amountMinor, 0),
    0,
  )
  const todayIso = format(now, "yyyy-MM-dd")
  const todayCollected = PAYMENTS.filter((p) => p.status === "COMPLETED" && format(p.receivedAt, "yyyy-MM-dd") === todayIso).reduce(
    (s, p) => s + p.amountMinor,
    0,
  )
  const arrears = arrearsRows()
  const unmatched = PAYMENTS.filter((p) => p.status === "UNMATCHED").length
  return {
    units: units.length,
    occupied,
    vacant,
    monthExpected,
    monthCollected,
    todayCollected,
    unmatched,
    arrearsMinor: arrears.reduce((s, r) => s + r.balanceMinor, 0),
    arrearsTenantCount: arrears.length,
  }
}

function landlordOverview(): LandlordOverviewDto {
  const t = propertyTotals()
  return {
    properties: [PROPERTY],
    totals: {
      units: t.units,
      occupied: t.occupied,
      vacant: t.vacant,
      occupancyRatePct: Math.round((t.occupied / t.units) * 100),
      monthExpectedMinor: t.monthExpected,
      monthCollectedMinor: t.monthCollected,
      todayCollectedMinor: t.todayCollected,
      collectionRatePct: t.monthExpected > 0 ? Math.round((t.monthCollected / t.monthExpected) * 100) : 0,
      arrearsMinor: t.arrearsMinor,
      arrearsTenantCount: t.arrearsTenantCount,
      unmatchedPayments: t.unmatched,
      openTickets: 2,
    },
    arrears: arrearsRows(),
    recentPayments: PAYMENTS.filter((p) => p.status === "COMPLETED")
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
      .slice(0, 5),
    vacancies: UNITS.filter((u) => u.status === "VACANT").map((u) => ({ ...u, tenancy: null })),
    security: securityDigest(),
    month: CUR,
  }
}

function caretakerOverview(): CaretakerOverviewDto {
  const t = propertyTotals()
  return {
    property: PROPERTY,
    units: unitDtos(),
    totals: {
      monthExpectedMinor: t.monthExpected,
      monthCollectedMinor: t.monthCollected,
      todayCollectedMinor: t.todayCollected,
      arrearsMinor: t.arrearsMinor,
      arrearsTenantCount: t.arrearsTenantCount,
      vacant: t.vacant,
      unmatchedPayments: t.unmatched,
      openTickets: 2,
    },
    arrears: arrearsRows(),
    recentPayments: PAYMENTS.filter((p) => p.status === "COMPLETED")
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
      .slice(0, 5),
    security: securityDigest(),
    month: CUR,
  }
}

function tenantOverview(profileId: string): TenantOverviewDto | { status: 404 } {
  const own = TENANCY_META.find((m) => m.tenancyId === TENANCY_BY_TENANT[profileId])
  if (!own) return { status: 404 }
  const charges = chargesOf(own.tenancyId)
    .slice()
    .sort((a, b) => (a.periodMonth > b.periodMonth ? -1 : a.periodMonth < b.periodMonth ? 1 : 0))
  const curOutstanding = charges.filter((c) => c.periodMonth === CUR).reduce((s, c) => s + outstandingMinor(c), 0)
  const nextDueDate = curOutstanding > 0 ? periodDueDate(CUR).toISOString() : periodDueDate(NEXT).toISOString()
  const nextDueAmountMinor = curOutstanding > 0 ? curOutstanding : own.monthlyRentMinor + WATER_MINOR + GARBAGE_MINOR
  return {
    tenancy: {
      id: own.tenancyId,
      unitLabel: own.unitLabel,
      propertyName: PROPERTY.name,
      propertyLocation: PROPERTY.location,
      accountRef: own.accountRef,
      monthlyRentMinor: own.monthlyRentMinor,
      depositHeldMinor: own.depositHeldMinor,
      startDate: monthsAgoIso(4),
    },
    totals: {
      balanceMinor: balanceOf(own.tenancyId),
      nextDueDate,
      nextDueAmountMinor,
    },
    charges,
    receipts: receiptsOf(own.tenancyId),
    notifications: notificationsOf(profileId),
    recentVisitors: VISITORS.filter((v) => v.unitId === own.unitId).slice(0, 3),
  }
}

/** profileId -> tenancyId for tenants. */
const TENANCY_BY_TENANT: Record<string, string> = {
  "p-david": "t-a1",
  "p-sarah": "t-a2",
  "p-grace": "t-b2",
}

// ----- Phase 4: agent module fixtures (listing + applicants) ----------------

const AGENT = { id: "p-wanjiku", fullName: "Wanjiku Kamau" }
const B3_LISTING: ListingDto = {
  id: "l-b3",
  propertyId: PROPERTY.id,
  propertyName: PROPERTY.name,
  unitId: "u-b3",
  unitLabel: "B3",
  title: "Spacious 2-bedroom — Baraka Court",
  description:
    "Freshly painted 2-bedroom in a gated 5-unit court off Thika Road. Borehole water (metered), secure parking, 24/7 guard.",
  rentAmountMinor: 2_500_000,
  status: "PUBLISHED",
  createdAt: daysAgoIso(10),
  updatedAt: daysAgoIso(8),
  applicationCount: 3,
  newApplicationCount: 1,
}

const APPLICATIONS: ListingApplicationDto[] = [
  {
    id: "a-joyce",
    listingId: B3_LISTING.id,
    unitLabel: "B3",
    propertyName: PROPERTY.name,
    applicantName: "Joyce Muthoni",
    applicantPhone: "+254701555666",
    source: "PHONE",
    note: "Called after seeing the Facebook post. Works at Kenyatta University library.",
    status: "VIEWING",
    handledById: AGENT.id,
    handledByName: AGENT.fullName,
    decidedById: null,
    decidedByName: null,
    decidedAt: null,
    createdAt: daysAgoIso(2),
    updatedAt: hoursAgoIso(3.2),
    events: [
      { id: "e-1", toStatus: "NEW", actorId: AGENT.id, actorName: AGENT.fullName, note: "Phone lead from the Facebook post.", createdAt: daysAgoIso(2) },
      { id: "e-2", toStatus: "CONTACTED", actorId: AGENT.id, actorName: AGENT.fullName, note: "Called back — very interested.", createdAt: daysAgoIso(1.5) },
      { id: "e-3", toStatus: "VIEWING", actorId: AGENT.id, actorName: AGENT.fullName, note: "Viewed the unit today. Gate entry logged by Peter.", createdAt: hoursAgoIso(3.2) },
    ],
  },
  {
    id: "a-brian",
    listingId: B3_LISTING.id,
    unitLabel: "B3",
    propertyName: PROPERTY.name,
    applicantName: "Brian Ochieng",
    applicantPhone: "+254733444555",
    source: "WHATSAPP",
    note: "WhatsApped the number on the poster. Relocating from Kisumu in January.",
    status: "NEW",
    handledById: AGENT.id,
    handledByName: AGENT.fullName,
    decidedById: null,
    decidedByName: null,
    decidedAt: null,
    createdAt: hoursAgoIso(5),
    updatedAt: hoursAgoIso(5),
    events: [
      { id: "e-4", toStatus: "NEW", actorId: AGENT.id, actorName: AGENT.fullName, note: "WhatsApp lead — requested photos first.", createdAt: hoursAgoIso(5) },
    ],
  },
  {
    id: "a-faith",
    listingId: B3_LISTING.id,
    unitLabel: "B3",
    propertyName: PROPERTY.name,
    applicantName: "Faith Njeri",
    applicantPhone: "+254799111222",
    source: "FACEBOOK",
    note: "Facebook Marketplace enquiry. Family of three.",
    status: "CONTACTED",
    handledById: AGENT.id,
    handledByName: AGENT.fullName,
    decidedById: null,
    decidedByName: null,
    decidedAt: null,
    createdAt: daysAgoIso(1),
    updatedAt: hoursAgoIso(20),
    events: [
      { id: "e-5", toStatus: "NEW", actorId: AGENT.id, actorName: AGENT.fullName, note: "Facebook Marketplace enquiry.", createdAt: daysAgoIso(1) },
      { id: "e-6", toStatus: "CONTACTED", actorId: AGENT.id, actorName: AGENT.fullName, note: "Called — will confirm viewing day by Friday.", createdAt: hoursAgoIso(20) },
    ],
  },
]

function agentOverview(): AgentOverviewDto {
  const t = propertyTotals()
  const vacantUnits = unitDtos().filter((u) => u.status === "VACANT")
  return {
    portfolioProperties: [PROPERTY],
    totals: {
      properties: 1,
      units: t.units,
      occupancyRatePct: Math.round((t.occupied / t.units) * 100),
      vacantUnits: vacantUnits.length,
      liveListings: 1,
      newApplications: 1,
      activeApplications: 3,
    },
    unlistedVacantUnits: [], // the demo's only vacant unit (B3) is listed
    liveListings: [B3_LISTING],
  }
}

// ----- Phase 3: guard module fixtures -------------------------------------

const GUARD = { id: "p-peter", fullName: "Peter Njoroge" }
const ACTIVE_SHIFT_ID = "s-active"
const VISITORS: VisitorLogDto[] = [
  {
    id: "v-1",
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    unitId: "u-b2",
    unitLabel: "B2",
    visitorName: "Mary Wanjala",
    visitorPhone: "+254722111222",
    purpose: "VISITOR",
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    enteredAt: hoursAgoIso(3),
    exitedAt: null,
  },
  {
    id: "v-2",
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    unitId: "u-a1",
    unitLabel: "A1",
    visitorName: "Daniel Kimani",
    visitorPhone: null,
    purpose: "DELIVERY",
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    enteredAt: hoursAgoIso(5),
    exitedAt: hoursAgoIso(4),
  },
  {
    id: "v-3",
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    unitId: null,
    unitLabel: null,
    visitorName: "Erick Otieno",
    visitorPhone: "+254733444555",
    purpose: "CONTRACTOR",
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    enteredAt: hoursAgoIso(6),
    exitedAt: null,
  },
  {
    id: "v-4",
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    unitId: "u-b2",
    unitLabel: "B2",
    visitorName: "Joseph Mwangi",
    visitorPhone: null,
    purpose: "VIEWING",
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    enteredAt: hoursAgoIso(8),
    exitedAt: hoursAgoIso(7),
  },
]

const INCIDENTS: IncidentReportDto[] = [
  {
    id: "i-1",
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    category: "SECURITY",
    severity: "HIGH",
    description: "Two men tried to force the gate lock at the parking area late in the evening.",
    actionTaken: "Called the caretaker; recorded the motorcycle plate KDA 123X.",
    acknowledgedById: null,
    acknowledgedByName: null,
    acknowledgedAt: null,
    createdAt: hoursAgoIso(2),
  },
  {
    id: "i-2",
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    category: "DISPUTE",
    severity: "MEDIUM",
    description: "Water point dispute between unit A2 and B1 tenants.",
    actionTaken: "Separated both parties; caretaker informed.",
    acknowledgedById: "p-amina",
    acknowledgedByName: "Amina Barasa",
    acknowledgedAt: hoursAgoIso(26),
    createdAt: hoursAgoIso(30),
  },
]

const SHIFTS: GuardShiftDto[] = [
  {
    id: ACTIVE_SHIFT_ID,
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    startedAt: hoursAgoIso(9),
    endedAt: null,
    notes: null,
  },
  {
    id: "s-prev",
    propertyId: PROPERTY.id,
    propertyName: PROPERTY.name,
    guardId: GUARD.id,
    guardName: GUARD.fullName,
    startedAt: hoursAgoIso(33),
    endedAt: hoursAgoIso(24),
    notes: "Gate keys handed over. B3 water leak reported to caretaker.",
  },
]

function hoursAgoIso(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

function securityDigest(): SecurityDigestDto {
  return {
    visitorsToday: VISITORS.length,
    onSiteNow: VISITORS.filter((v) => v.exitedAt === null).length,
    unacknowledgedIncidents: INCIDENTS.filter((i) => i.acknowledgedById === null).length,
    highSeverityUnacked: INCIDENTS.filter(
      (i) => i.acknowledgedById === null && (i.severity === "HIGH" || i.severity === "CRITICAL")
    ).length,
    lastIncidentAt: INCIDENTS[0].createdAt,
    lastIncidentSeverity: INCIDENTS[0].severity,
    onDutyGuardName: GUARD.fullName,
  }
}

function guardOverview(): GuardOverviewDto {
  return {
    property: PROPERTY,
    activeShift: SHIFTS[0],
    properties: [PROPERTY],
    // The fixture property's units (A1..B3), label-sorted — shape-true for
    // the Log-visitor sheet's unit picker (empty when off duty, like the API).
    activePropertyUnits: [...UNITS]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((u) => ({ id: u.id, label: u.label })),
    totals: {
      visitorsToday: VISITORS.length,
      onSiteNow: VISITORS.filter((v) => v.exitedAt === null).length,
      unacknowledgedIncidents: INCIDENTS.filter(
        (i) => i.acknowledgedById === null && i.guardId === GUARD.id
      ).length,
    },
    recentVisitors: VISITORS.slice(0, 3),
  }
}

// ---------------------------------------------------------------------------
// Route responder
// ---------------------------------------------------------------------------

export interface FixtureResponse {
  status: number
  data?: unknown
  /** Marker for the api client to treat this as "no session". */
  unauthorized?: boolean
}

function sessionDto(): SessionDto | null {
  const p = currentProfile()
  return p ? { profile: { id: p.id, phone: p.phone, fullName: p.fullName, role: p.role, language: p.language } } : null
}

function roleAllowsMoney(role: Role | undefined): boolean {
  return role === "LANDLORD" || role === "CARETAKER" || role === "AGENT"
}

/**
 * Respond to a request from fixture data. Returns null when no fixture route
 * matches (the api client then surfaces the original network/404 error).
 */
export function fixtureRespond(method: "GET" | "POST", path: string, body?: unknown): FixtureResponse | null {
  const [pathname, search = ""] = path.split("?")
  const params = new URLSearchParams(search)
  const profile = currentProfile()
  const role = profile?.role

  // ----- auth ---------------------------------------------------------------
  if (pathname === "/api/auth/me") {
    const s = sessionDto()
    return s ? { status: 200, data: s } : { status: 401, unauthorized: true }
  }
  if (pathname === "/api/auth/profiles") {
    const demos = DEMO_PROFILE_IDS.map((id) => PROFILES.find((p) => p.id === id)!).sort(
      (a, b) => DEMO_ROLE_ORDER.indexOf(a.role) - DEMO_ROLE_ORDER.indexOf(b.role),
    )
    return { status: 200, data: demos.map(stripId) }
  }
  if (method === "POST" && pathname === "/api/auth/login") {
    const phone = (body as { phone?: string } | undefined)?.phone
    const p = PROFILES.find((x) => x.phone === phone)
    if (!p) return { status: 404 }
    setSessionPhone(p.phone)
    return { status: 200, data: { profile: stripId(p) } }
  }
  if (method === "POST" && pathname === "/api/auth/logout") {
    setSessionPhone(null)
    return { status: 200, data: { ok: true } }
  }

  // ----- dashboards ----------------------------------------------------------
  if (method === "GET" && pathname === "/api/landlord/overview" && role === "LANDLORD") return { status: 200, data: landlordOverview() }
  if (method === "GET" && pathname === "/api/caretaker/overview" && role === "CARETAKER") return { status: 200, data: caretakerOverview() }
  if (method === "GET" && pathname === "/api/tenant/overview" && role === "TENANT") {
    if (!profile) return { status: 401, unauthorized: true }
    const o = tenantOverview(profile.id)
    return "status" in o ? { status: 404 } : { status: 200, data: o }
  }
  if (method === "GET" && pathname === "/api/agent/overview" && role === "AGENT") return { status: 200, data: agentOverview() }
  if (method === "GET" && pathname === "/api/guard/overview" && role === "GUARD") return { status: 200, data: guardOverview() }

  // ----- money lists ------------------------------------------------------------
  if (method === "GET" && pathname === "/api/payments") {
    if (!roleAllowsMoney(role)) return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    const statusFilter = params.get("status")
    const rows = PAYMENTS.slice().sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
    return { status: 200, data: statusFilter ? rows.filter((p) => p.status === statusFilter) : rows }
  }
  if (method === "GET" && pathname === "/api/arrears") {
    if (!roleAllowsMoney(role)) return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    return { status: 200, data: arrearsRows() }
  }
  if (method === "GET" && pathname === "/api/tenancies") {
    if (!roleAllowsMoney(role) && role !== "TENANT") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    const rows: TenancySummaryDto[] = TENANCY_META.map((t) => ({
      tenancyId: t.tenancyId,
      tenantName: t.tenantName,
      tenantPhone: t.tenantPhone,
      unitLabel: t.unitLabel,
      propertyName: PROPERTY.name,
      accountRef: t.accountRef,
      balanceMinor: balanceOf(t.tenancyId),
    })).sort((a, b) => b.balanceMinor - a.balanceMinor)
    return { status: 200, data: rows }
  }
  if (method === "GET" && pathname === "/api/properties") {
    if (!roleAllowsMoney(role)) return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    return { status: 200, data: [PROPERTY] }
  }
  if (method === "GET" && pathname === "/api/units") {
    if (!roleAllowsMoney(role)) return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    return { status: 200, data: unitDtos() }
  }
  if (method === "GET" && pathname === "/api/receipts") {
    const tenancyId = params.get("tenancyId") ?? undefined
    if (role === "TENANT" && profile) {
      const own = TENANCY_BY_TENANT[profile.id]
      return { status: 200, data: receiptsOf(own ?? "__none__") }
    }
    if (!roleAllowsMoney(role)) return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    return { status: 200, data: receiptsOf(tenancyId) }
  }
  if (method === "GET" && pathname === "/api/notifications") {
    if (!profile) return { status: 401, unauthorized: true }
    if (role === "GUARD") return { status: 200, data: [] }
    return { status: 200, data: notificationsOf(profile.id) }
  }

  // ----- mutations --------------------------------------------------------------
  if (method === "POST" && pathname === "/api/payments/cash") {
    if (role !== "LANDLORD" && role !== "CARETAKER") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    return { status: 200, data: fixtureCash(body as CashCollectionRequest) }
  }
  if (method === "POST" && pathname === "/api/payments/stk-push") {
    if (!role) return { status: 401, unauthorized: true }
    const b = body as { tenancyId: string; amountMinor: number; phone?: string }
    const res = fixtureStkPush(b)
    SIM_PUSH_BODIES.set(res.checkoutRequestId, b)
    return { status: 200, data: res }
  }
  if (method === "GET" && pathname === "/api/mpesa/status") {
    return { status: 200, data: fixtureStatus(params.get("checkoutRequestId") ?? "") }
  }
  if (method === "POST" && pathname === "/api/mpesa/simulate") {
    return { status: 200, data: fixtureSimulate(body as { checkoutRequestId: string; outcome: string }) }
  }
  if (method === "POST" && pathname === "/api/payments/unmatched/match") {
    if (role !== "LANDLORD" && role !== "CARETAKER") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    try {
      return { status: 200, data: fixtureMatch(body as { paymentId: string; tenancyId: string }) }
    } catch {
      return { status: 404, data: { error: "Not found", code: "NOT_FOUND" } }
    }
  }
  if (method === "POST" && pathname === "/api/notifications/reminders") {
    if (role !== "LANDLORD" && role !== "CARETAKER") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    return { status: 200, data: fixtureReminder(body as { tenancyId: string }) }
  }

  // ----- Phase 3: guard module ---------------------------------------------------
  if (method === "GET" && pathname === "/api/visitors") {
    if (role === "GUARD") return { status: 200, data: VISITORS }
    if (role === "LANDLORD" || role === "CARETAKER") return { status: 200, data: VISITORS }
    if (role === "TENANT" && profile) {
      const own = TENANCY_BY_TENANT[profile.id]
      const unitId = own ? TENANCY_META.find((m) => m.tenancyId === own)?.unitId : null
      return { status: 200, data: unitId ? VISITORS.filter((v) => v.unitId === unitId) : [] }
    }
    return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
  }
  if (method === "POST" && pathname === "/api/visitors") {
    if (role !== "GUARD") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    const b = body as { visitorName: string; visitorPhone?: string; purpose: string; unitId?: string }
    const unit = b.unitId ? UNITS.find((u) => u.id === b.unitId) : null
    const dto: VisitorLogDto = {
      id: `v-${Date.now()}`,
      propertyId: PROPERTY.id,
      propertyName: PROPERTY.name,
      unitId: unit?.id ?? null,
      unitLabel: unit?.label ?? null,
      visitorName: b.visitorName,
      visitorPhone: b.visitorPhone ?? null,
      purpose: b.purpose as VisitorLogDto["purpose"],
      guardId: GUARD.id,
      guardName: GUARD.fullName,
      enteredAt: new Date().toISOString(),
      exitedAt: null,
    }
    VISITORS.unshift(dto)
    return { status: 200, data: dto }
  }
  if (method === "POST" && /^\/api\/visitors\/[^/]+\/exit$/.test(pathname)) {
    if (role !== "GUARD") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    const id = pathname.split("/")[3]
    const v = VISITORS.find((x) => x.id === id)
    if (!v) return { status: 404, data: { error: "Not found", code: "NOT_FOUND" } }
    if (v.exitedAt) return { status: 409, data: { error: "Already exited", code: "CONFLICT" } }
    v.exitedAt = new Date().toISOString()
    return { status: 200, data: v }
  }
  if (method === "GET" && pathname === "/api/incidents") {
    if (role === "GUARD" || role === "LANDLORD" || role === "CARETAKER") return { status: 200, data: INCIDENTS }
    return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
  }
  if (method === "POST" && pathname === "/api/incidents") {
    if (role !== "GUARD") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    const b = body as { category: string; severity: string; description: string; actionTaken?: string }
    const dto: IncidentReportDto = {
      id: `i-${Date.now()}`,
      propertyId: PROPERTY.id,
      propertyName: PROPERTY.name,
      guardId: GUARD.id,
      guardName: GUARD.fullName,
      category: b.category as IncidentReportDto["category"],
      severity: b.severity as IncidentReportDto["severity"],
      description: b.description,
      actionTaken: b.actionTaken ?? null,
      acknowledgedById: null,
      acknowledgedByName: null,
      acknowledgedAt: null,
      createdAt: new Date().toISOString(),
    }
    INCIDENTS.unshift(dto)
    return { status: 200, data: dto }
  }
  if (method === "POST" && /^\/api\/incidents\/[^/]+\/ack$/.test(pathname)) {
    if (role !== "LANDLORD" && role !== "CARETAKER") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    const id = pathname.split("/")[3]
    const i = INCIDENTS.find((x) => x.id === id)
    if (!i) return { status: 404, data: { error: "Not found", code: "NOT_FOUND" } }
    if (i.acknowledgedById) return { status: 409, data: { error: "Already acknowledged", code: "CONFLICT" } }
    i.acknowledgedById = "p-amina"
    i.acknowledgedByName = "Amina Barasa"
    i.acknowledgedAt = new Date().toISOString()
    return { status: 200, data: i }
  }
  if (method === "GET" && pathname === "/api/shifts") {
    if (role === "GUARD" || role === "LANDLORD" || role === "CARETAKER") return { status: 200, data: SHIFTS }
    return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
  }
  if (method === "POST" && pathname === "/api/shifts") {
    if (role !== "GUARD") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    if (SHIFTS[0].endedAt === null) return { status: 409, data: { error: "Already on duty", code: "CONFLICT" } }
    const dto: GuardShiftDto = {
      id: `s-${Date.now()}`,
      propertyId: PROPERTY.id,
      propertyName: PROPERTY.name,
      guardId: GUARD.id,
      guardName: GUARD.fullName,
      startedAt: new Date().toISOString(),
      endedAt: null,
      notes: null,
    }
    SHIFTS.unshift(dto)
    return { status: 200, data: dto }
  }
  if (method === "POST" && /^\/api\/shifts\/[^/]+\/end$/.test(pathname)) {
    if (role !== "GUARD") return { status: 403, data: { error: "Forbidden", code: "FORBIDDEN" } }
    const id = pathname.split("/")[3]
    const s = SHIFTS.find((x) => x.id === id)
    if (!s) return { status: 404, data: { error: "Not found", code: "NOT_FOUND" } }
    if (s.endedAt) return { status: 409, data: { error: "Shift already ended", code: "CONFLICT" } }
    s.endedAt = new Date().toISOString()
    s.notes = ((body as { notes?: string }).notes) ?? null
    return { status: 200, data: s }
  }

  return null
}

function stripId(p: FxProfile): ProfileDto {
  return { id: p.id, phone: p.phone, fullName: p.fullName, role: p.role, language: p.language }
}
