/**
 * NEST — Money utilities.
 *
 * RULE: money is stored, transported and computed as integer KES minor
 * units (cents). Floats are never used for money anywhere in the system.
 * Only formatting to a display string happens here.
 */

/** Format minor units as a Kenyan Shilling display string. */
export function formatKes(minor: number, opts: { withCents?: boolean } = {}): string {
  const withCents = opts.withCents ?? false
  const negative = minor < 0
  const abs = Math.abs(minor)
  const whole = Math.floor(abs / 100)
  const cents = abs % 100
  const wholeStr = whole.toLocaleString("en-KE")
  let out: string
  if (withCents || cents !== 0) {
    out = `KSh ${wholeStr}.${String(cents).padStart(2, "0")}`
  } else {
    out = `KSh ${wholeStr}`
  }
  return negative ? `-${out}` : out
}

/**
 * Compact axis-label form of formatKes for charts: "KSh 40k", "KSh 1.2M",
 * "KSh 800". Display-only (integer math throughout — the value itself never
 * becomes a float), for tight tick labels where the full form would not fit.
 */
export function formatKesCompact(minor: number): string {
  const negative = minor < 0
  const whole = Math.round(Math.abs(minor) / 100) // whole shillings, display-only
  let out: string
  if (whole >= 1_000_000) {
    // Tenths of a million, kept integral so the label is exact ("1.2M").
    const tenths = Math.round(whole / 100_000)
    out = tenths % 10 === 0 ? `KSh ${tenths / 10}M` : `KSh ${Math.floor(tenths / 10)}.${tenths % 10}M`
  } else if (whole >= 1_000) {
    out = `KSh ${Math.round(whole / 1000)}k`
  } else {
    out = `KSh ${whole}`
  }
  return negative ? `-${out}` : out
}

/** Convert a whole-shilling user input string ("12500") to minor units. */
export function shillingsToMinor(input: string): number | null {
  const cleaned = input.replace(/[,\sKSh]/gi, "")
  if (!/^\d+$/.test(cleaned)) return null
  return parseInt(cleaned, 10) * 100
}

/** Convert minor units to whole shillings for <input type="number"> fields. */
export function minorToShillingsInput(minor: number): string {
  return String(Math.floor(minor / 100))
}

/**
 * Split an amount across charges oldest-first without losing a cent.
 * Returns allocations whose sum equals `amountMinor` exactly.
 * Charges must be ordered by dueDate asc.
 */
export function splitWaterfall(
  amountMinor: number,
  outstanding: { chargeId: string; outstandingMinor: number }[]
): { chargeId: string; amountMinor: number }[] {
  let remaining = amountMinor
  const out: { chargeId: string; amountMinor: number }[] = []
  for (const c of outstanding) {
    if (remaining <= 0) break
    const take = Math.min(remaining, c.outstandingMinor)
    if (take > 0) {
      out.push({ chargeId: c.chargeId, amountMinor: take })
      remaining -= take
    }
  }
  return out
}

/** Percentage helper for collection/occupancy rates. */
export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}
