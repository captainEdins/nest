/**
 * NEST — database seed (Task 1-a, GitHub issue captainEdins/nest#5).
 *
 * Run: `bun run db:seed` (=> `bun prisma/seed.ts`).
 *
 * Seeds one demo plot — "Baraka Court", Kahawa Wendani, Nairobi — with the
 * full Phase 1 money graph: 7 profiles, 1 property, 5 units, 3 ACTIVE
 * tenancies, charges for the previous + current month per tenancy
 * (RENT / WATER / GARBAGE, due on the 5th), 2 completed M-Pesa payments with
 * append-only PaymentAllocation rows, 1 unmatched payment, a deposit ledger
 * per tenancy, notifications, and audit entries for the completed payments.
 *
 * Invariants honoured (mirrors src/lib/reconciliation.ts semantics):
 * - Money is ALWAYS integer KES minor units (cents) — no floats anywhere.
 * - Payment + PaymentAllocation rows are append-only; charge.paidMinor is
 *   recomputed as the SUM of its allocations (never hand-set).
 * - Charge status derives from paidMinor vs amountMinor (UNPAID/PART/PAID).
 *
 * Idempotent: wipes every table first (FK-safe child-first order), then
 * inserts. Period keys ("YYYY-MM") are computed from the run date so the
 * demo data is always "live".
 */

import { db } from "@/lib/db"
import { formatKes } from "@/lib/money"
import type { RentCharge, Tenancy, Unit } from "@prisma/client"

// ---------------------------------------------------------------------------
// Period math — computed from the run date.
// ---------------------------------------------------------------------------

const now = new Date()
const MONTHS_TENANCY_AGE = 4 // tenancies started ~4 months ago

/** {y, m} (m 0-based) shifted k months from the run date, year-safe. */
function shift(k: number): { y: number; m: number } {
  const d = new Date(now.getFullYear(), now.getMonth() + k, 1)
  return { y: d.getFullYear(), m: d.getMonth() }
}

