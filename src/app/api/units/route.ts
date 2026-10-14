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
 *
 * Phase 26 (issue #121): POST creates a unit — the structural write stays
 * LANDLORD-only (the owner's decision; caretaker/agent read the directory but
 * never reshape the building). Label uniqueness rides the model's
 * @@unique([propertyId, label]) — a duplicate answers 409 CONFLICT. New
 * units start VACANT; every creation lands in AuditLog (UNIT_CREATED).
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { conflict, handleRouteError, notFound, ok, parseJsonBody, requireRole } from "@/lib/auth-guard"
import type { UnitDto, UnitStatus, UnitType } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Label shape kept generous but bounded: "A1", "B 2", "Shop 3"… */
const createSchema = z.object({
  propertyId: z.string().min(1),
  label: z
    .string()
    .trim()
    .min(1, "label is required")
    .max(12, "label must be at most 12 characters")
    .regex(/^[A-Za-z0-9][A-Za-z0-9 /-]*$/, "label may only use letters, digits, spaces and dashes"),
  type: z.enum(["BEDSITTER", "SINGLE", "ONE_BR", "TWO_BR", "THREE_BR", "SHOP"]),
  rentAmountMinor: z.number().int().positive().max(100_000_000), // ≤ KSh 1,000,000
  depositAmountMinor: z.number().int().min(0).max(100_000_000), // 0 = negotiated at move-in
})

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

/**
 * Phase 26 (issue #121) — POST /api/units: the landlord adds a unit to an
 * owned property. Structural writes are the owner's alone (caretaker/agent
 * read the directory; they never reshape the building) — 403 otherwise.
 *
 * Guarantees:
 * - property must be OWNED by the caller (miss → 404, no existence leak);
 * - label unique within the property (pre-check + the model's
 *   @@unique([propertyId, label]) as backstop) → 409 CONFLICT on a duplicate;
 * - the unit is born VACANT — tenancies (and their deposits) are the
 *   move-in flow's business, never this route's;
 * - AuditLog UNIT_CREATED rides every creation (post-commit by design).
 */
export async function POST(request: Request) {
  try {
    const profile = await requireRole("LANDLORD")
    const input = await parseJsonBody(request, createSchema)

    // Scope the property to the caller — a miss is a 404 either way.
    const property = await db.property.findFirst({
      where: { id: input.propertyId, landlordId: profile.id },
      select: { id: true, name: true },
    })
    if (!property) throw notFound("Property not found")

    // Label uniqueness within the property (model constraint as backstop).
    const duplicate = await db.unit.findFirst({
      where: { propertyId: property.id, label: input.label },
      select: { id: true },
    })
    if (duplicate != null) {
      throw conflict(`A unit labelled ${input.label} already exists on this property`)
    }

    const unit = await db.unit.create({
      data: {
        propertyId: property.id,
        label: input.label,
        type: input.type,
        rentAmountMinor: input.rentAmountMinor,
        depositAmountMinor: input.depositAmountMinor,
        status: "VACANT",
      },
    })

    await audit(profile.id, "UNIT_CREATED", "Unit", unit.id, {
      propertyId: property.id,
      propertyName: property.name,
      label: input.label,
      type: input.type,
      rentAmountMinor: input.rentAmountMinor,
      depositAmountMinor: input.depositAmountMinor,
      createdBy: profile.fullName,
    })

    // A fresh unit has no tenancy — the DTO's economic fields start at zero.
    const dto: UnitDto = {
      id: unit.id,
      propertyId: unit.propertyId,
      propertyName: property.name,
      label: unit.label,
      type: unit.type as UnitType,
      status: unit.status as UnitStatus,
      rentAmountMinor: unit.rentAmountMinor,
      depositAmountMinor: unit.depositAmountMinor,
      tenancy: null,
    }
    return ok(dto, 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
