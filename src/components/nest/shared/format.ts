"use client";

/**
 * NEST — formatting helpers for display strings.
 * Money comes from src/lib/money.ts (formatKes); dates from date-fns.
 */

import { format, parseISO } from "date-fns";

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
