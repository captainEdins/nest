/**
 * NEST — POST /api/move-ins  (Phase 8, issue #72)
 *
 * THE conversion endpoint — one verified action that turns an approved
 * applicant into an active, money-ready tenancy. This is where the Phase 4
 * funnel stops dead-ending at "APPROVED": the landlord moves them in, and
 * NEST generates the whole lease's money backbone in ONE transaction:
 *
 *   tenant Profile (find-or-create by phone, role TENANT)
 *   + Tenancy        (ACTIVE, accountRef NEST-<unit>-<seq>, start date)
 *   + Deposit        (HOLD movement — append-only, actor stamped)
 *   + first RentCharge (RENT, the start month, due at start date)
 *   + Unit           → OCCUPIED
 *   + Listing        → LET (the funnel visibly closes)
 *   + Application    → CONVERTED + timeline event (the record of record)
 *
 * Role fence (matrix §4.2): LANDLORD only — the move-in is the landlord's
 * decision of record, same as APPROVE/REJECT. Everyone else 403s before any
 * data is touched. The application is fetched WITH the landlord's scope
 * condition in the same query (miss → 404 — existence must not leak).
 *
 * State machine guards (409s, the same family as the status route):
 *   - application must be APPROVED (REJECTED/WITHDRAWN → "not approved";
 *     CONVERTED → "already moved in" — conversion is exactly-once)
 *   - the listing's unit must be VACANT (an occupied unit means an active
 *     tenancy already exists — end it first)
 *   - the phone must not belong to a non-tenant staff account (a caretaker
 *     cannot become a tenant by move-in)
 *
 * Money: integer KES minor only (zod int, >0 rent, >=0 deposit). The deposit
 * is HELD, never "paid" — a move-in moves no rent money; the first charge
 * simply exists for the waterfall to allocate against.
 *
 * Side effects (never fatal): MOVE_IN audit row; notifications — the agent
 * who recorded the applicant (APPLICATION_STATUS) and the new tenant
 * (MOVE_IN, the welcome record). Response: MoveInResultDto.
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
} from "@/lib/auth-guard"
import { queueNotification } from "@/lib/notify"
import { formatKes } from "@/lib/money"
import type { MoveInResultDto } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const moveInSchema = z.object({
  applicationId: z.string().min(1),
  monthlyRentMinor: z.number().int().positive(),
  depositHeldMinor: z.number().int().nonnegative(),
  startDate: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date"),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
})

/** "2026-10-15" / ISO → "2026-10" (the first charge's periodMonth). */
function periodMonthOf(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

/**
 * accountRef NEST-<unit>-<seq> — the human-stable M-Pesa reference. The seed
 * occupies 1001..100N, so the sequence continues from a total count; the
 * unique constraint is the backstop, retried with a bump on collision.
 */
async function nextAccountRef(unitLabel: string): Promise<string> {
  const base = 1000 + (await db.tenancy.count())
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `NEST-${unitLabel}-${base + attempt + 1}`
    const clash = await db.tenancy.findUnique({ where: { accountRef: candidate }, select: { id: true } })
    if (!clash) return candidate
  }
  // Vanishingly unlikely (5 collisions); timestamp suffix keeps it unique.
  return `NEST-${unitLabel}-${Date.now().toString(36).toUpperCase()}`
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("LANDLORD")
    const body = await parseJsonBody(request, moveInSchema)
    const startDate = new Date(body.startDate)

    // Scope check in the same query — an out-of-scope application is a 404.
    const application = await db.listingApplication.findFirst({
      where: {
        id: body.applicationId,
        property: { landlordId: profile.id },
      },
      include: {
        listing: {
          include: {
            unit: { select: { id: true, label: true, status: true } },
            property: { select: { id: true, name: true, landlordId: true, agentId: true } },
          },
        },
      },
    })
    if (!application) throw notFound("Application not found")

    // --- State machine guards ----------------------------------------------
    if (application.status === "CONVERTED") {
      throw conflict("This applicant has already been moved in")
    }
    if (application.status !== "APPROVED") {
      throw conflict("Only an approved applicant can be moved in — approve them first")
    }
    if (application.listing.unit.status !== "VACANT") {
      throw conflict("That unit is not vacant — end the current tenancy first")
    }
    // Belt-and-braces beyond the unit status column: an ACTIVE tenancy on the
    // unit means the status column is wrong (or a move-in raced us).
    const activeTenancy = await db.tenancy.findFirst({
      where: { unitId: application.listing.unit.id, status: "ACTIVE" },
      select: { id: true },
    })
    if (activeTenancy) {
      throw conflict("That unit is not vacant — end the current tenancy first")
    }

    // --- Phone → tenant Profile (find-or-create) ----------------------------
    // A staff account on that phone can never silently become a tenant.
    const existingByPhone = await db.profile.findFirst({
      where: { phone: application.applicantPhone },
      select: { id: true, role: true, fullName: true, active: true },
    })
    if (existingByPhone && existingByPhone.role !== "TENANT") {
      throw conflict("That phone already belongs to a staff account — use the applicant's own number")
    }

    const unitLabel = application.listing.unit.label
    const propertyName = application.listing.property.name
    const accountRef = await nextAccountRef(unitLabel)
    const periodMonth = periodMonthOf(startDate)

    // --- The one transaction: lease money backbone + funnel closure --------
    const result = await db.$transaction(async (tx) => {
      // 1. Tenant profile — reuse the phone's existing TENANT account or
      //    create one; the name of record is the applicant's own.
      const tenant =
        existingByPhone ??
        (await tx.profile.create({
          data: {
            phone: application.applicantPhone,
            fullName: application.applicantName,
            role: "TENANT",
            language: "en",
            active: true,
          },
        }))

      // 2. Tenancy — ACTIVE from the move-in date, accountRef of record.
      const tenancy = await tx.tenancy.create({
        data: {
          unitId: application.listing.unit.id,
          tenantId: tenant.id,
          startDate,
          monthlyRentMinor: body.monthlyRentMinor,
          depositHeldMinor: body.depositHeldMinor,
          status: "ACTIVE",
          accountRef,
        },
      })

      // 3. Deposit held — append-only HOLD movement, actor of record.
      await tx.deposit.create({
        data: {
          tenancyId: tenancy.id,
          heldMinor: body.depositHeldMinor,
          status: "HELD",
          movements: {
            create: {
              kind: "HOLD",
              amountMinor: body.depositHeldMinor,
              reason: `Held at move-in from ${application.applicantName}'s approved application`,
              actorId: profile.id,
            },
          },
        },
      })

      // 4. First RENT charge — the start month, due at move-in. The unique
      //    (tenancy, kind, period) constraint makes double-raising impossible.
      await tx.rentCharge.create({
        data: {
          tenancyId: tenancy.id,
          kind: "RENT",
          periodMonth,
          dueDate: startDate,
          amountMinor: body.monthlyRentMinor,
          status: "UNPAID",
        },
      })

      // 5. Unit flips OCCUPIED; 6. listing closes (LET) — the funnel end.
      await tx.unit.update({
        where: { id: application.listing.unit.id },
        data: { status: "OCCUPIED" },
      })
      await tx.listing.update({
        where: { id: application.listingId },
        data: { status: "LET" },
      })

      // 7. Application → CONVERTED + the timeline event of record. The note
      //    carries the landlord's words AND the machine summary (tenancy ref,
      //    rent, deposit, start) so every surface — agent, landlord, timeline —
      //    shows the lease facts without a join, whichever note was typed.
      const machineSummary =
        `Tenancy ${accountRef} opened · rent ${formatKes(body.monthlyRentMinor)}/mo · ` +
        `deposit ${formatKes(body.depositHeldMinor)} held · starts ${startDate.toISOString().slice(0, 10)}`
      const summaryNote = body.note ? `${body.note} — ${machineSummary}` : machineSummary
      await tx.listingApplication.update({
        where: { id: application.id },
        data: { status: "CONVERTED" },
      })
      await tx.listingApplicationEvent.create({
        data: {
          applicationId: application.id,
          toStatus: "CONVERTED",
          actorId: profile.id,
          note: summaryNote,
        },
      })

      return { tenant, tenancy }
    })

    // --- Trust trail (never fatal) -------------------------------------------
    await audit(profile.id, "MOVE_IN", "Tenancy", result.tenancy.id, {
      applicationId: application.id,
      tenant: result.tenant.fullName,
      phone: application.applicantPhone,
      unit: unitLabel,
      property: propertyName,
      accountRef,
      monthlyRentMinor: body.monthlyRentMinor,
      depositHeldMinor: body.depositHeldMinor,
      startDate: startDate.toISOString(),
      firstChargePeriod: periodMonth,
      by: profile.fullName,
    })

    // Agent who recorded the applicant — the funnel closed on their lead.
    await queueNotification(
      application.handledById,
      "IN_APP",
      "APPLICATION_STATUS",
      `NEST: ${profile.fullName} moved ${application.applicantName} into ${unitLabel} (${propertyName}). ` +
        `Tenancy ${accountRef} is active — rent ${formatKes(body.monthlyRentMinor)}/month.`,
    )
    // The new tenant — the welcome record (their home now exists in NEST).
    await queueNotification(
      result.tenant.id,
      "IN_APP",
      "MOVE_IN",
      `NEST: Karibu ${propertyName} ${unitLabel}! Your tenancy ${accountRef} is active. ` +
        `Rent ${formatKes(body.monthlyRentMinor)}/month, deposit ${formatKes(body.depositHeldMinor)} held. ` +
        `Pay via M-Pesa from the Home tab.`,
    )

    const dto: MoveInResultDto = {
      tenancyId: result.tenancy.id,
      accountRef,
      tenantId: result.tenant.id,
      tenantName: result.tenant.fullName,
      tenantPhone: application.applicantPhone,
      unitLabel,
      propertyName,
      monthlyRentMinor: body.monthlyRentMinor,
      depositHeldMinor: body.depositHeldMinor,
      startDate: startDate.toISOString(),
      firstChargePeriod: periodMonth,
      applicationId: application.id,
    }
    return ok(dto)
  } catch (error) {
    return handleRouteError(error)
  }
}
