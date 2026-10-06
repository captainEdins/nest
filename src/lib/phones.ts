/**
 * NEST — Kenyan phone-number normalization.
 *
 * Kenyan MSISDNs are +254 followed by 9 digits (mobile prefixes 07xx / 01xx).
 * Users and M-Pesa callbacks hand us every variant:
 *   "+254711000001", "254711000001", "0711000001", "711000001",
 *   "+254 711 000 001" (spaced), "254711000003" (Daraja callback form, no +).
 *
 * All Profile.phone values are stored in E.164 ("+254…"). This module is the
 * single place that converts anything user- or provider-supplied to that form.
 */

/** Strip everything except digits and a single leading "+". */
function cleanPhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s\-()]/g, "")
  return trimmed.startsWith("+") ? `+${trimmed.slice(1).replace(/\D/g, "")}` : trimmed.replace(/\D/g, "")
}

/**
 * Normalize any common Kenyan phone representation to E.164 ("+254XXXXXXXXX")
 * or return null when the input cannot be a valid Kenyan MSISDN.
 */
export function normalizeKenyanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = cleanPhone(raw)

  // +254 + 9 digits — already E.164
  if (/^\+254\d{9}$/.test(cleaned)) return cleaned
  // 254 + 9 digits — missing "+"
  if (/^254\d{9}$/.test(cleaned)) return `+${cleaned}`
  // 0 + 9 digits — national format ("0711000001")
  if (/^0\d{9}$/.test(cleaned)) return `+254${cleaned.slice(1)}`
  // 9 digits bare ("711000001") — national without the trunk zero
  if (/^\d{9}$/.test(cleaned)) return `+254${cleaned}`

  return null
}

/**
 * Last-9-digits comparison key — the tie-breaker used for "is this the same
 * Kenyan number?" when formats differ ("+254711000003" vs "254711000003" vs
 * "0711000003" all → "711000003"). Returns null when fewer than 9 digits
 * exist (not a usable Kenyan MSISDN).
 */
export function kenyanPhoneKey9(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = cleanPhone(raw).replace(/^\+/, "")
  if (digits.length < 9) return null
  return digits.slice(-9)
}

/**
 * Daraja wants MSISDNs WITHOUT the leading "+" ("2547XXXXXXXX"). Our E.164
 * form converts by stripping "+".
 */
export function toDarajaPhone(e164: string): string {
  return e164.startsWith("+") ? e164.slice(1) : e164
}
