/**
 * NEST — POST /api/tenancies/[id]/move-out  (Phase 11, issue #78)
 *
 * Completing the lease exit — the second and final state transition of the
 * exit arc (notice → … → move-out). LANDLORD or CARETAKER executes it once
 * the tenant has actually left (move-out day reached).
 *
 *   1. Scope check in the same fetch (property chain via unit) — miss =
 *      404, no existence leak. LANDLORD owns the property; CARETAKER runs
 *      it (the field worker is often the one confirming the unit is empty).
 *   2. Guard rails (in order):
 *        - tenancy not NOTICE         → 409 "no notice on record" (move-out
 *          only ever follows a recorded notice — the honest-record rule).
 *        - moveOutDate > today        → 400 VALIDATION "move-out date not
 *          reached" (the date on the notice is the commitment).
 *        - unit is VACANT             → 409 (already moved out — replay).
 *   3. One transaction: Tenancy NOTICE→ENDED, Unit NOTICE→VACANT,
 *      audit TENANCY_ENDED (the exit receipt of record: who executed,
 *      when, which unit).
 *   4. Notify the tenant (IN_APP + SMS): the tenancy is ended and the
 *      deposit settlement now follows the move-out inspection — the exact
 *      wording that sets expectations for the Phase 2 settle flow.
 *
 * Deposit settlement is deliberately NOT part of this route: it stays the
 * LANDLORD-only Phase 2 action requiring a MOVE_OUT condition report and
 * its own evidence rules (deductions ≤ held, atomic compare-and-set).
 * The unit flips VACANT so the Phase 4 listing funnel can market it again.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  ApiHttpError,
  conflict,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  requireRole,
} from "@/lib/auth-guard"
import { toTenancyLifecycleDto, tenancyLifecycleInclude } from "@/lib/dto"
import { queueNotification } from "@/lib/notify"
import type { TenancyLifecycleDto } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Optional handover note (≤ 400 chars) — e.g. "keys returned, meter read 40213". */
const moveOutSchema = z.object({
  note: z.string().trim().max(400).optional(),
})

const ruleViolation = (message: string) => new ApiHttpError(400, message, "VALIDATION")

function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER")
    const { id } = await params
    const body = await parseJsonBody(request, moveOutSchema)

    // Scope: LANDLORD → landlord chain; CARETAKER → caretaker chain.
    const tenancy = await db.tenancy.findFirst({
      where: {
        id,
        unit: {
          property:
            profile.role === "LANDLORD"
              ? { landlordId: profile.id }
              : { caretakerId: profile.id },
        },
      },
      include: tenancyLifecycleInclude,
    })
    if (!tenancy) throw notFound("Tenancy not found")

    // The honest-record rule: exits only follow a recorded notice.
    if (tenancy.status === "ACTIVE") throw conflict("No notice on record for this tenancy")
    if (tenancy.status === "ENDED") throw conflict("Tenancy has already ended")

    // The notice date is the commitment — the exit can be executed on it
    // or any day after, never before.
    const moveOutDate = tenancy.endDate
    if (!moveOutDate || moveOutDate > startOfTodayUtc()) {
      throw ruleViolation("Move-out date has not been reached yet")
    }

    // ---- One transaction: tenancy ends, unit frees, audit ---------------------
    await db.$transaction(async (tx) => {
      const updated = await tx.tenancy.update({
        where: { id: tenancy.id },
        data: { status: "ENDED" },
      })
      if (updated.status !== "ENDED") throw conflict("Tenancy already ended")
      // Compare-and-set: only a NOTICE unit flips VACANT (replay-safe).
      const freed = await tx.unit.updateMany({
        where: { id: tenancy.unitId, status: "NOTICE" },
        data: { status: "VACANT" },
      })
      if (freed.count === 0) throw conflict("Unit is not on notice")
      await audit(
        profile.id,
        "TENANCY_ENDED",
        "Tenancy",
        tenancy.id,
        {
          unitLabel: tenancy.unit.label,
          moveOutDate: moveOutDate.toISOString(),
          executedBy: profile.role,
          note: body.note ?? null,
        },
        tx
      )
    })

    // ---- Notify the tenant: exit recorded, settlement next --------------------
    const property = tenancy.unit.property
    const unitLabel = tenancy.unit.label
    const notificationBody =
      `NEST: Move-out completed for unit ${unitLabel}, ${property.name}. The tenancy has ended. ` +
      `Your deposit settlement follows the move-out inspection.` +
      (body.note ? ` Note: ${body.note}.` : "")
    await Promise.all([
      queueNotification(tenancy.tenantId, "IN_APP", "TENANCY_ENDED", notificationBody),
      queueNotification(tenancy.tenantId, "SMS", "TENANCY_ENDED", notificationBody),
    ])

    const fresh = await db.tenancy.findUniqueOrThrow({
      where: { id: tenancy.id },
      include: tenancyLifecycleInclude,
    })
    return ok<TenancyLifecycleDto>(toTenancyLifecycleDto(fresh))
  } catch (error) {
    return handleRouteError(error)
  }
}
