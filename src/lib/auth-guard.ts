/**
 * NEST — API route guards + JSON error envelope (Task 2-a).
 *
 * Every route handler:
 *   1. Zod-validates input (→ 400 VALIDATION with details),
 *   2. resolves the session server-side (`requireProfile` → 401 UNAUTHORIZED),
 *   3. enforces the role-scope matrix (`requireRole` → 403 FORBIDDEN, and the
 *      scope `where` fragments below → 404 NOT_FOUND when a row is out of
 *      scope; existence must not leak — role-scope-matrix.md §1).
 *
 * Deny by default: a resource not covered by the matrix is accessible to NO
 * role until a row is added there. This module is the single place those
 * conditions live (matrix §7.1) — routes never copy-paste conditions.
 *
 * Error envelope matches `ApiError` in src/lib/types.ts exactly:
 *   { error: string, code: "UNAUTHORIZED"|"FORBIDDEN"|"VALIDATION"|"NOT_FOUND"|"CONFLICT"|"SERVER", details? }
 */

import { NextResponse } from "next/server"
import { ZodError, type ZodType } from "zod"
import type { Profile, Prisma } from "@prisma/client"
import type { Role, ApiError } from "@/lib/types"
import { db } from "@/lib/db"
import { getSessionProfile } from "@/lib/session"

// ---------------------------------------------------------------------------
// Typed HTTP error — thrown by guards/engines, converted once per route by
// handleRouteError so no route hand-builds an error response.
// ---------------------------------------------------------------------------

export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: ApiError["code"],
    public readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiHttpError"
  }
}

export const unauthorized = (message = "Authentication required") => new ApiHttpError(401, message, "UNAUTHORIZED")
export const forbidden = (message = "You do not have permission to do that") => new ApiHttpError(403, message, "FORBIDDEN")
export const notFound = (message = "Not found") => new ApiHttpError(404, message, "NOT_FOUND")
export const conflict = (message: string) => new ApiHttpError(409, message, "CONFLICT")
export const validationError = (details: unknown, message = "Invalid request") =>
  new ApiHttpError(400, message, "VALIDATION", details)

// ---------------------------------------------------------------------------
// Session + role guards
// ---------------------------------------------------------------------------

/** Resolve the session Profile or throw 401 (never trust the client's role). */
export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile()
  if (!profile) throw unauthorized()
  return profile
}

/**
 * Require the session's role to be one of `roles`, else 403 FORBIDDEN
 * (code "FORBIDDEN"). The role is re-derived from the DB via requireProfile —
 * never read from a body, query param, or header.
 */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile()
  if (!roles.includes(profile.role as Role)) {
    throw forbidden(`Role ${profile.role} may not access this resource`)
  }
  return profile
}

// ---------------------------------------------------------------------------
// Zod body/query validation — 400 VALIDATION with field details
// ---------------------------------------------------------------------------

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    throw new ApiHttpError(400, "Request body must be valid JSON", "VALIDATION", { body: "invalid JSON" })
  }
  const result = schema.safeParse(json)
  if (!result.success) throw validationError(zodDetails(result.error))
  return result.data
}

export function parseSearchParams<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) throw validationError(zodDetails(result.error))
  return result.data
}

/** Flatten a ZodError into a small, UI-friendly details array. */
function zodDetails(error: ZodError): unknown {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }))
}

// ---------------------------------------------------------------------------
// Success/error responses — the ApiOk<T> { data } envelope + ApiError shape
// ---------------------------------------------------------------------------

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

/** Map any thrown value to the uniform ApiError JSON response. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiHttpError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...(error.details !== undefined ? { details: error.details } : {}) },
      { status: error.status }
    )
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", code: "VALIDATION", details: zodDetails(error) }, { status: 400 })
  }
  console.error("[api] unhandled error:", error)
  return NextResponse.json({ error: "Internal server error", code: "SERVER" }, { status: 500 })
}

// ---------------------------------------------------------------------------
// Role-scope matrix fragments (§2/§4 of docs/architecture/role-scope-matrix.md)
//
// Usage: fetch the target row WITH the scope condition in the same query —
// a miss ⇒ 404 (existence must not leak). Never check scope against an id
// the client sent without re-fetching (matrix §7.2).
//
// "SELF" = the session profile id. Property-field form is the key; the tenancy
// chain goes tenancy → unit → property → {landlordId|caretakerId|agentId}.
// ---------------------------------------------------------------------------

/** Prisma `where` for Tenancy rows visible to `profile` under the matrix. */
export function tenancyScopeWhere(profile: Profile): Prisma.TenancyWhereInput {
  switch (profile.role) {
    case "LANDLORD":
      return { unit: { property: { landlordId: profile.id } } }
    case "CARETAKER":
      return { unit: { property: { caretakerId: profile.id } } }
    case "AGENT":
      return { unit: { property: { agentId: profile.id } } }
    case "TENANT":
      // Own tenancies only (matrix §4.4). Money reads additionally require
      // status ACTIVE — applied by callers that expose money.
      return { tenantId: profile.id }
    default: // GUARD and anything unknown — deny by default.
      return { id: "__never__" }
  }
}

