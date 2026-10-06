/**
 * NEST — POST /api/listings/[id]/pause  (Task P4-b, issue #46)
 *
 * Pause a live listing: PUBLISHED → PAUSED (the unit stays vacant, the
 * marketing goes quiet — no new applicants should arrive). AGENT + LANDLORD
 * (matrix §4.2). Any other source status → 409 "That status change is not
 * allowed from here". A PAUSED listing resumes via the publish sub-path.
 *
 * The listing is fetched WITH the caller's scope condition in the same query
 * (miss → 404 — existence must not leak, matrix §1). Verb sub-path POST —
 * the api client is GET/POST only, matching /api/shifts/[id]/end.
 *
 * Side effect (never fatal): LISTING_PAUSED audit row. No notification.
 *
 * Body: none. Returns ApiOk<ListingDto>.
 */

import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { conflict, handleRouteError, notFound, ok, requireRole, listingScopeWhere } from "@/lib/auth-guard"
import { listingInclude, toListingDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const { id } = await params

    // Scope check in the same query — an out-of-scope listing is a 404.
    const listing = await db.listing.findFirst({
      where: { id, ...listingScopeWhere(profile) },
      include: listingInclude,
    })
    if (!listing) throw notFound("Listing not found")

    if (listing.status !== "PUBLISHED") {
      throw conflict("That status change is not allowed from here")
    }

    const updated = await db.listing.update({
      where: { id: listing.id },
      data: { status: "PAUSED" },
      include: listingInclude,
    })

    await audit(profile.id, "LISTING_PAUSED", "Listing", listing.id, {
      unit: updated.unit.label,
      title: updated.title,
      by: profile.fullName,
    })

    return ok(toListingDto(updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
