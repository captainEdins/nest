/**
 * NEST — GET /api/rent-score (Phase 6-b, issue #66)
 *
 * The payment-record score for one tenancy. Read-only derivation of the
 * append-only ledger — never writes, no AuditLog rows (D-018).
 *
 * Scope (role-scope matrix §4):
 * - TENANT        → own ACTIVE tenancy (?tenancyId= ignored — never trusted).
 * - LANDLORD /
 *   CARETAKER     → ?tenancyId= required, re-fetched inside their scope.
 * - GUARD, AGENT  → 403 (money is out of their lanes).
 */

import { forbidden, handleRouteError, ok, requireProfile } from "@/lib/auth-guard"
import { getRentScore } from "@/lib/rent-score"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const profile = await requireProfile()
    if (profile.role === "GUARD" || profile.role === "AGENT") {
      throw forbidden("Rent scores are not available for this role")
    }
    return ok(await getRentScore(profile, request))
  } catch (error) {
    return handleRouteError(error)
  }
}
