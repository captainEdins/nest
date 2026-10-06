/**
 * NEST — Rent Score engine (Phase 6-b, issue #66).
 *
 * A payment-record score the TENANT owns: derived only from verified NEST
 * facts (charges, allocations), never self-reported, never a black box —
 * every factor's earned/max is shipped with the score so the card can show
 * exactly how it was built. The external partner-facing API (consent-gated)
 * is a later phase; this is the tenant/landlord slice.
 *
 * Scoring model (0–800, four documented factors — see issue #66):
 *
 * 1. PAYMENT_HISTORY (max 300) — share of billed minor units that was fully
 *    settled by the end of the month it was billed for. A charge counts
 *    on-time only when it is fully paid (paidMinor == amountMinor) AND its
 *    latest allocation landed within that same period month. Partial or
 *    late counts as not-on-time — strict, but explainable in one sentence.
 *
 * 2. ARREARS_DEPTH (max 250) — the harsher of two pressures, each capped so
 *    the factor bottoms out at zero (never negative):
 *      depthPenalty   = min(1, closingBalance / (2 × monthly rent))
 *                      — two months' rent owed zeroes the factor;
 *      streakPenalty  = min(1, longest run of consecutive months ending
 *                      in arrears / 3) — three billed months in a row
 *                      carried forward zeroes the factor.
 *
 * 3. TENURE (max 150) — months since the tenancy started, saturating at 24.
 *
 * 4. RECENT_TREND (max 100) — of the last 3 billed months, how many were
 *    fully settled on time (per the rule in 1).
 *
 * Bands: 720–800 EXCELLENT · 560–719 GOOD · 400–559 FAIR · 0–399 BUILDING.
 * Zero billed months ⇒ the documented floor: score 0, every factor 0,
 * band BUILDING (never NaN, never negative).
 *
 * Money rules: integer KES minor units end-to-end; scores are integer
 * points (Math.round at the factor level, Math.floor for tenure months).
 * Read-only: no AuditLog rows (D-018).
 */

import type { Profile } from "@prisma/client"
import { z } from "zod"
import { db } from "@/lib/db"
import { notFound, parseSearchParams, tenancyScopeWhere } from "@/lib/auth-guard"
import type { RentScoreBand, RentScoreDto, RentScoreFactorDto } from "@/lib/types"

// ---------------------------------------------------------------------------
// Documented model constants
// ---------------------------------------------------------------------------

export const RENT_SCORE_MAX = 800
export const RENT_SCORE_WEIGHTS = {
  PAYMENT_HISTORY: 300,
  ARREARS_DEPTH: 250,
  TENURE: 150,
  RECENT_TREND: 100,
} as const

/** Months of on-time payments a tenancy is credited for at most (TENURE). */
const TENURE_SATURATION_MONTHS = 24
/** Rent-months owed that zero the ARREARS_DEPTH factor. */
const DEPTH_ZERO_RENT_MONTHS = 2
/** Consecutive arrears months that zero the ARREARS_DEPTH factor. */
const STREAK_ZERO_MONTHS = 3
/** Billed months the RECENT_TREND factor looks back on. */
const TREND_WINDOW = 3

export function rentScoreBandOf(score: number): RentScoreBand {
  if (score >= 720) return "EXCELLENT"
  if (score >= 560) return "GOOD"
  if (score >= 400) return "FAIR"
  return "BUILDING"
}

// ---------------------------------------------------------------------------
// Facts — the only inputs the engine trusts
// ---------------------------------------------------------------------------

interface ScoreFacts {
  tenancyId: string
  tenantName: string
  unitLabel: string
  monthlyRentMinor: number
  /** Whole months since tenancy start (floor), for TENURE. */
  tenureMonths: number
  closingBalanceMinor: number
  /** Per billed month: billed minor, on-time-settled minor, month ended in arrears. */
  months: Array<{
    periodMonth: string
    billedMinor: number
    onTimeMinor: number
    endedInArrears: boolean
  }>
}

/** Charge-level + allocation-level facts for one tenancy. */
interface ChargeFact {
  periodMonth: string
  amountMinor: number
  paidMinor: number
  /** Latest allocation timestamp per charge (null when nothing was paid). */
  lastAllocatedAt: Date | null
}

