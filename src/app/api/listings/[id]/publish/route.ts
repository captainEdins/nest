/**
 * NEST — POST /api/listings/[id]/publish  (Task P4-b, issue #46)
 *
 * Take a listing live: DRAFT or PAUSED → PUBLISHED. AGENT + LANDLORD
 * (matrix §4.2 — the marketing surface flips live at the owner's side).
 * Any other source status → 409 "That status change is not allowed from
 * here" (a LET listing is closed history; a PUBLISHED one is already live).
 *
 * The listing is fetched WITH the caller's scope condition in the same query
 * (miss → 404 — existence must not leak, matrix §1). Verb sub-path POST —
 * the api client is GET/POST only, matching /api/incidents/[id]/ack.
 *
 * Side effect (never fatal): LISTING_PUBLISHED audit row with the rent via
 * formatKes (seed detail format). No notification — publishing is the
 * agent's own pipeline step, not a landlord event.
 *
 * Body: none. Returns ApiOk<ListingDto>.
 */

import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { conflict, handleRouteError, notFound, ok, requireRole, listingScopeWhere } from "@/lib/auth-guard"
import { listingInclude, toListingDto } from "@/lib/dto"
import { formatKes } from "@/lib/money"

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

    if (listing.status !== "DRAFT" && listing.status !== "PAUSED") {
      throw conflict("That status change is not allowed from here")
    }

    const updated = await db.listing.update({
      where: { id: listing.id },
      data: { status: "PUBLISHED" },
      include: listingInclude,
    })

    await audit(profile.id, "LISTING_PUBLISHED", "Listing", listing.id, {
      unit: updated.unit.label,
      rent: formatKes(updated.rentAmountMinor),
      by: profile.fullName,
    })

    return ok(toListingDto(updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
