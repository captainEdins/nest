/**
 * NEST — POST /api/visitors/[id]/exit  (Task P3-a, issue #34)
 *
 * Mark a visitor OUT of the gate register. GUARD only, and only on a
 * register they can read: the row is fetched WITH visitorLogScopeWhere in
 * the SAME query — an id from a property the guard has never worked at is
 * a 404, never a 403 (existence must not leak, matrix §1). The scope form
 * also means any guard on the shared register can sign out a visitor
 * another guard logged — relief must be able to close open entries
 * (P3-0 frozen decision: the register is shared, shift-agnostic on reads).
 *
 * No on-duty (ACTIVE-shift) requirement here, unlike POST /api/visitors:
 * exit does not attribute a new entry to a property — it only stamps a
 * timestamp on an already-attributed, already-scoped row. The P3-0 fixture
 * contract froze this shape (GUARD + 404 + 409, no shift check).
 *
 * Idempotency guard: exitedAt already set ⇒ 409 CONFLICT — exit is one
 * timestamp, not a timeline; a second attempt means a stale UI row.
 *
 * Side effect (never fatal): VISITOR_EXIT audit row. No notification —
 * gate traffic is noise (P3-0 frozen decision).
 */

import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  handleRouteError,
  notFound,
  ok,
  requireRole,
  visitorLogScopeWhere,
} from "@/lib/auth-guard"
import { toVisitorLogDto, visitorLogInclude } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await requireRole("GUARD")
    const { id } = await params

    // Scope-checked fetch — a miss is indistinguishable from "does not exist".
    const log = await db.visitorLog.findFirst({
      where: { id, ...visitorLogScopeWhere(profile) },
      include: visitorLogInclude,
    })
    if (!log) throw notFound("Visitor log not found")

    if (log.exitedAt) throw conflict("Visitor already marked out")

    const updated = await db.visitorLog.update({
      where: { id: log.id },
      data: { exitedAt: new Date() },
      include: visitorLogInclude,
    })

    await audit(profile.id, "VISITOR_EXIT", "VisitorLog", log.id, {
      visitorName: log.visitorName,
    })

    return ok(toVisitorLogDto(updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
