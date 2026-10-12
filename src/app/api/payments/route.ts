/**
 * NEST — GET /api/payments  (Phase 14, issue #86)
 *
 * The full ledger read behind the Payments / Collections tab. The overview's
 * `recentPayments` (take 5) stays the home-screen strip; THIS endpoint is the
 * real ledger: newest first, take ≤ 60, optional ?propertyId= filter (the
 * multi-plot portfolio view, D-027).
 *
 * Roles (matrix §5): LANDLORD / CARETAKER / AGENT — each strictly scoped via
 * paymentScopeWhere (property chain OR their visible unmatched slice, so the
 * match queue keeps working from this list too). GUARD: 403 by role. TENANT:
 * 403 — their money surface is receipts + statement (§5.2), not the ledger.
 *
 * ?propertyId= narrows to that property's payments. Unmatched payments have
 * no tenancy, so a property filter EXCLUDES them by construction — money that
 * belongs to no plot yet is exactly what "All plots" is for.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import {
  forbidden,
  handleRouteError,
  ok,
  parseSearchParams,
  requireProfile,
  paymentScopeWhere,
} from "@/lib/auth-guard"
import { paymentInclude, toPaymentDto } from "@/lib/dto"
import type { Profile } from "@prisma/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  propertyId: z.string().min(1).optional(),
})

/** Cap the ledger read — the tab is a ledger, not an export (KRA CSV owns that). */
const MAX_TAKE = 60

export async function GET(request: Request) {
  try {
    const profile = await requireProfile()
    if (profile.role !== "LANDLORD" && profile.role !== "CARETAKER" && profile.role !== "AGENT") {
      throw forbidden("The payments ledger is a staff view")
    }
    const { propertyId } = parseSearchParams(request, querySchema)

    const where = await paymentsWhere(profile, propertyId)
    const payments = await db.payment.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: MAX_TAKE,
      include: paymentInclude,
    })

    return ok(payments.map(toPaymentDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

async function paymentsWhere(profile: Profile, propertyId?: string) {
  const scope = await paymentScopeWhere(profile)
  if (!propertyId) return scope
  // AND-combine: the property filter can only NARROW the caller's scope —
  // a propertyId outside scope simply matches nothing (existence doesn't leak).
  return { AND: [scope, { tenancy: { unit: { propertyId } } }] }
}
