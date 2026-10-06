/**
 * NEST — typed API client (client-side only).
 *
 * - Relative paths only (single-origin SPA behind the gateway).
 * - Returns unwrapped DTOs; throws `ApiError` (typed {error, code}) on failure.
 * - 401 handling: registers a global unauthorized callback so the app shell
 *   can flip the ["auth","me"] query to null (sign-out) via query invalidation.
 * - Dev fixtures: when NEXT_PUBLIC_DEV_FIXTURES === "1" AND the real fetch
 *   fails (network error or 404 — route not implemented yet), the request is
 *   answered from src/lib/fixtures.ts. Real backend responses always win.
 */

import type { ApiError as ApiErrorShape, SessionDto } from "./types"
import { DEV_FIXTURES, fixtureRespond, type MpesaStatusDto, type TenancySummaryDto } from "./fixtures"

export type { MpesaStatusDto, TenancySummaryDto }

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVER"
  | "NETWORK"
  | "OFFLINE"

/** Typed error thrown by every api call. Shape matches the wire ApiError. */
export class ApiError extends Error {
  readonly error: string
  readonly code: ApiErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(error: string, code: ApiErrorCode, status: number, details?: unknown) {
    super(error)
    this.name = "ApiError"
    this.error = error
    this.code = code
    this.status = status
    this.details = details
  }

  get isUnauthorized(): boolean {
    return this.code === "UNAUTHORIZED"
  }
}

function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return "UNAUTHORIZED"
    case 403:
      return "FORBIDDEN"
    case 404:
      return "NOT_FOUND"
    case 409:
      return "CONFLICT"
    case 422:
      return "VALIDATION"
    default:
      return "SERVER"
  }
}

// ---------------------------------------------------------------------------
// 401 → session invalidation hook (set by the app shell)
// ---------------------------------------------------------------------------

let unauthorizedHandler: (() => void) | null = null

/** The app shell registers this to null out the ["auth","me"] query on 401. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

function unwrap<T>(json: unknown): T {
  // Backend contract is ApiOk<T> = { data: T }; stay lenient for raw DTOs.
  if (json && typeof json === "object" && "data" in (json as Record<string, unknown>)) {
    return (json as { data: T }).data
  }
  return json as T
}

async function parseErrorBody(res: Response): Promise<ApiErrorShape | null> {
  try {
    const json = await res.json()
    if (json && typeof json === "object" && "error" in json && "code" in json) {
      return json as ApiErrorShape
    }
    return null
  } catch {
    return null
  }
}

interface RequestOptions {
  /** The session probe itself must not fire the global 401 handler. */
  sessionProbe?: boolean
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    })
  } catch {
    // Network failure (offline / server down) — try fixtures in dev mode.
    if (DEV_FIXTURES) {
      const fx = fixtureRespond(method, path, body)
      if (fx) return respondOrThrow<T>(fx)
    }
    throw new ApiError("Network request failed", "NETWORK", 0)
  }

  if (res.ok) {
    return unwrap<T>(await res.json())
  }

  // Real backend responded with an error — parse the typed body.
  const errBody = await parseErrorBody(res)
  if (res.status === 404) {
    // Route not implemented yet (backend still landing) — fixtures may answer.
    if (DEV_FIXTURES) {
      const fx = fixtureRespond(method, path, body)
      if (fx) return respondOrThrow<T>(fx)
    }
  }
  if (res.status === 401 && !opts.sessionProbe) {
    unauthorizedHandler?.()
  }
  throw new ApiError(
    errBody?.error ?? (res.statusText || "Request failed"),
    (errBody?.code as ApiErrorCode) ?? codeForStatus(res.status),
    res.status,
    errBody?.details,
  )
}

function respondOrThrow<T>(fx: { status: number; data?: unknown; unauthorized?: boolean }): T {
  if (fx.status >= 400) {
    if (fx.unauthorized) unauthorizedHandler?.()
    const msg = (fx.data as ApiErrorShape | undefined)?.error ?? "Request failed"
    throw new ApiError(msg, codeForStatus(fx.status), fx.status)
  }
  return fx.data as T
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Typed GET returning a DTO. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path)
}

/** Typed POST returning a DTO. */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body)
}

/**
 * Session fetch for the auth gate: 401 → null (signed out) instead of a throw,
 * so "no session" is a normal state, not an error. The global unauthorized
 * handler is intentionally NOT fired for this probe — it is the probe itself.
 */
export async function apiGetSession(): Promise<SessionDto | null> {
  try {
    return await request<SessionDto>("GET", "/api/auth/me", undefined, {
      sessionProbe: true,
    })
  } catch (e) {
    if (e instanceof ApiError && e.isUnauthorized) return null
    throw e
  }
}

// ---------------------------------------------------------------------------
// Offline outbox (cash collections queued while offline — D-012)
// ---------------------------------------------------------------------------

export interface OutboxEntry {
  kind: "CASH"
  clientRef: string
  tenancyId: string
  amountMinor: number
  note?: string
  queuedAt: string
}

const OUTBOX_KEY = "nest-outbox"

export function getOutbox(): OutboxEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]") as OutboxEntry[]
  } catch {
    return []
  }
}

export function queueOffline(entry: Omit<OutboxEntry, "queuedAt">): void {
  if (typeof window === "undefined") return
  const items = getOutbox()
  if (items.some((i) => i.clientRef === entry.clientRef)) return
  items.push({ ...entry, queuedAt: new Date().toISOString() })
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable — the collection is lost; the UI already warned */
  }
}

/** Try to sync queued cash collections. Returns the number synced. */
export async function flushOutbox(): Promise<number> {
  const items = getOutbox()
  if (items.length === 0) return 0
  const remaining: OutboxEntry[] = []
  let synced = 0
  for (const item of items) {
    try {
      await apiPost("/api/payments/cash", {
        tenancyId: item.tenancyId,
        amountMinor: item.amountMinor,
        note: item.note,
        clientRef: item.clientRef,
      })
      synced++
    } catch {
      remaining.push(item)
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining))
    } catch {
      /* ignore */
    }
  }
  return synced
}
