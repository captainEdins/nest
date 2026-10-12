/**
 * NEST — POST /api/expenses/[id]/reverse (Phase 12, issue #82).
 *
 * Append-only correction: the original row is never touched; a NEW row with
 * −amountMinor and reversalOfId = original id is written (the deposit-movement
 * trust pattern). LANDLORD-only — reversing money-out is an owner decision.
 *
 * Guard rails:
 * - scope miss ⇒ 404 (existence must not leak),
 * - already reversed ⇒ 409 (reversalOfId is @unique — replay-proof),
 * - reversing a reversal ⇒ 400 (the ledger stops exactly one level deep),
 * - note is REQUIRED (≥ 3 chars): a correction says why — trust is the product.
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
  expenseScopeWhere,
  ApiHttpError,
} from "@/lib/auth-guard"
import { expenseInclude, toExpenseDto } from "@/lib/dto"
import { formatKes } from "@/lib/money"
import { queueNotification } from "@/lib/notify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const reverseSchema = z.object({
  note: z.string().trim().min(3).max(140),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireRole("LANDLORD")
    const { id } = await context.params
    const input = await parseJsonBody(request, reverseSchema)

    const original = await db.expense.findFirst({
      where: { id, ...expenseScopeWhere(profile) },
      include: {
        ...expenseInclude,
        reversal: { select: { id: true } },
        original: { select: { id: true } },
      },
    })
    if (!original) throw notFound("Expense not found")
    if (original.reversal) {
      throw conflict("This expense has already been reversed")
    }
    if (original.reversalOfId) {
      throw new ApiHttpError(400, "A reversal cannot be reversed", "VALIDATION")
    }

    const reversal = await db.expense.create({
      data: {
        propertyId: original.propertyId,
        category: original.category,
        amountMinor: -original.amountMinor,
        occurredAt: original.occurredAt,
        note: input.note,
        recordedById: profile.id,
        reversalOfId: original.id,
      },
      include: expenseInclude,
    })

    await audit(profile.id, "EXPENSE_REVERSED", "Expense", original.id, {
      reversalId: reversal.id,
      propertyId: original.propertyId,
      category: original.category,
      amountMinor: -original.amountMinor,
      reversedBy: profile.fullName,
      note: input.note,
    })

    // If the caretaker keyed the original, tell them it was reversed
    // (they see the ledger; the correction must not be a surprise).
    if (original.recordedById !== profile.id) {
      const body = `NEST: The ${original.category.toLowerCase()} expense of ${formatKes(
        original.amountMinor,
      )} for ${original.property.name} was reversed by ${profile.fullName}. Reason: ${input.note}`
      await queueNotification(original.recordedById, "IN_APP", "EXPENSE_REVERSED", body)
    }

    return ok(toExpenseDto(reversal), 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
