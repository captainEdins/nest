/**
 * NEST — GET /api/mpesa/status?checkoutRequestId=…
 *
 * STK push status for the UI polling loop (S-07/S-09 "confirm payment"):
 *   { status, resultCode, resultDesc, paymentId?, receiptNo? }
 *
 * Scope (matrix §4): the session must be the TENANT of that transaction's
 * tenancy, or a money-role (landlord/caretaker/agent) whose property chain
 * contains the tenancy. GUARD → 403 by role before scope evaluation.
 * Out-of-scope or unknown ids → 404 (existence must not leak).
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { forbidden, handleRouteError, notFound, ok, parseSearchParams, requireProfile } from "@/lib/auth-guard"
import { getStkStatus } from "@/lib/reconciliation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const statusSchema = z.object({ checkoutRequestId: z.string().min(1) })

export async function GET(request: Request) {
  try {
    const profile = await requireProfile()
    const { checkoutRequestId } = parseSearchParams(request, statusSchema)

    if (profile.role === "GUARD") {
      throw forbidden("Guard role may not read M-Pesa transactions")
    }

    const transaction = await db.mpesaTransaction.findUnique({
      where: { checkoutRequestId },
      include: { tenancy: { include: { unit: { include: { property: true } } } } },
    })
    if (!transaction) throw notFound("Transaction not found")

    if (profile.role === "TENANT") {
      if (transaction.tenancy?.tenantId !== profile.id) throw notFound("Transaction not found")
    } else {
      // LANDLORD / CARETAKER / AGENT: the transaction's tenancy must sit in
      // their property chain.
      const property = transaction.tenancy?.unit.property
      const inScope =
        property?.landlordId === profile.id ||
        property?.caretakerId === profile.id ||
        property?.agentId === profile.id
      if (!inScope) throw notFound("Transaction not found")
    }

    const status = await getStkStatus(checkoutRequestId)
    if (!status) throw notFound("Transaction not found")
    return ok(status)
  } catch (error) {
    return handleRouteError(error)
  }
}
