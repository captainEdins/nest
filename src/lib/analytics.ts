/**
 * NEST — landlord analytics aggregation (Phase 5 wedge A, issue #57).
 *
 * One read-only payload for the landlord's Analytics screen (single API call,
 * per the design-system perf rule — queries are fixed-count, never N+1):
 *   1. monthly        — 6-month collection trend (billed vs collected),
 *   2. arrearsAging   — tenants bucketed by outstanding-balance age,
 *   3. occupancy      — occupied/vacant units per owned property.
 *
 * Scope + money rules (mirrors src/lib/overview.ts — the same seam):
 * - LANDLORD scope: properties where landlordId = profile.id, via
 *   Tenancy → Unit → Property. Aging balances use ACTIVE tenancies and the
 *   SAME math as the landlord home arrears (Σ charges − Σ matched COMPLETED
 *   payments; negative = tenant credit and is skipped, ADR-0007).
 * - Money is ALWAYS integer KES minor units — no floats, no fractional
 *   division anywhere in this module.
 * - Read-only: this module never writes (analytics records no AuditLog).
 *
 * Month bucketing (documented once, used for both series):
 * - billedMinor    = Σ RentCharge.amountMinor whose dueDate falls in the
 *   month (landlord scope; ALL charge statuses — a charge issued is billed).
 * - collectedMinor = Σ PaymentAllocation.amountMinor joined through its
 *   successful Payment (status COMPLETED) whose receivedAt (the "money
 *   landed" date, the same field the overview's monthCollected uses) falls
 *   in the month. UNMATCHED money is not "collected" until a human matches it.
 *
 * Aging buckets (age = whole days since the OLDEST unpaid charge's dueDate,
 * identical edge semantics to the client-side arrears screen):
 *   age ≤ 0 → current · 1–30 → d1_30 · 31–60 → d31_60 · ≥ 61 → d61plus.
 * "current" additionally holds tenants whose balance is exactly zero.
 */

import type { Profile } from "@prisma/client"
import { db } from "@/lib/db"
import type {
  AnalyticsMonthDto,
  ArrearsAgingDto,
  LandlordAnalyticsDto,
  OccupancyRowDto,
} from "@/lib/types"

/** Calendar months in the collection trend, current month included. */
const TREND_MONTHS = 6

/** Short month labels for chart axes ("Jan"…"Dec", 0-based index). */
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/** "YYYY-MM" for a date's local calendar month (same format as charges). */
function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * The last TREND_MONTHS calendar months INCLUDING the current one, OLDEST
 * first. Each entry carries its key, axis label and month boundaries so the
 * bucket comparison never needs string math.
 */
function trendMonths(now: Date): { monthKey: string; label: string; start: Date; end: Date }[] {
  const out: { monthKey: string; label: string; start: Date; end: Date }[] = []
  for (let back = TREND_MONTHS - 1; back >= 0; back -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1, 0, 0, 0, 0)
    out.push({ monthKey: monthKeyOf(start), label: MONTH_LABELS[start.getMonth()], start, end })
  }
  return out
}

/**
 * Calendar days from the due date's day to today (same day = 0 → not yet
 * overdue). Matches the shared arrears screen's daysSincePeriodDue semantics
 * exactly, so the two landlord views never disagree on a bucket.
 */
function daysOverdue(dueDate: Date, now: Date): number {
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((today - dueDay) / 86_400_000)
}

