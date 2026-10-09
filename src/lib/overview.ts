/**
 * NEST — dashboard aggregation (Task 2-a).
 *
 * One overview payload per role home screen (a single API call per dashboard,
 * per the design-system perf rule — no N+1 fetches). Every query here embeds
 * the role-scope matrix condition (docs/architecture/role-scope-matrix.md):
 * the overview is a money endpoint, so GUARD gets no *Minor field at all and
 * TENANT sees only their own ACTIVE tenancy.
 *
 * MONEY DEFINITIONS (documented once, used everywhere):
 * - month (YYYY-MM) = the server's current month.
 * - monthExpectedMinor  = Σ charge.amountMinor for periodMonth = current
 *   month across in-scope tenancies (charges raised = expected, regardless
 *   of payment state).
 * - monthCollectedMinor = Σ payment.amountMinor where status COMPLETED,
 *   tenancy in scope, receivedAt within the current month (what actually
 *   landed — matched money only; UNMATCHED money is not "collected" until a
 *   human matches it).
 * - todayCollectedMinor = same, since local midnight (all sources).
 * - arrearsMinor        = Σ (charge.amountMinor − charge.paidMinor) of
 *   UNPAID+PART charges in scope (the charge-side view).
 * - tenancy balanceMinor = Σ charge.amountMinor − Σ payment.amountMinor of
 *   the tenancy's matched COMPLETED payments — the ECONOMIC position, so an
 *   over-payment credit shows as a NEGATIVE balance (ADR-0007). With no
 *   credit it equals Σ outstanding charges exactly (allocations never
 *   exceed outstanding).
 * - arrearsTenantCount  = distinct in-scope tenancies with balance > 0.
 * - monthsBehind        = calendar months between the oldest unpaid charge's
 *   dueDate and now, clamped ≥ 0 (oldest unpaid 2025-12 vs now 2026-02 → 2).
 * - occupancy           = non-VACANT units / total units (NOTICE units are
 *   still tenanted, so occupied + vacant = units always holds).
 * - unmatchedPayments   = UNMATCHED payment count per matrix §7.4: LANDLORD
 *   sees all (owner of record on the single paybill shortcode);
 *   CARETAKER/AGENT only when the payer phone matches one of their tenants.
 */

import type { Prisma, Profile } from "@prisma/client"
import { db } from "@/lib/db"
import { ApiHttpError, paymentScopeWhere, unmatchedVisibleWhere } from "@/lib/auth-guard"
import { pct } from "@/lib/money"
import {
  chargeInclude,
  listingInclude,
  paymentInclude,
  toChargeDto,
  toListingDto,
  toNotificationDtoRow,
  toPaymentDto,
  toPropertyDto,
  toReceiptDto,
  toUnitDto,
  toVisitorLogDto,
  unitInclude,
  visitorLogInclude,
} from "@/lib/dto"
import type {
  AgentOverviewDto,
  ArrearsRowDto,
  CaretakerOverviewDto,
  GuardOverviewDto,
  IncidentSeverity,
  LandlordOverviewDto,
  SecurityDigestDto,
  TenantOverviewDto,
} from "@/lib/types"

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** "YYYY-MM" for the server's current month. */
export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

/** Start of the month BEFORE `now` (Jan → Dec of previous year). */
function startOfPrevMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
}

function startOfDay(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

/** Calendar months from `from` to `to`, clamped at 0 (never "months ahead"). */
function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  return Math.max(0, months)
}

/** Display order within one period: RENT, then WATER, then GARBAGE. */
const KIND_ORDER: Record<string, number> = { RENT: 0, WATER: 1, GARBAGE: 2 }
function kindOrder(kind: string): number {
  return KIND_ORDER[kind] ?? 3
}

// ---------------------------------------------------------------------------
// Shared money rollup for the two property-scoped roles (LANDLORD, CARETAKER)
// ---------------------------------------------------------------------------

type TenancyWithChain = Prisma.TenancyGetPayload<{
  include: { tenant: true; unit: { include: { property: true } } }
}>

