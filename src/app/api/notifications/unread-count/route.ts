/**
 * NEST — GET /api/notifications/unread-count  (Phase 7, issue #70)
 *
 * The cheapest possible poll for the bell badge: one COUNT on the caller's
 * own rows where readAt IS NULL (matrix §4: every role, own notifications
 * only). Returns { unread: number } — never a list, never another profile's
 * count.
 */

import { db } from "@/lib/db"
import { handleRouteError, ok, requireProfile } from "@/lib/auth-guard"
import type { NotificationUnreadCountDto } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireProfile()
    const unread = await db.notification.count({
      where: { profileId: profile.id, readAt: null },
    })
    const dto: NotificationUnreadCountDto = { unread }
    return ok(dto)
  } catch (error) {
    return handleRouteError(error)
  }
}