export function scoreOfFacts(facts: ScoreFacts): Omit<RentScoreDto, "asOf"> {
  const monthsOfHistory = facts.months.length

  if (monthsOfHistory === 0) {
    // The documented floor: no billed months → Building, zero everywhere.
    return {
      tenancyId: facts.tenancyId,
      tenantName: facts.tenantName,
      unitLabel: facts.unitLabel,
      score: 0,
      band: "BUILDING",
      factors: (Object.keys(RENT_SCORE_WEIGHTS) as Array<keyof typeof RENT_SCORE_WEIGHTS>).map(
        (key) => ({ key, earned: 0, max: RENT_SCORE_WEIGHTS[key] }),
      ),
      monthsOfHistory: 0,
    }
  }

  // 1. Payment history — on-time share of everything ever billed.
  const totalBilled = facts.months.reduce((sum, m) => sum + m.billedMinor, 0)
  const totalOnTime = facts.months.reduce((sum, m) => sum + m.onTimeMinor, 0)
  const paymentHistoryEarned = Math.round((totalOnTime / Math.max(totalBilled, 1)) * RENT_SCORE_WEIGHTS.PAYMENT_HISTORY)

  // 2. Arrears depth — harsher of current-balance depth and historical streak.
  const depthPenalty =
    facts.monthlyRentMinor > 0
      ? Math.min(1, facts.closingBalanceMinor / (facts.monthlyRentMinor * DEPTH_ZERO_RENT_MONTHS))
      : facts.closingBalanceMinor > 0
        ? 1
        : 0
  let streak = 0
  let longestStreak = 0
  for (const month of facts.months) {
    streak = month.endedInArrears ? streak + 1 : 0
    longestStreak = Math.max(longestStreak, streak)
  }
  const streakPenalty = Math.min(1, longestStreak / STREAK_ZERO_MONTHS)
  const arrearsDepthEarned = Math.round(
    RENT_SCORE_WEIGHTS.ARREARS_DEPTH * (1 - Math.max(depthPenalty, streakPenalty)),
  )

  // 3. Tenure — months on record, saturating at 24.
  const tenureEarned = Math.round(
    RENT_SCORE_WEIGHTS.TENURE * Math.min(1, facts.tenureMonths / TENURE_SATURATION_MONTHS),
  )

  // 4. Recent trend — of the last billed months, fully-on-time count.
  const recent = facts.months.slice(-TREND_WINDOW)
  const recentOnTime = recent.filter((m) => m.billedMinor > 0 && m.onTimeMinor === m.billedMinor).length
  const recentTrendEarned = Math.round((recentOnTime / TREND_WINDOW) * RENT_SCORE_WEIGHTS.RECENT_TREND)

  const factors: RentScoreFactorDto[] = [
    { key: "PAYMENT_HISTORY", earned: paymentHistoryEarned, max: RENT_SCORE_WEIGHTS.PAYMENT_HISTORY },
    { key: "ARREARS_DEPTH", earned: arrearsDepthEarned, max: RENT_SCORE_WEIGHTS.ARREARS_DEPTH },
    { key: "TENURE", earned: tenureEarned, max: RENT_SCORE_WEIGHTS.TENURE },
    { key: "RECENT_TREND", earned: recentTrendEarned, max: RENT_SCORE_WEIGHTS.RECENT_TREND },
  ]

  const score = Math.max(
    0,
    Math.min(RENT_SCORE_MAX, factors.reduce((sum, f) => sum + f.earned, 0)),
  )

  return {
    tenancyId: facts.tenancyId,
    tenantName: facts.tenantName,
    unitLabel: facts.unitLabel,
    score,
    band: rentScoreBandOf(score),
    factors,
    monthsOfHistory,
  }
}

// ---------------------------------------------------------------------------
// Fact assembly (database → ScoreFacts), then the pure engine above
// ---------------------------------------------------------------------------

/** ?tenancyId= — optional for tenants (own tenancy); required for staff. */
export const rentScoreQuerySchema = z.object({
  tenancyId: z.string().min(1).optional(),
})

/** Charged facts with allocation timestamps, grouped per charge. */
async function chargeFacts(tenancyId: string): Promise<ChargeFact[]> {
  const charges = await db.rentCharge.findMany({
    where: { tenancyId },
    select: { id: true, periodMonth: true, amountMinor: true, paidMinor: true },
    orderBy: [{ periodMonth: "asc" }, { kind: "asc" }],
  })
  if (charges.length === 0) return []
  const allocations = await db.paymentAllocation.findMany({
    where: { chargeId: { in: charges.map((c) => c.id) } },
    select: { chargeId: true, createdAt: true },
  })
  const lastAllocatedByCharge = new Map<string, Date>()
  for (const allocation of allocations) {
    const current = lastAllocatedByCharge.get(allocation.chargeId)
    if (!current || allocation.createdAt > current) {
      lastAllocatedByCharge.set(allocation.chargeId, allocation.createdAt)
    }
  }
  return charges.map((c) => ({
    periodMonth: c.periodMonth,
    amountMinor: c.amountMinor,
    paidMinor: c.paidMinor,
    lastAllocatedAt: lastAllocatedByCharge.get(c.id) ?? null,
  }))
}