/** Prisma `where` for Payment rows on the caller's property chain (matrix §4). */
export function paymentChainWhere(profile: Profile): Prisma.PaymentWhereInput {
  switch (profile.role) {
    case "LANDLORD":
      return { tenancy: { unit: { property: { landlordId: profile.id } } } }
    case "CARETAKER":
      return { tenancy: { unit: { property: { caretakerId: profile.id } } } }
    case "AGENT":
      return { tenancy: { unit: { property: { agentId: profile.id } } } }
    case "TENANT":
      return { tenancy: { tenantId: profile.id, status: "ACTIVE" } }
    default:
      return { id: -1 } // GUARD — deny by default
  }
}

/**
 * Tenant phones of the properties in `profile`'s scope (E.164). Used to scope
 * the unmatched queue for CARETAKER/AGENT: they see UNMATCHED money only when
 * the payer phone matches one of their tenants (matrix §4.2/§4.3/§6).
 */
export async function scopedTenantPhones(profile: Profile): Promise<string[]> {
  const propertyWhere: Prisma.PropertyWhereInput =
    profile.role === "CARETAKER" ? { caretakerId: profile.id } : profile.role === "AGENT" ? { agentId: profile.id } : { id: "__never__" }
  const tenancies = await db.tenancy.findMany({
    where: { status: "ACTIVE", unit: { property: propertyWhere } },
    select: { tenant: { select: { phone: true } } },
  })
  return tenancies.map((t) => t.tenant.phone)
}

/**
 * The unmatched-queue visibility fragment (matrix §4.1/§4.2/§4.3):
 * - LANDLORD: every UNMATCHED payment — owner of record for unattributable
 *   money on the single paybill shortcode (§7.4).
 * - CARETAKER/AGENT: UNMATCHED AND payer phone ∈ scoped tenant phones.
 * - everyone else: nothing.
 *
 * Phones are compared on the normalized E.164 form; Payer phones from Daraja
 * are normalized before Payment rows are written (reconciliation.ts), so the
 * `in` comparison is exact here.
 */
export async function unmatchedVisibleWhere(profile: Profile): Promise<Prisma.PaymentWhereInput> {
  if (profile.role === "LANDLORD") return { status: "UNMATCHED" }
  if (profile.role === "CARETAKER" || profile.role === "AGENT") {
    const phones = await scopedTenantPhones(profile)
    return { status: "UNMATCHED", phone: { in: phones } }
  }
  return { id: -1 }
}

/**
 * Full payment visibility for `profile`: property-chain payments OR their
 * visible slice of the unmatched queue. (The full Payment rows list used by
 * recent-payments and receipts — receipts additionally filter receiptNo.)
 */
export async function paymentScopeWhere(profile: Profile): Promise<Prisma.PaymentWhereInput> {
  if (profile.role === "LANDLORD" || profile.role === "CARETAKER" || profile.role === "AGENT") {
    return { OR: [paymentChainWhere(profile), await unmatchedVisibleWhere(profile)] }
  }
  return paymentChainWhere(profile)
}

/** Money-role check used by money endpoints (matrix §5). GUARD is never a money role. */
export function isMoneyRole(profile: Profile): boolean {
  return profile.role === "LANDLORD" || profile.role === "AGENT" || profile.role === "CARETAKER"
}

// ---------------------------------------------------------------------------
// Phase 2 — maintenance tickets, deposit ledger, condition reports
// ---------------------------------------------------------------------------

/**
 * Prisma `where` for MaintenanceTicket rows visible to `profile` (Phase 2 matrix):
 * - TENANT: tickets attached to their own tenancies (any status — history stays visible),
 * - LANDLORD/CARETAKER/AGENT: tickets on their property chain (AGENT read-only),
 * - GUARD: nothing (deny by default).
 */
export function ticketScopeWhere(profile: Profile): Prisma.MaintenanceTicketWhereInput {
  switch (profile.role) {
    case "LANDLORD":
      return { unit: { property: { landlordId: profile.id } } }
    case "CARETAKER":
      return { unit: { property: { caretakerId: profile.id } } }
    case "AGENT":
      return { unit: { property: { agentId: profile.id } } }
    case "TENANT":
      return { tenancy: { tenantId: profile.id } }
    default: // GUARD and anything unknown — deny by default.
      return { id: "__never__" }
  }
}

/**
 * Prisma `where` for Tenancy rows whose deposit/condition data `profile` may READ
 * (Phase 2 matrix). Deposits are money: AGENT and GUARD get nothing. TENANT sees
 * their own ACTIVE **or** NOTICE tenancy (the deposit matters while it is held,
 * including through a move-out settlement).
 */
export function depositTenancyScopeWhere(profile: Profile): Prisma.TenancyWhereInput {
  switch (profile.role) {
    case "LANDLORD":
      return { unit: { property: { landlordId: profile.id } } }
    case "CARETAKER":
      return { unit: { property: { caretakerId: profile.id } } }
    case "TENANT":
      return { tenantId: profile.id, status: { in: ["ACTIVE", "NOTICE"] } }
    default: // AGENT + GUARD — deny by default (deposits are money data).
      return { id: "__never__" }
  }
}
