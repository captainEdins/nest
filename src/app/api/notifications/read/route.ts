/**
 * NEST — POST /api/notifications/read  (Phase 7, issue #70)
 *
 * Marks the caller's OWN notifications read (readAt = now). Idempotent:
 * rows already read keep their original readAt (append-only spirit — the
 * first read time is the record that matters). Non-financial UI state, so
 * no AuditLog entry (D-008 covers money actions only).
 *
 * Body:  { all: true }                      → every own unread row
 *        { ids: ["...", "..."] }            → those own rows (others silently
 *                                              filtered out — existence of
 *                                              foreign ids must not leak)
 * At least one of the two is required; `all` wins when both are present.
 *
 * Returns { unread: number } — the badge count after the write, so the
 * client updates in one round-trip without a follow-up GET.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { handleRouteError, ok, parseJsonBody, requireProfile, validationError } from "@/lib/auth-guard"
import type { NotificationUnreadCountDto } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const readSchema = z
  .object({
    all: z.boolean().optional(),
    ids: z.array(z.string().trim().min(1)).max(50).optional(),
  })
  .refine((v) => v.all === true || (v.ids !== undefined && v.ids.length > 0), {
    message: "Provide { all: true } or a non-empty ids array",
  })

export async function POST(request: Request) {
  try {
    const profile = await requireProfile()
    const body = await parseJsonBody(request, readSchema)
    if (body.all !== true && body.ids === undefined) {
      throw validationError({ body: "all or ids required" })
    }

    const now = new Date()
    if (body.all === true) {
      await db.notification.updateMany({
        where: { profileId: profile.id, readAt: null },
        data: { readAt: now },
      })
    } else if (body.ids) {
      // Scope to own rows: foreign ids match nothing, and updateMany counts
      // don't reveal whether they exist for someone else.
      await db.notification.updateMany({
        where: { profileId: profile.id, readAt: null, id: { in: body.ids } },
        data: { readAt: now },
      })
    }

    const unread = await db.notification.count({
      where: { profileId: profile.id, readAt: null },
    })
    const dto: NotificationUnreadCountDto = { unread }
    return ok(dto)
  } catch (error) {
    return handleRouteError(error)
  }
}
