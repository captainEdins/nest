/**
 * NEST — GET/POST /api/listings/[id]/applications  (Task P4-b, issue #46)
 *
 * The applicant funnel under one listing.
 *
 * GET — the listing's applicants (newest first) for AGENT + LANDLORD
 * (matrix §4.2). The listing is fetched WITH the caller's scope condition
 * in the same query (miss → 404 — existence must not leak, matrix §1) using
 * listingDetailInclude, and its `applications` array is returned verbatim.
 *
 * POST — record an applicant: AGENT ONLY (matrix §4.2 — the agent is the
 * intake desk; the landlord observes the funnel, they do not staff it — a
 * landlord POST gets a real 403). The listing must be PUBLISHED (409
 * otherwise): applicants on a draft or paused listing would be marketing
 * noise. propertyId is DERIVED from the listing server-side — never sent.
 *
 * The application row and its FIRST timeline event (toStatus NEW, actor =
 * the recording agent) are written in ONE transaction — an application can
 * never exist without its origin event (append-only timeline, schema intent).
 *
 * Side effects (never fatal): APPLICATION_RECORDED audit + an IN_APP
 * APPLICATION_RECORDED notification to the property's LANDLORD — the owner
 * hears about every new applicant (seed notification format).
 *
 * Body: RecordApplicationRequest. Returns 201 ApiOk<ListingApplicationDto>.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  requireRole,
  listingScopeWhere,
} from "@/lib/auth-guard"
import {
  applicationInclude,
  listingDetailInclude,
  toApplicationDto,
} from "@/lib/dto"
import { queueNotification } from "@/lib/notify"
import { APPLICATION_SOURCES, type ApplicationSource } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Kenyan-format phone: optional leading +, then 9-15 digits/spaces/dashes. */
const APPLICANT_PHONE_RE = /^\+?[0-9\s-]{9,15}$/

const recordApplicationSchema = z.object({
  applicantName: z.string().trim().min(2).max(80),
  applicantPhone: z
    .string()
    .trim()
    .regex(APPLICANT_PHONE_RE, "Phone must be 9-15 digits, optionally starting with +"),
  source: z.enum(APPLICATION_SOURCES),
  // Optional first-notice note; "" normalizes to null so the timeline renders
  // "no note" cleanly (same convention as the visitor phone).
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
})

/** Human words for notification bodies (seed convention: "via WhatsApp"). */
const SOURCE_LABEL: Record<ApplicationSource, string> = {
  WALK_IN: "walk-in",
  PHONE: "phone call",
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook",
  OTHER: "another channel",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const { id } = await params

    // Scope check in the same query — an out-of-scope listing is a 404.
    const listing = await db.listing.findFirst({
      where: { id, ...listingScopeWhere(profile) },
      include: listingDetailInclude,
    })
    if (!listing) throw notFound("Listing not found")

    return ok(listing.applications.map(toApplicationDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Intake is the agent's job alone — the landlord watches, never records.
    const profile = await requireRole("AGENT")
    const { id } = await params
    const body = await parseJsonBody(request, recordApplicationSchema)

    // Scope check in the same query (miss → 404) + the property relation for
    // the landlord notification below. propertyId derives from this row.
    const listing = await db.listing.findFirst({
      where: { id, ...listingScopeWhere(profile) },
      include: {
        unit: { select: { id: true, label: true } },
        property: { select: { id: true, name: true, landlordId: true } },
      },
    })
    if (!listing) throw notFound("Listing not found")

    if (listing.status !== "PUBLISHED") {
      throw conflict("Applicants can only be recorded on a published listing")
    }

    // One transaction: the application row + its origin event. The timeline
    // is append-only — an application without its NEW event cannot exist.
    const application = await db.$transaction(async (tx) => {
      const row = await tx.listingApplication.create({
        data: {
          listingId: listing.id,
          propertyId: listing.propertyId,
          applicantName: body.applicantName,
          applicantPhone: body.applicantPhone,
          source: body.source,
          note: body.note,
          status: "NEW",
          handledById: profile.id,
        },
      })
      await tx.listingApplicationEvent.create({
        data: {
          applicationId: row.id,
          toStatus: "NEW",
          actorId: profile.id,
          note: body.note,
        },
      })
      return row
    })

    await audit(profile.id, "APPLICATION_RECORDED", "ListingApplication", application.id, {
      applicant: body.applicantName,
      source: body.source,
      unit: listing.unit.label,
      title: listing.title,
    })

    // The landlord hears about every new applicant (seed body format).
    // queueNotification never throws, so this can never break the intake.
    const notifyBody =
      `NEST: New applicant for ${listing.unit.label} (${listing.title}) — ` +
      `${body.applicantName}, recorded by ${profile.fullName} via ${SOURCE_LABEL[body.source]}.`
    await queueNotification(listing.property.landlordId, "IN_APP", "APPLICATION_RECORDED", notifyBody)

    const updated = await db.listingApplication.findUniqueOrThrow({
      where: { id: application.id },
      include: applicationInclude,
    })
    return ok(toApplicationDto(updated), 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
