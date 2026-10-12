/**
 * NEST — /api/expenses (Phase 12, issue #82) — money-out ledger.
 *
 * GET  ?month=YYYY-MM  — role-scoped rows for the month + category totals.
 *                        (LANDLORD: owned; CARETAKER/AGENT: assigned/managed.
 *                        TENANT/GUARD: 403 — money-out is staff business.)
 * POST                — record a spend. LANDLORD + CARETAKER (the caretaker
 *                        keys in spend on-site; landlord gets an IN_APP+SMS
 *                        notification — the fraud-detection trust story).
 *                        AGENT/TENANT/GUARD: 403 (no writing money-out).
 *
 * Money rules (same discipline as payments):
 * - amountMinor is a POSITIVE integer (KES minor units) on creation;
 * - the row is append-only — corrections are REVERSING rows via
 *   POST /api/expenses/[id]/reverse, never mutations here;
 * - every write lands in AuditLog (EXPENSE_RECORDED).
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
  parseSearchParams,
  requireRole,
  expenseScopeWhere,
} from "@/lib/auth-guard"
import { expenseInclude, toExpenseDto } from "@/lib/dto"
import { formatKes } from "@/lib/money"
import { queueNotification } from "@/lib/notify"
import type { ExpensesResponseDto } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must look like YYYY-MM")

const createSchema = z.object({
  propertyId: z.string().min(1),
  category: z.enum([
    "REPAIRS",
    "WATER",
    "GARBAGE",
    "SECURITY",
    "SALARY",
    "UTILITIES",
    "OTHER",
  ]),
  amountMinor: z.number().int().positive().max(100_000_000), // ≤ KSh 1,000,000 in minor units
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "occurredAt must be a calendar day (YYYY-MM-DD)")
    .refine((v) => {
      const day = new Date(`${v}T00:00:00Z`)
      if (Number.isNaN(day.getTime())) return false
      // Future money-out is a plan, not a record: cap at today.
      const today = new Date()
      const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      return day.getTime() <= todayUtc
    }, "occurredAt cannot be in the future"),
  note: z.string().trim().max(140).optional(),
})

/** Month boundaries (UTC) for a "YYYY-MM" key — expenses bucket by occurredAt. */
function monthBounds(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  return { start, end }
}

function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function GET(request: Request) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER", "AGENT")
    const { month } = parseSearchParams(request, z.object({ month: monthSchema.optional() }))
    const monthKey = month ?? currentMonthKey()
    const { start, end } = monthBounds(monthKey)

    const rows = await db.expense.findMany({
      where: {
        ...expenseScopeWhere(profile),
        occurredAt: { gte: start, lt: end },
      },
      include: expenseInclude,
      orderBy: { occurredAt: "desc" },
    })

    // Category totals — net of reversals by sign (a reversal is −amount).
    const byCategory: ExpensesResponseDto["totals"]["byCategory"] = {}
    let totalMinor = 0
    for (const row of rows) {
      byCategory[row.category as keyof typeof byCategory] =
        (byCategory[row.category as keyof typeof byCategory] ?? 0) + row.amountMinor
      totalMinor += row.amountMinor
    }

    const body: ExpensesResponseDto = {
      monthKey,
      expenses: rows.map(toExpenseDto),
      totals: { monthKey, totalMinor, byCategory },
    }
    return ok(body)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER")
    const input = await parseJsonBody(request, createSchema)

    // Scope the property: landlord owns it OR caretaker is assigned to it.
    // Existence must not leak — a miss is a 404 either way.
    const property = await db.property.findFirst({
      where:
        profile.role === "LANDLORD"
          ? { id: input.propertyId, landlordId: profile.id }
          : { id: input.propertyId, caretakerId: profile.id },
      select: { id: true, name: true, landlord: { select: { id: true, fullName: true } } },
    })
    if (!property) throw notFound("Property not found")

    // Calendar day at UTC midnight (the move-out seed convention).
    const occurredAt = new Date(`${input.occurredAt}T00:00:00Z`)

    const row = await db.expense.create({
      data: {
        propertyId: property.id,
        category: input.category,
        amountMinor: input.amountMinor,
        occurredAt,
        note: input.note ?? null,
        recordedById: profile.id,
      },
      include: expenseInclude,
    })

    await audit(profile.id, "EXPENSE_RECORDED", "Expense", row.id, {
      propertyId: property.id,
      propertyName: property.name,
      category: input.category,
      amountMinor: input.amountMinor,
      occurredAt: input.occurredAt,
      recordedBy: profile.fullName,
    })

    // Caretaker spend visible to the landlord instantly (trust story, D-013).
    if (profile.role === "CARETAKER") {
      const body =
        `NEST: ${profile.fullName} recorded a ${input.category.toLowerCase()} expense of ` +
        `${formatKes(input.amountMinor)} for ${property.name}.` +
        (input.note ? ` Note: ${input.note}` : "")
      await queueNotification(property.landlord.id, "IN_APP", "EXPENSE_RECORDED", body)
      await queueNotification(property.landlord.id, "SMS", "EXPENSE_RECORDED", body)
    }

    return ok(toExpenseDto(row), 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
