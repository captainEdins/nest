/**
 * NEST — GET /api/rent-score/list (Phase 6-b, issue #66)
 *
 * Lightweight score list for staff arrears views: every ACTIVE tenancy in
 * the caller's scope with {tenancyId, tenantName, score, band} — one call,
 * no factor detail (the detail belongs to the tenant's own card).
 * Read-only, no AuditLog rows (D-018).
 *
 * Scope: LANDLORD / CARETAKER only. Others → 403.
 */

import { forbidden, handleRouteError, ok, requireProfile } from "@/lib/auth-guard"
import { getRentScoreList } from "@/lib/rent-score"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireProfile()
    if (profile.role !== "LANDLORD" && profile.role !== "CARETAKER") {
      throw forbidden("The score list is only available to staff roles")
    }
    return ok(await getRentScoreList(profile))
  } catch (error) {
    return handleRouteError(error)
  }
}
