/**
 * NEST — Reconciliation engine (Task 2-a, ADR-0007). THE money pipeline.
 *
 * INVARIANTS (enforced here, nowhere else — this module is the single
 * append-only write path for money, per D-008 and role-scope-matrix §1):
 *
 *  1. ALL money writes flow through this file. Routes never create/edit
 *     Payment/PaymentAllocation rows directly; `paidMinor` is always
 *     recomputed as the SUM of a charge's PaymentAllocation rows (never
 *     hand-set, never client-supplied).
 *  2. Idempotency: STK callback processing is keyed on CheckoutRequestID +
 *     `callbackProcessedAt`; replays return without re-crediting. Cash
 *     collections are idempotent on `clientRef`.
 *  3. Ledger invariant: Σ allocations ≤ payment.amountMinor, with equality
 *     whenever open charges exist (ADR-0007 "Σ allocations = payment amount").
 *     An over-payment beyond open charges is carried as TENANT CREDIT:
 *     no negative allocation is ever created; the remainder is recorded in
 *     `payment.note` and shows as a NEGATIVE tenancy balance (charges Σ −
 *     payments Σ) until Phase 2's wallet ledger refines it.
 *  4. Allocation is a waterfall: open charges ordered by dueDate asc (then
 *     RENT before WATER before GARBAGE within the same date), cents preserved
 *     exactly via `splitWaterfall` (money.ts) — never floats.
 *  5. Receipts are deterministic: `NEST-R-` + paymentId zero-padded to 6 —
 *     set once, never changed; Payment.id is an autoincrement, so the number
 *     is race-free.
 *  6. Failed/cancelled STK pushes NEVER create money rows — pending state
 *     lives in MpesaTransaction only.
 *  7. Every financial mutation writes an AuditLog row (post-commit so money
 *     integrity is never hostage to audit failures).
 *
 * Money-write entry points: processStkCallback (the single non-session path,
 * authenticated by the Daraja signature), recordCashCollection, and
 * matchUnmatchedPayment. Everything else is read-only.
 */

import type { Payment, Prisma, Tenancy } from "@prisma/client"
import { db } from "@/lib/db"
import { ApiHttpError } from "@/lib/auth-guard"
import { audit } from "@/lib/audit"
import { queueNotification } from "@/lib/notify"
import { formatKes, splitWaterfall } from "@/lib/money"
import { kenyanPhoneKey9, normalizeKenyanPhone } from "@/lib/phones"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Deterministic receipt number from the immutable payment id. */
export function receiptNoFor(paymentId: number): string {
  return `NEST-R-${String(paymentId).padStart(6, "0")}`
}

/** Charge-kind rank for waterfall ordering within one due date: RENT first. */
function kindRank(kind: string): number {
  switch (kind) {
    case "RENT":
      return 0
    case "WATER":
      return 1
    case "GARBAGE":
      return 2
    default:
      return 3
  }
}

/**
 * Run a Prisma interactive transaction with a small retry loop for SQLite
 * write-lock contention (SQLITE_BUSY under concurrent callbacks/cash posts).
 *
 * RETRY SAFETY: every transactional path below re-checks its idempotency key
 * (callbackProcessedAt / clientRef / status UNMATCHED) INSIDE the
 * transaction, so a retry after an ambiguous timeout can never double-credit.
 */
async function withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const maxAttempts = 4
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(fn, { timeout: 15_000 })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable = /busy|locked|sqlite|timed out|p2028/i.test(message)
      if (!retryable || attempt >= maxAttempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 40 * attempt + Math.random() * 40))
    }
  }
}

// ---------------------------------------------------------------------------
// Tenancy resolution (ADR-0007 step 1: match)
// ---------------------------------------------------------------------------

/**
 * Resolve the tenancy a payment belongs to:
 *   1. accountReference exact-match to an ACTIVE Tenancy.accountRef, else
 *   2. payer phone → tenant profile → their ACTIVE tenancy (E.164 exact
 *      first, then last-9-digits comparison to survive format variance).
 * Returns null when nothing matches → the payment goes to the UNMATCHED queue.
 */
