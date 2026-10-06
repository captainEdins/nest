/**
 * NEST — /api/condition-reports  (Task P2-b, issue #22)
 *
 * The paper trail that makes deposit deductions arguable:
 *
 *   GET  ?tenancyId=…  → ConditionReportDto[] (oldest first) for a tenancy
 *                        the caller may see under the deposit scope
 *                        (depositTenancyScopeWhere): TENANT → their own
 *                        ACTIVE/NOTICE tenancy; LANDLORD/CARETAKER → their
 *                        property chain. AGENT/GUARD → 403. A tenancy out
 *                        of scope is a 404 (existence must not leak).
 *
 *   POST               → LANDLORD/CARETAKER record a MOVE_IN or MOVE_OUT
 *                        condition report against a tenancy on their
 *                        chain (scope-checked in the same fetch → 404).
 *                        photoUrls (≤ 5, each http(s)://) are stored as a
 *                        JSON array on the row. Audits
 *                        CONDITION_REPORT_RECORDED; a MOVE_OUT report also
 *                        notifies the tenant IN_APP that they can now
 *                        review it in their deposit ledger.
 *
 * Notes are 10..4000 chars — a real inspection note, not a token.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { queueNotification } from "@/lib/notify"
import {
  depositTenancyScopeWhere,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  parseSearchParams,
  requireRole,
} from "@/lib/auth-guard"
import { conditionReportInclude, toConditionReportDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const listQuerySchema = z.object({
  tenancyId: z.string().min(1),
})

const photoUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
    message: "Photo URL must start with http:// or https://",
  })

const createReportSchema = z.object({
  tenancyId: z.string().min(1),
  kind: z.enum(["MOVE_IN", "MOVE_OUT"]),
  notes: z.string().trim().min(10).max(4000),
  photoUrls: z.array(photoUrlSchema).max(5).optional(),
})

export async function GET(request: Request) {
  try {
    const profile = await requireRole("TENANT", "LANDLORD", "CARETAKER")
    const { tenancyId } = parseSearchParams(request, listQuerySchema)

    // Scope check in the same fetch — a miss is a 404, never a leak.
    const tenancy = await db.tenancy.findFirst({
      where: { id: tenancyId, ...depositTenancyScopeWhere(profile) },
      select: { id: true },
    })
    if (!tenancy) throw notFound("Tenancy not found")

    const reports = await db.conditionReport.findMany({
      where: { tenancyId: tenancy.id },
      include: conditionReportInclude,
      orderBy: { createdAt: "asc" },
    })

    return ok(reports.map(toConditionReportDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER")
    const body = await parseJsonBody(request, createReportSchema)

    // Scope-check the tenancy (landlord/caretaker chain) in the same fetch.
    const tenancy = await db.tenancy.findFirst({
      where: { id: body.tenancyId, ...depositTenancyScopeWhere(profile) },
      include: { unit: { include: { property: true } } },
    })
    if (!tenancy) throw notFound("Tenancy not found")

    const created = await db.conditionReport.create({
      data: {
        tenancyId: tenancy.id,
        kind: body.kind,
        notes: body.notes,
        photoUrlsJson: JSON.stringify(body.photoUrls ?? []),
        recordedById: profile.id,
      },
    })

    await audit(profile.id, "CONDITION_REPORT_RECORDED", "ConditionReport", created.id, {
      tenancyId: tenancy.id,
      kind: body.kind,
    })

    // A MOVE_OUT report unlocks the tenant's settlement review — tell them.
    if (body.kind === "MOVE_OUT") {
      await queueNotification(
        tenancy.tenantId,
        "IN_APP",
        "MOVE_OUT_RECORDED",
        `NEST: Move-out condition report recorded for unit ${tenancy.unit.label} — you can now review it in your deposit ledger.`
      )
    }

    // Re-fetch with the recordedBy relation for the DTO.
    const report = await db.conditionReport.findUniqueOrThrow({
      where: { id: created.id },
      include: conditionReportInclude,
    })

    return ok(toConditionReportDto(report))
  } catch (error) {
    return handleRouteError(error)
  }
}
