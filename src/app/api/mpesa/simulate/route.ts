/**
 * NEST — POST /api/mpesa/simulate  (Task 2-a, ADR-0005 "sim" mode)
 *
 * The sandbox's stand-in for Safaricom calling our callback. Builds a REAL
 * Daraja-shaped callback body (buildSimulatedStkCallback — CallbackMetadata
 * only on ResultCode 0, receipt number, payer phone, TransactionDate) and
 * feeds it DIRECTLY to processStkCallback — the exact same pipeline as a
 * live callback: idempotency, allocation, receipting, notification, audit.
 * No self-HTTP, no shortcut around the engine.
 *
 * Guards:
 *   - 403 FORBIDDEN when MPESA_MODE=live — this endpoint must not exist in
 *     production (the only real money path is Safaricom's callback).
 *   - Unauthenticated by design in sim mode: it is a clearly-named QA/demo
 *     hook for the UI's "confirm payment" step (S-09) and the E2E matrix;
 *     it can only complete pushes that were themselves initiated in sim
 *     mode, and every call writes an MPESA_STK_SIMULATED audit row.
 *
 * Body: { checkoutRequestId, outcome: SUCCESS | CANCELLED | TIMEOUT | INSUFFICIENT }
 * Returns the engine's StkCallbackOutcome (ok/replay/matched/paymentId…).
 */

import { z } from "zod"
import { audit } from "@/lib/audit"
import { forbidden, handleRouteError, notFound, ok, parseJsonBody } from "@/lib/auth-guard"
import { buildSimulatedStkCallback, mpesaMode } from "@/lib/mpesa"
import { processStkCallback, type StkCallbackOutcome } from "@/lib/reconciliation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const simulateSchema = z.object({
  checkoutRequestId: z.string().min(1),
  outcome: z.enum(["SUCCESS", "CANCELLED", "TIMEOUT", "INSUFFICIENT"]),
})

export async function POST(request: Request) {
  try {
    if (mpesaMode() === "live") {
      throw forbidden("Payment simulation is disabled in live mode")
    }
    const body = await parseJsonBody(request, simulateSchema)

    // Build a real Daraja body for this push (404 when the id is unknown).
    let rawBody: string
    try {
      rawBody = await buildSimulatedStkCallback(body.checkoutRequestId, body.outcome)
    } catch (error) {
      throw notFound(error instanceof Error ? error.message : "Unknown CheckoutRequestID")
    }

    await audit(null, "MPESA_STK_SIMULATED", "MpesaTransaction", body.checkoutRequestId, {
      outcome: body.outcome,
    })

    const outcome: StkCallbackOutcome = await processStkCallback(rawBody)
    return ok(outcome)
  } catch (error) {
    return handleRouteError(error)
  }
}
