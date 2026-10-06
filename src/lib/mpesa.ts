/**
 * NEST — M-Pesa Daraja boundary (Task 2-a, ADR-0005 / D-006).
 *
 * This module is the ONLY place that talks to Safaricom Daraja (or, in sim
 * mode, fabricates the same shapes locally). Downstream code never branches
 * on provider details — `initiateStkPush` returns an `MpesaTransaction` row
 * plus an `StkPushResponseDto` whose `mode` field tells the UI honestly
 * whether the push was simulated.
 *
 * ── Daraja shapes implemented here (real contract, from Daraja docs) ──
 *
 * STK Push request (POST /mpesa/stkpush/v1/processrequest):
 *   {
 *     "BusinessShortCode": "174379",
 *     "Password": base64(shortcode + passkey + timestamp),
 *     "Timestamp": "YYYYMMDDHHmmss",              // must be current-ish
 *     "TransactionType": "CustomerPayBillOnline",
 *     "Amount": 1,                                // WHOLE SHILLINGS (minor
 *                                                // units are a NEST-internal
 *                                                // concept; Daraja has no cents)
 *     "PartyA": "254711000001",                   // payer MSISDN, no "+"
 *     "PartyB": "174379",                         // paybill shortcode
 *     "PhoneNumber": "254711000001",
 *     "CallBackURL": "https://…/api/mpesa/callback",
 *     "AccountReference": "NEST-A1-1001",         // ≤ 12 chars on the prompt
 *     "TransactionDesc": "NEST rent"
 *   }
 *
 * STK Callback (POST to our /api/mpesa/callback) — the money-write trigger:
 *   {
 *     "Body": { "stkCallback": {
 *       "MerchantRequestID": "29115-34620561-1",
 *       "CheckoutRequestID": "ws_CO_191220191020363925",
 *       "ResultCode": 0,                          // 0 = success
 *       "ResultDesc": "The service request is processed successfully.",
 *       "CallbackMetadata": {                      // PRESENT ONLY ON SUCCESS
 *         "Item": [
 *           { "Name": "Amount", "Value": 1 },
 *           { "Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV" },
 *           { "Name": "PhoneNumber", "Value": 254711000001 },
 *           { "Name": "TransactionDate", "Value": 20191219102104 }
 *         ]
 *       }
 *     } }
 *   }
 *   ResultCodes seen in practice: 0 success · 1032 user cancelled ·
 *   1 insufficient funds · 1037 timeout / DS timeout.
 *
 * Callback authentication: when MPESA_CALLBACK_SECRET is set, Daraja-style
 * callers may sign the RAW request body with HMAC-SHA256 and send the hex
 * digest in the `x-mpesa-signature` header (C2B-style). We verify with
 * crypto.timingSafeEqual. In sim mode (secret unset) verification is skipped
 * with a console.warn + audit note — never a silent pass.
 *
 * OAuth: GET {base}/oauth/v1/generate?grant_type=client_credentials with
 * HTTP Basic (consumer key:secret) → { access_token }.
 *
 * Money rule (D-007): amounts are integer KES minor units everywhere in
 * NEST. At this boundary only, they convert to Daraja's whole-shilling
 * integers: amount = round(amountMinor / 100). The Payment row created by
 * the callback pipeline takes its amount from the CALLBACK Amount × 100 —
 * what M-Pesa says it actually settled is the source of truth, never what
 * we asked for. (Sim callbacks echo the pushed amount, so cents survive
 * only in sim mode; live Daraja cannot settle sub-shilling amounts.)
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { MpesaTransaction } from "@prisma/client"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { toDarajaPhone } from "@/lib/phones"
import type { StkPushResponseDto } from "@/lib/types"

/** "live" → real Daraja network; anything else (default "sim") → fabricated locally. */
export function mpesaMode(): "live" | "sim" {
  return process.env.MPESA_MODE === "live" ? "live" : "sim"
}

function darajaBaseUrl(): string {
  // MPESA_ENV=production → the live gateway; sandbox is the default.
  return process.env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke"
}

/** Daraja Timestamp: YYYYMMDDHHmmss in Nairobi time (UTC+3) regardless of server TZ. */
function darajaTimestamp(date = new Date()): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, "0")
  return (
    `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}` +
    `${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`
  )
}

// ---------------------------------------------------------------------------
// STK Push
// ---------------------------------------------------------------------------

export interface StkPushInput {
  /** E.164 payer phone, e.g. "+254711000003" (the tenant's phone on file). */
  phone: string
  /** KES minor units. Converted to whole shillings for Daraja. */
  amountMinor: number
  /** Tenancy account reference, e.g. "NEST-B2-1003" (≤12 chars on the prompt). */
  accountReference: string
  description: string
  tenancyId?: string | null
}

