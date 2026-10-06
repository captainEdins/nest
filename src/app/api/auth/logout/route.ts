/**
 * NEST — POST /api/auth/logout
 * Clears the session cookie (maxAge 0). No auth required — logging out with
 * no session is a no-op success.
 */

import { handleRouteError, ok } from "@/lib/auth-guard"
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const response = ok({ ok: true })
    response.cookies.set({
      name: SESSION_COOKIE,
      value: "",
      ...sessionCookieOptions(0),
    })
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
