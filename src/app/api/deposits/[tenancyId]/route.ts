/**
 * NEST — GET /api/deposits/[tenancyId]  (Task P2-b, issue #22)
 *
 * LANDLORD / CARETAKER scoped read of one tenancy's deposit ledger for
 * settlement review (matrix §4.1/§4.2): the Deposit row (with its
 * append-only movements) plus the tenancy's condition reports, oldest
 * first — everything needed to decide a fair deduction before calling
 * POST /api/deposits/[tenancyId]/settle.
 *
 * The tenancy is fetched WITH the caller's deposit-scope condition in the
 * SAME query (depositTenancyScopeWhere: landlord / caretaker property
 * chain) — an out-of-scope or unknown id is a 404, so existence must not
 * leak. A tenancy with no Deposit row is a 404 too ("no deposit for
 * tenancy"). TENANT uses /api/deposits/mine; AGENT/GUARD → 403 (deposits
 * are money data — deny by default).
 */

import { db } from "@/lib/db"
import { depositTenancyScopeWhere, handleRouteError, notFound, ok, requireRole } from "@/lib/auth-guard"
import { conditionReportInclude, depositInclude, toDepositDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenancyId: string }> }
) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER")
    const { tenancyId } = await params

    const tenancy = await db.tenancy.findFirst({
      where: { id: tenancyId, ...depositTenancyScopeWhere(profile) },
      include: {
        deposit: { include: depositInclude },
        conditionReports: { include: conditionReportInclude, orderBy: { createdAt: "asc" } },
      },
    })
    if (!tenancy) throw notFound("Tenancy not found")
    if (!tenancy.deposit) throw notFound("No deposit for tenancy")

    return ok(toDepositDto(tenancy.deposit, tenancy.conditionReports))
  } catch (error) {
    return handleRouteError(error)
  }
}
