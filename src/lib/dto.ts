/**
 * NEST — Prisma row → wire DTO mappers (Task 2-a).
 *
 * Every route returns EXACTLY the shapes in src/lib/types.ts; these mappers
 * are the single conversion point, so a DTO change is a one-file change.
 * The `*Include` constants define the Prisma relations each mapper needs —
 * routes/overview pass them straight into `include`.
 *
 * Conversions worth noting:
 * - Payment.id is an Int autoincrement in the DB but a string on the wire
 *   (PaymentDto.id) — receipt numbers are derived from it (NEST-R-######).
 * - Dates serialize as ISO strings.
 * - Enum-ish strings (SQLite has no enums) are narrowed with `as` after
 *   Zod/seed discipline guarantees the value set.
 * - matchedLabel: the payer's human label — tenant name when matched,
 *   the payer phone while UNMATCHED.
 */

import type { Prisma, Profile, Property } from "@prisma/client"
import type {
  ChargeDto,
  ChargeKind,
  ChargeStatus,
  ConditionReportDto,
  DepositDto,
  DepositMovementKind,
  DepositStatus,
  GuardShiftDto,
  IncidentCategory,
  IncidentReportDto,
  IncidentSeverity,
  NotificationDto,
  PaymentDto,
  PaymentSource,
  PaymentStatus,
  ProfileDto,
  PropertyDto,
  ReceiptDto,
  Role,
  TicketDto,
  TicketPriority,
  TicketStatus,
  UnitDto,
  UnitStatus,
  VisitorLogDto,
  VisitorPurpose,
  UnitType,
} from "@/lib/types"

// ---------------------------------------------------------------------------
// Includes
// ---------------------------------------------------------------------------

/** Everything PaymentDto + ReceiptDto need (tenancy chain, recorder, allocations). */
export const paymentInclude = {
  tenancy: { include: { tenant: true, unit: { include: { property: true } } } },
  recordedBy: { select: { id: true, fullName: true } },
  allocations: { include: { charge: true } },
} satisfies Prisma.PaymentInclude

export type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>

/** Everything ChargeDto needs (unit label + tenant name). */
export const chargeInclude = {
  tenancy: { include: { unit: true, tenant: true } },
} satisfies Prisma.RentChargeInclude

export type ChargeWithRelations = Prisma.RentChargeGetPayload<{ include: typeof chargeInclude }>

/** Everything UnitDto needs, incl. the ACTIVE tenancy for occupied units. */
export const unitInclude = {
  property: { select: { id: true, name: true } },
  tenancies: { where: { status: "ACTIVE" }, include: { tenant: true } },
} satisfies Prisma.UnitInclude

export type UnitWithRelations = Prisma.UnitGetPayload<{ include: typeof unitInclude }>

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function toProfileDto(profile: Profile): ProfileDto {
  return {
    id: profile.id,
    phone: profile.phone,
    fullName: profile.fullName,
    role: profile.role as Role,
    language: profile.language === "sw" ? "sw" : "en",
  }
}

export function toPaymentDto(payment: PaymentWithRelations): PaymentDto {
  return {
    id: String(payment.id),
    receiptNo: payment.receiptNo,
    amountMinor: payment.amountMinor,
    source: payment.source as PaymentSource,
    status: payment.status as PaymentStatus,
    receivedAt: payment.receivedAt.toISOString(),
    tenancyId: payment.tenancyId,
    accountReference: payment.accountReference,
    phone: payment.phone,
    matchedLabel: payment.tenancy?.tenant.fullName ?? payment.phone ?? null,
    recordedByName: payment.recordedBy?.fullName ?? null,
    allocations: payment.allocations.map((allocation) => ({
      chargeId: allocation.chargeId,
      chargeKind: allocation.charge.kind as ChargeKind,
      chargePeriod: allocation.charge.periodMonth,
      amountMinor: allocation.amountMinor,
    })),
  }
}

/** Payment → ReceiptDto. Only call for matched payments (receiptNo + tenancy set). */
export function toReceiptDto(payment: PaymentWithRelations): ReceiptDto {
  if (!payment.receiptNo || !payment.tenancy) {
    throw new Error(`toReceiptDto called on payment ${payment.id} without receiptNo/tenancy`)
  }
  return {
    receiptNo: payment.receiptNo,
    paymentId: String(payment.id),
    amountMinor: payment.amountMinor,
    source: payment.source as PaymentSource,
    receivedAt: payment.receivedAt.toISOString(),
    tenancyId: payment.tenancyId!,
    tenantName: payment.tenancy.tenant.fullName,
    tenantPhone: payment.tenancy.tenant.phone,
    unitLabel: payment.tenancy.unit.label,
    propertyName: payment.tenancy.unit.property.name,
    accountRef: payment.tenancy.accountRef,
    allocations: payment.allocations.map((allocation) => ({
      chargeId: allocation.chargeId,
      chargeKind: allocation.charge.kind as ChargeKind,
      chargePeriod: allocation.charge.periodMonth,
      amountMinor: allocation.amountMinor,
    })),
  }
}

