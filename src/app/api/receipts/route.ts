/**
 * NEST — GET /api/receipts
 *
 * Scoped ReceiptDto[] (receipts are derived data — nobody writes them):
 *   TENANT              → receipts of their own ACTIVE tenancy (matrix §4.4).
 *   LANDLORD/CARETAKER/
 *   AGENT               → receipts across their property chain.
 *   GUARD               → 403 (money endpoint, matrix §5.3).
 *
 * Receipt rows = matched COMPLETED payments (receiptNo set), newest first,
 * each with its PaymentAllocation breakdown (query via PaymentAllocation
 * include — money.ts waterfall visible to the penny).
 */

import { db } from "@/lib/db"
import { forbidden, handleRouteError, ok, requireProfile, paymentScopeWhere } from "@/lib/auth-guard"
import { paymentInclude, toReceiptDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireProfile()
    if (profile.role === "GUARD") {
      throw forbidden("Guard role may not read receipts")
    }

    const payments = await db.payment.findMany({
      where: {
        receiptNo: { not: null },
        status: "COMPLETED",
        ...(await paymentScopeWhere(profile)),
      },
      orderBy: { receivedAt: "desc" },
      include: paymentInclude,
    })

    return ok(payments.map(toReceiptDto))
  } catch (error) {
    return handleRouteError(error)
  }
}