async function resolveTenancyForPayment(
  tx: Prisma.TransactionClient,
  payment: { accountReference: string | null; phone: string | null }
): Promise<Tenancy | null> {
  if (payment.accountReference) {
    const byRef = await tx.tenancy.findFirst({ where: { accountRef: payment.accountReference, status: "ACTIVE" } })
    if (byRef) return byRef
  }

  if (payment.phone) {
    const e164 = normalizeKenyanPhone(payment.phone)
    if (e164) {
      const profile = await tx.profile.findUnique({ where: { phone: e164 }, select: { id: true } })
      if (profile) {
        const byPhone = await tx.tenancy.findFirst({ where: { tenantId: profile.id, status: "ACTIVE" } })
        if (byPhone) return byPhone
      }
    }
    // Last-9-digits fallback: "+254711000003" vs "254711000003" vs "0711000003".
    const key9 = kenyanPhoneKey9(payment.phone)
    if (key9) {
      const tenants = await tx.profile.findMany({ where: { role: "TENANT" }, select: { id: true, phone: true } })
      const tenantIds = tenants.filter((p) => kenyanPhoneKey9(p.phone) === key9).map((p) => p.id)
      if (tenantIds.length > 0) {
        const byKey = await tx.tenancy.findFirst({ where: { tenantId: { in: tenantIds }, status: "ACTIVE" } })
        if (byKey) return byKey
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Allocation core (ADR-0007 step 2: waterfall) — runs INSIDE a transaction
// ---------------------------------------------------------------------------

interface CoreAllocationResult {
  matched: boolean
  tenancyId: string | null
  receiptNo: string | null
  allocations: { chargeId: string; amountMinor: number }[]
  /** Over-payment remainder beyond all open charges (tenant credit). */
  unallocatedMinor: number
}

/**
 * Match + allocate an existing Payment row inside `tx`:
 * - resolves the tenancy (unless `knownTenancyId` is given — cash/match paths),
 * - waterfalls the amount across open charges (dueDate asc, RENT first),
 * - creates PaymentAllocation rows,
 * - recomputes each charge's paidMinor from the allocation SUM and sets
 *   status PAID/PART accordingly (the ledger rule — never a direct write),
 * - issues the deterministic receiptNo on the matched path,
 * - over-payment: remainder → payment.note (tenant credit, no negative row).
 *
 * `knownTenancyId` skips reference/phone matching (the caller already knows
 * the target — cash recording and manual matching) but the waterfall, ledger
 * updates and receipting are identical.
 */
async function allocatePaymentCore(
  tx: Prisma.TransactionClient,
  paymentId: number,
  knownTenancyId: string | null
): Promise<CoreAllocationResult> {
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } })

  const tenancy = knownTenancyId
    ? await tx.tenancy.findFirst({ where: { id: knownTenancyId, status: "ACTIVE" } })
    : await resolveTenancyForPayment(tx, payment)

  if (!tenancy) {
    // UNMATCHED: money is recorded, nothing is allocated, no receipt.
    // The manual review queue (landlord/caretaker) resolves it later.
    if (payment.status !== "COMPLETED") {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "UNMATCHED", tenancyId: null } })
    }
    return { matched: false, tenancyId: null, receiptNo: null, allocations: [], unallocatedMinor: payment.amountMinor }
  }

  // Open charges, oldest first; RENT before service charges on the same date.
  const openCharges = await tx.rentCharge.findMany({ where: { tenancyId: tenancy.id, status: { not: "PAID" } } })
  openCharges.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || kindRank(a.kind) - kindRank(b.kind))

  const outstanding = openCharges.map((c) => ({ chargeId: c.id, outstandingMinor: c.amountMinor - c.paidMinor }))
  const allocations = splitWaterfall(payment.amountMinor, outstanding)
  const allocatedTotal = allocations.reduce((sum, a) => sum + a.amountMinor, 0)
  const unallocatedMinor = payment.amountMinor - allocatedTotal // > 0 ⇒ tenant credit

  for (const allocation of allocations) {
    await tx.paymentAllocation.create({ data: { paymentId, chargeId: allocation.chargeId, amountMinor: allocation.amountMinor } })
  }

  // Recompute paidMinor as the SUM of allocations — the ledger invariant —
  // and derive the charge status (PAID when fully settled, PART otherwise).
  for (const chargeId of allocations.map((a) => a.chargeId)) {
    const charge = await tx.rentCharge.findUniqueOrThrow({ where: { id: chargeId } })
    const sum = await tx.paymentAllocation.aggregate({ where: { chargeId }, _sum: { amountMinor: true } })
    const paidMinor = sum._sum.amountMinor ?? 0
    await tx.rentCharge.update({
      where: { id: chargeId },
      data: { paidMinor, status: paidMinor >= charge.amountMinor ? "PAID" : "PART" },
    })
  }

  // Over-payment: no negative allocation — the remainder is tenant credit,
  // surfaced as a negative tenancy balance (charges Σ − payments Σ).
  const creditNote =
    unallocatedMinor > 0
      ? `Overpayment credit ${formatKes(unallocatedMinor)} unallocated — carried as tenant credit (negative balance).`
      : null
  const note = [payment.note, creditNote].filter(Boolean).join(" | ") || null

  await tx.payment.update({
    where: { id: paymentId },
    data: {
      tenancyId: tenancy.id,
      status: "COMPLETED",
      receiptNo: receiptNoFor(paymentId),
      note,
    },
  })

  return { matched: true, tenancyId: tenancy.id, receiptNo: receiptNoFor(paymentId), allocations, unallocatedMinor }
}

