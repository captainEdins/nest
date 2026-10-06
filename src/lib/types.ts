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
// Maintenance tickets (Phase 2)
// ---------------------------------------------------------------------------

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export interface TicketUpdateDto {
  id: string
  note: string
  authorName: string
  statusFrom: TicketStatus | null
  statusTo: TicketStatus | null
  createdAt: string
}

export interface TicketDto {
  id: string
  propertyId: string
  propertyName: string
  unitId: string
  unitLabel: string
  tenancyId: string | null
  title: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  reportedById: string
  reportedByName: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  /** Full history, oldest first. */
  updates: TicketUpdateDto[]
}

export interface CreateTicketRequest {
  /** Required for CARETAKER (unit picker); derived from the ACTIVE tenancy for TENANT. */
  unitId?: string
  title: string
  description: string
  priority?: TicketPriority
}

export interface AddTicketUpdateRequest {
  note: string
  /** Optional status transition — omitted means a pure comment. */
  statusTo?: TicketStatus
}

// ---------------------------------------------------------------------------
// Deposit ledger + condition reports (Phase 2)
// ---------------------------------------------------------------------------

export const DEPOSIT_MOVEMENT_KINDS = ["HOLD", "DEDUCT", "REFUND", "ADJUST"] as const
export type DepositMovementKind = (typeof DEPOSIT_MOVEMENT_KINDS)[number]

export const DEPOSIT_STATUSES = ["HELD", "RELEASED"] as const
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number]

export const CONDITION_REPORT_KINDS = ["MOVE_IN", "MOVE_OUT"] as const
export type ConditionReportKind = (typeof CONDITION_REPORT_KINDS)[number]

export interface DepositMovementDto {
  id: string
  kind: DepositMovementKind
  amountMinor: number
  reason: string | null
  actorName: string | null
  createdAt: string
}

export interface ConditionReportDto {
  id: string
  tenancyId: string
  kind: ConditionReportKind
  notes: string
  photoUrls: string[]
  recordedByName: string
  createdAt: string
}

export interface DepositDto {
  id: string
  tenancyId: string
  unitLabel: string
  propertyName: string
  tenantName: string
  tenantPhone: string
  heldMinor: number
  status: DepositStatus
  /** Oldest first — the append-only ledger. */
  movements: DepositMovementDto[]
  conditionReports: ConditionReportDto[]
}

export interface DepositSettlementLine {
  reason: string
  amountMinor: number
}

export interface DepositSettleRequest {
  deductions: DepositSettlementLine[]
}

export interface CreateConditionReportRequest {
  tenancyId: string
  kind: ConditionReportKind
  notes: string
  photoUrls?: string[]
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
    /** Payments received since midnight today (all sources) */
    todayCollectedMinor: number
    collectionRatePct: number // 0-100 of expected collected
    arrearsMinor: number
    arrearsTenantCount: number
    unmatchedPayments: number
    /** OPEN + IN_PROGRESS maintenance tickets across owned properties. */
    openTickets: number
  }
  arrears: ArrearsRowDto[]
  recentPayments: PaymentDto[]
  vacancies: UnitDto[]
  /** Phase 3: eyes on the ground — visitor/incident digest. */
  security: SecurityDigestDto
  month: string // "YYYY-MM" the numbers refer to
}

export interface CaretakerOverviewDto {
  property: PropertyDto
  units: UnitDto[]
  totals: {
    monthExpectedMinor: number
    monthCollectedMinor: number
    /** Payments received since midnight today (all sources) */
    todayCollectedMinor: number
    arrearsMinor: number
    arrearsTenantCount: number
    vacant: number
    unmatchedPayments: number
    /** OPEN + IN_PROGRESS maintenance tickets on the caretaker's property. */
    openTickets: number
  }
  arrears: ArrearsRowDto[]
  recentPayments: PaymentDto[]
  /** Phase 3: eyes on the ground — visitor/incident digest. */
  security: SecurityDigestDto
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
  /** Phase 3: who came to my unit — most recent first (last 7 days, max 5). */
  recentVisitors: VisitorLogDto[]
}

