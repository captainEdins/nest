/**
 * NEST — GET /api/auth/profiles
 *
 * Demo identities for the role-select screen (S-01). Returns ProfileDto[]
 * with NO secrets. Gated hard on DEMO_MODE=1 — any other value (including
 * unset, i.e. production) returns 404 and leaks nothing. Unauthenticated by
 * design: the screen exists BEFORE login.
 */

import { db } from "@/lib/db"
import { handleRouteError, notFound, ok } from "@/lib/auth-guard"
import { toProfileDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (process.env.DEMO_MODE !== "1") {
      throw notFound()
    }
    const profiles = await db.profile.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })
    return ok(profiles.map(toProfileDto))
  } catch (error) {
    return handleRouteError(error)
  }
}