export function toChargeDto(charge: ChargeWithRelations): ChargeDto {
  return {
    id: charge.id,
    tenancyId: charge.tenancyId,
    kind: charge.kind as ChargeKind,
    periodMonth: charge.periodMonth,
    dueDate: charge.dueDate.toISOString(),
    amountMinor: charge.amountMinor,
    paidMinor: charge.paidMinor,
    status: charge.status as ChargeStatus,
    unitLabel: charge.tenancy.unit.label,
    tenantName: charge.tenancy.tenant.fullName,
  }
}

/**
 * Unit → UnitDto. `balances` maps tenancyId → outstanding balance (KES minor)
 * so callers can embed tenancy balances without N+1 charge queries. When the
 * unit is VACANT (no ACTIVE tenancy) `tenancy` is null.
 */
export function toUnitDto(
  unit: UnitWithRelations,
  balances: Map<string, number>
): UnitDto {
  const activeTenancy = unit.tenancies[0] ?? null
  return {
    id: unit.id,
    propertyId: unit.propertyId,
    propertyName: unit.property.name,
    label: unit.label,
    type: unit.type as UnitType,
    status: unit.status as UnitStatus,
    rentAmountMinor: unit.rentAmountMinor,
    depositAmountMinor: unit.depositAmountMinor,
    tenancy: activeTenancy
      ? {
          id: activeTenancy.id,
          tenantId: activeTenancy.tenantId,
          tenantName: activeTenancy.tenant.fullName,
          tenantPhone: activeTenancy.tenant.phone,
          accountRef: activeTenancy.accountRef,
          monthlyRentMinor: activeTenancy.monthlyRentMinor,
          startDate: activeTenancy.startDate.toISOString(),
          // Outstanding balance (negative = tenant credit from over-payment).
          balanceMinor: balances.get(activeTenancy.id) ?? 0,
        }
      : null,
  }
}

export function toPropertyDto(property: Property, unitCount: number, occupiedCount: number): PropertyDto {
  return {
    id: property.id,
    name: property.name,
    location: property.location,
    landlordId: property.landlordId,
    caretakerId: property.caretakerId,
    unitCount,
    occupiedCount,
  }
}

export function toNotificationDtoRow(n: {
  id: string
  channel: string
  templateKey: string
  body: string
  status: string
  createdAt: Date
  sentAt: Date | null
}): NotificationDto {
  return {
    id: n.id,
    channel: n.channel as NotificationDto["channel"],
    templateKey: n.templateKey,
    body: n.body,
    status: n.status as NotificationDto["status"],
    createdAt: n.createdAt.toISOString(),
    sentAt: n.sentAt ? n.sentAt.toISOString() : null,
  }
}

/** Tenancy picker row (route-local DTO for GET /api/tenancies). */
export interface TenancyPickerRow {
  id: string
  tenantName: string
  tenantPhone: string
  unitLabel: string
  propertyName: string
  accountRef: string
  monthlyRentMinor: number
  balanceMinor: number
}

export function toTenancyPickerRow(
  tenancy: Prisma.TenancyGetPayload<{ include: { tenant: true; unit: { include: { property: true } } } }>,
  balanceMinor: number
): TenancyPickerRow {
  return {
    id: tenancy.id,
    tenantName: tenancy.tenant.fullName,
    tenantPhone: tenancy.tenant.phone,
    unitLabel: tenancy.unit.label,
    propertyName: tenancy.unit.property.name,
    accountRef: tenancy.accountRef,
    monthlyRentMinor: tenancy.monthlyRentMinor,
    balanceMinor,
  }
}

// ---------------------------------------------------------------------------
// Maintenance tickets (Phase 2)
// ---------------------------------------------------------------------------

