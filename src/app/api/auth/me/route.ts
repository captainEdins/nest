/**
 * NEST — GET /api/auth/me
 * Returns SessionDto for the current cookie session, or 401 UNAUTHORIZED.
 * The role is re-derived from the DB on every call (never the cookie).
 */

import type { SessionDto } from "@/lib/types"
import { handleRouteError, ok, requireProfile } from "@/lib/auth-guard"
import { toProfileDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireProfile()
    return ok({ profile: toProfileDto(profile) } satisfies SessionDto)
  } catch (error) {
    return handleRouteError(error)
  }
}