export interface AgentOverviewDto {
  portfolioProperties: PropertyDto[]
  totals: {
    properties: number
    units: number
    occupancyRatePct: number
    /** Phase 4 funnel: live pipeline on the agent's portfolio. */
    vacantUnits: number
    liveListings: number
    newApplications: number
    activeApplications: number
  }
  /** Vacant units with no live listing yet (create-listing candidates). */
  unlistedVacantUnits: { id: string; label: string; propertyName: string; rentAmountMinor: number }[]
  /** Live listings preview (PUBLISHED), newest first. */
  liveListings: ListingDto[]
}

export interface GuardOverviewDto {
  property: PropertyDto | null
  /** ACTIVE shift if on duty — the guard's write anchor (property derived from it). */
  activeShift: GuardShiftDto | null
  /** Properties the guard has ever worked at (shift-derived scope), for Start-shift pickers. */
  properties: PropertyDto[]
  /**
   * Units of the ACTIVE shift's property (id + label, label-sorted) — the
   * Log-visitor sheet's unit picker source. EMPTY when off duty: units are
   * the active shift's context, and /api/units stays landlord/caretaker-only
   * (the guard never fetches it — this field is the guard-scoped source).
   */
  activePropertyUnits: { id: string; label: string }[]
  totals: {
    visitorsToday: number
    onSiteNow: number
    unacknowledgedIncidents: number
  }
  recentVisitors: VisitorLogDto[]
}

// ---------------------------------------------------------------------------
// Guard module — visitor log, incident reports, shifts (Phase 3)
// ---------------------------------------------------------------------------

export const VISITOR_PURPOSES = ["VISITOR", "DELIVERY", "CONTRACTOR", "VIEWING", "OTHER"] as const
export type VisitorPurpose = (typeof VISITOR_PURPOSES)[number]

export const INCIDENT_CATEGORIES = ["SECURITY", "DAMAGE", "DISPUTE", "THEFT", "OTHER"] as const
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number]

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]

export interface VisitorLogDto {
  id: string
  propertyId: string
  propertyName: string
  unitId: string | null
  unitLabel: string | null
  visitorName: string
  visitorPhone: string | null
  purpose: VisitorPurpose
  guardId: string
  guardName: string
  enteredAt: string
  exitedAt: string | null
}

export interface LogVisitorRequest {
  visitorName: string
  visitorPhone?: string
  purpose: VisitorPurpose
  /** Optional unit the visitor is heading to (must belong to the shift property). */
  unitId?: string
}

export interface IncidentReportDto {
  id: string
  propertyId: string
  propertyName: string
  guardId: string
  guardName: string
  category: IncidentCategory
  severity: IncidentSeverity
  description: string
  actionTaken: string | null
  acknowledgedById: string | null
  acknowledgedByName: string | null
  acknowledgedAt: string | null
  createdAt: string
}

export interface ReportIncidentRequest {
  category: IncidentCategory
  severity: IncidentSeverity
  description: string
  actionTaken?: string
}

export interface GuardShiftDto {
  id: string
  propertyId: string
  propertyName: string
  guardId: string
  guardName: string
  startedAt: string
  endedAt: string | null
  notes: string | null
}

export interface StartShiftRequest {
  propertyId: string
}

export interface EndShiftRequest {
  notes?: string
}

/** Security digest for LANDLORD/CARETAKER home cards (Phase 3). */
export interface SecurityDigestDto {
  visitorsToday: number
  onSiteNow: number
  unacknowledgedIncidents: number
  highSeverityUnacked: number
  lastIncidentAt: string | null
  lastIncidentSeverity: IncidentSeverity | null
  onDutyGuardName: string | null
}

// ---------------------------------------------------------------------------
// Agent module — listings + applicant pipeline (Phase 4)
// ---------------------------------------------------------------------------

export const LISTING_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED", "LET"] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const APPLICATION_STATUSES = ["NEW", "CONTACTED", "VIEWING", "APPROVED", "REJECTED", "WITHDRAWN"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_SOURCES = ["WALK_IN", "PHONE", "WHATSAPP", "FACEBOOK", "OTHER"] as const
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number]

export interface ListingDto {
  id: string
  propertyId: string
  propertyName: string
  unitId: string
  unitLabel: string
  title: string
  description: string
  rentAmountMinor: number
  status: ListingStatus
  createdAt: string
  updatedAt: string
  /** Applicant counts by bucket (the funnel at a glance). */
  applicationCount: number
  newApplicationCount: number
}

/** Listing detail with the full applicant list (newest first). */
export interface ListingDetailDto extends ListingDto {
  applications: ListingApplicationDto[]
}

