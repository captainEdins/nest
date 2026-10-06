/**
 * NEST — append-only audit trail writer (Task 2-a, D-008).
 *
 * Every financial/auth mutation lands in AuditLog. Audit has NO read API in
 * Phase 1 (role-scope-matrix §7.7) — rows are written by the system and read
 * by server-side tooling only.
 *
 * RULE: audit failures must NEVER break a money flow. This function catches
 * its own errors and logs them loudly; the caller's transaction/mutation has
 * already succeeded at that point (audits are written post-commit by design —
 * a crash between commit and audit loses an audit row, never money).
 */

import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

export type AuditClient = Prisma.TransactionClient | typeof db

/**
 * Write one AuditLog row.
 * @param actorId  Profile id of the human actor, or null for system actions
 *                 (e.g. the M-Pesa callback pipeline).
 * @param action   e.g. MPESA_CALLBACK, PAYMENT_CASH_RECORDED, UNMATCHED_MATCHED,
 *                 AUTH_LOGIN, MPESA_STK_INITIATED, REMINDER_SENT.
 * @param entity   e.g. "Payment", "MpesaTransaction", "Profile", "Tenancy".
 * @param entityId Row id (string; Payment ids are integers — stringify).
 * @param detail   Optional JSON-serializable detail (amounts, references…).
 */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: unknown,
  client: AuditClient = db
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId ?? null,
        detailJson: detail === undefined ? null : JSON.stringify(detail),
      },
    })
  } catch (error) {
    // Never throws upward — money already moved. Loud log for ops.
    console.error(`[audit] FAILED to write ${action} on ${entity}:${entityId ?? "-"} —`, error)
  }
}
