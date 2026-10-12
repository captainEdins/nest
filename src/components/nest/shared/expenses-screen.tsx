"use client";

/**
 * S-41 · Money out screen (Phase 12, issue #82) — the expense ledger + P&L.
 *
 * Landlord (More tab) + caretaker (More tab). Month selector (this month +
 * the previous one). The P&L hero row shows Total money out and — for the
 * CURRENT month — Net (collected − expenses) using the overview's live
 * monthCollectedMinor: the money-IN and money-OUT stories meet on one card.
 *
 * The list is grouped by day (newest first), each row: pastel category chip,
 * note, recorder name, amount (reversal rows show their negative + chip).
 * Reversing is landlord-only, via the store-anchored AlertDialog that states
 * BOTH rows stay on the record — the correction is a new entry, never an
 * edit (append-only, same as payments and deposit movements).
 */

import * as React from "react";
import { Loader2, Receipt, TrendingDown, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useExpenses, useReverseExpense, useSession } from "@/hooks/use-overview";
import { useCaretakerOverview, useLandlordOverview } from "@/hooks/use-overview";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { KpiCard, momDeltaPct } from "@/components/nest/shared/kpi-card";
import { formatDate } from "@/components/nest/shared/format";
import { formatKes } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const NOTE_MIN = 3;

function categoryKey(category: ExpenseCategory): `expenses.category.${ExpenseCategory}` {
  return `expenses.category.${category}`;
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Pastel chip per category — Monty family tints, never pure color blocks. */
const CATEGORY_CHIP: Record<ExpenseCategory, string> = {
  REPAIRS: "bg-attention/10 text-attention border-attention/20",
  WATER: "bg-primary/10 text-primary border-primary/20",
  GARBAGE: "bg-muted text-foreground border-border",
  SECURITY: "bg-primary/10 text-primary border-primary/20",
  SALARY: "bg-muted text-foreground border-border",
  UTILITIES: "bg-primary/10 text-primary border-primary/20",
  OTHER: "bg-muted text-foreground border-border",
};

export function ExpensesScreen() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const role = session?.profile.role;

  const now = new Date();
  const thisMonth = monthKeyOf(now);
  const prevMonth = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const [monthKey, setMonthKey] = React.useState(thisMonth);

  // Fixed hook order: current month (P&L hero) + the SELECTED month (ledger;
  // same key as current when this month is selected — react-query dedupes) +
  // the PREVIOUS month (MoM baseline for the money-out delta).
  const current = useExpenses(thisMonth);
  const selected = useExpenses(monthKey);
  const previous = useExpenses(prevMonth);

  const { data: landlordOverview } = useLandlordOverview();
  const { data: caretakerOverview } = useCaretakerOverview();
  const monthCollectedMinor =
    role === "CARETAKER"
      ? caretakerOverview?.totals.monthCollectedMinor
      : landlordOverview?.totals.monthCollectedMinor;

  const expenses = selected.data?.expenses ?? [];
  const totals = selected.data?.totals;
  const isCurrentMonth = monthKey === thisMonth;
  const netMinor =
    totals && monthCollectedMinor !== undefined ? monthCollectedMinor - totals.totalMinor : null;

  const moneyOutDelta = totals
    ? momDeltaPct(totals.totalMinor, previous.data?.totals.totalMinor ?? 0)
    : null;

  // Reverse flow (landlord) — anchored in the store like every money dialog.
  const reverseExpenseId = useUIStore((s) => s.reverseExpenseId);
  const openReverseExpense = useUIStore((s) => s.openReverseExpense);
  const closeReverseExpense = useUIStore((s) => s.closeReverseExpense);
  const reverseTarget = expenses.find((e) => e.id === reverseExpenseId) ?? null;

  return (
    <section aria-label={t("expenses.title")} className="space-y-4 sm:space-y-6">
      {/* Header + month selector */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="text-h2 font-semibold">{t("expenses.title")}</h1>
        <div
          role="radiogroup"
          aria-label={t("expenses.month")}
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        >
          {[prevMonth, thisMonth].map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={key === monthKey}
              onClick={() => setMonthKey(key)}
              className={cn(
                "h-11 sm:h-9 px-3 rounded-md text-label font-medium tabular-nums",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors",
                key === monthKey
                  ? "bg-card text-primary font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key === thisMonth
                ? t("expenses.thisMonth")
                : new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-KE", {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
            </button>
          ))}
        </div>
      </div>
      <p className="text-caption text-muted-foreground -mt-3 sm:-mt-5">{t("expenses.subtitle")}</p>

      {selected.error != null ? (
        <ErrorState onRetry={() => selected.refetch()} message={t("errors.couldNotLoad")} />
      ) : selected.isPending ? (
        <ExpensesSkeleton />
      ) : (
        <>
          {/* P&L hero row — money-out total (+MoM) and the meeting of the two stories. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KpiCard
              label={t("expenses.totalOut")}
              value={formatKes(totals?.totalMinor ?? 0)}
              icon={TrendingDown}
              tone="amber"
              delta={moneyOutDelta ? { deltaPct: moneyOutDelta } : undefined}
              lastMonthValue={
                previous.data ? `${t("expenses.totalOut")} · ${formatKes(previous.data.totals.totalMinor)}` : undefined
              }
            />
            {isCurrentMonth && netMinor !== null ? (
              <KpiCard
                label={t("expenses.netTitle")}
                value={formatKes(netMinor)}
                icon={Receipt}
                tone={netMinor >= 0 ? "success" : "amber"}
                sub={
                  <span className="tabular-nums">
                    {t("expenses.netFormula")} ·{" "}
                    {netMinor >= 0 ? t("expenses.netPositive") : t("expenses.netNegative")}
                  </span>
                }
              />
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] leading-5 text-muted-foreground">
                    {t("expenses.month")}
                  </p>
                  <p className="text-caption text-muted-foreground mt-1.5">
                    {monthKey === prevMonth
                      ? t("expenses.netFormula")
                      : t("expenses.noExpenses")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Category totals — horizontal chip row (only categories with spend). */}
          {totals && Object.keys(totals.byCategory).length > 0 ? (
            <div className="flex gap-2 flex-wrap" aria-label={t("expenses.category")}>
              {(Object.entries(totals.byCategory) as [ExpenseCategory, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <span
                    key={category}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-medium",
                      CATEGORY_CHIP[category],
                    )}
                  >
                    {t(categoryKey(category))}
                    <span className="tabular-nums font-semibold">{formatKes(amount)}</span>
                  </span>
                ))}
            </div>
          ) : null}

          {/* Ledger — grouped by day, newest first. */}
          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t("expenses.noExpenses")}
              hint={t("expenses.noExpensesHint")}
            />
          ) : (
            <Card className="divide-y">
              {groupedByDay(expenses).map((group) => (
                <div key={group.day}>
                  <p className="px-4 py-2 text-label font-medium text-muted-foreground uppercase tracking-wide bg-muted/40">
                    {formatDate(group.day)}
                  </p>
                  {group.rows.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      canReverse={role === "LANDLORD" && expense.amountMinor > 0 && !expense.reversedById}
                      onReverse={() => openReverseExpense(expense.id)}
                    />
                  ))}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Reverse dialog — landlord-only, note required, both rows stay on record. */}
      <ReverseExpenseDialog target={reverseTarget} onClose={closeReverseExpense} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row + grouping
// ---------------------------------------------------------------------------

interface DayGroup {
  day: string;
  rows: ExpenseDto[];
}

function groupedByDay(expenses: ExpenseDto[]): DayGroup[] {
  const groups = new Map<string, ExpenseDto[]>();
  for (const expense of expenses) {
    const day = expense.occurredAt.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), expense]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, rows]) => ({ day, rows }));
}

