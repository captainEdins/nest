/**
 * NEST — POST /api/notifications/remind-all  (Phase 13, issue #84 part A)
 *
 * One verified action that notifies EVERY in-scope tenant with a balance.
 *
 * Roles: LANDLORD + CARETAKER only (a bulk blast is a bigger hammer than the
 * per-tenant reminder in /api/notifications/reminders, which also allows
 * agents — ROLE-SCOPE-MATRIX §5.6).
 *
 * Idempotency: one successful bulk run locks the SENDER out for 30 minutes —
 * the last REMINDERS_BULK_SENT AuditLog row for this actor is the lock (durable,
 * append-only, no new state to drift). A replay inside the window → 409.
 *
 * Money rules (same as the single reminder):
 * - Balance is ALWAYS the economic figure: Σ charge.amountMinor − Σ matched
 *   COMPLETED payments (integer KES minor units — no floats on the wire).
 * - Only tenancies with balance > 0 are notified (credits are never arrears,
 *   ADR-0007). No money is written by this route — notifications + audit only.
 * - Delivery failures never break the flow (queueNotification contract, D-013).
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  handleRouteError,
  ok,
  parseJsonBody,
  requireRole,
  tenancyScopeWhere,
} from "@/lib/auth-guard"
import { formatKes } from "@/lib/money"
import { queueNotification } from "@/lib/notify"
import type { RemindAllResultDto } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Replay window (ms) — one bulk run per sender per 30 minutes. */
const REMIND_ALL_COOLDOWN_MS = 30 * 60 * 1000

const remindAllSchema = z.object({}).strict()

export async function POST(request: Request) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER")
    await parseJsonBody(request, remindAllSchema)

    // Idempotency lock — the sender's most recent successful bulk run.
    const [lastRun] = await db.auditLog.findMany({
      where: { actorId: profile.id, action: "REMINDERS_BULK_SENT" },
      orderBy: { createdAt: "desc" },
      take: 1,
    })
    if (lastRun && Date.now() - lastRun.createdAt.getTime() < REMIND_ALL_COOLDOWN_MS) {
      throw conflict("Bulk reminders were already sent in the last 30 minutes")
    }

    // In-scope ACTIVE tenancies with tenant + unit + property for the message.
    const tenancies = await db.tenancy.findMany({
      where: { status: "ACTIVE", ...tenancyScopeWhere(profile) },
      include: { tenant: true, unit: { include: { property: true } } },
    })

    // Per-tenancy economic balance — the same math as the single reminder,
    // batched so the blast and the per-row button can never disagree.
    const rows = await Promise.all(
      tenancies.map(async (tenancy) => {
        const [charges, payments] = await Promise.all([
          db.rentCharge.findMany({ where: { tenancyId: tenancy.id }, select: { amountMinor: true } }),
          db.payment.findMany({
            where: { tenancyId: tenancy.id, status: "COMPLETED" },
            select: { amountMinor: true },
          }),
        ])
        const balanceMinor =
          charges.reduce((sum, c) => sum + c.amountMinor, 0) -
          payments.reduce((sum, p) => sum + p.amountMinor, 0)
        return { tenancy, balanceMinor }
      }),
    )
    const due = rows.filter((row) => row.balanceMinor > 0)

    // The message is EXACTLY the single-reminder shape (name, unit, property,
    // balance, account ref, M-Pesa) — a tenant cannot tell which button sent it.
    for (const { tenancy, balanceMinor } of due) {
      const body =
        `NEST: Hi ${tenancy.tenant.fullName}, rent for ${tenancy.unit.label} ` +
        `(${tenancy.unit.property.name}) is past due. Balance ${formatKes(balanceMinor)}. ` +
        `Pay via M-Pesa using account ref ${tenancy.accountRef}.`
      await queueNotification(tenancy.tenantId, "SMS", "ARREARS_REMINDER", body)
      await queueNotification(tenancy.tenantId, "IN_APP", "ARREARS_REMINDER", body)
    }

    await audit(profile.id, "REMINDERS_BULK_SENT", "Profile", profile.id, {
      notifiedCount: due.length,
      skippedCount: tenancies.length - due.length,
      channels: ["SMS", "IN_APP"],
    })

    const result: RemindAllResultDto = {
      notifiedCount: due.length,
      skippedCount: tenancies.length - due.length,
      channels: ["SMS", "IN_APP"],
      sentAt: new Date().toISOString(),
    }
    return ok(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
