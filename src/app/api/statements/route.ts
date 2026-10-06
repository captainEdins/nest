/**
 * NEST — GET /api/statements (Phase 6-a, issue #65)
 *
 * The tenant's portable monthly statement: billed vs settled vs running
 * balance, one row per active month. Read-only derivation of the append-only
 * ledger — never writes, no AuditLog rows (D-018).
 *
 * Scope (role-scope matrix §4):
 * - TENANT      → own ACTIVE tenancy (?tenancyId= ignored — never trusted).
 * - LANDLORD /
 *   CARETAKER   → ?tenancyId= required, re-fetched inside their scope.
 * - GUARD, AGENT → 403 (money is out of their lanes).
 */

import { forbidden, handleRouteError, ok, requireProfile } from "@/lib/auth-guard"
import { getStatement } from "@/lib/statements"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const profile = await requireProfile()
    if (profile.role === "GUARD" || profile.role === "AGENT") {
      throw forbidden("Statements are not available for this role")
    }
    const statement = await getStatement(profile, request)
    return ok(statement)
  } catch (error) {
    return handleRouteError(error)
  }
}