/**
 * Match + allocate a payment by its own reference/phone (ADR-0007 step 1+2),
 * inside its own transaction. Exported for flows that create the Payment row
 * first and reconcile it in a second step (callback pipeline passes its own
 * transaction instead to keep creation+allocation atomic).
 */
export async function matchAndAllocate(paymentId: number): Promise<CoreAllocationResult> {
  return withTransaction((tx) => allocatePaymentCore(tx, paymentId, null))
}

// ---------------------------------------------------------------------------
// STK callback processing (the money-write trigger)
// ---------------------------------------------------------------------------

interface DarajaStkCallbackItem {
  Name: string
  Value?: string | number
}

interface DarajaStkCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string
      CheckoutRequestID?: string
      ResultCode?: number | string
      ResultDesc?: string
      CallbackMetadata?: { Item?: DarajaStkCallbackItem[] }
    }
  }
}

export interface StkCallbackOutcome {
  /** true when the callback was handled (or is an idempotent replay). */
  ok: boolean
  /** true when a previously-processed callback replayed — NOTHING re-credited. */
  replay: boolean
  matched: boolean
  outcome: "SUCCESS" | "FAILED" | "TIMEOUT" | "REPLAY" | "NOT_FOUND" | "MALFORMED" | "ERROR"
  paymentId?: number
  receiptNo?: string | null
  resultCode?: number
  resultDesc?: string
  message: string
}

function metadataItem(body: DarajaStkCallbackBody, name: string): DarajaStkCallbackItem | undefined {
  return body.Body?.stkCallback?.CallbackMetadata?.Item?.find((item) => item.Name === name)
}

/**
 * Process a raw Daraja STK callback body (the string exactly as received).
 *
 * Idempotency: keyed on CheckoutRequestID — if `callbackProcessedAt` is set,
 * returns { ok: true, replay: true } WITHOUT re-crediting (checked before AND
 * inside the transaction, so concurrent replays are safe).
 *
 * ResultCode 0 → ONE Payment row (COMPLETED, amount from the callback's
 * Amount × 100 — what M-Pesa settled is the source of truth, source MPESA,
 * payer phone normalized to E.164, accountReference from the push) → match +
 * waterfall allocation → receiptNo NEST-R-###### → receipt notification(s)
 * → MpesaTransaction SUCCESS + paymentId + callbackProcessedAt.
 *
 * Non-zero ResultCode → MpesaTransaction FAILED (1037 → TIMEOUT) +
 * callbackProcessedAt. NO money row is ever created for a failed push.
 */
