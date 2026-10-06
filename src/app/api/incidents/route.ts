/**
 * NEST — GET/POST /api/incidents  (Task P3-b, issue #35)
 *
 * GET — the incident register, role-scoped via incidentScopeWhere (Phase 3
 * matrix): GUARD sees the SHARED register (every guard's incidents at the
 * properties they have worked — context for the next shift), LANDLORD/
 * CARETAKER see their property chain. TENANT/AGENT are denied with an
 * explicit 403 here rather than the scope fragment's empty array: incidents
 * are operations data, and a hard 403 tells those clients the resource is
 * not for them at all (deny by default, matrix §1).
 * ?unacked=true narrows the list to acknowledgedById: null — the
 * landlord/caretaker work queue (the same slice the security digest counts).
 * Newest first, take 100 (a live register, not an archive dump).
 *
 * POST — GUARD files an incident report. The property is NEVER taken from
 * the client: it is derived from the caller's ACTIVE shift
 * (guardActiveShift — "on duty" is the trust anchor). No active shift →
 * 409 with the remedy ("start a shift"), because the state to fix is the
 * guard's own shift, not the request payload.
 *
 * Side effects (never fatal): INCIDENT_FILED audit; for HIGH/CRITICAL an
 * IN_APP INCIDENT_FILED notification to the property's landlord AND
 * caretaker — the people accountable for the plot (queueNotification and
 * audit swallow their own errors, so a filed report is never lost to a
 * notify failure). LOW/MEDIUM stay in the register only — severity is the
 * noise filter.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  guardActiveShift,
  handleRouteError,
  incidentScopeWhere,
  ok,
  parseJsonBody,
  parseSearchParams,
  requireRole,
} from "@/lib/auth-guard"
import { incidentInclude, toIncidentDto } from "@/lib/dto"
import { queueNotification } from "@/lib/notify"
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITIES, type IncidentCategory } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Human words for notification bodies (seed convention: "(Security)"). */
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

/** Strict "true"/"false" — a typo like ?unacked=1 is a client bug worth a 400, not a silent full list. */
const listQuerySchema = z.object({
  unacked: z.enum(["true", "false"]).optional(),
})

const reportSchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES),
  severity: z.enum(INCIDENT_SEVERITIES),
  description: z.string().trim().min(5).max(1000),
  actionTaken: z.string().trim().max(1000).optional(),
})

export async function GET(request: Request) {
  try {
    const profile = await requireRole("GUARD", "LANDLORD", "CARETAKER")
    const query = parseSearchParams(request, listQuerySchema)

    const incidents = await db.incidentReport.findMany({
      where: {
        ...incidentScopeWhere(profile),
        ...(query.unacked === "true" ? { acknowledgedById: null } : {}),
      },
      include: incidentInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return ok(incidents.map(toIncidentDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("GUARD")
    const body = await parseJsonBody(request, reportSchema)

    // The property comes from the caller's ACTIVE shift — the client never
    // sends it. Off-duty → 409 with the remedy (start a shift first).
    const shift = await guardActiveShift(profile)
    if (!shift) {
      throw conflict("You must be on duty (start a shift) to report incidents")
    }

    const incident = await db.incidentReport.create({
      data: {
        propertyId: shift.propertyId,
        guardId: profile.id,
        category: body.category,
        severity: body.severity,
        description: body.description,
        actionTaken: body.actionTaken ?? null,
      },
    })

    await audit(profile.id, "INCIDENT_FILED", "IncidentReport", incident.id, {
      category: body.category,
      severity: body.severity,
      property: shift.property.name,
    })

    // HIGH/CRITICAL must reach the accountable side immediately. The shift
    // include only carries {id, name}, so the notify recipients come from a
    // follow-up fetch of the shift's property (FK-guaranteed to exist — a
    // null here is impossible and just skips the notify, never the report).
    if (body.severity === "HIGH" || body.severity === "CRITICAL") {
      const property = await db.property.findUnique({
        where: { id: shift.propertyId },
        select: { landlordId: true, caretakerId: true },
      })
      // Seed wording verbatim — HIGH and CRITICAL share the "High-severity"
      // prefix, matching the security digest's high-severity bucket.
      const notifyBody =
        `NEST: High-severity incident at ${shift.property.name} filed by ${profile.fullName} ` +
        `(${CATEGORY_LABEL[body.category]}): "${excerpt(body.description)}"`
      const recipients = [property?.landlordId, property?.caretakerId].filter(
        (id): id is string => typeof id === "string"
      )
      await Promise.all(
        recipients.map((recipientId) => queueNotification(recipientId, "IN_APP", "INCIDENT_FILED", notifyBody))
      )
    }

    const created = await db.incidentReport.findUniqueOrThrow({
      where: { id: incident.id },
      include: incidentInclude,
    })
    return ok(toIncidentDto(created), 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
