/**
 * NEST — GET /api/payments/unmatched  (Task 2-a, issue #10)
 *
 * The unmatched-money review queue. LANDLORD / AGENT / CARETAKER only
 * (TENANT/GUARD → 403 — the queue is invisible to them, matrix §4.4/§4.5).
 *
 * Visibility (matrix §4.1/§4.2/§4.3 + §7.4):
 *   LANDLORD  → every UNMATCHED payment (owner of record on the single
 *               paybill shortcode).
 *   CARETAKER /
 *   AGENT     → UNMATCHED payments whose PAYER PHONE matches a tenant of
 *               their scoped properties only (the seeded +254722000999
 *               payment is invisible to them — matrix §6 probe).
 *
 * Returns PaymentDto[] (matchedLabel falls back to the payer phone).
 */

import { db } from "@/lib/db"
import { handleRouteError, ok, requireRole, unmatchedVisibleWhere } from "@/lib/auth-guard"
import { paymentInclude, toPaymentDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireRole("LANDLORD", "AGENT", "CARETAKER")
    const payments = await db.payment.findMany({
      where: await unmatchedVisibleWhere(profile),
      orderBy: { receivedAt: "desc" },
      include: paymentInclude,
    })
    return ok(payments.map(toPaymentDto))
  } catch (error) {
    return handleRouteError(error)
  }
}
