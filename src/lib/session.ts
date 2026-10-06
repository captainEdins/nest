/**
 * NEST — session cookie (Task 2-a, ADR-0003 / D-005).
 *
 * Demo HMAC-signed httpOnly cookie session. The cookie stores ONLY the
 * profile id plus an HMAC-SHA256 over it:
 *
 *     nest_session = `<profileId>.<hex hmac(profileId, SESSION_SECRET)>`
 *
 * SECURITY INVARIANTS:
 * - The cookie NEVER stores the role. The role is re-derived from the Profile
 *   row in the database on EVERY request — a tampered or stale cookie can
 *   never escalate privileges (see role-scope-matrix.md §1).
 * - httpOnly + sameSite=lax: the value is invisible to client JS.
 * - The profile is re-fetched per request, so deactivation (`active = false`)
 *   takes effect immediately.
 * - Production swaps this single module for Supabase phone-OTP; every route
 *   guard keeps calling `getSessionProfile()` unchanged.
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { Profile } from "@prisma/client"
import { db } from "@/lib/db"

export const SESSION_COOKIE = "nest_session"
/** 30 days, in seconds. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 8) {
    // Dev fallback keeps the sandbox usable; a short/missing secret is loudly
    // flagged so it is never silently trusted in production.
    console.warn("[session] SESSION_SECRET is unset or short — using dev fallback. NEVER do this in production.")
    return "nest-dev-only-insecure-secret"
  }
  return secret
}

/** HMAC-SHA256 hex digest of the profile id — the cookie signature. */
export function sessionCookieValue(profileId: string): string {
  return `${profileId}.${createHmac("sha256", sessionSecret()).update(profileId).digest("hex")}`
}

/** Timing-safe hex comparison (both sides must be same length). */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Cookie options every route uses when setting/clearing the session. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    // The sandbox preview runs over http; only set Secure behind TLS.
    secure: process.env.NODE_ENV === "production",
  }
}

/**
 * Resolve the current session's Profile from the request cookie, or null.
 * Verifies the HMAC (timing-safe), then loads the Profile from the DB —
 * the role therefore always comes from the database, never the cookie.
 */
export async function getSessionProfile(): Promise<Profile | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null

  const dot = raw.lastIndexOf(".")
  if (dot <= 0) return null
  const profileId = raw.slice(0, dot)
  const signature = raw.slice(dot + 1)

  if (!safeEqualHex(signature, createHmac("sha256", sessionSecret()).update(profileId).digest("hex"))) {
    return null
  }

  const profile = await db.profile.findUnique({ where: { id: profileId } })
  if (!profile || !profile.active) return null
  return profile
}
