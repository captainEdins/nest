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
 * Phase 2 adds the repairs story (tickets + condition reports) and the
 * move-out deposit settlement; Phase 3 adds the guard story: Peter's shift
 * history + ACTIVE shift, a 2-day gate register (10 visitor entries), and
 * 3 incident reports (1 HIGH unacknowledged — the demo hook).
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
  // Kevin — the Phase 2 move-out story: NOTICE tenancy, deposit settlement demo.
  const kevin = await db.profile.create({
    data: { phone: "+254711000008", fullName: "Kevin Mutua", role: "TENANT" },
  })
  void peter // Peter (GUARD) carries the Phase 3 story: shifts, gate register, incidents (section 8c).

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
    { label: "B1", type: "BEDSITTER", rentAmountMinor: 850_000, depositAmountMinor: 850_000, status: "NOTICE" },
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

  // Kevin's NOTICE tenancy (Phase 2 move-out story): all settled, ending —
  // no open charges, deposit still held pending settlement at move-out.
  const kevinTenancy = await db.tenancy.create({
    data: {
      unitId: units["B1"].id,
      tenantId: kevin.id,
      startDate: tenancyStart,
      monthlyRentMinor: 850_000,
      depositHeldMinor: 850_000,
      status: "NOTICE",
      accountRef: "NEST-B1-1004",
    },
  })

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

  // Kevin's deposit (HELD — settlement flow demo, Phase 2).
  const kevinDeposit = await db.deposit.create({
    data: { tenancyId: kevinTenancy.id, heldMinor: 850_000, status: "HELD", createdAt: tenancyStart },
  })
  await db.depositMovement.create({
    data: {
      depositId: kevinDeposit.id,
      kind: "HOLD",
      amountMinor: 850_000,
      reason: "Security deposit collected at tenancy start",
      actorId: amina.id,
      createdAt: tenancyStart,
    },
  })

  // --- 8b) Condition reports (Phase 2) --------------------------------------
  const conditionReportSeeds = [
    {
      tenancyId: tenancies["NEST-A1-1001"].id,
      kind: "MOVE_IN" as const,
      notes:
        "Unit inspected with tenant present. Walls clean, windows intact, plumbing working, meter reading 04123.",
      recordedById: amina.id,
      createdAt: tenancyStart,
    },
    {
      tenancyId: tenancies["NEST-A2-1002"].id,
      kind: "MOVE_IN" as const,
      notes: "Shop inspected with tenant. Floor tiled, door lock new, water connection verified.",
      recordedById: amina.id,
      createdAt: tenancyStart,
    },
    {
      tenancyId: tenancies["NEST-B2-1003"].id,
      kind: "MOVE_IN" as const,
      notes: "Bedsitter inspected. Paint fresh, shower drains well, sink sealed.",
      recordedById: mwangi.id,
      createdAt: tenancyStart,
    },
    {
      tenancyId: kevinTenancy.id,
      kind: "MOVE_IN" as const,
      notes: "Bedsitter inspected with tenant. All fixtures working, walls newly painted, no damage noted.",
      recordedById: amina.id,
      createdAt: tenancyStart,
    },
    {
      tenancyId: kevinTenancy.id,
      kind: "MOVE_OUT" as const,
      notes:
        "Move-out inspection with tenant present. One wall panel damaged (burn mark), window latch loose. Rest of unit in good condition.",
      recordedById: mwangi.id,
      createdAt: daysAgo(3),
    },
  ]
  for (const report of conditionReportSeeds) {
    await db.conditionReport.create({ data: { ...report, photoUrlsJson: "[]" } })
  }

  // --- 8c) Maintenance tickets (Phase 2) -------------------------------------
  // Grace — OPEN (reported yesterday).
  const graceTicket = await db.maintenanceTicket.create({
    data: {
      propertyId: property.id,
      unitId: units["B2"].id,
      tenancyId: tenancies["NEST-B2-1003"].id,
      title: "Leaking kitchen sink",
      description:
        "The sink drain leaks onto the floor whenever I wash dishes. Started three days ago and is getting worse.",
      priority: "NORMAL",
      status: "OPEN",
      reportedById: grace.id,
      createdAt: daysAgo(1),
    },
  })

  // David — IN_PROGRESS (started 2 days ago).
  const davidTicket = await db.maintenanceTicket.create({
    data: {
      propertyId: property.id,
      unitId: units["A1"].id,
      tenancyId: tenancies["NEST-A1-1001"].id,
      title: "Broken window latch",
      description: "The bedroom window latch is broken so the window won't lock at night.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      reportedById: david.id,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(2),
    },
  })
  await db.ticketUpdate.create({
    data: {
      ticketId: davidTicket.id,
      authorId: mwangi.id,
      note: "Carpenter scheduled for tomorrow morning.",
      statusFrom: "OPEN",
      statusTo: "IN_PROGRESS",
      createdAt: daysAgo(2),
    },
  })

  // Sarah — RESOLVED (awaiting landlord review).
  const sarahTicket = await db.maintenanceTicket.create({
    data: {
      propertyId: property.id,
      unitId: units["A2"].id,
      tenancyId: tenancies["NEST-A2-1002"].id,
      title: "Shop door lock sticking",
      description: "The main shop door lock sticks — needs two hands to turn the key every morning.",
      priority: "NORMAL",
      status: "RESOLVED",
      reportedById: sarah.id,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(8),
      resolvedAt: daysAgo(8),
    },
  })
  await db.ticketUpdate.create({
    data: {
      ticketId: sarahTicket.id,
      authorId: mwangi.id,
      note: "Looking at it today.",
      statusFrom: "OPEN",
      statusTo: "IN_PROGRESS",
      createdAt: daysAgo(9),
    },
  })
  await db.ticketUpdate.create({
    data: {
      ticketId: sarahTicket.id,
      authorId: mwangi.id,
      note: "Lock oiled and realigned — turning smoothly now.",
      statusFrom: "IN_PROGRESS",
      statusTo: "RESOLVED",
      createdAt: daysAgo(8),
    },
  })

  // Kevin — CLOSED (the full lifecycle, matched to the move-out story).
  const kevinTicket = await db.maintenanceTicket.create({
    data: {
      propertyId: property.id,
      unitId: units["B1"].id,
      tenancyId: kevinTenancy.id,
      title: "Wall repaint before move-out",
      description: "Repaint needed on the wall I damaged — agreed to deduct the cost from my deposit.",
      priority: "NORMAL",
      status: "CLOSED",
      reportedById: kevin.id,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(5),
      resolvedAt: daysAgo(6),
    },
  })
  await db.ticketUpdate.create({
    data: {
      ticketId: kevinTicket.id,
      authorId: mwangi.id,
      note: "Painter quoted the job.",
      statusFrom: "OPEN",
      statusTo: "IN_PROGRESS",
      createdAt: daysAgo(11),
    },
  })
  await db.ticketUpdate.create({
    data: {
      ticketId: kevinTicket.id,
      authorId: mwangi.id,
      note: "Repaint done — wall restored.",
      statusFrom: "IN_PROGRESS",
      statusTo: "RESOLVED",
      createdAt: daysAgo(6),
    },
  })
  await db.ticketUpdate.create({
    data: {
      ticketId: kevinTicket.id,
      authorId: amina.id,
      note: "Reviewed and closed — deduction will be recorded against the deposit at move-out.",
      statusFrom: "RESOLVED",
      statusTo: "CLOSED",
      createdAt: daysAgo(5),
    },
  })

  void graceTicket // referenced by the notification + audit seeds below

  // --- 8c) Guard module (Phase 3): shifts, visitors, incidents --------------
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000)

  // Peter's shift history: two completed day shifts + the ACTIVE one.
  const activeShift = await db.guardShift.create({
    data: { propertyId: property.id, guardId: peter.id, startedAt: hoursAgo(6) },
  })
  const prevShift = await db.guardShift.create({
    data: {
      propertyId: property.id,
      guardId: peter.id,
      startedAt: hoursAgo(28),
      endedAt: hoursAgo(18),
      notes: "Gate keys handed over. Water point dispute between A2 and B1 settled by caretaker.",
    },
  })
  const oldShift = await db.guardShift.create({
    data: {
      propertyId: property.id,
      guardId: peter.id,
      startedAt: hoursAgo(52),
      endedAt: hoursAgo(42),
      notes: "Quiet night. B3 viewing scheduled for the morning team.",
    },
  })

  // Today's gate register (enteredAt relative to now — never future-dated).
  const visitorSeeds = [
    // today
    { name: "Mary Wanjala", phone: "+254722111222", purpose: "VISITOR", unit: "B2", entered: 5.5, exited: null as number | null },
    { name: "Daniel Kimani", phone: null, purpose: "DELIVERY", unit: "A1", entered: 4.8, exited: 4.5 },
    { name: "Erick Otieno", phone: "+254733444555", purpose: "CONTRACTOR", unit: null, entered: 4, exited: null },
    { name: "Joyce Muthoni", phone: "+254701555666", purpose: "VIEWING", unit: "B3", entered: 3.2, exited: 2.6 },
    { name: "Brian Kariuki", phone: null, purpose: "VISITOR", unit: "A2", entered: 2.2, exited: null },
    { name: "Naivas Delivery", phone: null, purpose: "DELIVERY", unit: "B2", entered: 1.8, exited: 1.5 },
    { name: "Samwel Ochieng", phone: "+254712999888", purpose: "VISITOR", unit: "B2", entered: 1.2, exited: 0.7 },
    // yesterday
    { name: "Alice Wanja", phone: null, purpose: "VISITOR", unit: "A1", entered: 25, exited: 23.5 },
    { name: "Kelvin Mutiso", phone: "+254745123456", purpose: "VISITOR", unit: "B1", entered: 26, exited: 24 },
    { name: "Cynthia Auma", phone: "+254759777888", purpose: "VIEWING", unit: "B3", entered: 27, exited: 26.2 },
  ]
  for (const v of visitorSeeds) {
    await db.visitorLog.create({
      data: {
        propertyId: property.id,
        unitId: v.unit ? units[v.unit].id : null,
        visitorName: v.name,
        visitorPhone: v.phone,
        purpose: v.purpose,
        guardId: peter.id,
        enteredAt: hoursAgo(v.entered),
        exitedAt: v.exited === null ? null : hoursAgo(v.exited),
      },
    })
  }

  // Incident reports: 1 HIGH unseen (the demo hook), 2 acknowledged.
  const gateIncident = await db.incidentReport.create({
    data: {
      propertyId: property.id,
      guardId: peter.id,
      category: "SECURITY",
      severity: "HIGH",
      description:
        "Two men tried to force the gate lock at the parking area early this morning. They fled on a black motorcycle.",
      actionTaken:
        "Confronted them from the gatehouse; they left. Motorcycle plate KDA 123X recorded and shared with the caretaker.",
      createdAt: hoursAgo(6.1),
    },
  })
  const disputeIncident = await db.incidentReport.create({
    data: {
      propertyId: property.id,
      guardId: peter.id,
      category: "DISPUTE",
      severity: "MEDIUM",
      description: "Water point dispute between unit A2 and B1 tenants — buckets and raised voices.",
      actionTaken: "Separated both parties and called the caretaker, who resolved it.",
      acknowledgedById: amina.id,
      acknowledgedAt: hoursAgo(24.5),
      createdAt: hoursAgo(26),
    },
  })
  const hingeIncident = await db.incidentReport.create({
    data: {
      propertyId: property.id,
      guardId: peter.id,
      category: "DAMAGE",
      severity: "LOW",
      description: "Gate hinge came loose after the garbage truck reversed into it.",
      actionTaken: "Tied the gate shut; caretaker scheduled welding for the morning.",
      acknowledgedById: amina.id,
      acknowledgedAt: hoursAgo(41),
      createdAt: hoursAgo(50),
    },
  })

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

  // Phase 2 ticket notifications: caretaker + landlord hear about a new tenant
  // report; the reporter hears about progress on theirs.
  await db.notification.create({
    data: {
      profileId: mwangi.id,
      channel: "IN_APP",
      templateKey: "TICKET_CREATED",
      body:
        `NEST: Grace Wanjiku reported a repair in unit B2 (Baraka Court): "Leaking kitchen sink" (Normal priority).`,
      status: "QUEUED",
      createdAt: daysAgo(1),
    },
  })
  await db.notification.create({
    data: {
      profileId: amina.id,
      channel: "IN_APP",
      templateKey: "TICKET_CREATED",
      body:
        `NEST: Grace Wanjiku reported a repair in unit B2 (Baraka Court): "Leaking kitchen sink" (Normal priority).`,
      status: "QUEUED",
      createdAt: daysAgo(1),
    },
  })
  await db.notification.create({
    data: {
      profileId: david.id,
      channel: "IN_APP",
      templateKey: "TICKET_UPDATED",
      body:
        `NEST: Your repair "Broken window latch" (unit A1) is now In progress. John Mwangi: "Carpenter scheduled for tomorrow morning."`,
      status: "SENT",
      createdAt: daysAgo(2),
      sentAt: daysAgo(2),
    },
  })

  // Phase 3 incident notifications: HIGH severity → landlord + caretaker hear
  // immediately; the guard hears when a report is acknowledged (the loop closes).
  for (const recipient of [amina, mwangi]) {
    await db.notification.create({
      data: {
        profileId: recipient.id,
        channel: "IN_APP",
        templateKey: "INCIDENT_FILED",
        body:
          `NEST: High-severity incident at Baraka Court filed by Peter Njoroge (Security): ` +
          `"Two men tried to force the gate lock at the parking area early this morning."`,
        status: "QUEUED",
        createdAt: hoursAgo(6.1),
      },
    })
  }
  await db.notification.create({
    data: {
      profileId: peter.id,
      channel: "IN_APP",
      templateKey: "INCIDENT_ACKED",
      body:
        `NEST: Amina Barasa acknowledged your incident report (Dispute): ` +
        `"Water point dispute between unit A2 and B1 tenants."`,
      status: "SENT",
      createdAt: hoursAgo(24.5),
      sentAt: hoursAgo(24.5),
    },
  })
  await db.notification.create({
    data: {
      profileId: peter.id,
      channel: "IN_APP",
      templateKey: "INCIDENT_ACKED",
      body:
        `NEST: Amina Barasa acknowledged your incident report (Damage): ` +
        `"Gate hinge came loose after the garbage truck reversed into it."`,
      status: "SENT",
      createdAt: hoursAgo(41),
      sentAt: hoursAgo(41),
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

  // --- 10b) Audit log: Phase 2 ticket lifecycle evidence --------------------
  const ticketAuditSeeds = [
    { ticket: graceTicket, actorId: grace.id, action: "TICKET_CREATED", at: daysAgo(1) },
    { ticket: davidTicket, actorId: david.id, action: "TICKET_CREATED", at: daysAgo(4) },
    { ticket: davidTicket, actorId: mwangi.id, action: "TICKET_UPDATED", at: daysAgo(2) },
    { ticket: sarahTicket, actorId: sarah.id, action: "TICKET_CREATED", at: daysAgo(10) },
    { ticket: sarahTicket, actorId: mwangi.id, action: "TICKET_UPDATED", at: daysAgo(8) },
    { ticket: kevinTicket, actorId: kevin.id, action: "TICKET_CREATED", at: daysAgo(12) },
    { ticket: kevinTicket, actorId: amina.id, action: "TICKET_UPDATED", at: daysAgo(5) },
  ]
  for (const a of ticketAuditSeeds) {
    await db.auditLog.create({
      data: {
        actorId: a.actorId,
        action: a.action,
        entity: "MaintenanceTicket",
        entityId: a.ticket.id,
        detailJson: JSON.stringify({
          title: a.ticket.title,
          status: a.ticket.status,
          unitId: a.ticket.unitId,
          priority: a.ticket.priority,
        }),
        createdAt: a.at,
      },
    })
  }

  // --- 10c) Audit log: Phase 3 guard module evidence ------------------------
  const guardAuditSeeds = [
    { action: "SHIFT_START", entity: "GuardShift", id: activeShift.id, at: hoursAgo(6), detail: { property: property.name, guard: "Peter Njoroge" } },
    { action: "SHIFT_END", entity: "GuardShift", id: prevShift.id, at: hoursAgo(18), detail: { property: property.name, guard: "Peter Njoroge", notes: prevShift.notes } },
    { action: "SHIFT_START", entity: "GuardShift", id: prevShift.id, at: hoursAgo(28), detail: { property: property.name, guard: "Peter Njoroge" } },
    { action: "SHIFT_END", entity: "GuardShift", id: oldShift.id, at: hoursAgo(42), detail: { property: property.name, guard: "Peter Njoroge", notes: oldShift.notes } },
    { action: "SHIFT_START", entity: "GuardShift", id: oldShift.id, at: hoursAgo(52), detail: { property: property.name, guard: "Peter Njoroge" } },
    { action: "VISITOR_LOGGED", entity: "VisitorLog", id: "seed:mary", at: hoursAgo(5.5), detail: { visitorName: "Mary Wanjala", purpose: "VISITOR", unit: "B2" } },
    { action: "VISITOR_LOGGED", entity: "VisitorLog", id: "seed:daniel", at: hoursAgo(4.8), detail: { visitorName: "Daniel Kimani", purpose: "DELIVERY", unit: "A1" } },
    { action: "VISITOR_EXIT", entity: "VisitorLog", id: "seed:daniel", at: hoursAgo(4.5), detail: { visitorName: "Daniel Kimani" } },
    { action: "VISITOR_LOGGED", entity: "VisitorLog", id: "seed:erick", at: hoursAgo(4), detail: { visitorName: "Erick Otieno", purpose: "CONTRACTOR" } },
    { action: "VISITOR_LOGGED", entity: "VisitorLog", id: "seed:joyce", at: hoursAgo(3.2), detail: { visitorName: "Joyce Muthoni", purpose: "VIEWING", unit: "B3" } },
    { action: "VISITOR_EXIT", entity: "VisitorLog", id: "seed:joyce", at: hoursAgo(2.6), detail: { visitorName: "Joyce Muthoni" } },
    { action: "VISITOR_LOGGED", entity: "VisitorLog", id: "seed:naivas", at: hoursAgo(1.8), detail: { visitorName: "Naivas Delivery", purpose: "DELIVERY", unit: "B2" } },
    { action: "VISITOR_EXIT", entity: "VisitorLog", id: "seed:naivas", at: hoursAgo(1.5), detail: { visitorName: "Naivas Delivery" } },
    { action: "INCIDENT_FILED", entity: "IncidentReport", id: gateIncident.id, at: hoursAgo(6.1), detail: { category: "SECURITY", severity: "HIGH", property: property.name } },
    { action: "INCIDENT_FILED", entity: "IncidentReport", id: disputeIncident.id, at: hoursAgo(26), detail: { category: "DISPUTE", severity: "MEDIUM", property: property.name } },
    { action: "INCIDENT_ACKED", entity: "IncidentReport", id: disputeIncident.id, at: hoursAgo(24.5), detail: { by: "Amina Barasa" } },
    { action: "INCIDENT_FILED", entity: "IncidentReport", id: hingeIncident.id, at: hoursAgo(50), detail: { category: "DAMAGE", severity: "LOW", property: property.name } },
    { action: "INCIDENT_ACKED", entity: "IncidentReport", id: hingeIncident.id, at: hoursAgo(41), detail: { by: "Amina Barasa" } },
  ]
  for (const a of guardAuditSeeds) {
    await db.auditLog.create({
      data: {
        actorId: a.action === "INCIDENT_ACKED" ? amina.id : peter.id,
        action: a.action,
        entity: a.entity,
        entityId: a.id,
        detailJson: JSON.stringify(a.detail),
        createdAt: a.at,
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
    tickets: await db.maintenanceTicket.count(),
    ticketUpdates: await db.ticketUpdate.count(),
    conditionReports: await db.conditionReport.count(),
    visitorLogs: await db.visitorLog.count(),
    incidentReports: await db.incidentReport.count(),
    guardShifts: await db.guardShift.count(),
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