interface MoneyRollup {
  month: string
  monthExpectedMinor: number
  monthCollectedMinor: number
  /** D-022 (Phase 9): matched COMPLETED money that landed LAST calendar month —
   *  the KPI MoM delta's denominator. Same payments array, zero extra queries. */
  monthCollectedPrevMinor: number
  todayCollectedMinor: number
  arrearsMinor: number
  arrearsTenantCount: number
  unmatchedPayments: number
  arrears: ArrearsRowDto[]
  /** tenancyId → economic balance (negative = tenant credit). */
  balances: Map<string, number>
}

/**
 * Compute every money figure for a set of ACTIVE tenancies + the caller's
 * visible slice of the unmatched queue. Queries: charges, matched payments,
 * unmatched count — three round trips regardless of portfolio size.
 */
async function computeMoneyRollup(profile: Profile, tenancies: TenancyWithChain[], now: Date): Promise<MoneyRollup> {
  const month = currentMonthKey(now)
  const tenancyIds = tenancies.map((t) => t.id)

  if (tenancyIds.length === 0) {
    return {
      month,
      monthExpectedMinor: 0,
      monthCollectedMinor: 0,
      monthCollectedPrevMinor: 0,
      todayCollectedMinor: 0,
      arrearsMinor: 0,
      arrearsTenantCount: 0,
      unmatchedPayments: await db.payment.count({ where: await unmatchedVisibleWhere(profile) }),
      arrears: [],
      balances: new Map(),
    }
  }

  const [charges, payments, unmatchedCount] = await Promise.all([
    db.rentCharge.findMany({ where: { tenancyId: { in: tenancyIds } } }),
    db.payment.findMany({ where: { tenancyId: { in: tenancyIds }, status: "COMPLETED" } }),
    db.payment.count({ where: await unmatchedVisibleWhere(profile) }),
  ])

  const monthStart = startOfMonth(now)
  const prevMonthStart = startOfPrevMonth(now)
  const dayStart = startOfDay(now)

  let monthExpectedMinor = 0
  let monthCollectedMinor = 0
  let monthCollectedPrevMinor = 0
  let todayCollectedMinor = 0
  let arrearsMinor = 0
  const chargeTotals = new Map<string, number>() // tenancyId → Σ charge.amountMinor
  const paymentTotals = new Map<string, number>() // tenancyId → Σ payment.amountMinor
  const oldestUnpaid = new Map<string, { periodMonth: string; dueDate: Date }>()

  for (const charge of charges) {
    if (charge.periodMonth === month) monthExpectedMinor += charge.amountMinor
    if (charge.status === "UNPAID" || charge.status === "PART") {
      arrearsMinor += charge.amountMinor - charge.paidMinor

      const outstanding = charge.amountMinor - charge.paidMinor
      if (outstanding > 0) {
        const current = oldestUnpaid.get(charge.tenancyId)
        if (!current || charge.dueDate < current.dueDate) {
          oldestUnpaid.set(charge.tenancyId, { periodMonth: charge.periodMonth, dueDate: charge.dueDate })
        }
      }
    }
    chargeTotals.set(charge.tenancyId, (chargeTotals.get(charge.tenancyId) ?? 0) + charge.amountMinor)
  }

  for (const payment of payments) {
    if (payment.receivedAt >= monthStart) monthCollectedMinor += payment.amountMinor
    else if (payment.receivedAt >= prevMonthStart) monthCollectedPrevMinor += payment.amountMinor
    if (payment.receivedAt >= dayStart) todayCollectedMinor += payment.amountMinor
    if (payment.tenancyId) {
      paymentTotals.set(payment.tenancyId, (paymentTotals.get(payment.tenancyId) ?? 0) + payment.amountMinor)
    }
  }

  // Economic balance per tenancy: charges raised − money received.
  const balances = new Map<string, number>()
  const arrears: ArrearsRowDto[] = []
  for (const tenancy of tenancies) {
    const balance = (chargeTotals.get(tenancy.id) ?? 0) - (paymentTotals.get(tenancy.id) ?? 0)
    balances.set(tenancy.id, balance)
    if (balance > 0) {
      const oldest = oldestUnpaid.get(tenancy.id)
      arrears.push({
        tenancyId: tenancy.id,
        tenantName: tenancy.tenant.fullName,
        tenantPhone: tenancy.tenant.phone,
        unitLabel: tenancy.unit.label,
        propertyName: tenancy.unit.property.name,
        accountRef: tenancy.accountRef,
        balanceMinor: balance,
        oldestUnpaidPeriod: oldest?.periodMonth ?? null,
        monthsBehind: oldest ? monthsBetween(oldest.dueDate, now) : 0,
      })
    }
  }
  arrears.sort((a, b) => b.balanceMinor - a.balanceMinor) // biggest debt first

  return {
    month,
    monthExpectedMinor,
    monthCollectedMinor,
    monthCollectedPrevMinor,
    todayCollectedMinor,
    arrearsMinor,
    arrearsTenantCount: arrears.length,
    unmatchedPayments: unmatchedCount,
    arrears,
    balances,
  }
}

