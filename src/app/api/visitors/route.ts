/**
 * NEST — GET/POST /api/visitors  (Task P3-a, issue #34)
 *
 * The gate register — people-in/people-out bookkeeping only. Guards never
 * touch money, and this module never carries an amount field (matrix §5).
 *
 * GET — role-scoped VisitorLogDto[] via visitorLogScopeWhere (Phase 3 matrix):
 *   GUARD              → the SHARED register at every property they have EVER
 *                        worked a shift at — a relieving guard must see the
 *                        entries the previous guard wrote (P3-0 frozen
 *                        decision),
 *   LANDLORD/CARETAKER → full history across their property chain,
 *   TENANT             → their ACTIVE-tenancy unit ONLY, further clipped to
 *                        the last 7 days (matrix §4.4 — "who came to my unit"
 *                        is a short-term question, not a surveillance feed),
 *   AGENT              → 403 (marketing role, not operations; the P3-0
 *                        fixtures froze AGENT→403 here, deny-by-default).
 * Ordering: enteredAt desc, newest first (P3-0 frozen decision — screens
 * render API order verbatim); take 100 — the register is append-only.
 *
 * POST — log an entry, GUARD only, and only while ON DUTY: propertyId is
 * DERIVED from guardActiveShift(profile) — the client NEVER sends it (the
 * ACTIVE shift is the trust anchor; every entry is attributed to the
 * property the guard is actually stationed at). Off duty ⇒ 409 CONFLICT
 * with guidance rather than 403/404 — the guard DOES have this power, they
 * just are not clocked in yet (P3-0 frozen decision). A unitId, when sent,
 * must sit on the shift's property (scope-checked in the same query — miss
 * ⇒ 404, existence must not leak, matrix §1).
 *
 * Side effect (never fatal): VISITOR_LOGGED audit row. Visitors deliberately
 * generate NO notifications — gate traffic is noise (P3-0 frozen decision).
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  guardActiveShift,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  requireRole,
  visitorLogScopeWhere,
} from "@/lib/auth-guard"
import { toVisitorLogDto, visitorLogInclude } from "@/lib/dto"
import { VISITOR_PURPOSES } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Matrix §4.4 — tenants see 7 days of gate traffic for their unit, nothing older. */
const TENANT_WINDOW_MS = 7 * 24 * 3_600_000

/** Kenyan-format phone: optional leading +, then 9–15 digits/spaces/dashes. */
const VISITOR_PHONE_RE = /^\+?[0-9\s-]{9,15}$/

const logVisitorSchema = z.object({
  visitorName: z.string().trim().min(2).max(80),
  // Optional by contract; the guard sheet sends "" when the field was skipped
  // — normalize that to null so the register renders "no phone" cleanly.
  visitorPhone: z
    .union([z.literal(""), z.string().trim().regex(VISITOR_PHONE_RE, "Phone must be 9-15 digits, optionally starting with +")])
    .optional()
    .transform((v) => (v ? v : null)),
  purpose: z.enum(VISITOR_PURPOSES),
  unitId: z.string().min(1).optional(),
})

export async function GET() {
  try {
    // requireRole (not bare requireProfile) so AGENT gets a real 403 instead
    // of a silently-empty 200 — the register is operations data.
    const profile = await requireRole("GUARD", "LANDLORD", "CARETAKER", "TENANT")

    // TENANT reads are clipped to the 7-day window; every other admitted
    // role sees the full register (capped at 100 rows).
    const where =
      profile.role === "TENANT"
        ? { ...visitorLogScopeWhere(profile), enteredAt: { gte: new Date(Date.now() - TENANT_WINDOW_MS) } }
        : visitorLogScopeWhere(profile)

    const rows = await db.visitorLog.findMany({
      where,
      include: visitorLogInclude,
      orderBy: { enteredAt: "desc" },
      take: 100,
    })

    return ok(rows.map(toVisitorLogDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("GUARD")
    const body = await parseJsonBody(request, logVisitorSchema)

    // propertyId never comes from the client — the ACTIVE shift is the write
    // anchor. Off-duty is a solvable state, hence 409 with guidance, not 403.
    const shift = await guardActiveShift(profile)
    if (!shift) {
      throw conflict("You must be on duty (start a shift) to log visitors")
    }

    // unitId, when sent, must belong to the shift's property — fetched with
    // the scope condition in the same query (miss ⇒ 404, matrix §1).
    let unitId: string | null = null
    if (body.unitId) {
      const unit = await db.unit.findFirst({
        where: { id: body.unitId, propertyId: shift.propertyId },
        select: { id: true },
      })
      if (!unit) throw notFound("Unit not found on this property")
      unitId = unit.id
    }

    const row = await db.visitorLog.create({
      data: {
        propertyId: shift.propertyId,
        unitId,
        visitorName: body.visitorName,
        visitorPhone: body.visitorPhone,
        purpose: body.purpose,
        guardId: profile.id,
      },
      include: visitorLogInclude,
    })

    await audit(profile.id, "VISITOR_LOGGED", "VisitorLog", row.id, {
      visitorName: row.visitorName,
      purpose: row.purpose,
      unitId: row.unitId,
    })

    return ok(toVisitorLogDto(row), 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
