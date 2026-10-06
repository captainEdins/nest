/**
 * NEST — POST /api/incidents/[id]/ack  (Task P3-b, issue #35)
 *
 * The trust loop closer: LANDLORD/CARETAKER mark a guard's incident report
 * as seen. GUARD/TENANT/AGENT cannot ack (403) — the acknowledgement must
 * come from the side accountable for the plot, never the filer.
 *
 * The incident is fetched WITH the caller's scope condition in the same
 * query (miss → 404 — existence must not leak, matrix §1). A replayed ack
 * is a 409 (idempotency guard): acknowledgedBy/acknowledgedAt keep recording
 * the FIRST sighting and can never be overwritten by a second reader.
 *
 * Side effects (never fatal): INCIDENT_ACKED audit + an IN_APP notification
 * to the filing guard — the loop closes, the guard learns the report was
 * received. The acker is LANDLORD/CARETAKER and the filer is a GUARD, so a
 * self-notification is impossible by construction.
 *
 * Body: none. Returns ApiOk<IncidentReportDto>.
 */

import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { conflict, handleRouteError, incidentScopeWhere, notFound, ok, requireRole } from "@/lib/auth-guard"
import { incidentInclude, toIncidentDto } from "@/lib/dto"
import { queueNotification } from "@/lib/notify"
import type { IncidentCategory } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Human words for notification bodies (seed convention: "(Dispute)"). */
const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  SECURITY: "Security",
  DAMAGE: "Damage",
  DISPUTE: "Dispute",
  THEFT: "Theft",
  OTHER: "Other",
}

/** Notification bodies quote the description capped at 120 chars (seed format). */
function excerpt(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER")
    const { id } = await params

    // Scope check in the same query — an out-of-scope incident is a 404.
    const incident = await db.incidentReport.findFirst({
      where: { id, ...incidentScopeWhere(profile) },
      include: incidentInclude,
    })
    if (!incident) throw notFound("Incident not found")

    if (incident.acknowledgedById) throw conflict("Incident already acknowledged")

    const updated = await db.incidentReport.update({
      where: { id: incident.id },
      data: { acknowledgedById: profile.id, acknowledgedAt: new Date() },
      include: incidentInclude,
    })

    await audit(profile.id, "INCIDENT_ACKED", "IncidentReport", incident.id, {
      by: profile.fullName,
    })

    // queueNotification never throws, so this can never break the ack.
    const notifyBody =
      `NEST: ${profile.fullName} acknowledged your incident report ` +
      `(${CATEGORY_LABEL[incident.category as IncidentCategory]}): "${excerpt(incident.description)}"`
    await queueNotification(incident.guardId, "IN_APP", "INCIDENT_ACKED", notifyBody)

    return ok(toIncidentDto(updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
