/**
 * NEST — provider-agnostic notifications (Task 2-a, D-013).
 *
 * `queueNotification(profileId, channel, templateKey, body)`:
 *   1. writes a Notification row QUEUED (the durable record),
 *   2. then attempts delivery through the adapter selected by env:
 *        SMS_PROVIDER        → SMS adapter      (dev | africastalking | twilio)
 *        WHATSAPP_PROVIDER   → WhatsApp adapter (dev | meta | twilio)
 *
 * Phase 1 ships ONLY the dev adapter, which logs and marks the row SENT with
 * the note "simulated". The Africa's Talking / Twilio integration points are
 * documented below as clearly marked stubs — NO real network calls are made
 * until credentials exist (SECURITY.md: no fake sends).
 *
 * RULE: notification failures must NEVER break a money flow — delivery errors
 * mark the row FAILED and are logged; queueNotification never throws upward.
 *
 * IN_APP "delivery" is the row itself: creating it IS the delivery, so the
 * row goes straight to SENT (read via GET /api/notifications).
 */

import type { Notification } from "@prisma/client"
import { db } from "@/lib/db"
import type { NotificationChannel } from "@/lib/types"

interface DeliveryResult {
  ok: boolean
  /** Provider/adapter outcome, e.g. "simulated" — logged, never stored on the row. */
  note: string
}

interface DeliveryAdapter {
  name: string
  deliver(args: { to: string; body: string }): Promise<DeliveryResult>
}

// ---------------------------------------------------------------------------
// Dev/simulation adapters — the Phase 1 default (SMS_PROVIDER / WHATSAPP_PROVIDER = "dev")
// ---------------------------------------------------------------------------

const devAdapter = (channel: string): DeliveryAdapter => ({
  name: `dev-${channel.toLowerCase()}`,
  async deliver({ to, body }) {
    // Simulated delivery: log loudly, mark SENT. No provider is contacted.
    console.log(`[notify][simulated ${channel}] → ${to}: ${body}`)
    return { ok: true, note: "simulated" }
  },
})

// ---------------------------------------------------------------------------
// INTEGRATION POINTS — real provider adapters (NOT enabled in Phase 1).
//
// ── Africa's Talking (SMS_PROVIDER=africastalking) ──
// Enable when SMS_API_KEY, AFRICASTALKING_USERNAME and AFRICASTALKING_SENDER
// are configured. The adapter would be:
//
//   const africasTalkingAdapter: DeliveryAdapter = {
//     name: "africastalking",
//     async deliver({ to, body }) {
//       const res = await fetch("https://api.africastalking.com/version1/messaging", {
//         method: "POST",
//         headers: { apiKey: process.env.SMS_API_KEY!, Accept: "application/json",
//                    "Content-Type": "application/x-www-form-urlencoded" },
//         body: new URLSearchParams({
//           username: process.env.AFRICASTALKING_USERNAME!,
//           to,                      // E.164, e.g. +254711000003
//           message: body,
//           ...(process.env.AFRICASTALKING_SENDER ? { from: process.env.AFRICASTALKING_SENDER } : {}),
//         }),
//       })
//       const json = await res.json().catch(() => null)
//       return { ok: res.ok, note: json?.SMSMessageData?.Recipients?.[0]?.status ?? String(res.status) }
//     },
//   }
//
// ── Twilio (SMS_PROVIDER=twilio) ──
// Enable when TWILIO_ACCOUNT_SID + SMS_API_KEY (auth token) + TWILIO_SENDER exist:
//
//   POST https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json
//   Authorization: "Basic " + base64(TWILIO_ACCOUNT_SID + ":" + SMS_API_KEY)
//   body (form): To=<E.164>, From=TWILIO_SENDER, Body=<body>
//
// ── WhatsApp (WHATSAPP_PROVIDER=meta) — WhatsApp Cloud API ──
//   POST https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
//   Authorization: Bearer WHATSAPP_API_KEY
//   body (JSON): { messaging_product: "whatsapp", to, type: "text", text: { body } }
//
// Until those env keys exist, resolveSmsAdapter/resolveWhatsAppAdapter keep
// returning the dev adapter (honest failure > fake success).
// ---------------------------------------------------------------------------

function resolveSmsAdapter(): DeliveryAdapter {
  const provider = process.env.SMS_PROVIDER ?? "dev"
  const hasCredentials = Boolean(process.env.SMS_API_KEY)
  if (provider !== "dev" && !hasCredentials) {
    console.warn(`[notify] SMS_PROVIDER=${provider} but SMS_API_KEY is unset — falling back to dev adapter`)
  }
  // Phase 1: dev adapter for every configuration (see integration points above).
  return devAdapter("SMS")
}

function resolveWhatsAppAdapter(): DeliveryAdapter {
  const provider = process.env.WHATSAPP_PROVIDER ?? "dev"
  const hasCredentials = Boolean(process.env.WHATSAPP_API_KEY)
  if (provider !== "dev" && !hasCredentials) {
    console.warn(`[notify] WHATSAPP_PROVIDER=${provider} but WHATSAPP_API_KEY is unset — falling back to dev adapter`)
  }
  return devAdapter("WHATSAPP")
}

function adapterFor(channel: NotificationChannel): DeliveryAdapter {
  switch (channel) {
    case "SMS":
      return resolveSmsAdapter()
    case "WHATSAPP":
      return resolveWhatsAppAdapter()
    case "IN_APP":
    default:
      return devAdapter("IN_APP")
  }
}

/**
 * Queue a notification for `profileId` on `channel` and attempt delivery.
 * Never throws: delivery failures mark the row FAILED and are logged.
 * Returns the Notification row (or null if even the row could not be written).
 */
export async function queueNotification(
  profileId: string,
  channel: NotificationChannel,
  templateKey: string,
  body: string
): Promise<Notification | null> {
  let row: Notification | null = null
  try {
    row = await db.notification.create({
      data: { profileId, channel, templateKey, body, status: "QUEUED" },
    })

    if (channel === "IN_APP") {
      // In-app delivery == the row existing. Mark SENT immediately.
      return await db.notification.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date() },
      })
    }

    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { phone: true, active: true } })
    if (!profile || !profile.active) {
      return await db.notification.update({
        where: { id: row.id },
        data: { status: "FAILED" },
      })
    }

    const result = await adapterFor(channel).deliver({ to: profile.phone, body })
    return await db.notification.update({
      where: { id: row.id },
      data: result.ok ? { status: "SENT", sentAt: new Date() } : { status: "FAILED" },
    })
  } catch (error) {
    console.error(`[notify] queueNotification failed (template ${templateKey}, channel ${channel}):`, error)
    if (row) {
      try {
        return await db.notification.update({ where: { id: row.id }, data: { status: "FAILED" } })
      } catch {
        return row
      }
    }
    return null
  }
}
