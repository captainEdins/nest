"use client";

/**
 * NEST — statement print sheet (Phase 13, issue #84 part B).
 *
 * The portable document a tenant hands to an employer, a loan officer or a
 * deposit dispute. Rendered ONLY in print media (`hidden print:block`) —
 * the interactive timeline stays the on-screen source of truth, and both
 * views are built from the SAME /api/statements payload, so the export can
 * never disagree with the screen (the kra.ts seam pattern, D-018).
 *
 * Print rules (design-system §print, D-026):
 * - Black text on white; the deep green appears only as the letterhead rule
 *   and accents — cheap on any printer, legible after photocopying.
 * - One page per statement: compact rows, `tabular-nums` everywhere money
 *   appears, `break-inside-avoid` so a month row never splits.
 * - `print-color-adjust: exact` keeps the brand marks; everything else is
 *   plain borders.
 */

import { useI18n } from "@/lib/i18n";
import type { StatementDto, StatementMonthDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { formatDate, formatMonthKey } from "@/components/nest/shared/format";
import { NestLogo } from "@/components/nest/nest-logo";
import { cn } from "@/lib/utils";

/** Billed-line kind label: RENT / WATER / GARBAGE (matches the screen view). */
function lineKindLabel(month: StatementMonthDto): string {
  return month.billedLines
    .map((line) => line.kind.charAt(0) + line.kind.slice(1).toLowerCase())
    .join(" + ");
}

export function StatementPrintSheet({ data }: { data: StatementDto }) {
  const { t } = useI18n();
  const latestMonth = data.months.length > 0 ? data.months[data.months.length - 1] : null;

  return (
    <article
      className="bg-background text-foreground"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-6 pb-3 border-b-2"
        style={{ borderColor: "#0B6B3A" }}
      >
        <div className="flex items-center gap-3">
          <NestLogo className="size-10 shrink-0" />
          <div>
            <p className="text-[18px] font-semibold leading-tight tracking-wide">NEST</p>
            <p className="text-[10px] text-muted-foreground">
              {data.propertyName} · {data.unitLabel}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold uppercase tracking-widest">{t("statement.printTitle")}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {t("statement.printGenerated")}: {formatDate(data.generatedAt)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("statement.printAccountRef")}: <span className="font-mono">{data.accountRef}</span>
          </p>
        </div>
      </header>

      {/* Issued-to block */}
      <section className="grid grid-cols-2 gap-6 mt-4">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
            {t("statement.printIssuedTo")}
          </p>
          <p className="text-[13px] font-semibold">{data.tenantName}</p>
          <p className="text-[11px] text-muted-foreground">{data.tenantPhone}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
            {t("statement.printPeriod")}
          </p>
          <p className="text-[11px] tabular-nums">
            {formatMonthKey(data.startMonth)}
            {latestMonth ? ` — ${formatMonthKey(latestMonth.periodMonth)}` : ""}
          </p>
        </div>
      </section>

      {/* Totals strip */}
      <section className="grid grid-cols-3 gap-3 mt-4">
        {[
          { label: t("statement.summaryBilled"), value: formatKes(data.totalBilledMinor), strong: false },
          { label: t("statement.summarySettled"), value: formatKes(data.totalSettledMinor), strong: false },
          { label: t("statement.summaryBalance"), value: formatKes(data.closingBalanceMinor), strong: true },
        ].map((cell) => (
          <div key={cell.label} className={cn("border rounded-md p-2.5", cell.strong && "border-foreground")}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{cell.label}</p>
            <p className={cn("text-[13px] font-semibold tabular-nums mt-0.5", cell.strong && "text-[15px]")}>
              {cell.value}
            </p>
          </div>
        ))}
      </section>

      {/* Month table — chronological, one row per month */}
      <table className="w-full mt-4 text-[11px] border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground uppercase text-[9px] tracking-widest">
              {t("statement.printMonth")}
            </th>
            <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground uppercase text-[9px] tracking-widest">
              {t("statement.printBilled")}
            </th>
            <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground uppercase text-[9px] tracking-widest">
              {t("statement.printSettled")}
            </th>
            <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground uppercase text-[9px] tracking-widest">
              {t("statement.printReceipts")}
            </th>
            <th className="text-right py-1.5 font-medium text-muted-foreground uppercase text-[9px] tracking-widest">
              {t("statement.printBalance")}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.months.map((month) => (
            <tr key={month.periodMonth} className="border-b break-inside-avoid">
              <td className="py-1.5 pr-2">
                <p className="font-medium">{formatMonthKey(month.periodMonth)}</p>
                <p className="text-[9px] text-muted-foreground">{lineKindLabel(month)}</p>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatKes(month.billedMinor)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatKes(month.settledMinor)}</td>
              <td className="py-1.5 pr-2">
                {month.paymentLines.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="tabular-nums">
                    {month.paymentLines.map((payment) => (
                      <span key={payment.paymentId} className="block text-[9px] leading-snug">
                        {/* paymentId is a number on the wire — stringify before
                         *  slicing (the receiptless fallback, Phase 15 fix). */}
                        {payment.receiptNo ?? `#${String(payment.paymentId).slice(-6)}`} ·{" "}
                        {formatKes(payment.allocatedMinor)}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right tabular-nums font-semibold",
                  month.closingBalanceMinor > 0 && "text-attention",
                  month.closingBalanceMinor <= 0 && "text-success",
                )}
              >
                {formatKes(month.closingBalanceMinor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signature lines */}
      <section className="grid grid-cols-2 gap-10 mt-10">
        {[
          { who: t("statement.printSignTenant") },
          { who: t("statement.printSignManager") },
        ].map((line) => (
          <div key={line.who}>
            <div className="border-t border-foreground" />
            <p className="text-[9px] text-muted-foreground mt-1">
              {line.who} · {t("statement.printSignDate")}: ______________
            </p>
          </div>
        ))}
      </section>

      {/* Footnote */}
      <footer className="mt-6 pt-2 border-t text-[9px] text-muted-foreground leading-relaxed">
        <p>{t("statement.printFootnote")}</p>
        <p className="mt-0.5">{t("statement.printPaybill", { ref: data.accountRef })}</p>
      </footer>
    </article>
  );
}
