/**
 * NEST — /api/units (Task P2-d, issue #24).
 *
 * Landlord/caretaker unit directory that powers the deposit-settlement entry
 * point on the Properties screen (Properties → NOTICE unit → Settle deposit).
 *
 * Why this route exists: the overview payload only carries `vacancies`
 * (VACANT-only) and /api/tenancies only ACTIVE tenancies, so no existing
 * endpoint surfaces a NOTICE unit or its tenancy id to the landlord. The
 * frozen Phase 2 mapper (dto.ts `unitInclude`) also filters tenancies to
 * ACTIVE, so this route is deliberately self-contained — its own include and
 * its own UnitDto mapping — rather than touching the frozen contract files.
 *
 * Scope matrix (same read scope as GET /api/deposits/[tenancyId]):
 * LANDLORD → units of owned properties; CARETAKER → units of the assigned
 * property. Everyone else → 403.
 *
 * Tenancy on each unit = the CURRENT one (ACTIVE preferred, NOTICE next — the
 * move-out story); balanceMinor is the honest economic position (Σ charges −
 * Σ matched COMPLETED payments, identical definition to computeMoneyRollup —
 * negative = tenant credit, ADR-0007).
 */

import { db } from "@/lib/db"
import { handleRouteError, ok, requireRole } from "@/lib/auth-guard"
import type { UnitDto, UnitStatus, UnitType } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER")

    const units = await db.unit.findMany({
      where:
        profile.role === "LANDLORD"
          ? { property: { landlordId: profile.id } }
          : { property: { caretakerId: profile.id } },
      include: {
        property: { select: { id: true, name: true } },
        tenancies: {
          // Phase 11: ENDED tenancies stay visible while their deposit is
          // still HELD — the settlement action must survive the move-out
          // (the settle route itself allows NOTICE and ENDED alike).
          where: {
            OR: [
              { status: { in: ["ACTIVE", "NOTICE"] } },
              { status: "ENDED", deposit: { status: "HELD" } },
            ],
          },
          include: { tenant: true },
          orderBy: { startDate: "desc" },
        },
      },
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
    })

    // Economic balance per current tenancy: charges raised − money received.
    const tenancyIds = units.flatMap((unit) => unit.tenancies.map((t) => t.id))
    const balances = new Map<string, number>()
    if (tenancyIds.length > 0) {
      const [charges, payments] = await Promise.all([
        db.rentCharge.findMany({ where: { tenancyId: { in: tenancyIds } } }),
        db.payment.findMany({
          where: { tenancyId: { in: tenancyIds }, status: "COMPLETED" },
        }),
      ])
      for (const charge of charges) {
        balances.set(charge.tenancyId, (balances.get(charge.tenancyId) ?? 0) + charge.amountMinor)
      }
      for (const payment of payments) {
        if (!payment.tenancyId) continue
        balances.set(payment.tenancyId, (balances.get(payment.tenancyId) ?? 0) - payment.amountMinor)
      }
    }

    const dtos: UnitDto[] = units.map((unit) => {
      // Current tenancy: ACTIVE beats NOTICE beats an ENDED lease whose
      // deposit is still HELD (the settle action must survive move-out).
      const tenancy =
        unit.tenancies.find((t) => t.status === "ACTIVE") ??
        unit.tenancies.find((t) => t.status === "NOTICE") ??
        unit.tenancies[0] ??
        null
      return {
        id: unit.id,
        propertyId: unit.propertyId,
        propertyName: unit.property.name,
        label: unit.label,
        type: unit.type as UnitType,
        status: unit.status as UnitStatus,
        rentAmountMinor: unit.rentAmountMinor,
        depositAmountMinor: unit.depositAmountMinor,
        tenancy: tenancy
          ? {
              id: tenancy.id,
              tenantId: tenancy.tenantId,
              tenantName: tenancy.tenant.fullName,
              tenantPhone: tenancy.tenant.phone,
              accountRef: tenancy.accountRef,
              monthlyRentMinor: tenancy.monthlyRentMinor,
              startDate: tenancy.startDate.toISOString(),
              balanceMinor: balances.get(tenancy.id) ?? 0,
              moveOutDate: tenancy.endDate ? tenancy.endDate.toISOString() : null,
              tenancyStatus: tenancy.status as "ACTIVE" | "NOTICE" | "ENDED",
            }
          : null,
      }
    })

    return ok(dtos)
  } catch (error) {
    return handleRouteError(error)
  }
}
