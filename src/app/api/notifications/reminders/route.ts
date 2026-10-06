/**
 * NEST — POST /api/notifications/reminders  (Task 2-a)
 *
 * Send an arrears reminder to a tenancy's tenant. LANDLORD / CARETAKER /
 * AGENT (staff who can read the tenancy chain; no money is written).
 *
 * The tenancy is fetched WITH the sender's scope condition (miss ⇒ 404).
 * Creates ARREARS_REMINDER notifications on both channels (SMS + IN_APP —
 * D-013) with the tenancy's economic balance, then audits REMINDER_SENT.
 * Returns NotificationDto[] (one per channel).
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { handleRouteError, notFound, ok, parseJsonBody, requireRole, tenancyScopeWhere } from "@/lib/auth-guard"
import { toNotificationDtoRow } from "@/lib/dto"
import { formatKes } from "@/lib/money"
import { queueNotification } from "@/lib/notify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const reminderSchema = z.object({
  tenancyId: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const profile = await requireRole("LANDLORD", "CARETAKER", "AGENT")
    const { tenancyId } = await parseJsonBody(request, reminderSchema)

    const tenancy = await db.tenancy.findFirst({
      where: { id: tenancyId, status: "ACTIVE", ...tenancyScopeWhere(profile) },
      include: { tenant: true, unit: { include: { property: true } } },
    })
    if (!tenancy) throw notFound("Tenancy not found")

    // Economic balance: charges raised − matched payments (negative = credit).
    const [charges, payments] = await Promise.all([
      db.rentCharge.findMany({ where: { tenancyId: tenancy.id }, select: { amountMinor: true } }),
      db.payment.findMany({ where: { tenancyId: tenancy.id, status: "COMPLETED" }, select: { amountMinor: true } }),
    ])
    const balanceMinor =
      charges.reduce((sum, c) => sum + c.amountMinor, 0) - payments.reduce((sum, p) => sum + p.amountMinor, 0)

    const body =
      `NEST: Hi ${tenancy.tenant.fullName}, rent for ${tenancy.unit.label} ` +
      `(${tenancy.unit.property.name}) is past due. Balance ${formatKes(balanceMinor)}. ` +
      `Pay via M-Pesa using account ref ${tenancy.accountRef}.`

    const sms = await queueNotification(tenancy.tenantId, "SMS", "ARREARS_REMINDER", body)
    const inApp = await queueNotification(tenancy.tenantId, "IN_APP", "ARREARS_REMINDER", body)

    await audit(profile.id, "REMINDER_SENT", "Tenancy", tenancy.id, {
      tenancyId: tenancy.id,
      tenantId: tenancy.tenantId,
      balanceMinor,
      channels: ["SMS", "IN_APP"],
    })

    const notifications = [sms, inApp].filter((n) => n !== null)
    return ok(notifications.map(toNotificationDtoRow))
  } catch (error) {
    return handleRouteError(error)
  }
}
