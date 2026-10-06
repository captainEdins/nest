/**
 * NEST — POST /api/deposits/[tenancyId]/settle  (Task P2-b, issue #22)
 *
 * LANDLORD-only settlement of a security deposit at move-out. This is the
 * receipt-of-record moment for the deposit ledger:
 *
 *   1. Zod-validate the deduction lines ({reason, amountMinor}, ≤ 10 lines,
 *      empty array = full refund).
 *   2. Scope-check the tenancy (landlord property chain) in the SAME fetch
 *      — a miss is a 404, existence must not leak.
 *   3. Guard rails (in order):
 *        - no Deposit row            → 404 "no deposit for tenancy"
 *        - Deposit already RELEASED  → 409 "already settled" — the
 *          idempotency guard: a replayed settle can never double-deduct.
 *        - tenancy still ACTIVE      → 400 VALIDATION "tenancy not ending"
 *          (settlement needs NOTICE or ENDED).
 *        - no MOVE_OUT condition report → 400 VALIDATION "move-out
 *          condition report required" (record it first via
 *          POST /api/condition-reports).
 *        - Σ deductions > heldMinor  → 400 VALIDATION "deductions exceed
 *          amount held".
 *   4. One prisma transaction: append-only DEDUCT movement per line, one
 *      REFUND movement for the remainder, then an atomic HELD→RELEASED
 *      compare-and-set on Deposit so a concurrent second settle rolls back
 *      instead of double-deducting. The DEPOSIT_SETTLED audit row (full
 *      detail — this is the receipt of record) is written inside the same
 *      transaction, atomic with the money.
 *   5. Notify the tenant IN_APP + SMS with the full money story.
 *
 * Money is integer KES minor units throughout — no floats, no rounding.
 * Movements are append-only: this route only ever CREATEs movement rows;
 * the only Deposit mutation is the HELD→RELEASED status flip with
 * heldMinor = 0 (deducted + refunded always equals held by construction,
 * so the ledger invariant heldMinor = HOLD+ADJUST−DEDUCT−REFUND holds).
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { formatKes } from "@/lib/money"
import { queueNotification } from "@/lib/notify"
import {
  ApiHttpError,
  conflict,
  depositTenancyScopeWhere,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  requireRole,
} from "@/lib/auth-guard"
import { conditionReportInclude, depositInclude, toDepositDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const deductionSchema = z.object({
  reason: z.string().trim().min(3).max(200),
  amountMinor: z.number().int().positive(),
})

const settleSchema = z.object({
  // Empty array = full refund; max 10 lines keeps the receipt human-readable.
  deductions: z.array(deductionSchema).max(10),
})

/** A domain rule violation → 400 with code VALIDATION (contract shape). */
const ruleViolation = (message: string) => new ApiHttpError(400, message, "VALIDATION")

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenancyId: string }> }
) {
  try {
    const profile = await requireRole("LANDLORD")
    const { tenancyId } = await params
    const body = await parseJsonBody(request, settleSchema)

    // Scope check + full settlement context in one fetch.
    const tenancy = await db.tenancy.findFirst({
      where: { id: tenancyId, ...depositTenancyScopeWhere(profile) },
      include: {
        deposit: { include: depositInclude },
        conditionReports: { include: conditionReportInclude, orderBy: { createdAt: "asc" } },
      },
    })
    if (!tenancy) throw notFound("Tenancy not found")

    const deposit = tenancy.deposit
    if (!deposit) throw notFound("No deposit for tenancy")

    // Idempotency guard — checked BEFORE any state reasoning so a replayed
    // settle short-circuits immediately (and re-checked inside the
    // transaction as an atomic compare-and-set for the race window).
    if (deposit.status === "RELEASED") throw conflict("Deposit already settled")

    // Settlement only happens on an ending / ended tenancy.
    if (tenancy.status !== "NOTICE" && tenancy.status !== "ENDED") {
      throw ruleViolation("Tenancy not ending — deposit settlement happens at move-out")
    }

    // Evidence first: a MOVE_OUT condition report must be on record.
    const hasMoveOutReport = tenancy.conditionReports.some((report) => report.kind === "MOVE_OUT")
    if (!hasMoveOutReport) {
      throw ruleViolation("Move-out condition report required before settlement")
    }

    // Integer math only: Σ deductions must fit inside the amount held.
    const heldBeforeMinor = deposit.heldMinor
    const totalDeductedMinor = body.deductions.reduce((sum, line) => sum + line.amountMinor, 0)
    if (totalDeductedMinor > heldBeforeMinor) {
      throw ruleViolation("Deductions exceed amount held")
    }
    const refundMinor = heldBeforeMinor - totalDeductedMinor

    // ---- Settlement: one transaction, all rows or none -----------------------
    await db.$transaction(async (tx) => {
      // Append-only ledger entries — one DEDUCT movement per line.
      for (const line of body.deductions) {
        await tx.depositMovement.create({
          data: {
            depositId: deposit.id,
            kind: "DEDUCT",
            amountMinor: line.amountMinor,
            reason: line.reason,
            actorId: profile.id,
          },
        })
      }
      // The remainder goes back to the tenant as one REFUND movement.
      if (refundMinor > 0) {
        await tx.depositMovement.create({
          data: {
            depositId: deposit.id,
            kind: "REFUND",
            amountMinor: refundMinor,
            reason: "Balance refunded to tenant at move-out",
            actorId: profile.id,
          },
        })
      }
      // Atomic HELD → RELEASED compare-and-set: a concurrent second settle
      // finds zero matching rows, throws inside the transaction and rolls
      // back every movement written above — double-deduct is impossible.
      // heldMinor = 0 by construction (deducted + refunded = held).
      const settled = await tx.deposit.updateMany({
        where: { id: deposit.id, status: "HELD" },
        data: { status: "RELEASED", heldMinor: 0 },
      })
      if (settled.count === 0) throw conflict("Deposit already settled")

      // Receipt of record — full settlement detail, atomic with the money.
      await audit(
        profile.id,
        "DEPOSIT_SETTLED",
        "Deposit",
        deposit.id,
        {
          tenancyId: tenancy.id,
          heldMinor: heldBeforeMinor,
          deductions: body.deductions,
          refundMinor,
        },
        tx
      )
    })

    // ---- Notifications: never break the money flow (queueNotification
    // never throws). Full money story so the tenant can verify the math. ----
    const unitLabel = deposit.tenancy.unit.label
    const propertyName = deposit.tenancy.unit.property.name
    const deductionSummary =
      body.deductions.length === 0
        ? "none"
        : `${formatKes(totalDeductedMinor)} (${body.deductions.map((line) => line.reason).join("; ")})`
    const notificationBody =
      `NEST: Deposit settled for unit ${unitLabel}, ${propertyName}. ` +
      `Held: ${formatKes(heldBeforeMinor)}. ` +
      `Deductions: ${deductionSummary}. ` +
      `Refund: ${formatKes(refundMinor)}.`
    await Promise.all([
      queueNotification(tenancy.tenantId, "IN_APP", "DEPOSIT_SETTLED", notificationBody),
      queueNotification(tenancy.tenantId, "SMS", "DEPOSIT_SETTLED", notificationBody),
    ])

    // ---- Fresh DepositDto for the caller (status RELEASED, heldMinor 0) ----
    const fresh = await fetchFreshDeposit(tenancy.id, deposit.id)
    return ok(fresh)
  } catch (error) {
    return handleRouteError(error)
  }
}

/** Re-fetch the settled deposit + its condition reports for the response. */
async function fetchFreshDeposit(tenancyId: string, depositId: string) {
  const [deposit, reports] = await Promise.all([
    db.deposit.findUniqueOrThrow({ where: { id: depositId }, include: depositInclude }),
    db.conditionReport.findMany({
      where: { tenancyId },
      include: conditionReportInclude,
      orderBy: { createdAt: "asc" },
    }),
  ])
  return toDepositDto(deposit, reports)
}
