/**
 * NEST — POST /api/payments/unmatched/match  (Task 2-a, issue #10)
 *
 * Match an UNMATCHED payment to a tenancy. LANDLORD / CARETAKER only —
 * matrix §5.4 money writes (§4.2 + §6: agent match is an explicit 403
 * adversarial probe in Phase 1; deferred to Phase 4 with its own ACs).
 *
 * Scope: the TARGET tenancy is fetched with the actor's scope condition
 * (miss ⇒ 404, existence must not leak). The payment itself must exist and
 * be UNMATCHED — the engine 404s unknown payments and 409 CONFLICTs
 * non-UNMATCHED ones (append-only domain: no re-matching of credited money).
 *
 * All money work flows through matchUnmatchedPayment (single write path):
 * set tenancy → waterfall allocation → receiptNo → UNMATCHED_MATCHED audit.
 * Returns the updated PaymentDto.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { handleRouteError, notFound, ok, parseJsonBody, requireRole, tenancyScopeWhere } from "@/lib/auth-guard"
import { paymentInclude, toPaymentDto } from "@/lib/dto"
import { matchUnmatchedPayment } from "@/lib/reconciliation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const matchSchema = z.object({
  // Payment ids are integers in the DB but strings on the wire (PaymentDto.id).
  paymentId: z.coerce.number().int().positive(),
  tenancyId: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    // Phase 1 money writes: LANDLORD + CARETAKER only (matrix §5.4/§6).
    const profile = await requireRole("LANDLORD", "CARETAKER")
    const body = await parseJsonBody(request, matchSchema)

    // Target tenancy must be in the actor's scope chain (matrix §4.1/§4.3).
    const tenancy = await db.tenancy.findFirst({
      where: { id: body.tenancyId, status: { in: ["ACTIVE", "NOTICE"] }, ...tenancyScopeWhere(profile) },
    })
    if (!tenancy) throw notFound("Target tenancy not found")

    const payment = await matchUnmatchedPayment(body.paymentId, tenancy.id, profile.id)

    const withRelations = await db.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: paymentInclude,
    })
    return ok(toPaymentDto(withRelations))
  } catch (error) {
    return handleRouteError(error)
  }
}
