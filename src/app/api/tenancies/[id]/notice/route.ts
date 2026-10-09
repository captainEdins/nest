/**
 * NEST — POST / DELETE /api/tenancies/[id]/notice  (Phase 11, issue #78)
 *
 * The notice-to-vacate moment — the first step of the lease exit arc.
 * `NOTICE` existed in every contract since Phase 2 (settle guards, unit
 * statuses, overview fallback) but nothing could ever reach it; this route
 * is that missing state transition.
 *
 * POST   — give (tenant) or record (landlord) notice:
 *   1. Zod: moveOutDate (calendar date, ≥ today, ≤ 120 days out), reason
 *      (3–400 chars). The date is the MOVE-OUT day itself (tenant leaves
 *      that day), stored on Tenancy.endDate.
 *   2. Scope check in the same fetch (tenancy chain) — miss = 404, no leak.
 *      TENANT may notice their own ACTIVE tenancy; LANDLORD may record a
 *      notice on any ACTIVE tenancy in their property chain.
 *   3. Guard rails: tenancy must be ACTIVE (NOTICE → 409 replay guard — a
 *      second notice never overwrites the first; ENDED → 409).
 *   4. One transaction: Tenancy ACTIVE→NOTICE (endDate = moveOutDate),
 *      Unit OCCUPIED→NOTICE (compare-and-set — concurrent paths roll back),
 *      audit NOTICE_GIVEN (who, date, reason — the receipt of record).
 *   5. Notify: landlord + caretaker (IN_APP + SMS) and the tenant
 *      (IN_APP confirmation) — delivery never breaks the state change.
 *
 * DELETE — withdraw a notice (move-out not yet executed):
 *   TENANT (own) or LANDLORD (chain); tenancy must still be NOTICE.
 *   One transaction: Tenancy NOTICE→ACTIVE (endDate null), Unit
 *   NOTICE→OCCUPIED, audit NOTICE_WITHDRAWN, notify the same parties.
 *   Until POST move-out executes, the exit is reversible — that is the
 *   honest record (people change plans; the log keeps both decisions).
 *
 * No money moves here — deposit settlement stays the Phase 2 route with
 * its own evidence rules. Scoped 404s; append-only audit; integer-safe.
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

const noticeSchema = z.object({
  /** YYYY-MM-DD — the move-out day (inclusive). */
  moveOutDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "moveOutDate must be a calendar date (YYYY-MM-DD)"),
  reason: z.string().trim().min(3).max(400),
})

const ruleViolation = (message: string) => new ApiHttpError(400, message, "VALIDATION")