/** True when the charge was fully paid within the month it was billed for. */
function chargeWasOnTime(fact: ChargeFact): boolean {
  if (fact.paidMinor < fact.amountMinor) return false
  if (fact.lastAllocatedAt == null) return false
  // Same "YYYY-MM" as the charge's own period — settled inside the due month.
  return fact.lastAllocatedAt.toISOString().slice(0, 7) === fact.periodMonth
}

async function factsForTenancy(tenancyId: string): Promise<ScoreFacts | null> {
  const tenancy = await db.tenancy.findFirst({
    where: { id: tenancyId, status: "ACTIVE" },
    select: {
      id: true,
      startDate: true,
      monthlyRentMinor: true,
      tenant: { select: { fullName: true } },
      unit: { select: { label: true } },
    },
  })
  if (!tenancy) return null

  const chargeRows = await chargeFacts(tenancyId)

  // Group charges by period month.
  const byPeriod = new Map<string, ChargeFact[]>()
  for (const fact of chargeRows) {
    byPeriod.set(fact.periodMonth, [...(byPeriod.get(fact.periodMonth) ?? []), fact])
  }
  const months = [...byPeriod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodMonth, facts]) => {
      const billedMinor = facts.reduce((sum, f) => sum + f.amountMinor, 0)
      const onTimeMinor = facts.filter(chargeWasOnTime).reduce((sum, f) => sum + f.amountMinor, 0)
      const settledMinor = facts.reduce((sum, f) => sum + f.paidMinor, 0)
      return { periodMonth, billedMinor, onTimeMinor, endedInArrears: billedMinor > settledMinor }
    })

  // Closing balance — the same economic math as /api/tenancies (Σ billed − Σ settled).
  const totalBilled = months.reduce((sum, m) => sum + m.billedMinor, 0)
  const totalSettled = chargeRows.reduce((sum, f) => sum + f.paidMinor, 0)

  const now = new Date()
  const tenureMonths = Math.max(
    0,
    (now.getFullYear() - tenancy.startDate.getFullYear()) * 12 +
      (now.getMonth() - tenancy.startDate.getMonth()),
  )

  return {
    tenancyId: tenancy.id,
    tenantName: tenancy.tenant.fullName,
    unitLabel: tenancy.unit.label,
    monthlyRentMinor: tenancy.monthlyRentMinor,
    tenureMonths,
    closingBalanceMinor: totalBilled - totalSettled,
    months,
  }
}

/**
 * The score for one tenancy. Scope: TENANT → own ACTIVE tenancy
 * (?tenancyId= ignored — never trusted). LANDLORD/CARETAKER → the
 * ?tenancyId= row re-fetched inside their scope (miss ⇒ 404).
 */
export async function getRentScore(profile: Profile, request: Request): Promise<RentScoreDto> {
  const { tenancyId } = parseSearchParams(request, rentScoreQuerySchema)
  const where =
    profile.role === "TENANT"
      ? { tenantId: profile.id, status: "ACTIVE" as const }
      : { id: tenancyId ?? "__never__", status: "ACTIVE" as const, ...tenancyScopeWhere(profile) }

  const tenancy = await db.tenancy.findFirst({
    where,
    select: { id: true },
  })
  if (!tenancy) {
    throw notFound("No rent score is available for this tenancy")
  }

  const facts = await factsForTenancy(tenancy.id)
  if (!facts) {
    throw notFound("No rent score is available for this tenancy")
  }
  return { ...scoreOfFacts(facts), asOf: new Date().toISOString() }
}

/**
 * Lightweight score list for the staff arrears views: every ACTIVE tenancy
 * in scope with just {tenancyId, tenantName, score, band} — one call, no
 * factor detail (the detail belongs to the tenant's own card).
 */
export async function getRentScoreList(profile: Profile): Promise<
  Array<{ tenancyId: string; tenantName: string; score: number; band: RentScoreBand }>
> {
  const tenancies = await db.tenancy.findMany({
    where: { status: "ACTIVE", ...tenancyScopeWhere(profile) },
    select: { id: true },
    orderBy: { accountRef: "asc" },
  })
  const scored = await Promise.all(
    tenancies.map(async (tenancy) => {
      const facts = await factsForTenancy(tenancy.id)
      return facts ? scoreOfFacts(facts) : null
    }),
  )
  return scored
    .filter((s): s is Omit<RentScoreDto, "asOf"> => s !== null)
    .map((s) => ({ tenancyId: s.tenancyId, tenantName: s.tenantName, score: s.score, band: s.band }))
}
