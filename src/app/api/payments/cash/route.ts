/**
 * NEST — POST /api/payments/cash  (Task 2-a, issue #9)
 *
 * Record a cash collection. CARETAKER or LANDLORD only (matrix §5.4 money
 * writes; agents record no money in Phase 1 — 403; tenants/guards 403).
 *
 * The target tenancy is fetched WITH the recorder's scope condition — an
 * out-of-scope tenancy is a 404 (matrix §1). All money work happens in the
 * reconciliation engine: Payment (CASH, COMPLETED, receiptNo NEST-R-######,
 * recordedBy) → waterfall allocation → tenant receipt notification →
 * PAYMENT_CASH_RECORDED audit.
 *
 * Idempotency: when clientRef is supplied and a Payment already carries it,
 * the existing row is returned unchanged (offline queue sync replays are
 * safe) and `replay: true` is flagged in the response.
 *
 * Body: CashCollectionRequest { tenancyId, amountMinor, note?, clientRef? }
 * Returns { payment: PaymentDto, receiptNo, replay }.
 */

import { z } from "zod"
import type { CashCollectionRequest } from "@/lib/types"
import { db } from "@/lib/db"
import { handleRouteError, notFound, ok, parseJsonBody, requireRole, tenancyScopeWhere } from "@/lib/auth-guard"
import { paymentInclude, toPaymentDto } from "@/lib/dto"
import { recordCashCollection } from "@/lib/reconciliation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const cashSchema = z.object({
  tenancyId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  clientRef: z.string().trim().min(1).max(100).optional(),
})

export async function POST(request: Request) {
  try {
    // Phase 1 money writes: LANDLORD + CARETAKER only (matrix §5.4).
    const profile = await requireRole("CARETAKER", "LANDLORD")
    const body: CashCollectionRequest = await parseJsonBody(request, cashSchema)

    const tenancy = await db.tenancy.findFirst({
      where: { id: body.tenancyId, status: { in: ["ACTIVE", "NOTICE"] }, ...tenancyScopeWhere(profile) },
    })
    if (!tenancy) throw notFound("Tenancy not found")

    const result = await recordCashCollection({
      tenancyId: tenancy.id,
      amountMinor: body.amountMinor,
      recordedById: profile.id,
      note: body.note,
      clientRef: body.clientRef,
    })

    // Re-fetch with relations so the DTO carries allocations + recorder name.
    const payment = await db.payment.findUniqueOrThrow({
      where: { id: result.payment.id },
      include: paymentInclude,
    })

    return ok({ payment: toPaymentDto(payment), receiptNo: result.receiptNo, replay: result.replay })
  } catch (error) {
    return handleRouteError(error)
  }
}
