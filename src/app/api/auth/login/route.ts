/**
 * NEST — POST /api/auth/login  (Task 2-a, ADR-0003 / D-005)
 *
 * Phone-first login for the demo phase: `{ phone }` → session cookie.
 * Phone normalization accepts "+2547…", "07…", "2547…" — comparison happens
 * on the normalized E.164 form first, then on last-9-digits.
 *
 * On success: sets the httpOnly HMAC cookie `nest_session` (30 days) and
 * returns SessionDto. Audits AUTH_LOGIN. Production swaps this module's
 * session layer for Supabase phone OTP (route guards unchanged).
 */

import { z } from "zod"
import type { SessionDto } from "@/lib/types"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { handleRouteError, ok, parseJsonBody, unauthorized } from "@/lib/auth-guard"
import { toProfileDto } from "@/lib/dto"
import { kenyanPhoneKey9, normalizeKenyanPhone } from "@/lib/phones"
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionCookieOptions, sessionCookieValue } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const loginSchema = z.object({
  phone: z.string().trim().min(5).max(20),
})

export async function POST(request: Request) {
  try {
    const { phone } = await parseJsonBody(request, loginSchema)

    // Try the normalized E.164 form first (profiles are stored in E.164).
    const normalized = normalizeKenyanPhone(phone)
    let profile = normalized ? await db.profile.findUnique({ where: { phone: normalized } }) : null

    if (!profile) {
      // Fallback: compare on the last 9 digits — "0711000001",
      // "+254711000001" and "254711000001" are the same Kenyan MSISDN.
      const key9 = kenyanPhoneKey9(phone)
      if (key9) {
        const candidates = await db.profile.findMany({ where: { active: true } })
        profile = candidates.find((p) => kenyanPhoneKey9(p.phone) === key9) ?? null
      }
    }

    // Same response for "unknown number" and "deactivated account" — no
    // account-enumeration signal.
    if (!profile || !profile.active) {
      throw unauthorized("Invalid phone number")
    }

    await audit(profile.id, "AUTH_LOGIN", "Profile", profile.id, { phone: profile.phone })

    const response = ok({ profile: toProfileDto(profile) } satisfies SessionDto)
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionCookieValue(profile.id),
      ...sessionCookieOptions(SESSION_MAX_AGE_SECONDS),
    })
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
