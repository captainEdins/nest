/**
 * NEST — GET /api/tenancies
 *
 * Scoped ACTIVE-tenancy picker list for payment collection screens:
 *   { id, tenantName, tenantPhone, unitLabel, propertyName, accountRef,
 *     monthlyRentMinor, balanceMinor }
 *
 * Scope (role-scope matrix §3/§4): landlord → own properties; caretaker →
 * the plot they run; agent → own portfolio; tenant → own ACTIVE tenancy.
 * GUARD → 403 (tenancies are NONE for guards). balanceMinor is the economic
 * balance (negative = tenant credit, ADR-0007).
 */

import { db } from "@/lib/db"
import { forbidden, handleRouteError, ok, requireProfile, tenancyScopeWhere } from "@/lib/auth-guard"
import { toTenancyPickerRow } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireProfile()
    if (profile.role === "GUARD") {
      throw forbidden("Guard role may not list tenancies")
    }

    // Phase 11: the picker keeps NOTICE tenancies — final rent is still
    // collectable through the whole notice window (money-in paths accept
    // ACTIVE + NOTICE; only ENDED goes dark).
    const tenancies = await db.tenancy.findMany({
      where: { status: { in: ["ACTIVE", "NOTICE"] }, ...tenancyScopeWhere(profile) },
      include: { tenant: true, unit: { include: { property: true } } },
      orderBy: { accountRef: "asc" },
    })

    const tenancyIds = tenancies.map((t) => t.id)
    const [charges, payments] =
      tenancyIds.length > 0
        ? await Promise.all([
            db.rentCharge.findMany({ where: { tenancyId: { in: tenancyIds } } }),
            db.payment.findMany({ where: { tenancyId: { in: tenancyIds }, status: "COMPLETED" } }),
          ])
        : [[], []]

    // Economic balance per tenancy: Σ charges raised − Σ matched payments.
    const chargeTotals = new Map<string, number>()
    for (const charge of charges) {
      chargeTotals.set(charge.tenancyId, (chargeTotals.get(charge.tenancyId) ?? 0) + charge.amountMinor)
    }
    const paymentTotals = new Map<string, number>()
    for (const payment of payments) {
      if (payment.tenancyId) {
        paymentTotals.set(payment.tenancyId, (paymentTotals.get(payment.tenancyId) ?? 0) + payment.amountMinor)
      }
    }

    return ok(
      tenancies.map((tenancy) =>
        toTenancyPickerRow(tenancy, (chargeTotals.get(tenancy.id) ?? 0) - (paymentTotals.get(tenancy.id) ?? 0))
      )
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