export async function getLandlordAnalytics(profile: Profile): Promise<LandlordAnalyticsDto> {
  const now = new Date()

  // --- Scope: owned properties → their units → ACTIVE tenancies -----------
  const properties = await db.property.findMany({
    where: { landlordId: profile.id },
    include: { units: { select: { id: true, status: true } } },
  })

  const occupancy: OccupancyRowDto[] = properties.map((property) => {
    const occupied = property.units.filter((u) => u.status !== "VACANT").length // NOTICE still tenanted
    return {
      propertyId: property.id,
      propertyName: property.name,
      occupied,
      vacant: property.units.length - occupied,
    }
  })

  const unitIds = properties.flatMap((property) => property.units.map((u) => u.id))
  const tenancies = unitIds.length
    ? await db.tenancy.findMany({
        where: { unitId: { in: unitIds }, status: "ACTIVE" },
        select: { id: true },
      })
    : []
  const tenancyIds = tenancies.map((t) => t.id)

  // --- Charges: full history (balances + trend buckets) --------------------
  const charges = tenancyIds.length
    ? await db.rentCharge.findMany({ where: { tenancyId: { in: tenancyIds } } })
    : []

  // --- Money received: matched COMPLETED payments + their allocations -----
  const payments = tenancyIds.length
    ? await db.payment.findMany({
        where: { tenancyId: { in: tenancyIds }, status: "COMPLETED" },
        select: { id: true, amountMinor: true, receivedAt: true, tenancyId: true },
      })
    : []
  const paymentIds = payments.map((p) => p.id)
  const allocations = paymentIds.length
    ? await db.paymentAllocation.findMany({
        where: { paymentId: { in: paymentIds } },
        select: { paymentId: true, amountMinor: true },
      })
    : []

  // --- 1) Monthly trend: bucket charges by dueDate month, allocations by
  //        the parent payment's receivedAt month. Integer sums only. --------
  const months = trendMonths(now)
  const monthIndex = new Map(months.map((m, i) => [m.monthKey, i]))
  const monthly: AnalyticsMonthDto[] = months.map((m) => ({
    monthKey: m.monthKey,
    label: m.label,
    billedMinor: 0,
    collectedMinor: 0,
  }))

  for (const charge of charges) {
    const index = monthIndex.get(monthKeyOf(charge.dueDate))
    if (index !== undefined) monthly[index].billedMinor += charge.amountMinor
  }

  const receivedAtById = new Map(payments.map((p) => [p.id, p.receivedAt]))
  for (const allocation of allocations) {
    const receivedAt = receivedAtById.get(allocation.paymentId)
    if (!receivedAt) continue
    const index = monthIndex.get(monthKeyOf(receivedAt))
    if (index !== undefined) monthly[index].collectedMinor += allocation.amountMinor
  }

  // --- 2) Arrears aging: balance + oldest unpaid charge per tenancy -------
  // Balance = Σ charges − Σ matched COMPLETED payments (overview.ts math);
  // negative = tenant credit → skipped. Oldest unpaid = earliest dueDate
  // among charges with outstanding > 0 (charge.paidMinor is the ledger sum
  // of allocations, so this never disagrees with the payment side).
  const chargeTotals = new Map<string, number>()
  const paymentTotals = new Map<string, number>()
  const oldestUnpaidDue = new Map<string, Date>()

  for (const charge of charges) {
    chargeTotals.set(charge.tenancyId, (chargeTotals.get(charge.tenancyId) ?? 0) + charge.amountMinor)
    if (charge.amountMinor - charge.paidMinor > 0) {
      const current = oldestUnpaidDue.get(charge.tenancyId)
      if (!current || charge.dueDate < current) {
        oldestUnpaidDue.set(charge.tenancyId, charge.dueDate)
      }
    }
  }
  for (const payment of payments) {
    // The where-clause `tenancyId in ids` guarantees non-null; TS can't see it.
    if (!payment.tenancyId) continue
    paymentTotals.set(payment.tenancyId, (paymentTotals.get(payment.tenancyId) ?? 0) + payment.amountMinor)
  }

  const aging: ArrearsAgingDto = {
    current: { count: 0, totalMinor: 0 },
    d1_30: { count: 0, totalMinor: 0 },
    d31_60: { count: 0, totalMinor: 0 },
    d61plus: { count: 0, totalMinor: 0 },
  }
  for (const tenancyId of tenancyIds) {
    const balance = (chargeTotals.get(tenancyId) ?? 0) - (paymentTotals.get(tenancyId) ?? 0)
    if (balance < 0) continue // tenant credit (ADR-0007) — never an arrears row
    if (balance === 0) {
      aging.current.count += 1
      continue
    }
    const due = oldestUnpaidDue.get(tenancyId)
    const age = due ? daysOverdue(due, now) : 0 // no unpaid charge ⇒ nothing past due
    if (age <= 0) {
      aging.current.count += 1
      aging.current.totalMinor += balance
    } else if (age <= 30) {
      aging.d1_30.count += 1
      aging.d1_30.totalMinor += balance
    } else if (age <= 60) {
      aging.d31_60.count += 1
      aging.d31_60.totalMinor += balance
    } else {
      aging.d61plus.count += 1
      aging.d61plus.totalMinor += balance
    }
  }

  return { monthly, arrearsAging: aging, occupancy, generatedAt: now.toISOString() }
}