export async function processStkCallback(rawBody: string): Promise<StkCallbackOutcome> {
  let parsed: DarajaStkCallbackBody
  try {
    parsed = JSON.parse(rawBody) as DarajaStkCallbackBody
  } catch {
    await audit(null, "MPESA_CALLBACK_MALFORMED", "MpesaTransaction", null, { rawBodyHead: rawBody.slice(0, 200) })
    return { ok: false, replay: false, matched: false, outcome: "MALFORMED", message: "Callback body is not valid JSON" }
  }

  const callback = parsed.Body?.stkCallback
  const checkoutRequestId = callback?.CheckoutRequestID
  const resultCode = callback?.ResultCode !== undefined ? Number(callback.ResultCode) : undefined
  const resultDesc = callback?.ResultDesc ?? ""

  if (!checkoutRequestId || resultCode === undefined || Number.isNaN(resultCode)) {
    await audit(null, "MPESA_CALLBACK_MALFORMED", "MpesaTransaction", null, { rawBodyHead: rawBody.slice(0, 200) })
    return { ok: false, replay: false, matched: false, outcome: "MALFORMED", message: "Callback missing CheckoutRequestID/ResultCode" }
  }

  const transaction = await db.mpesaTransaction.findUnique({ where: { checkoutRequestId } })
  if (!transaction) {
    await audit(null, "MPESA_CALLBACK_UNKNOWN", "MpesaTransaction", null, { checkoutRequestId, resultCode })
    return {
      ok: false,
      replay: false,
      matched: false,
      outcome: "NOT_FOUND",
      message: `No STK push found for CheckoutRequestID ${checkoutRequestId}`,
    }
  }

  // Idempotency (pre-check outside the transaction, fast path).
  if (transaction.callbackProcessedAt) {
    await audit(null, "MPESA_CALLBACK_REPLAY", "MpesaTransaction", transaction.id, { checkoutRequestId, resultCode })
    return {
      ok: true,
      replay: true,
      matched: transaction.status === "SUCCESS",
      outcome: "REPLAY",
      paymentId: transaction.paymentId ?? undefined,
      receiptNo: null,
      resultCode,
      resultDesc,
      message: "Callback already processed — no double-credit",
    }
  }

  // ---- Failure paths: no money row, ever ---------------------------------
  if (resultCode !== 0) {
    const status = resultCode === 1037 ? "TIMEOUT" : "FAILED"
    await db.mpesaTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        resultCode: String(resultCode),
        resultDesc,
        callbackProcessedAt: new Date(),
        rawJson: rawBody,
      },
    })
    await audit(null, "MPESA_CALLBACK", "MpesaTransaction", transaction.id, {
      checkoutRequestId,
      resultCode,
      resultDesc,
      outcome: status,
      tenancyId: transaction.tenancyId,
    })
    return {
      ok: true,
      replay: false,
      matched: false,
      outcome: status as "FAILED" | "TIMEOUT",
      resultCode,
      resultDesc,
      message: `STK push failed (ResultCode ${resultCode}): ${resultDesc}`,
    }
  }

  // ---- Success path: create ONE payment, allocate, receipt, notify -------
  const amountItem = metadataItem(parsed, "Amount")
  const amountShillings = amountItem?.Value !== undefined ? Math.round(Number(amountItem.Value)) : NaN
  if (!Number.isFinite(amountShillings) || amountShillings <= 0) {
    // ResultCode 0 without a usable Amount — do NOT mark processed, so a
    // corrected Daraja retry can still land. Anomaly audited.
    await audit(null, "MPESA_CALLBACK_MALFORMED", "MpesaTransaction", transaction.id, {
      checkoutRequestId,
      reason: "ResultCode 0 but Amount metadata missing/invalid",
    })
    return { ok: false, replay: false, matched: false, outcome: "MALFORMED", message: "Success callback missing Amount metadata" }
  }
  const amountMinor = amountShillings * 100

  const payerPhoneRaw = metadataItem(parsed, "PhoneNumber")?.Value
  const payerPhone =
    normalizeKenyanPhone(payerPhoneRaw !== undefined ? String(payerPhoneRaw) : null) ?? transaction.phone

  const mpesaReceiptNo = metadataItem(parsed, "MpesaReceiptNumber")?.Value
  const core = await withTransaction(async (tx) => {
    // Idempotency re-check INSIDE the transaction (race-safe: a concurrent
    // replay that already committed makes this return the replay branch).
    const fresh = await tx.mpesaTransaction.findUnique({ where: { checkoutRequestId } })
    if (!fresh || fresh.callbackProcessedAt) {
      return { replay: true as const, paymentId: fresh?.paymentId ?? undefined, result: null }
    }

    // ONE Payment row for this callback — COMPLETED at the M-Pesa layer;
    // matchAndAllocate flips it to UNMATCHED when nothing matches.
    const payment = await tx.payment.create({
      data: {
        amountMinor,
        source: "MPESA",
        status: "COMPLETED",
        receivedAt: new Date(),
        phone: payerPhone,
        accountReference: transaction.accountReference,
        note:
          mpesaReceiptNo !== undefined
            ? `M-Pesa receipt ${String(mpesaReceiptNo)}`
            : null,
      },
    })

    const result = await allocatePaymentCore(tx, payment.id, transaction.tenancyId ?? null)

    await tx.mpesaTransaction.update({
      where: { id: fresh.id },
      data: {
        status: "SUCCESS",
        resultCode: "0",
        resultDesc,
        callbackProcessedAt: new Date(),
        paymentId: payment.id,
        rawJson: rawBody,
      },
    })

    return { replay: false as const, paymentId: payment.id, result }
  })

  if (core.replay) {
    await audit(null, "MPESA_CALLBACK_REPLAY", "MpesaTransaction", transaction.id, { checkoutRequestId, resultCode: 0 })
    return {
      ok: true,
      replay: true,
      matched: true,
      outcome: "REPLAY",
      paymentId: core.paymentId,
      resultCode: 0,
      resultDesc,
      message: "Callback already processed — no double-credit",
    }
  }

  const paymentId = core.paymentId!
  const result = core.result!

  // Post-commit side effects (notifications/audit never break money flows).
  if (result.matched && result.tenancyId) {
    const tenancy = await db.tenancy.findUnique({
      where: { id: result.tenancyId },
      include: { tenant: { select: { id: true, fullName: true } } },
    })
    if (tenancy) {
      const body = `NEST: Receipt ${result.receiptNo} — ${formatKes(amountMinor)} received for ${tenancy.accountRef}`
      await queueNotification(tenancy.tenant.id, "SMS", "RECEIPT_ISSUED", body)
      await queueNotification(tenancy.tenant.id, "IN_APP", "RECEIPT_ISSUED", body)
    }
  } else {
    // Unmatched M-Pesa money: surface it to every LANDLORD as owner of
    // record for the single paybill shortcode (matrix §7.4). Phase 5
    // hardening: per-property shortcodes must route this to exactly the
    // right landlord — multi-landlord deployments must not skip that.
    const landlords = await db.profile.findMany({ where: { role: "LANDLORD", active: true }, select: { id: true } })
    for (const landlord of landlords) {
      await queueNotification(
        landlord.id,
        "IN_APP",
        "UNMATCHED_PAYMENT",
        `NEST: Unmatched M-Pesa payment of ${formatKes(amountMinor)} from ${payerPhone} ` +
          `(ref ${transaction.accountReference}) needs to be matched to a tenancy.`
      )
    }
  }

  await audit(null, "MPESA_CALLBACK", "Payment", String(paymentId), {
    checkoutRequestId,
    resultCode: 0,
    resultDesc,
    amountMinor,
    tenancyId: result.tenancyId,
    matched: result.matched,
    receiptNo: result.receiptNo,
    unallocatedMinor: result.unallocatedMinor,
  })

  return {
    ok: true,
    replay: false,
    matched: result.matched,
    outcome: "SUCCESS",
    paymentId,
    receiptNo: result.receiptNo,
    resultCode: 0,
    resultDesc,
    message: result.matched
      ? `Payment credited — receipt ${result.receiptNo}`
      : "Payment recorded but UNMATCHED — added to the review queue",
  }
}