export interface ListingApplicationDto {
  id: string
  listingId: string
  unitLabel: string
  propertyName: string
  applicantName: string
  applicantPhone: string
  source: ApplicationSource
  note: string | null
  status: ApplicationStatus
  handledById: string
  handledByName: string
  decidedById: string | null
  decidedByName: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
  /** Append-only timeline (oldest first) — the trust record. */
  events: ApplicationEventDto[]
}

export interface ApplicationEventDto {
  id: string
  toStatus: ApplicationStatus
  actorId: string
  actorName: string
  note: string | null
  createdAt: string
}

export interface CreateListingRequest {
  unitId: string
  title: string
  description: string
  /** Optional override; defaults to the unit's rent (integer KES minor units). */
  rentAmountMinor?: number
}

export interface ListingStatusChangeRequest {
  status: ListingStatus
}

export interface RecordApplicationRequest {
  applicantName: string
  applicantPhone: string
  source: ApplicationSource
  note?: string
}

export interface ApplicationStatusChangeRequest {
  status: ApplicationStatus
  note?: string
}

// ---------------------------------------------------------------------------
// Landlord analytics (Phase 5 wedge A, issue #57)
// ---------------------------------------------------------------------------

/**
 * One month of the collection trend. Money is integer KES minor units:
 * billed = charges issued (due date in the month, any status); collected =
 * allocations of successful (COMPLETED) payments received in the month.
 */
export interface AnalyticsMonthDto {
  /** Calendar key, e.g. "2026-05". */
  monthKey: string
  /** Short month label for chart axes, e.g. "May". */
  label: string
  billedMinor: number
  collectedMinor: number
}

/** One arrears-aging bucket: tenant count + outstanding total. */
export interface ArrearsAgingBucketDto {
  count: number
  totalMinor: number
}

/**
 * Tenants bucketed by outstanding-balance age (days since the OLDEST unpaid
 * charge's dueDate). "current" = balance exactly zero, or owed but nothing
 * past due yet; negative balances (tenant credit) are skipped entirely.
 */
export interface ArrearsAgingDto {
  current: ArrearsAgingBucketDto
  d1_30: ArrearsAgingBucketDto
  d31_60: ArrearsAgingBucketDto
  d61plus: ArrearsAgingBucketDto
}

/** Occupancy per owned property (NOTICE units still count as occupied). */
export interface OccupancyRowDto {
  propertyId: string
  propertyName: string
  occupied: number
  vacant: number
}

/** GET /api/analytics — LANDLORD only (read-only, no audit rows). */
export interface LandlordAnalyticsDto {
  /** Last 6 calendar months INCLUDING the current one, oldest first. */
  monthly: AnalyticsMonthDto[]
  arrearsAging: ArrearsAgingDto
  occupancy: OccupancyRowDto[]
  /** ISO timestamp of the server computation. */
  generatedAt: string
}

// ---------------------------------------------------------------------------
// KRA/MRI tax assistant (Phase 5 wedge B, issue #59)
// ---------------------------------------------------------------------------

/**
 * One calendar month of the tax year (Jan–Dec, always 12 rows in calendar
 * order, zeros included — CSV parity). Money is integer KES minor units with
 * the same definitions as the analytics trend: billed = RentCharge.amountMinor
 * (ACTIVE tenancies in landlord scope, dueDate in the month); collected =
 * PaymentAllocation.amountMinor through COMPLETED payments received in the
 * month.
 */
export interface KraMonthRowDto {
  /** 1..12 */
  month: number
  /** Short month label, e.g. "Jan". */
  label: string
  billedMinor: number
  collectedMinor: number
}

/**
 * GET /api/kra/summary?year=YYYY — LANDLORD only (read-only, no audit rows).
 * Record-keeping assistance for Kenya's Monthly Rental Income (MRI) regime;
 * NEVER tax advice (the UI carries a persistent disclaimer).
 */
export interface KraSummaryDto {
  year: number
  /** Jan–Dec, 12 rows, calendar order, zero months included. */
  months: KraMonthRowDto[]
  totals: {
    billedMinor: number
    collectedMinor: number
  }
  /** 7.5% MRI estimate on collected rent (integer minor units). */
  mriEstimateMinor: number
  /** ISO timestamp of the server computation. */
  generatedAt: string
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
