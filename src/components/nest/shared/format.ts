"use client";

/**
 * NEST — formatting helpers for display strings.
 * Money comes from src/lib/money.ts (formatKes); dates from date-fns.
 */

import { format, parseISO } from "date-fns"
import type { TranslationKey } from "@/lib/i18n/en"

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** +254711000001 → "+254 711 000 001" (display only; stored E.164). */
export function formatPhone(e164: string): string {
  const raw = e164.replace(/[^\d+]/g, "")
  if (raw.startsWith("+254") && raw.length === 13) {
    return `+254 ${raw.slice(4, 7)} ${raw.slice(7, 10)} ${raw.slice(10)}`
  }
  return e164
}

/** "2026-02-12T..." → "12 Feb 2026" (design-system §9.6 — never ISO in UI). */
export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy")
  } catch {
    return iso
  }
}

/** ISO → "14:32" time caption. */
export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "HH:mm")
  } catch {
    return ""
  }
}

/** "2026-02" → "Feb 2026" month chip label. */
export function formatMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  if (!y || !m) return monthKey
  return format(new Date(y, m - 1, 1), "MMM yyyy")
}

/** Two initials for the initials-avatar (design-system §7). */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const second = parts.length > 1 ? parts[parts.length - 1]![0]! : ""
  return (first + second).toUpperCase() || "?"
}

/** Normalize a user-entered Kenyan mobile to E.164 (+254…). */
export function normalizeKePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "")
  let local: string
  if (digits.startsWith("254")) local = "0" + digits.slice(3)
  else if (digits.startsWith("0")) local = digits
  else return null
  if (!/^0(7|1)\d{8}$/.test(local)) return null
  return "+254" + local.slice(1)
}

/** Days between a period ("YYYY-MM") due date (5th) and today. */
export function daysSincePeriodDue(period: string, dayOfMonth = 5): number {
  const [y, m] = period.split("-").map(Number)
  if (!y || !m) return 0
  const due = new Date(y, m - 1, dayOfMonth)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((startOfToday.getTime() - due.getTime()) / 86_400_000)
}

/**
 * Loose time-ago caption for lists ("Just now", "5 min ago", "3 h ago");
 * anything older than 24h falls back to the absolute date. Translations are
 * the caller's job (timeAgo.* keys) so the helper stays locale-safe.
 */
export function timeAgo(iso: string, t: Translate, now: Date = new Date()): string {
  try {
    const seconds = Math.max(0, Math.floor((now.getTime() - parseISO(iso).getTime()) / 1000))
    if (seconds < 60) return t("timeAgo.justNow")
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t("timeAgo.minAgo", { count: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t("timeAgo.hourAgo", { count: hours })
  } catch {
    /* fall through to the absolute date */
  }
  return formatDate(iso)
}

/**
 * Phase 11: has the move-out CALENDAR DAY arrived (inclusive)? The notice is
 * a day commitment — compare UTC calendar days, never instants, so a
 * time-of-day component on the stored date can never shift the boundary.
 * This is the client twin of the move-out route's calendarDayUtc gate.
 */
export function calendarDayReached(iso: string, now: Date = new Date()): boolean {
  try {
    const day = parseISO(iso)
    const dayUtc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return dayUtc <= todayUtc
  } catch {
    return false
  }
}
