/**
 * NEST — tenant statement aggregation (Phase 6-a, issue #65).
 *
 * The tenant's portable payment record: month by month, what was billed,
 * what was settled, and the running balance. Disputes end here — every
 * number traces back to a charge row or a receipted payment.
 *
 * One payload per tenancy (GET /api/statements). A future CSV/share export
 * builds from the SAME rows, so screen and export can never disagree (the
 * kra.ts seam pattern, D-018).
 *
 * Scope + money rules (mirrors kra.ts / analytics.ts — the same seam):
 * - TENANT → own ACTIVE tenancy (matrix §4.4). LANDLORD/CARETAKER → tenancies
 *   in their scope via tenancyScopeWhere, ?tenancyId= required. GUARD/AGENT →
 *   403 at the route.
 * - Money is ALWAYS integer KES minor units — no floats on the wire.
 * - Read-only: this module never writes (no AuditLog rows, D-018).
 *
 * Month bucketing (the honest part):
 * - A month appears if a charge was raised in it OR a payment allocation
 *   landed on one of its charges. Quiet months are skipped, but the running
 *   balance carries through them — nothing resets.
 * - settledMinor uses charge.paidMinor (the waterfall ledger), NOT the
 *   payment's receivedAt month: a payment made in October that clears
 *   September rent shows on September's row, exactly where a human would
 *   look for it.
 * - paymentLines list the payments that touched the month's charges with
 *   their allocated slice — a cross-month payment appears on every month
 *   it settled, with the right slice.
 */

import type { Profile } from "@prisma/client"
import { z } from "zod"
import { db } from "@/lib/db"
import { notFound, parseSearchParams, tenancyScopeWhere } from "@/lib/auth-guard"
import type { StatementDto, StatementMonthDto, StatementPaymentLineDto } from "@/lib/types"

/** ?tenancyId= — required for landlord/caretaker reads; ignored for tenants. */
export const statementQuerySchema = z.object({
  tenancyId: z.string().min(1).optional(),
})

/**
 * Resolve the tenancy a statement may be built for:
 * - TENANT → their ACTIVE tenancy (a ?tenancyId= pointing anywhere else is
 *   ignored — the client is never trusted, matrix §7.2).
 * - LANDLORD/CARETAKER → the ?tenancyId= row re-fetched WITH the scope
 *   condition (a miss ⇒ 404 — existence must not leak).
 */
export async function resolveStatementTenancy(profile: Profile, request: Request) {
  const { tenancyId } = parseSearchParams(request, statementQuerySchema)

  const where =
    profile.role === "TENANT"
      ? { tenantId: profile.id, status: "ACTIVE" as const }
      : { id: tenancyId ?? "__never__", status: "ACTIVE" as const, ...tenancyScopeWhere(profile) }

  const tenancy = await db.tenancy.findFirst({
    where,
    select: {
      id: true,
      startDate: true,
      accountRef: true,
      tenant: { select: { fullName: true, phone: true } },
      unit: { select: { label: true, property: { select: { name: true } } } },
    },
  })
  if (!tenancy) {
    throw notFound("No statement is available for this tenancy")
  }
  return tenancy
}

