/**
 * NEST — Shared domain & API contract types.
 *
 * This file is the single source of truth for the shape of data crossing
 * the API boundary. Backend route handlers must return exactly these
 * shapes; the frontend consumes exactly these shapes. Money is ALWAYS
 * integer KES minor units (cents) — never floats. Dates are ISO strings.
 *
 * NOTE: Prisma+SQLite does not support enums, so all enum-like values are
 * strings validated by Zod on write and narrowed by these types on read.
 */

// ---------------------------------------------------------------------------
// Core domain
// ---------------------------------------------------------------------------

export const ROLES = ["LANDLORD", "AGENT", "CARETAKER", "TENANT", "GUARD"] as const
export type Role = (typeof ROLES)[number]

export const CHARGE_KINDS = ["RENT", "WATER", "GARBAGE"] as const
export type ChargeKind = (typeof CHARGE_KINDS)[number]

export const CHARGE_STATUSES = ["UNPAID", "PART", "PAID"] as const
export type ChargeStatus = (typeof CHARGE_STATUSES)[number]

export const PAYMENT_SOURCES = ["MPESA", "CASH", "BANK"] as const
export type PaymentSource = (typeof PAYMENT_SOURCES)[number]

export const PAYMENT_STATUSES = ["PENDING", "COMPLETED", "UNMATCHED", "REVERSED"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const UNIT_STATUSES = ["VACANT", "OCCUPIED", "NOTICE"] as const
export type UnitStatus = (typeof UNIT_STATUSES)[number]

export const UNIT_TYPES = ["BEDSITTER", "SINGLE", "ONE_BR", "TWO_BR", "THREE_BR", "SHOP"] as const
export type UnitType = (typeof UNIT_TYPES)[number]

export const TENANCY_STATUSES = ["ACTIVE", "ENDED", "NOTICE"] as const
export type TenancyStatus = (typeof TENANCY_STATUSES)[number]

export const NOTIFICATION_CHANNELS = ["SMS", "WHATSAPP", "IN_APP"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

// ---------------------------------------------------------------------------
// DTOs (wire shapes)
// ---------------------------------------------------------------------------

export interface ProfileDto {
  id: string
  phone: string // E.164-ish, e.g. "+254711000001"
  fullName: string
  role: Role
  language: "en" | "sw"
}

export interface SessionDto {
  profile: ProfileDto
}

export interface PropertyDto {
  id: string
  name: string
  location: string
  landlordId: string
  caretakerId: string | null
  unitCount: number
  occupiedCount: number
}

export interface UnitDto {
  id: string
  propertyId: string
  propertyName: string
  label: string
  type: UnitType
  status: UnitStatus
  rentAmountMinor: number
  depositAmountMinor: number
  /** Present when occupied */
  tenancy?: {
    id: string
    tenantId: string
    tenantName: string
    tenantPhone: string
    accountRef: string
    monthlyRentMinor: number
    startDate: string
    balanceMinor: number // unpaid charges total
  } | null
}

export interface ChargeDto {
  id: string
  tenancyId: string
  kind: ChargeKind
  periodMonth: string // "YYYY-MM"
  dueDate: string
  amountMinor: number
  paidMinor: number
  status: ChargeStatus
  unitLabel: string
  tenantName: string
}

export interface PaymentDto {
  id: string
  receiptNo: string | null
  amountMinor: number
  source: PaymentSource
  status: PaymentStatus
  receivedAt: string
  tenancyId: string | null
  accountReference: string | null
  phone: string | null
  /** Human label for the payer, resolved when matched */
  matchedLabel: string | null
  recordedByName: string | null
  allocations?: PaymentAllocationDto[]
}

export interface PaymentAllocationDto {
  chargeId: string
  chargeKind: ChargeKind
  chargePeriod: string
  amountMinor: number
}

export interface ReceiptDto {
  receiptNo: string
  paymentId: string
  amountMinor: number
  source: PaymentSource
  receivedAt: string
  tenancyId: string
  tenantName: string
  tenantPhone: string
  unitLabel: string
  propertyName: string
  accountRef: string
  allocations: PaymentAllocationDto[]
}

export interface NotificationDto {
  id: string
  channel: NotificationChannel
  templateKey: string
  body: string
  status: "QUEUED" | "SENT" | "FAILED"
  createdAt: string
  sentAt: string | null
}

// ---------------------------------------------------------------------------
// Dashboards — one small payload per role home screen (low-end phones)
// ---------------------------------------------------------------------------

export interface ArrearsRowDto {
  tenancyId: string
  tenantName: string
  tenantPhone: string
  unitLabel: string
  propertyName: string
  accountRef: string
  balanceMinor: number
  /** Oldest unpaid charge period, e.g. "2025-11" */
  oldestUnpaidPeriod: string | null
  monthsBehind: number
}

export interface LandlordOverviewDto {
  properties: PropertyDto[]
  totals: {
    units: number
    occupied: number
    vacant: number
    occupancyRatePct: number // 0-100, rounded
    monthExpectedMinor: number
    monthCollectedMinor: number
    collectionRatePct: number // 0-100 of expected collected
    arrearsMinor: number
    arrearsTenantCount: number
    unmatchedPayments: number
  }
  arrears: ArrearsRowDto[]
  recentPayments: PaymentDto[]
  vacancies: UnitDto[]
  month: string // "YYYY-MM" the numbers refer to
}

export interface CaretakerOverviewDto {
  property: PropertyDto
  units: UnitDto[]
  totals: {
    monthExpectedMinor: number
    monthCollectedMinor: number
    arrearsMinor: number
    arrearsTenantCount: number
    vacant: number
    unmatchedPayments: number
  }
  arrears: ArrearsRowDto[]
  recentPayments: PaymentDto[]
  month: string
}

export interface TenantOverviewDto {
  tenancy: {
    id: string
    unitLabel: string
    propertyName: string
    propertyLocation: string
    accountRef: string
    monthlyRentMinor: number
    depositHeldMinor: number
    startDate: string
  }
  totals: {
    balanceMinor: number
    nextDueDate: string | null
    nextDueAmountMinor: number
  }
  charges: ChargeDto[]
  receipts: ReceiptDto[]
  notifications: NotificationDto[]
}

export interface AgentOverviewDto {
  portfolioProperties: PropertyDto[]
  totals: {
    properties: number
    units: number
    occupancyRatePct: number
  }
  phaseNotice: string
}

export interface GuardOverviewDto {
  property: PropertyDto | null
  phaseNotice: string
}

// ---------------------------------------------------------------------------
// M-Pesa / payments API payloads
// ---------------------------------------------------------------------------

export interface StkPushRequest {
  tenancyId: string
  amountMinor: number
  /** Optional override; defaults to the tenant's phone on file */
  phone?: string
}

export interface StkPushResponseDto {
  checkoutRequestId: string
  merchantRequestId: string
  amountMinor: number
  phone: string
  accountReference: string
  /** Honest label shown in the UI */
  mode: "live" | "sim"
  customerMessage: string
}

export interface CashCollectionRequest {
  tenancyId: string
  amountMinor: number
  note?: string
  /** Client-generated idempotency key for offline sync */
  clientRef?: string
}

export interface MatchUnmatchedRequest {
  tenancyId: string
}

export interface ApiError {
  error: string
  code: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "SERVER"
  details?: unknown
}

export interface ApiOk<T> {
  data: T
}
