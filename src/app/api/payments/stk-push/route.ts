/**
 * NEST — POST /api/payments/stk-push  (Task 2-a, issues #9/#10)
 *
 * Initiate an M-Pesa STK push for a tenancy.
 *   TENANT    → own ACTIVE tenancy only (matrix §4.4 — the one money write
 *               a tenant can cause, completing only via the callback).
 *   CARETAKER /
 *   LANDLORD /
 *   AGENT     → tenancies in their property chain (the caretaker "request
 *               payment" flow S-07: the STK prompt goes to the TENANT's
 *               phone — no money moves without the tenant's PIN).
 *   GUARD     → 403.
 *
 * NOTE (matrix delta, flagged for the Principal): the matrix §4 detail tables
 * list STK-initiate under TENANT only; this route follows the orchestrator's
 * route spec (caretaker/landlord/agent in scope) because screen S-07 needs
 * it. STK-init creates an MpesaTransaction only — money rows still appear
 * exclusively through the callback pipeline, so matrix §5's money-write
 * rule is untouched. Needs a matrix row + ADR to formalize.
 *
 * Body: StkPushRequest { tenancyId, amountMinor (>0 integer), phone? } —
 * phone defaults to the tenant's phone on file. Audits MPESA_STK_INITIATED.
 * Returns StkPushResponseDto (mode tells the UI honestly: "sim" | "live").
 */

import { z } from "zod"
import type { StkPushRequest, StkPushResponseDto } from "@/lib/types"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { forbidden, handleRouteError, notFound, ok, parseJsonBody, requireProfile, tenancyScopeWhere, validationError } from "@/lib/auth-guard"
import { initiateStkPush } from "@/lib/mpesa"
import { normalizeKenyanPhone } from "@/lib/phones"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const stkPushSchema = z.object({
  tenancyId: z.string().min(1),
  amountMinor: z.number().int().positive(), // KES minor units; cents are allowed
  phone: z.string().trim().min(9).max(20).optional(),
})

export async function POST(request: Request) {
  try {
    const profile = await requireProfile()
    if (profile.role === "GUARD") {
      throw forbidden("Guard role may not initiate payments")
    }
    const body: StkPushRequest = await parseJsonBody(request, stkPushSchema)

    // Scope on the target tenancy: fetched WITH the role's scope condition —
    // an out-of-scope tenancy is a 404 (existence must not leak, §1).
    const tenancy = await db.tenancy.findFirst({
      where: { id: body.tenancyId, status: "ACTIVE", ...tenancyScopeWhere(profile) },
      include: { tenant: true, unit: true },
    })
    if (!tenancy) throw notFound("Tenancy not found")

    // Payer phone: optional override, else the tenant's phone on file.
    let phone: string
    if (body.phone) {
      const normalized = normalizeKenyanPhone(body.phone)
      if (!normalized) {
        throw validationError([{ path: "phone", message: "Not a valid Kenyan phone number" }])
      }
      phone = normalized
    } else {
      phone = tenancy.tenant.phone
    }

    const { response } = await initiateStkPush({
      phone,
      amountMinor: body.amountMinor,
      accountReference: tenancy.accountRef,
      description: `NEST rent ${tenancy.unit.label} ${tenancy.accountRef}`,
      tenancyId: tenancy.id,
    })

    await audit(profile.id, "MPESA_STK_INITIATED", "MpesaTransaction", response.checkoutRequestId, {
      tenancyId: tenancy.id,
      accountRef: tenancy.accountRef,
      amountMinor: body.amountMinor,
      phone,
      mode: response.mode,
      actorRole: profile.role,
    })

    return ok(response satisfies StkPushResponseDto)
  } catch (error) {
    return handleRouteError(error)
  }
}