function ExpenseRow({
  expense,
  canReverse,
  onReverse,
}: {
  expense: ExpenseDto;
  canReverse: boolean;
  onReverse: () => void;
}) {
  const { t } = useI18n();
  const isReversal = expense.amountMinor < 0;

  return (
    <div className="p-4 min-h-14 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium",
              CATEGORY_CHIP[expense.category],
            )}
          >
            {t(categoryKey(expense.category))}
          </span>
          {isReversal ? (
            <Badge variant="secondary" className="text-caption rounded-full bg-muted">
              {t("expenses.reversalChip")}
            </Badge>
          ) : expense.reversedById ? (
            <Badge
              variant="secondary"
              className="text-caption rounded-full bg-attention/10 text-attention border-transparent"
            >
              {t("expenses.reversedChip")}
            </Badge>
          ) : null}
        </div>
        {expense.note ? (
          <p className="text-body text-foreground/90 truncate mt-1" title={expense.note}>
            {expense.note}
          </p>
        ) : null}
        <p className="text-caption text-muted-foreground mt-0.5 truncate">
          {expense.propertyName} · {t("expenses.recordedBy")} {expense.recordedByName}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p
          className={cn(
            "text-body font-semibold tabular-nums",
            isReversal ? "text-success" : "text-foreground",
          )}
        >
          {formatKes(expense.amountMinor)}
        </p>
        {canReverse ? (
          <Button variant="ghost" size="sm" className="h-9 text-label" onClick={onReverse}>
            <Undo2 className="size-3.5" aria-hidden />
            {t("expenses.reverseAction")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reverse dialog (landlord) — the correction says why, both rows stay visible
// ---------------------------------------------------------------------------

function ReverseExpenseDialog({ target, onClose }: { target: ExpenseDto | null; onClose: () => void }) {
  const { t } = useI18n();
  const reverse = useReverseExpense();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Reset when the dialog closes.
  React.useEffect(() => {
    if (target) return;
    const timer = window.setTimeout(() => {
      setNote("");
      setError(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [target]);

  const noteValid = note.trim().length >= NOTE_MIN;

  function confirm() {
    if (!target || reverse.isPending || !noteValid) return;
    reverse.mutate(
      { id: target.id, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t("expenses.reversedToast"));
          onClose();
        },
        onError: (e) => setError(e instanceof Error ? e.message : t("errors.somethingWrong")),
      },
    );
  }

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-h3">{t("expenses.reverseTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("expenses.reverseDesc")}</AlertDialogDescription>
        </AlertDialogHeader>

        {target ? (
          <p className="text-caption text-foreground font-medium tabular-nums rounded-lg bg-muted p-3">
            {t("expenses.reverseOriginalLine", {
              category: t(categoryKey(target.category)),
              amount: formatKes(target.amountMinor),
              date: formatDate(target.occurredAt),
            })}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="reverse-note" className="text-label">
            {t("expenses.reverseNoteLabel")}
          </Label>
          <Textarea
            id="reverse-note"
            rows={2}
            placeholder={t("expenses.reverseNotePlaceholder")}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "reverse-note-error" : undefined}
            className="text-body"
          />
          {error ? (
            <p id="reverse-note-error" className="text-caption text-destructive" role="alert">
              {error}
            </p>
          ) : note.trim().length > 0 && !noteValid ? (
            <p className="text-caption text-muted-foreground">{t("expenses.reverseShort")}</p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={!noteValid || reverse.isPending}>
            {reverse.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("expenses.reverseAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ExpensesSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-3" aria-hidden="true">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-3" aria-hidden="true">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3 w-44" />
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <Card className="divide-y" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 min-h-14 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-3.5 w-44" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
    </div>
  );
}