// ---------------------------------------------------------------------------
// Cash collection (caretaker/landlord) — idempotent on clientRef
// ---------------------------------------------------------------------------

export interface RecordCashInput {
  tenancyId: string
  amountMinor: number
  recordedById: string
  note?: string
  /** Client-generated idempotency key (offline sync replays). */
  clientRef?: string
}

export interface CashCollectionResult {
  payment: Payment
  receiptNo: string | null
  /** true when an existing clientRef payment was returned unchanged (replay). */
  replay: boolean
  matched: boolean
}

/**
 * Record a cash collection against a KNOWN tenancy (the route has already
 * enforced the role-scope matrix on that tenancy).
 *
 * Idempotency: when `clientRef` is provided and a Payment with that clientRef
 * exists, the existing row is returned as-is (offline queue sync replays are
 * safe — checked before AND inside the transaction).
 * Creates Payment (CASH, COMPLETED, receiptNo, recordedBy) → allocation
 * waterfall → receipt notification to the tenant → PAYMENT_CASH_RECORDED audit.
 */
export async function recordCashCollection(input: RecordCashInput): Promise<CashCollectionResult> {
  if (input.clientRef) {
    const existing = await db.payment.findUnique({ where: { clientRef: input.clientRef } })
    if (existing) {
      return { payment: existing, receiptNo: existing.receiptNo, replay: true, matched: existing.status === "COMPLETED" }
    }
  }

  const core = await withTransaction(async (tx) => {
    // Race-safe idempotency re-check.
    if (input.clientRef) {
      const existing = await tx.payment.findUnique({ where: { clientRef: input.clientRef } })
      if (existing) return { replay: true as const, payment: existing, result: null }
    }

    const tenancy = await tx.tenancy.findFirst({
      where: { id: input.tenancyId, status: "ACTIVE" },
      include: { tenant: { select: { id: true, phone: true } } },
    })
    if (!tenancy) {
      throw new ApiHttpError(404, "Tenancy not found or not active", "NOT_FOUND")
    }

    const payment = await tx.payment.create({
      data: {
        amountMinor: input.amountMinor,
        source: "CASH",
        status: "COMPLETED",
        receivedAt: new Date(),
        tenancyId: tenancy.id,
        phone: tenancy.tenant.phone,
        accountReference: null, // cash has no M-Pesa account reference
        recordedById: input.recordedById,
        note: input.note ?? null,
        clientRef: input.clientRef ?? null,
      },
    })

    const result = await allocatePaymentCore(tx, payment.id, tenancy.id)
    return { replay: false as const, payment: await tx.payment.findUniqueOrThrow({ where: { id: payment.id } }), result }
  })

  if (core.replay) {
    return { payment: core.payment, receiptNo: core.payment.receiptNo, replay: true, matched: core.payment.status === "COMPLETED" }
  }

  const result = core.result!
  const tenancy = await db.tenancy.findUnique({
    where: { id: input.tenancyId },
    include: { tenant: { select: { id: true } } },
  })

  // Post-commit: receipt notification + audit (never break the money flow).
  if (tenancy && result.receiptNo) {
    const body = `NEST: Receipt ${result.receiptNo} — ${formatKes(input.amountMinor)} received for ${tenancy.accountRef} (cash)`
    await queueNotification(tenancy.tenant.id, "SMS", "RECEIPT_ISSUED", body)
    await queueNotification(tenancy.tenant.id, "IN_APP", "RECEIPT_ISSUED", body)
  }
  await audit(input.recordedById, "PAYMENT_CASH_RECORDED", "Payment", String(core.payment.id), {
    tenancyId: input.tenancyId,
    amountMinor: input.amountMinor,
    receiptNo: result.receiptNo,
    clientRef: input.clientRef ?? null,
    note: input.note ?? null,
    unallocatedMinor: result.unallocatedMinor,
  })

  return { payment: core.payment, receiptNo: result.receiptNo, replay: false, matched: result.matched }
}