/** Everything TicketDto needs (unit + property chain, reporter, update authors). */
export const ticketInclude = {
  unit: { select: { id: true, label: true, propertyId: true, property: { select: { name: true } } } },
  reportedBy: { select: { id: true, fullName: true } },
  updates: {
    include: { author: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.MaintenanceTicketInclude

export type TicketWithRelations = Prisma.MaintenanceTicketGetPayload<{ include: typeof ticketInclude }>

export function toTicketDto(ticket: TicketWithRelations): TicketDto {
  return {
    id: ticket.id,
    propertyId: ticket.propertyId,
    propertyName: ticket.unit.property.name,
    unitId: ticket.unitId,
    unitLabel: ticket.unit.label,
    tenancyId: ticket.tenancyId,
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority as TicketPriority,
    status: ticket.status as TicketStatus,
    reportedById: ticket.reportedById,
    reportedByName: ticket.reportedBy.fullName,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    updates: ticket.updates.map((u) => ({
      id: u.id,
      note: u.note,
      authorName: u.author.fullName,
      statusFrom: (u.statusFrom as TicketStatus | null) ?? null,
      statusTo: (u.statusTo as TicketStatus | null) ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  }
}

// ---------------------------------------------------------------------------
// Deposit ledger + condition reports (Phase 2)
// ---------------------------------------------------------------------------

/** Everything DepositDto needs (tenancy chain + append-only movements). */
export const depositInclude = {
  tenancy: { include: { tenant: true, unit: { include: { property: true } } } },
  movements: {
    include: { actor: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.DepositInclude

export type DepositWithRelations = Prisma.DepositGetPayload<{ include: typeof depositInclude }>

/** Everything ConditionReportDto needs. */
export const conditionReportInclude = {
  recordedBy: { select: { fullName: true } },
} satisfies Prisma.ConditionReportInclude

export type ConditionReportWithRelations = Prisma.ConditionReportGetPayload<{
  include: typeof conditionReportInclude
}>

export function toConditionReportDto(report: ConditionReportWithRelations): ConditionReportDto {
  let photoUrls: string[] = []
  try {
    const parsed = JSON.parse(report.photoUrlsJson) as unknown
    if (Array.isArray(parsed)) photoUrls = parsed.filter((u): u is string => typeof u === "string")
  } catch {
    // Corrupt JSON in the column must never break the read path.
  }
  return {
    id: report.id,
    tenancyId: report.tenancyId,
    kind: report.kind as ConditionReportDto["kind"],
    notes: report.notes,
    photoUrls,
    recordedByName: report.recordedBy.fullName,
    createdAt: report.createdAt.toISOString(),
  }
}

/** Deposit + its condition reports → DepositDto. Reports are queried by the caller (scope-checked). */
export function toDepositDto(
  deposit: DepositWithRelations,
  reports: ConditionReportWithRelations[]
): DepositDto {
  return {
    id: deposit.id,
    tenancyId: deposit.tenancyId,
    unitLabel: deposit.tenancy.unit.label,
    propertyName: deposit.tenancy.unit.property.name,
    tenantName: deposit.tenancy.tenant.fullName,
    tenantPhone: deposit.tenancy.tenant.phone,
    heldMinor: deposit.heldMinor,
    status: deposit.status as DepositStatus,
    movements: deposit.movements.map((m) => ({
      id: m.id,
      kind: m.kind as DepositMovementKind,
      amountMinor: m.amountMinor,
      reason: m.reason,
      actorName: m.actor ? m.actor.fullName : null,
      createdAt: m.createdAt.toISOString(),
    })),
    conditionReports: reports.map(toConditionReportDto),
  }
}

// ---------------------------------------------------------------------------
// Guard module — visitor log, incident reports, shifts (Phase 3)
// ---------------------------------------------------------------------------

/** Everything VisitorLogDto needs (unit + property names, logging guard). */
export const visitorLogInclude = {
  unit: { select: { id: true, label: true } },
  property: { select: { id: true, name: true } },
  guard: { select: { id: true, fullName: true } },
} satisfies Prisma.VisitorLogInclude

export type VisitorLogWithRelations = Prisma.VisitorLogGetPayload<{ include: typeof visitorLogInclude }>

export function toVisitorLogDto(row: VisitorLogWithRelations): VisitorLogDto {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.property.name,
    unitId: row.unitId,
    unitLabel: row.unit ? row.unit.label : null,
    visitorName: row.visitorName,
    visitorPhone: row.visitorPhone,
    purpose: row.purpose as VisitorPurpose,
    guardId: row.guardId,
    guardName: row.guard.fullName,
    enteredAt: row.enteredAt.toISOString(),
    exitedAt: row.exitedAt ? row.exitedAt.toISOString() : null,
  }
}

/** Everything IncidentReportDto needs (property, filing guard, acker). */
export const incidentInclude = {
  property: { select: { id: true, name: true } },
  guard: { select: { id: true, fullName: true } },
  acknowledgedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentReportInclude

export type IncidentWithRelations = Prisma.IncidentReportGetPayload<{ include: typeof incidentInclude }>

export function toIncidentDto(row: IncidentWithRelations): IncidentReportDto {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.property.name,
    guardId: row.guardId,
    guardName: row.guard.fullName,
    category: row.category as IncidentCategory,
    severity: row.severity as IncidentSeverity,
    description: row.description,
    actionTaken: row.actionTaken,
    acknowledgedById: row.acknowledgedById,
    acknowledgedByName: row.acknowledgedBy ? row.acknowledgedBy.fullName : null,
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Everything GuardShiftDto needs (property, guard). */
export const guardShiftInclude = {
  property: { select: { id: true, name: true } },
  guard: { select: { id: true, fullName: true } },
} satisfies Prisma.GuardShiftInclude

export type GuardShiftWithRelations = Prisma.GuardShiftGetPayload<{ include: typeof guardShiftInclude }>

export function toGuardShiftDto(row: GuardShiftWithRelations): GuardShiftDto {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.property.name,
    guardId: row.guardId,
    guardName: row.guard.fullName,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    notes: row.notes,
  }
}