/** Build the full statement for one tenancy. */
export async function getStatement(profile: Profile, request: Request): Promise<StatementDto> {
  const tenancy = await resolveStatementTenancy(profile, request)

  const [charges, payments] = await Promise.all([
    db.rentCharge.findMany({
      where: { tenancyId: tenancy.id },
      select: {
        id: true,
        kind: true,
        periodMonth: true,
        dueDate: true,
        amountMinor: true,
        paidMinor: true,
      },
      orderBy: [{ periodMonth: "asc" }, { kind: "asc" }],
    }),
    db.payment.findMany({
      where: { tenancyId: tenancy.id, status: "COMPLETED" },
      select: {
        id: true,
        receiptNo: true,
        source: true,
        receivedAt: true,
        amountMinor: true,
        allocations: { select: { chargeId: true, amountMinor: true } },
      },
      orderBy: { receivedAt: "asc" },
    }),
  ])

  // Charge id → period month (to place each allocation on the month it settled).
  const periodByChargeId = new Map(charges.map((c) => [c.id, c.periodMonth]))

  // --- Month assembly -------------------------------------------------------
  // months map: periodMonth → { billed lines, payments touching it }.
  const billedByMonth = new Map<string, typeof charges>()
  for (const charge of charges) {
    billedByMonth.set(charge.periodMonth, [...(billedByMonth.get(charge.periodMonth) ?? []), charge])
  }
  // allocatedMinor per (periodMonth, paymentId) — cross-month payments slice right.
  const allocatedByMonth = new Map<string, Map<number, StatementPaymentLineDto>>()
  for (const payment of payments) {
    for (const allocation of payment.allocations) {
      const period = periodByChargeId.get(allocation.chargeId)
      if (!period) continue // allocation to a charge outside this tenancy — impossible, guarded anyway
      let lines = allocatedByMonth.get(period)
      if (!lines) {
        lines = new Map()
        allocatedByMonth.set(period, lines)
      }
      const existing = lines.get(payment.id)
      if (existing) {
        existing.allocatedMinor += allocation.amountMinor
      } else {
        lines.set(payment.id, {
          paymentId: payment.id,
          receiptNo: payment.receiptNo,
          source: payment.source as StatementPaymentLineDto["source"],
          receivedAt: payment.receivedAt.toISOString(),
          amountMinor: payment.amountMinor,
          allocatedMinor: allocation.amountMinor,
        })
      }
    }
  }

  // Active months = billed ∪ allocated (chronological; "YYYY-MM" sorts as time).
  const activeMonths = [...new Set([...billedByMonth.keys(), ...allocatedByMonth.keys()])].sort(
    (a, b) => a.localeCompare(b),
  )

  // --- Running balance, oldest → newest ------------------------------------
  const months: StatementMonthDto[] = []
  let runningBalance = 0
  let totalBilled = 0
  let totalSettled = 0
  for (const period of activeMonths) {
    const billedLines = billedByMonth.get(period) ?? []
    const billedMinor = billedLines.reduce((sum, c) => sum + c.amountMinor, 0)
    const settledMinor = billedLines.reduce((sum, c) => sum + c.paidMinor, 0)
    // paidMinor is the waterfall ledger — payments that cleared THIS month's
    // charges, whenever they were actually handed over.
    const openingBalanceMinor = runningBalance
    runningBalance += billedMinor - settledMinor
    totalBilled += billedMinor
    totalSettled += settledMinor

    const paymentLines = [...(allocatedByMonth.get(period)?.values() ?? [])].sort(
      (a, b) => a.receivedAt.localeCompare(b.receivedAt),
    )

    months.push({
      periodMonth: period,
      openingBalanceMinor,
      billedLines: billedLines.map((c) => ({
        chargeId: c.id,
        kind: c.kind as StatementMonthDto["billedLines"][number]["kind"],
        dueDate: c.dueDate.toISOString(),
        amountMinor: c.amountMinor,
        paidMinor: c.paidMinor,
      })),
      billedMinor,
      paymentLines,
      settledMinor,
      closingBalanceMinor: runningBalance,
    })
  }

  return {
    tenancyId: tenancy.id,
    tenantName: tenancy.tenant.fullName,
    tenantPhone: tenancy.tenant.phone,
    unitLabel: tenancy.unit.label,
    propertyName: tenancy.unit.property.name,
    accountRef: tenancy.accountRef,
    startMonth: activeMonths[0] ?? tenancy.startDate.toISOString().slice(0, 7),
    months,
    totalBilledMinor: totalBilled,
    totalSettledMinor: totalSettled,
    closingBalanceMinor: runningBalance,
    generatedAt: new Date().toISOString(),
  }
}
