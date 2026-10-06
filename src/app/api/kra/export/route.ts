/**
 * NEST — GET /api/kra/export  (Phase 5 wedge B, issue #59)
 *
 * The landlord's MRI year export: a plain-ASCII, LF-terminated CSV of the
 * SAME rows /api/kra/summary serves (built via getKraYearSummary, so the
 * screen and the file can never disagree). Intended for the landlord's own
 * records or to accompany a KRA Monthly Rental Income filing —
 * record-keeping assistance only, NEVER tax advice.
 *
 * Query: ?year= — 4-digit integer (e.g. 2025–2027); anything else is a 400
 * VALIDATION; absent → current year.
 *
 * LANDLORD only via requireRole. Role/auth failures short-circuit into the
 * standard ApiError JSON (401/403/400) — a CSV is NEVER sent on failure, so
 * a misconfigured downloader cannot mistake an error page for records.
 *
 * CSV shape (money as WHOLE SHILLINGS — NEST data is whole-shilling by
 * design, so the minor→shilling conversion is integer division by 100,
 * truncating; the estimate column carries the same 7.5% rounded formula
 * per row):
 *   Month,Gross rent billed (KES),Gross rent collected (KES),MRI estimate at 7.5% (KES)
 *   January,…,…,…
 *   … 12 calendar rows, full month names, zeros included …
 *   TOTAL,<year billed>,<year collected>,<year estimate>
 */

import { NextResponse } from "next/server"
import { getKraYearSummary, mriEstimateOf, parseYear } from "@/lib/kra"
import { handleRouteError, requireRole } from "@/lib/auth-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Full month names for the CSV rows (1-based month index). */
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

export async function GET(request: Request) {
  try {
    const profile = await requireRole("LANDLORD")
    const year = parseYear(request)
    const summary = await getKraYearSummary(profile, year)

    // Whole shillings: integer division by 100. NEST money is whole-shilling
    // by design (seed + every write path), so this truncates a non-existent
    // fractional part rather than ever rounding real money.
    const shillings = (minor: number): number => Math.trunc(minor / 100)

    const lines: string[] = [
      "Month,Gross rent billed (KES),Gross rent collected (KES),MRI estimate at 7.5% (KES)",
    ]
    for (const row of summary.months) {
      // Per-month estimate: the same 7.5% rounded formula applied to THAT
      // month's collected rent (mriEstimateOf), then whole shillings — so a
      // landlord filing month-by-month sees exactly what each month's return
      // would be estimated at.
      lines.push(
        [
          FULL_MONTHS[row.month - 1],
          shillings(row.billedMinor),
          shillings(row.collectedMinor),
          shillings(mriEstimateOf(row.collectedMinor)),
        ].join(","),
      )
    }
    // Year total row. The estimate cell is the year-level MRI estimate
    // (summary.mriEstimateMinor — 7.5% of the year's collected rent), which
    // the summary API also reports; with whole-shilling data it equals the
    // sum of the monthly estimate cells.
    lines.push(
      [
        "TOTAL",
        shillings(summary.totals.billedMinor),
        shillings(summary.totals.collectedMinor),
        shillings(summary.mriEstimateMinor),
      ].join(","),
    )

    // LF line endings, trailing newline, no BOM — plain ASCII bytes.
    const csv = `${lines.join("\n")}\n`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nest-mri-${year}.csv"`,
        // Compliance export: never let a shared browser cache serve it.
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
