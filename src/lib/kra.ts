/**
 * NEST — KRA/MRI tax assistant aggregation (Phase 5 wedge B, issue #59).
 *
 * Record-keeping assistance for Kenya's Monthly Rental Income (MRI) regime:
 * residential gross rent is taxed at 7.5% and filed monthly by the 20th.
 * NEST ships SUMMARY NUMBERS ONLY — never tax advice; the UI carries a
 * persistent disclaimer and the landlord verifies current KRA regulations.
 *
 * One payload per tax year (GET /api/kra/summary) + the CSV export
 * (GET /api/kra/export) built from the same rows, so the two always agree.
 *
 * Scope + money rules (mirrors src/lib/analytics.ts — the same seam):
 * - LANDLORD scope: properties where landlordId = profile.id, via
 *   Tenancy → Unit → Property; tenancy status ACTIVE (the same tenancy
 *   population the analytics trend uses, so the two screens never disagree).
 * - Money is ALWAYS integer KES minor units — no floats on the wire.
 * - Read-only: this module never writes (no AuditLog rows).
 *
 * Month bucketing (identical to analytics.ts):
 * - billedMinor    = Σ RentCharge.amountMinor whose dueDate falls in the
 *   month (a charge issued is billed).
 * - collectedMinor = Σ PaymentAllocation.amountMinor joined through its
 *   successful Payment (status COMPLETED) whose receivedAt (the money-landed
 *   date) falls in the month. UNMATCHED money is not collected yet.
 *
 * MRI estimate:
 *   mriEstimateMinor = Math.round(collectedMinor * 75 / 1000)
 * — 7.5% of the year's collected rent, rounded HALF-UP to the nearest
 * integer minor unit (75/1000 = 7.5% exactly in integer-ratio form; the
 * round() only matters when the 0.075 product lands on a half minor unit,
 * which whole-shilling data never produces in practice).
 */

import type { Profile } from "@prisma/client"
import { z } from "zod"
import { db } from "@/lib/db"
import { parseSearchParams } from "@/lib/auth-guard"
import type { KraMonthRowDto, KraSummaryDto } from "@/lib/types"

/** Short month labels ("Jan"…"Dec", 0-based index — same as analytics.ts). */
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

/**
 * ?year= — a 4-digit integer (e.g. 2025–2027). Anything else ("abcd", a
 * 3- or 5-digit number, a decimal) is a 400 VALIDATION. Absent → the
 * current year (applied by parseYear, not the schema, so the default is
 * computed per-request — the dev server survives New Year).
 */
export const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(1000).max(9999).optional(),
})

/** Resolve ?year= with the current-year default. Throws 400 via the guard. */
export function parseYear(request: Request): number {
  const { year } = parseSearchParams(request, yearQuerySchema)
  return year ?? new Date().getFullYear()
}

/** The 7.5% MRI estimate on `collectedMinor`, integer minor units. */
export function mriEstimateOf(collectedMinor: number): number {
  // 7.5% = 75/1000; Math.round → nearest integer minor unit (half up).
  return Math.round((collectedMinor * 75) / 1000)
}

/**
 * Calendar-year rollup Jan–Dec (12 rows, zeros included, calendar order) of
 * rent billed and rent collected in the landlord's scope, plus the year
 * totals and the 7.5% MRI estimate on collected rent.
 */
export async function getKraYearSummary(profile: Profile, year: number): Promise<KraSummaryDto> {
  // --- Scope: owned properties → their units → ACTIVE tenancies -----------
  const properties = await db.property.findMany({
    where: { landlordId: profile.id },
    select: { units: { select: { id: true } } },
  })
  const unitIds = properties.flatMap((property) => property.units.map((u) => u.id))
  const tenancies = unitIds.length
    ? await db.tenancy.findMany({
        where: { unitId: { in: unitIds }, status: "ACTIVE" },
        select: { id: true },
      })
    : []
  const tenancyIds = tenancies.map((t) => t.id)

  // --- Charges issued (billed) + matched COMPLETED money (collected) ------
  const charges = tenancyIds.length
    ? await db.rentCharge.findMany({
        where: { tenancyId: { in: tenancyIds } },
        select: { amountMinor: true, dueDate: true },
      })
    : []

  const payments = tenancyIds.length
    ? await db.payment.findMany({
        where: { tenancyId: { in: tenancyIds }, status: "COMPLETED" },
        select: { id: true, receivedAt: true },
      })
    : []
  const paymentIds = payments.map((p) => p.id)
  const allocations = paymentIds.length
    ? await db.paymentAllocation.findMany({
        where: { paymentId: { in: paymentIds } },
        select: { paymentId: true, amountMinor: true },
      })
    : []

  // --- 12 month buckets, Jan–Dec, zeros included (CSV parity) -------------
  const months: KraMonthRowDto[] = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    billedMinor: 0,
    collectedMinor: 0,
  }))

  for (const charge of charges) {
    if (charge.dueDate.getFullYear() !== year) continue
    months[charge.dueDate.getMonth()].billedMinor += charge.amountMinor
  }

  const receivedAtById = new Map(payments.map((p) => [p.id, p.receivedAt]))
  for (const allocation of allocations) {
    const receivedAt = receivedAtById.get(allocation.paymentId)
    if (!receivedAt || receivedAt.getFullYear() !== year) continue
    months[receivedAt.getMonth()].collectedMinor += allocation.amountMinor
  }

  const totals = months.reduce(
    (acc, row) => {
      acc.billedMinor += row.billedMinor
      acc.collectedMinor += row.collectedMinor
      return acc
    },
    { billedMinor: 0, collectedMinor: 0 },
  )

  return {
    year,
    months,
    totals,
    mriEstimateMinor: mriEstimateOf(totals.collectedMinor),
    generatedAt: new Date().toISOString(),
  }
}