export interface StkPushOutcome {
  transaction: MpesaTransaction
  response: StkPushResponseDto
}

/**
 * Initiate an STK push. `sim` mode fabricates CheckoutRequestID/MerchantRequestID
 * and makes NO network call; `live` mode performs the real Daraja OAuth + push.
 * Both paths persist an MpesaTransaction row INITIATED → PUSHED.
 */
export async function initiateStkPush(input: StkPushInput): Promise<StkPushOutcome> {
  const mode = mpesaMode()
  const shortcode = process.env.MPESA_SHORTCODE ?? "174379"
  const phoneE164 = input.phone.startsWith("+") ? input.phone : `+${input.phone}`
  const amountShillings = Math.max(1, Math.round(input.amountMinor / 100))

  let checkoutRequestId: string
  let merchantRequestId: string
  let customerMessage: string

  if (mode === "live") {
    // --- REAL DARAJA (only reachable with MPESA_MODE=live + credentials) ---
    const consumerKey = process.env.MPESA_CONSUMER_KEY
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET
    if (!consumerKey || !consumerSecret) {
      throw new Error("MPESA_MODE=live but MPESA_CONSUMER_KEY/MPESA_CONSUMER_SECRET are unset")
    }

    // 1) OAuth — client-credentials token, Basic auth.
    const authHeader = "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")
    const oauthRes = await fetch(`${darajaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: authHeader },
    })
    if (!oauthRes.ok) throw new Error(`Daraja OAuth failed (${oauthRes.status})`)
    const { access_token: accessToken } = (await oauthRes.json()) as { access_token?: string }
    if (!accessToken) throw new Error("Daraja OAuth returned no access_token")

    // 2) STK push — Password = base64(shortcode + passkey + timestamp).
    const passkey = process.env.MPESA_PASSKEY
    if (!passkey) throw new Error("MPESA_MODE=live but MPESA_PASSKEY is unset")
    const timestamp = darajaTimestamp()
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64")

    const pushRes = await fetch(`${darajaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amountShillings,
        PartyA: toDarajaPhone(phoneE164),
        PartyB: shortcode,
        PhoneNumber: toDarajaPhone(phoneE164),
        CallBackURL: process.env.MPESA_CALLBACK_URL ?? "https://example.com/api/mpesa/callback",
        AccountReference: input.accountReference,
        TransactionDesc: input.description.slice(0, 30),
      }),
    })
    const pushJson = (await pushRes.json().catch(() => null)) as
      | { CheckoutRequestID?: string; MerchantRequestID?: string; CustomerMessage?: string; errorMessage?: string }
      | null
    if (!pushRes.ok || !pushJson?.CheckoutRequestID) {
      const msg = pushJson?.errorMessage ?? `Daraja STK push failed (${pushRes.status})`
      // Record the failed initiation attempt for ops visibility, then surface.
      await db.mpesaTransaction.create({
        data: {
          checkoutRequestId: `ws_CO_ERR_${randomBytes(8).toString("hex")}`,
          merchantRequestId: pushJson?.MerchantRequestID ?? "unknown",
          phone: phoneE164,
          amountMinor: input.amountMinor,
          accountReference: input.accountReference,
          tenancyId: input.tenancyId ?? null,
          status: "FAILED",
          resultCode: String(pushRes.status),
          resultDesc: msg,
        },
      })
      throw new Error(msg)
    }
    checkoutRequestId = pushJson.CheckoutRequestID
    merchantRequestId = pushJson.MerchantRequestID ?? "unknown"
    customerMessage = pushJson.CustomerMessage ?? "Success. Request accepted for processing"
  } else {
    // --- SIM MODE: fabricate Daraja-shaped identifiers, NO network call. ---
    checkoutRequestId = `ws_CO_SIM_${Date.now()}_${randomBytes(6).toString("hex")}`
    merchantRequestId = `ws_MR_SIM_${randomBytes(6).toString("hex")}`
    customerMessage = "Success. Request accepted for processing (sandbox simulation)"
  }

  // Persist INITIATED → PUSHED (both modes — the state machine is identical).
  const transaction = await db.mpesaTransaction.create({
    data: {
      checkoutRequestId,
      merchantRequestId,
      phone: phoneE164,
      amountMinor: input.amountMinor,
      accountReference: input.accountReference,
      tenancyId: input.tenancyId ?? null,
      status: "INITIATED",
    },
  })
  const pushed = await db.mpesaTransaction.update({
    where: { id: transaction.id },
    data: { status: "PUSHED" },
  })

  return {
    transaction: pushed,
    response: {
      checkoutRequestId,
      merchantRequestId,
      amountMinor: input.amountMinor,
      phone: phoneE164,
      accountReference: input.accountReference,
      mode, // tells the UI honestly whether this push was simulated
      customerMessage,
    },
  }
}

