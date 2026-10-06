/**
 * NEST — GET /api/listings/[id]  (Task P4-b, issue #46)
 *
 * Listing detail: the ListingDto fields plus the full applicant list
 * (newest first) with each application's append-only event timeline
 * (oldest first — the trust record). AGENT + LANDLORD only (matrix §4.2).
 *
 * The listing is fetched WITH the caller's scope condition in the same query
 * (miss → 404 — existence must not leak, matrix §1). Read-only: no audit,
 * no notification.
 *
 * Returns ApiOk<ListingDetailDto>.
 */

import { db } from "@/lib/db"
import { handleRouteError, notFound, ok, requireRole, listingScopeWhere } from "@/lib/auth-guard"
import { listingDetailInclude, toListingDetailDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const { id } = await params

    const row = await db.listing.findFirst({
      where: { id, ...listingScopeWhere(profile) },
      include: listingDetailInclude,
    })
    if (!row) throw notFound("Listing not found")

    return ok(toListingDetailDto(row))
  } catch (error) {
    return handleRouteError(error)
  }
}
