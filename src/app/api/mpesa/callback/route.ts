/**
 * NEST — POST /api/mpesa/callback  (Task 2-a, issue #10 — ADR-0005)
 *
 * The Daraja STK callback endpoint — the single non-session money-write
 * path (role-scope-matrix §7.3). Authenticated by the Daraja signature,
 * never by a session cookie.
 *
 * Contract rules (Daraja retries on non-200, so):
 *   - ALWAYS returns 200 { ResultCode: 0, ResultDesc: "Accepted" },
 *     including for tampered/unknown/malformed callbacks — errors are
 *     logged + audited, never surfaced as 5xx.
 *   - Reads the RAW request body (await request.text()) — signature
 *     verification and replay comparison are byte-exact.
 *   - Idempotency is keyed on CheckoutRequestID inside processStkCallback
 *     (callbackProcessedAt guard): replays are 200 OK with NO re-crediting.
 *
 * Signature: when the x-mpesa-signature header is present we verify
 * HMAC-SHA256(MPESA_CALLBACK_SECRET) over the raw body (timing-safe). If
 * the secret is unset (sim mode) verification is skipped with a warning +
 * audit note — never silently. Invalid signature → callback NOT processed,
 * still 200.
 */

import { NextResponse } from "next/server"
import { audit } from "@/lib/audit"
import { processStkCallback } from "@/lib/reconciliation"
import { verifyDarajaSignature } from "@/lib/mpesa"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Daraja's required acknowledgement shape. */
function accepted(): NextResponse {
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })
}

export async function POST(request: Request) {
  // Byte-exact raw body — never re-serialized before verification/processing.
  const rawBody = await request.text()
  const signature = request.headers.get("x-mpesa-signature")

  try {
    // Verify only when a signature header is present; the helper handles the
    // "secret unset (sim)" case with a console.warn + audit note.
    if (signature) {
      const verification = await verifyDarajaSignature(rawBody, signature)
      if (!verification.ok) {
        console.error("[mpesa] callback signature REJECTED:", verification.reason)
        await audit(null, "MPESA_CALLBACK_REJECTED", "MpesaTransaction", null, {
          reason: verification.reason,
          rawBodyHead: rawBody.slice(0, 200),
        })
        return accepted() // no processing, but 200 (Daraja contract)
      }
    }

    const outcome = await processStkCallback(rawBody)
    if (!outcome.ok) {
      // Logged + audited inside the engine; Daraja still gets its 200.
      console.error("[mpesa] callback not processed:", outcome.outcome, outcome.message)
    }
    return accepted()
  } catch (error) {
    // Never 500: Daraja would hammer-retry. Crash is audited for ops.
    console.error("[mpesa] callback handler CRASHED:", error)
    await audit(null, "MPESA_CALLBACK_ERROR", "MpesaTransaction", null, {
      error: error instanceof Error ? error.message : String(error),
      rawBodyHead: rawBody.slice(0, 200),
    })
    return accepted()
  }
}