/** Calendar-day compare (UTC midnight) — no time-of-day games at the boundary. */
function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function parseMoveOutDate(raw: string): Date {
  const [y, m, d] = raw.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

async function loadScopedTenancy(tenancyId: string, profileId: string, isTenant: boolean) {
  return db.tenancy.findFirst({
    where: {
      id: tenancyId,
      // TENANT: own tenancy. LANDLORD: property chain. (CARETAKER/AGENT/
      // GUARD never initiate notices — matrix: the exit decision belongs
      // to the two parties of the lease.)
      ...(isTenant ? { tenantId: profileId } : { unit: { property: { landlordId: profileId } } }),
    },
    include: tenancyLifecycleInclude,
  })
}

// ---------------------------------------------------------------------------
// POST — give / record notice
// ---------------------------------------------------------------------------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("TENANT", "LANDLORD")
    const { id } = await params
    const body = await parseJsonBody(request, noticeSchema)

    const moveOutDate = parseMoveOutDate(body.moveOutDate)
    const today = startOfTodayUtc()
    const maxDate = new Date(today)
    maxDate.setUTCDate(maxDate.getUTCDate() + 120)
    if (moveOutDate < today) throw ruleViolation("Move-out date cannot be in the past")
    if (moveOutDate > maxDate) throw ruleViolation("Move-out date must be within 120 days")

    const tenancy = await loadScopedTenancy(id, profile.id, profile.role === "TENANT")
    if (!tenancy) throw notFound("Tenancy not found")

    // Replay guard — the first notice is the record; changes go withdraw→new.
    if (tenancy.status === "NOTICE") throw conflict("Notice already given for this tenancy")
    if (tenancy.status === "ENDED") throw conflict("Tenancy has already ended")

    // ---- One transaction: tenancy + unit flip + audit ------------------------
    await db.$transaction(async (tx) => {
      const updated = await tx.tenancy.update({
        where: { id: tenancy.id },
        data: { status: "NOTICE", endDate: moveOutDate },
      })
      if (updated.status !== "NOTICE") throw conflict("Notice already given")
      // Compare-and-set: only an OCCUPIED unit flips to NOTICE (a VACANT unit
      // with a live tenancy would be a data bug — refuse loudly, roll back).
      const flipped = await tx.unit.updateMany({
        where: { id: tenancy.unitId, status: "OCCUPIED" },
        data: { status: "NOTICE" },
      })
      if (flipped.count === 0) throw conflict("Unit is not occupied")
      await audit(
        profile.id,
        "NOTICE_GIVEN",
        "Tenancy",
        tenancy.id,
        {
          moveOutDate: body.moveOutDate,
          reason: body.reason,
          givenBy: profile.role,
          unitLabel: tenancy.unit.label,
        },
        tx
      )
    })

    // ---- Notifications (never break the flow) --------------------------------
    const property = tenancy.unit.property
    const unitLabel = tenancy.unit.label
    const dateLine = body.moveOutDate
    const notifyBody = `NEST: Notice to vacate for unit ${unitLabel}, ${property.name} — move-out on ${dateLine}. Reason: ${body.reason}.`
    const confirmationBody = `NEST: Your notice to vacate unit ${unitLabel} is recorded. Move-out date: ${dateLine}. Your deposit settlement follows the move-out inspection.`
    const targets: { profileId: string; channels: ("IN_APP" | "SMS")[]; body: string }[] = []
    if (profile.role === "TENANT") {
      // Tenant gave notice → landlord + caretaker learn, tenant confirms.
      if (property.landlordId) {
        targets.push({ profileId: property.landlordId, channels: ["IN_APP", "SMS"], body: notifyBody })
      }
      if (property.caretakerId) {
        targets.push({ profileId: property.caretakerId, channels: ["IN_APP", "SMS"], body: notifyBody })
      }
      targets.push({ profileId: profile.id, channels: ["IN_APP"], body: confirmationBody })
    } else {
      // Landlord recorded the notice → the tenant must be told prominently.
      targets.push({ profileId: tenancy.tenantId, channels: ["IN_APP", "SMS"], body: notifyBody })
      if (property.caretakerId && property.caretakerId !== profile.id) {
        targets.push({ profileId: property.caretakerId, channels: ["IN_APP"], body: notifyBody })
      }
    }
    await Promise.all(
      targets.flatMap((target) =>
        target.channels.map((channel) =>
          queueNotification(target.profileId, channel, "NOTICE_GIVEN", target.body)
        )
      )
    )

    const fresh = await db.tenancy.findUniqueOrThrow({
      where: { id: tenancy.id },
      include: tenancyLifecycleInclude,
    })
    return ok<TenancyLifecycleDto>(toTenancyLifecycleDto(fresh))
  } catch (error) {
    return handleRouteError(error)
  }
}

// ---------------------------------------------------------------------------
// DELETE — withdraw notice (exit not yet executed)
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("TENANT", "LANDLORD")
    const { id } = await params

    const tenancy = await loadScopedTenancy(id, profile.id, profile.role === "TENANT")
    if (!tenancy) throw notFound("Tenancy not found")
    if (tenancy.status === "ACTIVE") throw conflict("No notice to withdraw")
    if (tenancy.status === "ENDED") throw conflict("Tenancy has already ended")

    await db.$transaction(async (tx) => {
      const updated = await tx.tenancy.update({
        where: { id: tenancy.id },
        data: { status: "ACTIVE", endDate: null },
      })
      if (updated.status !== "ACTIVE") throw conflict("Notice already withdrawn")
      const flipped = await tx.unit.updateMany({
        where: { id: tenancy.unitId, status: "NOTICE" },
        data: { status: "OCCUPIED" },
      })
      if (flipped.count === 0) throw conflict("Unit is not on notice")
      await audit(
        profile.id,
        "NOTICE_WITHDRAWN",
        "Tenancy",
        tenancy.id,
        { unitLabel: tenancy.unit.label, priorMoveOutDate: tenancy.endDate?.toISOString() ?? null },
        tx
      )
    })

    const property = tenancy.unit.property
    const unitLabel = tenancy.unit.label
    const body = `NEST: Notice to vacate for unit ${unitLabel}, ${property.name} has been withdrawn. The tenancy continues as before.`
    const recipients = new Set<string>([tenancy.tenantId, profile.id])
    if (property.landlordId) recipients.add(property.landlordId)
    if (property.caretakerId) recipients.add(property.caretakerId)
    await Promise.all(
      [...recipients].map((profileId) =>
        queueNotification(profileId, "IN_APP", "NOTICE_WITHDRAWN", body)
      )
    )

    const fresh = await db.tenancy.findUniqueOrThrow({
      where: { id: tenancy.id },
      include: tenancyLifecycleInclude,
    })
    return ok<TenancyLifecycleDto>(toTenancyLifecycleDto(fresh))
  } catch (error) {
    return handleRouteError(error)
  }
}