// ---------------------------------------------------------------------------
// Callback signature verification (x-mpesa-signature)
// ---------------------------------------------------------------------------

export interface SignatureVerification {
  ok: boolean
  /** true when verification was skipped because no secret is configured (sim mode). */
  skipped: boolean
  reason?: string
}

/**
 * Verify a Daraja-style `x-mpesa-signature` header: HMAC-SHA256 over the RAW
 * request body (byte-for-byte as received — re-serialization breaks it),
 * hex-encoded, compared with crypto.timingSafeEqual.
 *
 * If MPESA_CALLBACK_SECRET is unset (sim default) → skip with console.warn +
 * an audit note — never a silent pass.
 */
export async function verifyDarajaSignature(rawBody: string, signature: string | null): Promise<SignatureVerification> {
  const secret = process.env.MPESA_CALLBACK_SECRET
  if (!secret) {
    const reason = "MPESA_CALLBACK_SECRET unset — callback signature verification skipped (sim mode)"
    console.warn(`[mpesa] ${reason}`)
    await audit(null, "MPESA_CALLBACK_SIGNATURE_SKIPPED", "MpesaTransaction", null, { reason })
    return { ok: true, skipped: true, reason }
  }
  if (!signature) {
    return { ok: false, skipped: false, reason: "x-mpesa-signature header missing while secret is configured" }
  }

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  const provided = signature.trim().toLowerCase()

  const expected = Buffer.from(digest, "utf8")
  const given = Buffer.from(provided, "utf8")
  // Same-length requirement + timingSafeEqual ⇒ no early-exit byte leaks.
  const matches = expected.length === given.length && timingSafeEqual(expected, given)

  return matches
    ? { ok: true, skipped: false }
    : { ok: false, skipped: false, reason: "HMAC mismatch" }
}

// ---------------------------------------------------------------------------
// Simulated callback construction — REAL Daraja body shapes
// ---------------------------------------------------------------------------

export type SimulatedOutcome = "SUCCESS" | "CANCELLED" | "TIMEOUT" | "INSUFFICIENT"

/** ResultCode mapping used by the simulator (see header comment). */
const SIM_RESULT_CODES: Record<SimulatedOutcome, { code: number; desc: string }> = {
  SUCCESS: { code: 0, desc: "The service request is processed successfully." },
  CANCELLED: { code: 1032, desc: "Request cancelled by user" },
  INSUFFICIENT: { code: 1, desc: "The balance is insufficient for the transaction" },
  TIMEOUT: { code: 1037, desc: "DS timeout: user cannot be reached" },
}

/** Random M-Pesa receipt number, e.g. "SLK4V3M2N6" (real ones start with S…). */
function simReceiptNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"
  let out = "S"
  const bytes = randomBytes(9)
  for (let i = 0; i < 9; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/**
 * Build a REAL Daraja STK callback body (as a raw JSON string) for the given
 * simulated outcome, using the persisted MpesaTransaction's identifiers,
 * amount and phone so the pipeline processes exactly what was pushed.
 *
 * Faithful to Daraja: CallbackMetadata (Amount, MpesaReceiptNumber,
 * PhoneNumber, TransactionDate) is present ONLY on ResultCode 0 — failure
 * callbacks carry just ResultCode/ResultDesc.
 */
export async function buildSimulatedStkCallback(
  checkoutRequestId: string,
  outcome: SimulatedOutcome
): Promise<string> {
  const tx = await db.mpesaTransaction.findUnique({ where: { checkoutRequestId } })
  if (!tx) throw new Error(`No MpesaTransaction for CheckoutRequestID ${checkoutRequestId}`)

  const { code, desc } = SIM_RESULT_CODES[outcome]
  const stkCallback: Record<string, unknown> = {
    MerchantRequestID: tx.merchantRequestId,
    CheckoutRequestID: tx.checkoutRequestId,
    ResultCode: code,
    ResultDesc: desc,
  }

  if (code === 0) {
    stkCallback.CallbackMetadata = {
      Item: [
        // Daraja Amount is whole shillings — the engine converts back to
        // minor units (source of truth = what M-Pesa settled).
        { Name: "Amount", Value: Math.max(1, Math.round(tx.amountMinor / 100)) },
        { Name: "MpesaReceiptNumber", Value: simReceiptNumber() },
        // Daraja sends the payer MSISDN without "+".
        { Name: "PhoneNumber", Value: parseInt(toDarajaPhone(tx.phone), 10) },
        { Name: "TransactionDate", Value: parseInt(darajaTimestamp(), 10) },
      ],
    }
  }

  return JSON.stringify({ Body: { stkCallback } })
}