/** "YYYY-MM" period key. */
function monthKey({ y, m }: { y: number; m: number }): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`
}

/** Charges fall due on the 5th of their month. */
function dueDate({ y, m }: { y: number; m: number }): Date {
  return new Date(y, m, 5, 9, 0, 0)
}

const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)

const PREV = shift(-1)
const CUR = shift(0)
const prevMonthKey = monthKey(PREV)
const curMonthKey = monthKey(CUR)
const tenancyStart = new Date(now.getFullYear(), now.getMonth() - MONTHS_TENANCY_AGE, 1)

// Fixed service-charge amounts (KES minor units).
const WATER_MINOR = 30_000 // KSh 300 / month
const GARBAGE_MINOR = 20_000 // KSh 200 / month

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // --- 1) Wipe (FK-safe: children before parents) -------------------------
  await db.auditLog.deleteMany()
  await db.notification.deleteMany()
  await db.ticketUpdate.deleteMany()
  await db.maintenanceTicket.deleteMany()
  await db.conditionReport.deleteMany()
  await db.visitorLog.deleteMany()
  await db.incidentReport.deleteMany()
  await db.guardShift.deleteMany()
  await db.listing.deleteMany()
  await db.depositMovement.deleteMany()
  await db.deposit.deleteMany()
  await db.paymentAllocation.deleteMany()
  await db.mpesaTransaction.deleteMany()
  await db.payment.deleteMany()
  await db.rentCharge.deleteMany()
  await db.tenancy.deleteMany()
  await db.unit.deleteMany()
  await db.property.deleteMany()
  await db.profile.deleteMany()
  // Restart Payment autoincrement so receiptNo NEST-R-000001 == payment.id 1
  // (demo determinism; harmless on a fresh DB).
  try {
    await db.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name = 'Payment'`)
  } catch {
    // sqlite_sequence does not exist yet on a brand-new database — fine.
  }

  // --- 2) People -----------------------------------------------------------
  const amina = await db.profile.create({
    data: { phone: "+254711000001", fullName: "Amina Barasa", role: "LANDLORD" },
  })
  const mwangi = await db.profile.create({
    data: { phone: "+254711000002", fullName: "John Mwangi", role: "CARETAKER" },
  })
  const grace = await db.profile.create({
    data: { phone: "+254711000003", fullName: "Grace Wanjiku", role: "TENANT" },
  })
  const david = await db.profile.create({
    data: { phone: "+254711000004", fullName: "David Otieno", role: "TENANT" },
  })
  const sarah = await db.profile.create({
    data: { phone: "+254711000005", fullName: "Sarah Achieng", role: "TENANT" },
  })
  const peter = await db.profile.create({
    data: { phone: "+254711000006", fullName: "Peter Njoroge", role: "GUARD" },
  })
  const wanjiku = await db.profile.create({
    data: { phone: "+254711000007", fullName: "Wanjiku Kamau", role: "AGENT" },
  })
  void peter // Peter (GUARD) has no Phase 1 data — guard module starts in Phase 3.

  // --- 3) Property + units -------------------------------------------------
  const property = await db.property.create({
    data: {
      name: "Baraka Court",
      location: "Kahawa Wendani, Nairobi",
      landlordId: amina.id,
      caretakerId: mwangi.id,
      agentId: wanjiku.id,
    },
  })

  const unitSeeds = [
    { label: "A1", type: "ONE_BR", rentAmountMinor: 1_500_000, depositAmountMinor: 1_500_000, status: "OCCUPIED" },
    { label: "A2", type: "SHOP", rentAmountMinor: 1_200_000, depositAmountMinor: 1_200_000, status: "OCCUPIED" },
    { label: "B1", type: "BEDSITTER", rentAmountMinor: 850_000, depositAmountMinor: 850_000, status: "VACANT" },
    { label: "B2", type: "BEDSITTER", rentAmountMinor: 850_000, depositAmountMinor: 850_000, status: "OCCUPIED" },
    { label: "B3", type: "TWO_BR", rentAmountMinor: 2_500_000, depositAmountMinor: 2_500_000, status: "VACANT" },
  ]
  const units: Record<string, Unit> = {}
  for (const u of unitSeeds) {
    units[u.label] = await db.unit.create({ data: { ...u, propertyId: property.id } })
  }

  // --- 4) Tenancies (ACTIVE, started ~4 months ago) ------------------------
  const tenancySeeds = [
    { unit: "A1", tenant: david, accountRef: "NEST-A1-1001", monthlyRentMinor: 1_500_000, depositHeldMinor: 1_500_000 },
    { unit: "A2", tenant: sarah, accountRef: "NEST-A2-1002", monthlyRentMinor: 1_200_000, depositHeldMinor: 1_200_000 },
    { unit: "B2", tenant: grace, accountRef: "NEST-B2-1003", monthlyRentMinor: 850_000, depositHeldMinor: 850_000 },
  ]
  const tenancies: Record<string, Tenancy> = {}
  for (const t of tenancySeeds) {
    tenancies[t.accountRef] = await db.tenancy.create({
      data: {
        unitId: units[t.unit].id,
        tenantId: t.tenant.id,
        startDate: tenancyStart,
        monthlyRentMinor: t.monthlyRentMinor,
        depositHeldMinor: t.depositHeldMinor,
        status: "ACTIVE",
        accountRef: t.accountRef,
      },
    })
  }

  // --- 5) Charges: previous + current month, per tenancy -------------------
  // key: `${accountRef}:${kind}:${periodMonth}` -> row
  const charges: Record<string, RentCharge> = {}
  for (const t of tenancySeeds) {
    for (const p of [PREV, CUR]) {
      const period = monthKey(p)
      const rows: { kind: "RENT" | "WATER" | "GARBAGE"; amountMinor: number }[] = [
        { kind: "RENT", amountMinor: t.monthlyRentMinor },
        { kind: "WATER", amountMinor: WATER_MINOR },
        { kind: "GARBAGE", amountMinor: GARBAGE_MINOR },
      ]
      for (const c of rows) {
        charges[`${t.accountRef}:${c.kind}:${period}`] = await db.rentCharge.create({
          data: {
            tenancyId: tenancies[t.accountRef].id,
            kind: c.kind,
            periodMonth: period,
            dueDate: dueDate(p),
            amountMinor: c.amountMinor,
            paidMinor: 0,
            status: "UNPAID",
          },
        })
      }
    }
  }

  // --- 6) Payments + append-only allocations -------------------------------
  // Grace — current month paid IN FULL: 900000 = 850000 rent + 30000 water
  // + 20000 garbage (allocation across all 3 current charges).
  const gracePaidAt = daysAgo(2)
  const gracePayment = await db.payment.create({
    data: {
      receiptNo: "NEST-R-000001",
      amountMinor: 900_000,
      source: "MPESA",
      status: "COMPLETED",
      receivedAt: gracePaidAt,
      tenancyId: tenancies["NEST-B2-1003"].id,
      accountReference: "NEST-B2-1003",
      phone: grace.phone,
      allocations: {
        create: [
          { chargeId: charges[`NEST-B2-1003:RENT:${curMonthKey}`].id, amountMinor: 850_000 },
          { chargeId: charges[`NEST-B2-1003:WATER:${curMonthKey}`].id, amountMinor: WATER_MINOR },
          { chargeId: charges[`NEST-B2-1003:GARBAGE:${curMonthKey}`].id, amountMinor: GARBAGE_MINOR },
        ],
      },
    },
  })

  // Sarah — partial: 600000 against current-month RENT only (600000/1200000 => PART).
  const sarahPaidAt = daysAgo(6)
  const sarahPayment = await db.payment.create({
    data: {
      receiptNo: "NEST-R-000002",
      amountMinor: 600_000,
      source: "MPESA",
      status: "COMPLETED",
      receivedAt: sarahPaidAt,
      tenancyId: tenancies["NEST-A2-1002"].id,
      accountReference: "NEST-A2-1002",
      phone: sarah.phone,
      allocations: {
        create: [{ chargeId: charges[`NEST-A2-1002:RENT:${curMonthKey}`].id, amountMinor: 600_000 }],
      },
    },
  })

  // David — NO payments: the arrears case (2 months × KSh 15,500 = 3100000 minor).

  // One UNMATCHED payment: money arrived but the reference resolves to no tenancy.
  await db.payment.create({
    data: {
      amountMinor: 500_000,
      source: "MPESA",
      status: "UNMATCHED",
      receivedAt: daysAgo(1),
      tenancyId: null,
      accountReference: "NEST-ZZ-9999",
      phone: "+254722000999",
      receiptNo: null,
    },
  })

  // --- 7) Recompute charge paidMinor/status from allocations ----------------
  // (paidMinor is ALWAYS the sum of PaymentAllocation rows — the ledger rule.)
  const grouped = await db.paymentAllocation.groupBy({ by: ["chargeId"], _sum: { amountMinor: true } })
  for (const g of grouped) {
    const charge = await db.rentCharge.findUniqueOrThrow({ where: { id: g.chargeId } })
    const paidMinor = g._sum.amountMinor ?? 0
    await db.rentCharge.update({
      where: { id: g.chargeId },
      data: {
        paidMinor,
        status: paidMinor >= charge.amountMinor ? "PAID" : "PART",
      },
    })
  }

  // --- 8) Deposit ledger: one Deposit (HELD) + HOLD movement per tenancy ----
  for (const t of tenancySeeds) {
    const deposit = await db.deposit.create({
      data: {
        tenancyId: tenancies[t.accountRef].id,
        heldMinor: t.depositHeldMinor,
        status: "HELD",
        createdAt: tenancyStart,
      },
    })
    await db.depositMovement.create({
      data: {
        depositId: deposit.id,
        kind: "HOLD",
        amountMinor: t.depositHeldMinor,
        reason: "Security deposit collected at tenancy start",
        actorId: amina.id,
        createdAt: tenancyStart,
      },
    })
  }

  // --- 9) Notifications ----------------------------------------------------
  // Grace's outstanding after her payment (previous month still owed).
  const graceCharges = await db.rentCharge.findMany({ where: { tenancyId: tenancies["NEST-B2-1003"].id } })
  const graceOutstandingMinor = graceCharges.reduce((s, c) => s + (c.amountMinor - c.paidMinor), 0)

  // David's arrears total (no payments at all).
  const davidCharges = await db.rentCharge.findMany({ where: { tenancyId: tenancies["NEST-A1-1001"].id } })
  const davidArrearsMinor = davidCharges.reduce((s, c) => s + (c.amountMinor - c.paidMinor), 0)

  await db.notification.create({
    data: {
      profileId: grace.id,
      channel: "IN_APP",
      templateKey: "RECEIPT_ISSUED",
      body:
        `NEST Receipt NEST-R-000001 — ${formatKes(900_000)} received from Grace Wanjiku ` +
        `for unit B2, Baraka Court (${curMonthKey}). Rent ${formatKes(850_000)}, ` +
        `Water ${formatKes(WATER_MINOR)}, Garbage ${formatKes(GARBAGE_MINOR)}. ` +
        `Outstanding balance: ${formatKes(graceOutstandingMinor)}.`,
      status: "SENT",
      createdAt: gracePaidAt,
      sentAt: gracePaidAt,
    },
  })

  await db.notification.create({
    data: {
      profileId: david.id,
      channel: "SMS",
      templateKey: "ARREARS_REMINDER",
      body:
        `NEST: Hi David, rent for unit A1 (Baraka Court) is past due. ` +
        `Balance ${formatKes(davidArrearsMinor)} (${prevMonthKey} + ${curMonthKey}). ` +
        `Pay via M-Pesa using account ref NEST-A1-1001.`,
      status: "QUEUED",
      createdAt: daysAgo(1),
    },
  })

  await db.notification.create({
    data: {
      profileId: amina.id,
      channel: "IN_APP",
      templateKey: "UNMATCHED_PAYMENT",
      body:
        `NEST: Unmatched M-Pesa payment of ${formatKes(500_000)} from ` +
        `+254722000999 (ref NEST-ZZ-9999) needs to be matched to a tenancy.`,
      status: "QUEUED",
      createdAt: daysAgo(1),
    },
  })

  // --- 10) Audit log: one MPESA_CALLBACK entry per completed payment -------
  const auditSeeds = [
    { payment: gracePayment, checkoutRequestId: "ws_CO_SEED_0001" },
    { payment: sarahPayment, checkoutRequestId: "ws_CO_SEED_0002" },
  ]
  for (const a of auditSeeds) {
    await db.auditLog.create({
      data: {
        actorId: null, // system: M-Pesa callback, no human actor
        action: "MPESA_CALLBACK",
        entity: "Payment",
        entityId: String(a.payment.id),
        detailJson: JSON.stringify({
          receiptNo: a.payment.receiptNo,
          amountMinor: a.payment.amountMinor,
          accountReference: a.payment.accountReference,
          tenancyId: a.payment.tenancyId,
          checkoutRequestId: a.checkoutRequestId,
          resultDesc: "The service request is processed successfully.",
        }),
        createdAt: a.payment.receivedAt,
      },
    })
  }

  // --- 11) Summary (evidence) ----------------------------------------------
  const counts = {
    profiles: await db.profile.count(),
    properties: await db.property.count(),
    units: await db.unit.count(),
    tenancies: await db.tenancy.count(),
    charges: await db.rentCharge.count(),
    payments: await db.payment.count(),
    allocations: await db.paymentAllocation.count(),
    deposits: await db.deposit.count(),
    depositMovements: await db.depositMovement.count(),
    notifications: await db.notification.count(),
    auditLogs: await db.auditLog.count(),
  }
  console.log("[seed] periods:", { previousMonth: prevMonthKey, currentMonth: curMonthKey })
  console.log("[seed] counts:", counts)
  console.log("[seed] grace outstandingMinor:", graceOutstandingMinor)
  console.log("[seed] david arrearsMinor:", davidArrearsMinor)
  console.log("[seed] done ✔")
}

main()
  .catch((err) => {
    console.error("[seed] FAILED:", err)
    process.exitCode = 1
  })
  .finally(() => {
    void db.$disconnect()
  })
