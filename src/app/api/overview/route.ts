/**
 * NEST — GET /api/overview
 *
 * Branches on the session role (re-derived from the DB) and returns that
 * role's dashboard DTO — one API call per home screen:
 *   LANDLORD  → LandlordOverviewDto   (own properties' full money graph)
 *   CARETAKER → CaretakerOverviewDto  (the plot they run)
 *   TENANT    → TenantOverviewDto     (own ACTIVE tenancy only; 404 with
 *                                       body "no active tenancy" when none)
 *   AGENT     → AgentOverviewDto      (portfolio KPIs, no money fields)
 *   GUARD     → GuardOverviewDto      (no money fields — ever, matrix §6)
 *
 * Money definitions live in src/lib/overview.ts.
 */

import {
  getAgentOverview,
  getCaretakerOverview,
  getGuardOverview,
  getLandlordOverview,
  getTenantOverview,
} from "@/lib/overview"
import { forbidden, handleRouteError, ok, requireProfile } from "@/lib/auth-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireProfile()
    switch (profile.role) {
      case "LANDLORD":
        return ok(await getLandlordOverview(profile))
      case "CARETAKER":
        return ok(await getCaretakerOverview(profile))
      case "TENANT":
        return ok(await getTenantOverview(profile))
      case "AGENT":
        return ok(await getAgentOverview(profile))
      case "GUARD":
        return ok(await getGuardOverview())
      default:
        // Unknown role string in the DB — deny by default.
        throw forbidden()
    }
  } catch (error) {
    return handleRouteError(error)
  }
}
