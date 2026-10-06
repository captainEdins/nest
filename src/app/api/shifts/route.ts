/**
 * NEST — GET/POST /api/shifts  (Task P3-b, issue #35)
 *
 * GET — the on-duty record, role-scoped via shiftScopeWhere (Phase 3
 * matrix): GUARD sees ALL guards' shifts at the properties they have worked
 * (handover relay — the relieving guard reads the outgoing note before
 * taking the gate), LANDLORD/CARETAKER see the shifts at their properties
 * (who is on the gate right now). TENANT/AGENT → 403 (a shift log is
 * operations data). Newest first, take 50.
 *
 * POST — GUARD starts a shift. Two guard rails, checked in this order:
 *   1. Past-shift link: the property must be one the guard has ALREADY
 *      worked at. The check runs inside the property query itself
 *      (guardPropertyIds semantics) — a miss is a 403 with the remedy, not
 *      a 404: first-shift bootstrap is a landlord-side invite flow,
 *      deliberately out of scope this round (documented Phase 3.x
 *      candidate), so a guard must never be able to self-assign to an
 *      arbitrary property by guessing ids.
 *   2. One live shift at a time: an existing ACTIVE shift
 *      (guardActiveShift) → 409 "You are already on duty" — property
 *      agnostic, because the remedy is "end the current shift first".
 *
 * Side effect (never fatal): SHIFT_START audit. Returns 201
 * ApiOk<GuardShiftDto> fetched with guardShiftInclude.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  forbidden,
  guardActiveShift,
  handleRouteError,
  ok,
  parseJsonBody,
  requireRole,
  shiftScopeWhere,
} from "@/lib/auth-guard"
import { guardShiftInclude, toGuardShiftDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const startSchema = z.object({
  propertyId: z.string().min(1),
})

export async function GET() {
  try {
    const profile = await requireRole("GUARD", "LANDLORD", "CARETAKER")

    const shifts = await db.guardShift.findMany({
      where: shiftScopeWhere(profile),
      include: guardShiftInclude,
      orderBy: { startedAt: "desc" },
      take: 50,
    })

    return ok(shifts.map(toGuardShiftDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("GUARD")
    const body = await parseJsonBody(request, startSchema)

    // Past-shift link in the same query — also the only fetch of the
    // property name needed by the audit row below.
    const property = await db.property.findFirst({
      where: { id: body.propertyId, guardShifts: { some: { guardId: profile.id } } },
      select: { id: true, name: true },
    })
    if (!property) {
      throw forbidden("You have not worked at this property before — ask the landlord to onboard you")
    }

    // One live shift at a time — end the current one before starting again.
    const active = await guardActiveShift(profile)
    if (active) throw conflict("You are already on duty")

    const shift = await db.guardShift.create({
      data: { propertyId: property.id, guardId: profile.id, startedAt: new Date() },
    })

    await audit(profile.id, "SHIFT_START", "GuardShift", shift.id, {
      property: property.name,
      guard: profile.fullName,
    })

    const created = await db.guardShift.findUniqueOrThrow({
      where: { id: shift.id },
      include: guardShiftInclude,
    })
    return ok(toGuardShiftDto(created), 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
