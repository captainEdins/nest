/**
 * NEST — GET /api/notifications
 *
 * The signed-in profile's own notifications, latest 20 (matrix §4: every
 * role reads own notifications only). NotificationDto[].
 */

import { db } from "@/lib/db"
import { handleRouteError, ok, requireProfile } from "@/lib/auth-guard"
import { toNotificationDtoRow } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireProfile()
    const notifications = await db.notification.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    return ok(notifications.map(toNotificationDtoRow))
  } catch (error) {
    return handleRouteError(error)
  }
}