/** Tenancies (ACTIVE) + units for a set of property ids — shared chain query. */
async function scopedActiveTenancies(unitIds: string[]): Promise<TenancyWithChain[]> {
  if (unitIds.length === 0) return []
  return db.tenancy.findMany({
    where: { unitId: { in: unitIds }, status: "ACTIVE" },
    include: { tenant: true, unit: { include: { property: true } } },
  })
}

// ---------------------------------------------------------------------------
// Phase 3 — security digest (eyes on the ground)
// ---------------------------------------------------------------------------

/**
 * SecurityDigestDto for a set of properties (the `where` selects them):
 * today's visitor count, on-site count, unacknowledged incident counts,
 * last incident, and who is on duty. No money — guards never touch it.
 */
async function securityDigest(propertyWhere: Prisma.PropertyWhereInput, now = new Date()): Promise<SecurityDigestDto> {
  const midnight = startOfDay(now)
  const [visitorsToday, onSiteNow, incidents, onDutyShift] = await Promise.all([
    db.visitorLog.count({ where: { property: propertyWhere, enteredAt: { gte: midnight } } }),
    db.visitorLog.count({ where: { property: propertyWhere, exitedAt: null, enteredAt: { gte: midnight } } }),
    db.incidentReport.findMany({
      where: { property: propertyWhere },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { severity: true, createdAt: true, acknowledgedById: true },
    }),
    db.guardShift.findFirst({
      where: { property: propertyWhere, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: { guard: { select: { fullName: true } } },
    }),
  ])

  const unacked = incidents.filter((i) => i.acknowledgedById === null)
  return {
    visitorsToday,
    onSiteNow,
    unacknowledgedIncidents: unacked.length,
    highSeverityUnacked: unacked.filter((i) => i.severity === "HIGH" || i.severity === "CRITICAL").length,
    lastIncidentAt: incidents[0] ? incidents[0].createdAt.toISOString() : null,
    lastIncidentSeverity: (incidents[0]?.severity as IncidentSeverity | undefined) ?? null,
    onDutyGuardName: onDutyShift ? onDutyShift.guard.fullName : null,
  }
}

// ---------------------------------------------------------------------------
// LANDLORD
// ---------------------------------------------------------------------------

export async function getLandlordOverview(profile: Profile): Promise<LandlordOverviewDto> {
  const now = new Date()

  const properties = await db.property.findMany({ where: { landlordId: profile.id }, include: { units: true } })
  const unitIds = properties.flatMap((p) => p.units.map((u) => u.id))
  const [units, tenancies] = await Promise.all([
    unitIds.length ? db.unit.findMany({ where: { id: { in: unitIds } }, include: unitInclude }) : Promise.resolve([]),
    scopedActiveTenancies(unitIds),
  ])

  const rollup = await computeMoneyRollup(profile, tenancies, now)

  const totalUnits = units.length
  const occupied = units.filter((u) => u.status !== "VACANT").length // NOTICE still tenanted
  const vacant = totalUnits - occupied

  const [recentPayments, openTickets, security] = await Promise.all([
    db.payment.findMany({
      where: await paymentScopeWhere(profile),
      orderBy: { receivedAt: "desc" },
      take: 5,
      include: paymentInclude,
    }),
    // OPEN + IN_PROGRESS maintenance tickets across owned properties (Phase 2).
    db.maintenanceTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, unit: { property: { landlordId: profile.id } } },
    }),
    // Phase 3: eyes-on-the-ground digest.
    securityDigest({ landlordId: profile.id }),
  ])

  return {
    properties: properties.map((p) => ({
      ...toPropertyDto(p, p.units.length, p.units.filter((u) => u.status !== "VACANT").length),
    })),
    totals: {
      units: totalUnits,
      occupied,
      vacant,
      occupancyRatePct: pct(occupied, totalUnits),
      monthExpectedMinor: rollup.monthExpectedMinor,
      monthCollectedMinor: rollup.monthCollectedMinor,
      monthCollectedPrevMinor: rollup.monthCollectedPrevMinor,
      todayCollectedMinor: rollup.todayCollectedMinor,
      collectionRatePct: pct(rollup.monthCollectedMinor, rollup.monthExpectedMinor),
      arrearsMinor: rollup.arrearsMinor,
      arrearsTenantCount: rollup.arrearsTenantCount,
      unmatchedPayments: rollup.unmatchedPayments,
      openTickets,
    },
    arrears: rollup.arrears,
    recentPayments: recentPayments.map(toPaymentDto),
    vacancies: units.filter((u) => u.status === "VACANT").map((u) => toUnitDto(u, rollup.balances)),
    security,
    month: rollup.month,
  }
}

