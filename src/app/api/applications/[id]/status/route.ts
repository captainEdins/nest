/**
 * NEST — POST /api/applications/[id]/status  (Task P4-b, issue #46)
 *
 * THE pipeline + decision endpoint — one verb sub-path (the api client is
 * GET/POST only, matching /api/incidents/[id]/ack) that moves an applicant
 * through the funnel and closes the loop.
 *
 * Role fence (matrix §4.2 — frozen):
 *   AGENT     → CONTACTED | VIEWING | WITHDRAWN only. They run the pipeline;
 *               they never decide: APPROVED/REJECTED attempts get a real 403
 *               "Only the landlord can approve or reject applicants". The
 *               source status must be live (NEW/CONTACTED/VIEWING) for a
 *               pipeline move; WITHDRAWN is allowed from any live status
 *               (the applicant walked); a decided application (APPROVED/
 *               REJECTED) takes no further moves → 409.
 *   LANDLORD   → APPROVED | REJECTED only. They decide, they never staff the
 *               pipeline: CONTACTED/VIEWING/WITHDRAWN attempts get a 403
 *               "The pipeline stages are the agent's — you decide approve or
 *               reject". A decision may land from ANY live status (a landlord
 *               may approve a NEW applicant directly); an already-decided
 *               application (409) or a withdrawn one (409) is final.
 *   No-op guard (both roles): target === current → 409.
 *
 * The application is fetched WITH the caller's scope condition in the same
 * query (miss → 404 — existence must not leak, matrix §1).
 *
 * The status update and the appended ListingApplicationEvent row (the
 * append-only timeline — created, never mutated) are written in ONE
 * transaction: the timeline can never drift from the status column.
 *
 * Side effects (never fatal): APPLICATION_STATUS audit; notifications —
 * a landlord decision tells the AGENT (APPLICATION_DECIDED, seed body
 * format), an agent WITHDRAWN tells the LANDLORD (APPLICATION_STATUS);
 * agent CONTACTED/VIEWING moves stay silent (pipeline noise, the frozen
 * decision: only the frozen moments notify).
 *
 * Body: ApplicationStatusChangeRequest. Returns ApiOk<ListingApplicationDto>.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  forbidden,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  requireRole,
  applicationScopeWhere,
} from "@/lib/auth-guard"
import { applicationInclude, toApplicationDto } from "@/lib/dto"
import { queueNotification } from "@/lib/notify"
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const statusChangeSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
})

/** Live pipeline statuses — an undecided, unwithdrawn applicant. */
const LIVE_STATUSES: readonly ApplicationStatus[] = ["NEW", "CONTACTED", "VIEWING"]

/** Pipeline stages the agent owns (never APPROVED/REJECTED — landlord's alone). */
const AGENT_TARGETS: readonly ApplicationStatus[] = ["CONTACTED", "VIEWING", "WITHDRAWN"]

/** Decisions the landlord alone may make. */
const LANDLORD_TARGETS: readonly ApplicationStatus[] = ["APPROVED", "REJECTED"]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const { id } = await params
    const body = await parseJsonBody(request, statusChangeSchema)

    // Scope check in the same query — an out-of-scope application is a 404.
    // The property relation rides along for the agent-withdrawn notification.
    const application = await db.listingApplication.findFirst({
      where: { id, ...applicationScopeWhere(profile) },
      include: {
        ...applicationInclude,
        property: { select: { id: true, landlordId: true } },
      },
    })
    if (!application) throw notFound("Application not found")

    const from = application.status as ApplicationStatus
    const to = body.status

    // --- Role fence ---------------------------------------------------------
    if (profile.role === "AGENT") {
      if (!AGENT_TARGETS.includes(to)) {
        throw forbidden("Only the landlord can approve or reject applicants")
      }
      // A decided application is history — no agent moves on it.
      if (LANDLORD_TARGETS.includes(from)) {
        throw conflict("This application has already been decided")
      }
    } else {
      if (!LANDLORD_TARGETS.includes(to)) {
        throw forbidden("The pipeline stages are the agent's — you decide approve or reject")
      }
      if (LANDLORD_TARGETS.includes(from)) {
        throw conflict("This application has already been decided")
      }
      // A withdrawn applicant cannot be decided after the fact.
      if (from === "WITHDRAWN") {
        throw conflict("This application has been withdrawn")
      }
    }

    // --- No-op guard + live-source validation -------------------------------
    if (to === from) {
      throw conflict("That status change is not allowed from here")
    }
    if (profile.role === "AGENT" && (to === "CONTACTED" || to === "VIEWING") && !LIVE_STATUSES.includes(from)) {
      throw conflict("That status change is not allowed from here")
    }

    // --- Apply: status + append-only timeline event in one transaction ------
    const isDecision = profile.role === "LANDLORD" && LANDLORD_TARGETS.includes(to)
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.listingApplication.update({
        where: { id: application.id },
        data: {
          status: to,
          ...(isDecision ? { decidedById: profile.id, decidedAt: new Date() } : {}),
        },
      })
      await tx.listingApplicationEvent.create({
        data: {
          applicationId: application.id,
          toStatus: to,
          actorId: profile.id,
          note: body.note,
        },
      })
      return row
    })

    const unitLabel = application.listing.unit.label
    const propertyName = application.listing.property.name

    await audit(profile.id, "APPLICATION_STATUS", "ListingApplication", application.id, {
      applicant: application.applicantName,
      from,
      to,
      by: profile.fullName,
      unit: unitLabel,
    })

    // --- Notifications (frozen decision: only the frozen moments notify) ----
    // A landlord decision tells the agent who recorded the applicant (they
    // are different roles — a self-notification is impossible by construction).
    // Agent pipeline moves (CONTACTED/VIEWING) stay silent.
    if (isDecision) {
      const notifyBody =
        `NEST: ${profile.fullName} ${to === "APPROVED" ? "approved" : "rejected"} ` +
        `${application.applicantName} for ${unitLabel} (${propertyName}).`
      await queueNotification(application.handledById, "IN_APP", "APPLICATION_DECIDED", notifyBody)
    } else if (profile.role === "AGENT" && to === "WITHDRAWN") {
      const notifyBody =
        `NEST: ${application.applicantName} withdrew their application for ` +
        `${unitLabel} (${propertyName}).`
      await queueNotification(application.property.landlordId, "IN_APP", "APPLICATION_STATUS", notifyBody)
    }

    const row = await db.listingApplication.findUniqueOrThrow({
      where: { id: updated.id },
      include: applicationInclude,
    })
    return ok(toApplicationDto(row))
  } catch (error) {
    return handleRouteError(error)
  }
}
