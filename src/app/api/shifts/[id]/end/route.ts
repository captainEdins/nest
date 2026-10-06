/**
 * NEST — POST /api/shifts/[id]/end  (Task P3-b, issue #35)
 *
 * GUARD ends their own shift: sets endedAt and (optionally) writes the
 * handover note — the relay record the next guard and the landlord read in
 * the shift log.
 *
 * The shift is fetched WITH guardId = the caller in the same query (miss →
 * 404): a guard can never end someone else's shift, and the existence of
 * other guards' shift ids does not leak. Ending twice → 409 — the shift
 * record is final, the timesheet must never be rewritten.
 *
 * Body: optional { notes ≤ 500 }. A POST with no body at all is a valid
 * "end without notes" — the api client omits the body when there is nothing
 * to send and the dev fixtures accept the same — so an absent body parses
 * as {} here instead of the 400 parseJsonBody would raise. Everything else
 * keeps the exact envelope/error style (ZodError is still formatted by
 * handleRouteError).
 *
 * Side effect (never fatal): SHIFT_END audit with the handover note.
 * Returns ApiOk<GuardShiftDto>.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { conflict, handleRouteError, notFound, ok, requireRole, validationError } from "@/lib/auth-guard"
import { guardShiftInclude, toGuardShiftDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const endSchema = z.object({
  notes: z.string().trim().max(500).optional(),
})

/** Body parse that treats an absent/empty body as {} (see header — notes is optional). */
async function parseEndBody(request: Request): Promise<{ notes?: string }> {
  const text = await request.text()
  if (text.trim() === "") return {}
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw validationError({ body: "invalid JSON" }, "Request body must be valid JSON")
  }
  return endSchema.parse(json)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("GUARD")
    const { id } = await params
    const body = await parseEndBody(request)

    // Own-shift check in the same query — someone else's shift id is a 404.
    const shift = await db.guardShift.findFirst({
      where: { id, guardId: profile.id },
      include: guardShiftInclude,
    })
    if (!shift) throw notFound("Shift not found")

    if (shift.endedAt) throw conflict("Shift already ended")

    const updated = await db.guardShift.update({
      where: { id: shift.id },
      data: { endedAt: new Date(), notes: body.notes ?? null },
      include: guardShiftInclude,
    })

    await audit(profile.id, "SHIFT_END", "GuardShift", shift.id, {
      property: shift.property.name,
      guard: profile.fullName,
      notes: updated.notes,
    })

    return ok(toGuardShiftDto(updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