// ---------------------------------------------------------------------------
// CARETAKER — one plot
// ---------------------------------------------------------------------------

export async function getCaretakerOverview(profile: Profile): Promise<CaretakerOverviewDto> {
  const now = new Date()

  const property = await db.property.findFirst({ where: { caretakerId: profile.id }, include: { units: true } })
  if (!property) {
    throw new ApiHttpError(404, "No property assigned to this caretaker", "NOT_FOUND")
  }

  const [units, tenancies] = await Promise.all([
    db.unit.findMany({ where: { propertyId: property.id }, include: unitInclude }),
    scopedActiveTenancies(property.units.map((u) => u.id)),
  ])

  const rollup = await computeMoneyRollup(profile, tenancies, now)
  const [recentPayments, openTickets, security] = await Promise.all([
    db.payment.findMany({
      where: await paymentScopeWhere(profile),
      orderBy: { receivedAt: "desc" },
      take: 5,
      include: paymentInclude,
    }),
    // OPEN + IN_PROGRESS maintenance tickets on the caretaker's property (Phase 2).
    db.maintenanceTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, unit: { property: { caretakerId: profile.id } } },
    }),
    // Phase 3: eyes-on-the-ground digest.
    securityDigest({ caretakerId: profile.id }),
  ])

  const occupied = units.filter((u) => u.status !== "VACANT").length

  return {
    property: toPropertyDto(property, units.length, occupied),
    units: units.map((u) => toUnitDto(u, rollup.balances)),
    totals: {
      monthExpectedMinor: rollup.monthExpectedMinor,
      monthCollectedMinor: rollup.monthCollectedMinor,
      monthCollectedPrevMinor: rollup.monthCollectedPrevMinor,
      todayCollectedMinor: rollup.todayCollectedMinor,
      arrearsMinor: rollup.arrearsMinor,
      arrearsTenantCount: rollup.arrearsTenantCount,
      vacant: units.length - occupied,
      unmatchedPayments: rollup.unmatchedPayments,
      openTickets,
    },
    arrears: rollup.arrears,
    recentPayments: recentPayments.map(toPaymentDto),
    security,
    month: rollup.month,
  }
}

// ---------------------------------------------------------------------------
// TENANT — own money only
// ---------------------------------------------------------------------------