// ---------------------------------------------------------------------------
// Manual matching of UNMATCHED payments
// ---------------------------------------------------------------------------

/**
 * Match an UNMATCHED payment to a tenancy (landlord/caretaker money write —
 * the route enforces scope on BOTH the payment and the target tenancy).
 * Only UNMATCHED payments can be re-matched; anything else is a 409 CONFLICT.
 */
export async function matchUnmatchedPayment(paymentId: number, tenancyId: string, actorId: string): Promise<Payment> {
  const core = await withTransaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } })
    if (!payment) {
      throw new ApiHttpError(404, "Payment not found", "NOT_FOUND")
    }
    if (payment.status !== "UNMATCHED") {
      throw new ApiHttpError(409, `Only UNMATCHED payments can be matched (this one is ${payment.status})`, "CONFLICT")
    }
    const tenancy = await tx.tenancy.findFirst({ where: { id: tenancyId, status: "ACTIVE" } })
    if (!tenancy) {
      throw new ApiHttpError(404, "Target tenancy not found or not active", "NOT_FOUND")
    }

    const result = await allocatePaymentCore(tx, paymentId, tenancyId)
    return { payment: await tx.payment.findUniqueOrThrow({ where: { id: paymentId } }), result }
  })

  await audit(actorId, "UNMATCHED_MATCHED", "Payment", String(paymentId), {
    tenancyId,
    amountMinor: core.payment.amountMinor,
    receiptNo: core.result.receiptNo,
  })

  return core.payment
}

// ---------------------------------------------------------------------------
// STK status polling (UI "confirm payment" loop)
// ---------------------------------------------------------------------------

export interface StkStatus {
  status: string
  resultCode: string | null
  resultDesc: string | null
  paymentId: string | null
  receiptNo: string | null
}

/** Current state of an STK push for the polling UI. */
export async function getStkStatus(checkoutRequestId: string): Promise<StkStatus | null> {
  const tx = await db.mpesaTransaction.findUnique({
    where: { checkoutRequestId },
    include: { payment: { select: { id: true, receiptNo: true } } },
  })
  if (!tx) return null
  return {
    status: tx.status,
    resultCode: tx.resultCode,
    resultDesc: tx.resultDesc,
    paymentId: tx.payment ? String(tx.payment.id) : null,
    receiptNo: tx.payment?.receiptNo ?? null,
  }
}
