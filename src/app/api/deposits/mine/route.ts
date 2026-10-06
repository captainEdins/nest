/**
 * NEST — GET /api/deposits/mine  (Task P2-b, issue #22)
 *
 * TENANT-only read of the caller's own deposit ledger — the trust view:
 * the Deposit row on their ACTIVE/NOTICE tenancy (depositTenancyScopeWhere,
 * matrix §4.4 — the deposit stays visible through a move-out settlement),
 * every append-only movement (HOLD / DEDUCT / REFUND / ADJUST, oldest
 * first) and the tenancy's condition reports (MOVE_IN / MOVE_OUT).
 *
 * No scoped tenancy or no Deposit row on it → 404 (same not-found shape as
 * every scoped read — existence must not leak). Staff use
 * GET /api/deposits/[tenancyId]; AGENT/GUARD get nothing (money data).
 */

import { db } from "@/lib/db"
import { depositTenancyScopeWhere, handleRouteError, notFound, ok, requireRole } from "@/lib/auth-guard"
import { conditionReportInclude, depositInclude, toDepositDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireRole("TENANT")

    // The caller's deposit-bearing tenancy in scope (tenantId = profile.id,
    // status ACTIVE|NOTICE). Newest first so a tenant with history sees their
    // current tenancy deterministically.
    const tenancy = await db.tenancy.findFirst({
      where: { deposit: { isNot: null }, ...depositTenancyScopeWhere(profile) },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    if (!tenancy) throw notFound("No active tenancy with a deposit was found for this account")

    const [deposit, reports] = await Promise.all([
      db.deposit.findUnique({ where: { tenancyId: tenancy.id }, include: depositInclude }),
      db.conditionReport.findMany({
        where: { tenancyId: tenancy.id },
        include: conditionReportInclude,
        orderBy: { createdAt: "asc" },
      }),
    ])
    if (!deposit) throw notFound("No deposit is held against this tenancy")

    return ok(toDepositDto(deposit, reports))
  } catch (error) {
    return handleRouteError(error)
  }
}