export async function getTenantOverview(profile: Profile): Promise<TenantOverviewDto> {
  const now = new Date()

  // ACTIVE first, NOTICE as the move-out fallback (Phase 2): a tenant on
  // notice still owns their deposit ledger, receipts and history — their home
  // must render, not error. ENDED tenancies stay hidden (a new one wins).
  const tenancy = await db.tenancy.findFirst({
    where: { tenantId: profile.id, status: { in: ["ACTIVE", "NOTICE"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], // "ACTIVE" < "NOTICE" alphabetically
    include: { unit: { include: { property: true } } },
  })
  if (!tenancy) {
    // Body says "no active tenancy" exactly — the UI keys off it.
    throw new ApiHttpError(404, "no active tenancy", "NOT_FOUND")
  }

  const [charges, payments, notifications, recentVisitors] = await Promise.all([
    db.rentCharge.findMany({ where: { tenancyId: tenancy.id }, include: chargeInclude }),
    db.payment.findMany({ where: { tenancyId: tenancy.id, status: "COMPLETED" }, include: paymentInclude }),
    db.notification.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    // Phase 3: who came to my unit — last 7 days, newest first (matrix §4.4).
    db.visitorLog.findMany({
      where: {
        unitId: tenancy.unitId,
        enteredAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
      },
      orderBy: { enteredAt: "desc" },
      take: 5,
      include: visitorLogInclude,
    }),
  ])

  // Newest first (dueDate desc), RENT before service charges within a period.
  charges.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime() || kindOrder(a.kind) - kindOrder(b.kind))
  payments.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())

  const chargesTotal = charges.reduce((sum, c) => sum + c.amountMinor, 0)
  const paymentsTotal = payments.reduce((sum, p) => sum + p.amountMinor, 0)
  const balanceMinor = chargesTotal - paymentsTotal // negative = credit (ADR-0007)

  // Next due: earliest unpaid charge; amount = what remains on that charge.
  const openCharges = charges.filter((c) => c.status !== "PAID").sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  const nextDue = openCharges[0] ?? null

  return {
    tenancy: {
      id: tenancy.id,
      unitLabel: tenancy.unit.label,
      propertyName: tenancy.unit.property.name,
      propertyLocation: tenancy.unit.property.location,
      accountRef: tenancy.accountRef,
      monthlyRentMinor: tenancy.monthlyRentMinor,
      depositHeldMinor: tenancy.depositHeldMinor,
      startDate: tenancy.startDate.toISOString(),
      status: tenancy.status as TenantOverviewDto["tenancy"]["status"],
      moveOutDate: tenancy.endDate ? tenancy.endDate.toISOString() : null,
    },
    totals: {
      balanceMinor,
      nextDueDate: nextDue ? nextDue.dueDate.toISOString() : null,
      nextDueAmountMinor: nextDue ? nextDue.amountMinor - nextDue.paidMinor : 0,
    },
    charges: charges.map(toChargeDto),
    receipts: payments.filter((p) => p.receiptNo).map(toReceiptDto),
    notifications: notifications.map(toNotificationDtoRow),
    recentVisitors: recentVisitors.map(toVisitorLogDto),
  }
}

// ---------------------------------------------------------------------------
// AGENT — portfolio KPIs only, no money fields (matrix §5 + §6)
// ---------------------------------------------------------------------------

export async function getAgentOverview(profile: Profile): Promise<AgentOverviewDto> {
  const properties = await db.property.findMany({
    where: { agentId: profile.id },
    include: { units: { select: { id: true, label: true, status: true, rentAmountMinor: true } } },
  })
  const units = properties.flatMap((p) => p.units.map((u) => ({ ...u, propertyName: p.name })))
  const occupied = units.filter((u) => u.status !== "VACANT").length
  const vacant = units.filter((u) => u.status === "VACANT")

  // Phase 4 funnel: listings on the agent's portfolio (any status) + the
  // live application pipeline scoped to the same portfolio.
  const [listings, applications] = await Promise.all([
    db.listing.findMany({
      where: { property: { agentId: profile.id } },
      include: listingInclude,
      orderBy: { updatedAt: "desc" },
    }),
    db.listingApplication.findMany({
      where: { property: { agentId: profile.id } },
      select: { status: true },
    }),
  ])

  // A vacant unit is "listed" when it has a listing in a live state (anything
  // but LET — a LET listing means the funnel closed and the unit is taken).
  const listedUnitIds = new Set(
    listings.filter((l) => l.status !== "LET").map((l) => l.unitId),
  )
  const unlistedVacantUnits = vacant
    .filter((u) => !listedUnitIds.has(u.id))
    .map((u) => ({
      id: u.id,
      label: u.label,
      propertyName: u.propertyName,
      rentAmountMinor: u.rentAmountMinor,
    }))

  const liveListings = listings.filter((l) => l.status === "PUBLISHED")
  const newApplications = applications.filter((a) => a.status === "NEW").length
  const activeApplications = applications.filter(
    (a) => a.status === "NEW" || a.status === "CONTACTED" || a.status === "VIEWING",
  ).length

  return {
    portfolioProperties: properties.map((p) =>
      toPropertyDto(p, p.units.length, p.units.filter((u) => u.status !== "VACANT").length)
    ),
    totals: {
      properties: properties.length,
      units: units.length,
      occupancyRatePct: pct(occupied, units.length),
      vacantUnits: vacant.length,
      liveListings: liveListings.length,
      newApplications,
      activeApplications,
    },
    unlistedVacantUnits,
    liveListings: liveListings.map(toListingDto),
  }
}

