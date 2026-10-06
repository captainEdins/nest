/**
 * NEST — GET/POST /api/listings  (Task P4-b, issue #46)
 *
 * The marketing funnel's root. AGENT + LANDLORD only (matrix §4.2 — the
 * listing is the agent's core module and the landlord's asset; CARETAKER/
 * TENANT/GUARD get a real 403 via requireRole).
 *
 * GET — role-scoped ListingDto[] via listingScopeWhere, newest-updated first.
 * Optional ?status= filter validated against LISTING_STATUSES (anything else
 * is a 400 VALIDATION, never a silently-ignored value).
 *
 * POST — create a DRAFT listing for a VACANT unit. The unit is fetched WITH
 * the caller's property-scope condition in the same query (miss → 404 —
 * existence must not leak, matrix §1): property.agentId = SELF for agents,
 * property.landlordId = SELF for landlords. propertyId is DERIVED from the
 * unit server-side — the client never sends it. Two 409 guards keep the
 * funnel honest: (1) the unit must be VACANT, (2) no other live (non-LET)
 * listing may already point at it. rentAmountMinor defaults to the unit's
 * rent when the client omits it (money is always integer KES minor units).
 *
 * Side effect (never fatal): LISTING_CREATED audit row. No notification —
 * a draft is internal until PUBLISHED.
 *
 * Body: CreateListingRequest. Returns 201 ApiOk<ListingDto>.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  parseSearchParams,
  requireRole,
  listingScopeWhere,
} from "@/lib/auth-guard"
import { listingInclude, toListingDto } from "@/lib/dto"
import { LISTING_STATUSES } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const listQuerySchema = z.object({
  status: z.enum(LISTING_STATUSES).optional(),
})

const createListingSchema = z.object({
  unitId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  // Integer KES minor units — never a float on the wire.
  rentAmountMinor: z.number().int().positive().optional(),
})

export async function GET(request: Request) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const { status } = parseSearchParams(request, listQuerySchema)

    const rows = await db.listing.findMany({
      where: { ...listingScopeWhere(profile), ...(status ? { status } : {}) },
      include: listingInclude,
      orderBy: { updatedAt: "desc" },
    })

    return ok(rows.map(toListingDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const body = await parseJsonBody(request, createListingSchema)

    // The unit is the trust anchor — fetched WITH the caller's property scope
    // in the same query, so an out-of-scope unitId is a 404 (no leak, §1).
    // propertyId is derived from this row; the client never sends it.
    const unit = await db.unit.findFirst({
      where: {
        id: body.unitId,
        property: profile.role === "AGENT" ? { agentId: profile.id } : { landlordId: profile.id },
      },
      include: { property: { select: { id: true, name: true } } },
    })
    if (!unit) throw notFound("Unit not found")

    if (unit.status !== "VACANT") {
      throw conflict("That unit is not vacant")
    }

    // One live listing per unit: anything but LET is still marketing the unit.
    const existingLive = await db.listing.findFirst({
      where: { unitId: unit.id, status: { not: "LET" } },
      select: { id: true },
    })
    if (existingLive) {
      throw conflict("This unit already has an active listing")
    }

    const created = await db.listing.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        title: body.title,
        description: body.description,
        rentAmountMinor: body.rentAmountMinor ?? unit.rentAmountMinor,
        status: "DRAFT",
      },
    })

    await audit(profile.id, "LISTING_CREATED", "Listing", created.id, {
      unit: unit.label,
      title: created.title,
      by: profile.fullName,
    })

    const row = await db.listing.findUniqueOrThrow({
      where: { id: created.id },
      include: listingInclude,
    })
    return ok(toListingDto(row), 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