// ---------------------------------------------------------------------------
// GUARD — no money, ever (matrix §4.5/§6); the shift is the trust anchor
// ---------------------------------------------------------------------------

export async function getGuardOverview(profile: Profile): Promise<GuardOverviewDto> {
  const now = new Date()
  const midnight = startOfDay(now)

  // The guard's property scope: distinct properties from their shift history.
  const shifts = await db.guardShift.findMany({
    where: { guardId: profile.id },
    orderBy: { startedAt: "desc" },
    include: { property: { include: { units: true } } },
  })
  const propertiesById = new Map(shifts.map((s) => [s.propertyId, s.property]))
  const properties = [...propertiesById.values()]

  // ACTIVE shift (write anchor) — newest open one.
  const activeShift = shifts.find((s) => s.endedAt === null) ?? null
  const activeProperty = activeShift ? propertiesById.get(activeShift.propertyId) ?? null : null

  // Today's stats scoped to the guard's properties.
  const scopeIds = properties.map((p) => p.id)
  const propertyIn = scopeIds.length ? { propertyId: { in: scopeIds } } : { propertyId: "__never__" }
  const [visitorsToday, onSiteNow, unacknowledgedIncidents, recentVisitors] = await Promise.all([
    db.visitorLog.count({ where: { ...propertyIn, enteredAt: { gte: midnight } } }),
    db.visitorLog.count({ where: { ...propertyIn, exitedAt: null, enteredAt: { gte: midnight } } }),
    db.incidentReport.count({
      where: { ...propertyIn, acknowledgedById: null, guardId: profile.id },
    }),
    db.visitorLog.findMany({
      where: { ...propertyIn, enteredAt: { gte: midnight } },
      orderBy: { enteredAt: "desc" },
      take: 5,
      include: visitorLogInclude,
    }),
  ])

  return {
    property: activeProperty
      ? toPropertyDto(
          activeProperty,
          activeProperty.units.length,
          activeProperty.units.filter((u) => u.status !== "VACANT").length
        )
      : null,
    activeShift: activeShift
      ? {
          id: activeShift.id,
          propertyId: activeShift.propertyId,
          propertyName: activeShift.property.name,
          guardId: activeShift.guardId,
          guardName: profile.fullName,
          startedAt: activeShift.startedAt.toISOString(),
          endedAt: null,
          notes: null,
        }
      : null,
    properties: properties.map((p) =>
      toPropertyDto(p, p.units.length, p.units.filter((u) => u.status !== "VACANT").length)
    ),
    // Unit picker source for the Log-visitor sheet — the ACTIVE property's
    // units, label-sorted (the shifts query already includes them; guards
    // never touch /api/units). Empty when off duty (contract comment).
    activePropertyUnits: activeProperty
      ? [...activeProperty.units]
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((u) => ({ id: u.id, label: u.label }))
      : [],
    totals: {
      visitorsToday,
      onSiteNow,
      unacknowledgedIncidents,
    },
    recentVisitors: recentVisitors.map(toVisitorLogDto),
  }
}
