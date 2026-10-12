"use client";

/**
 * S-42 · Record-expense sheet (Phase 12, issue #82) — money-out at the
 * point of spend.
 *
 * The caretaker keys in what left the plot (repairs, water, salary…);
 * the landlord records owner-side spend. Every field is one tap where
 * possible: category is a chip grid (Monty pastel tiles), the amount is
 * a numeric KES input, the date defaults to today, the note is optional.
 *
 * TRUST: the confirm AlertDialog states the exact amount + category +
 * date before commit, and — for the caretaker — that the landlord will
 * be notified (the money story is shared, not whispered). POST /api/expenses
 * is the guard of record; its zod messages surface inline.
 *
 * Field-worker rules: 44px targets, offline-guarded, no floats (integer
 * minor units via the shared KES amount parse).
 */

import * as React from "react";
import { Loader2, Receipt, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import {
  useCaretakerOverview,
  useCreateExpense,
  useLandlordOverview,
  useSession,
} from "@/hooks/use-overview";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { formatKes } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const NOTE_MAX = 140;

/** Pastel tile per category (design-system §7 pastel families). */
const CATEGORY_STYLE: Record<ExpenseCategory, string> = {
  REPAIRS: "bg-attention/10 text-attention",
  WATER: "bg-primary/10 text-primary",
  GARBAGE: "bg-muted text-foreground",
  SECURITY: "bg-primary/10 text-primary",
  SALARY: "bg-muted text-foreground",
  UTILITIES: "bg-primary/10 text-primary",
  OTHER: "bg-muted text-foreground",
};

const CATEGORY_ICON: Record<ExpenseCategory, string> = {
  REPAIRS: "W",
  WATER: "A",
  GARBAGE: "T",
  SECURITY: "U",
  SALARY: "M",
  UTILITIES: "H",
  OTHER: "N",
};

function categoryKey(category: ExpenseCategory): `expenses.category.${ExpenseCategory}` {
  return `expenses.category.${category}`;
}

/** "2,500" | "2500" | "2 500" → 250_000 (integer minor units). */
function parseKesAmount(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const minor = Number(digits) * 100;
  if (!Number.isInteger(minor) || minor <= 0 || minor > 100_000_000) return null;
  return minor;
}

export function RecordExpenseSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.recordExpenseOpen);
  const setRecordExpenseOpen = useUIStore((s) => s.setRecordExpenseOpen);
  const createExpense = useCreateExpense();
  const { data: session } = useSession();

  const role = session?.profile.role;
  const { data: caretakerOverview } = useCaretakerOverview();
  const { data: landlordOverview } = useLandlordOverview();

  // The property of record: caretaker has exactly one; landlord picks.
  const properties = React.useMemo(() => {
    if (role === "CARETAKER") return caretakerOverview ? [caretakerOverview.property] : [];
    if (role === "LANDLORD") return landlordOverview?.properties ?? [];
    return [];
  }, [role, caretakerOverview, landlordOverview]);

  const [propertyId, setPropertyId] = React.useState<string>("");
  const [category, setCategory] = React.useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = React.useState("");
  const [occurredAt, setOccurredAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Reset on close (past the slide-out) + prefill the property when the
  // overview arrives (single-property roles skip the picker entirely).
  React.useEffect(() => {
    if (open) {
      if (!propertyId && properties.length === 1) setPropertyId(properties[0]!.id);
      return;
    }
    const timer = window.setTimeout(() => {
      setPropertyId("");
      setCategory(null);
      setAmount("");
      setOccurredAt(new Date().toISOString().slice(0, 10));
      setNote("");
      setValidationError(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open, properties, propertyId]);

  const amountMinor = parseKesAmount(amount);
  const noteValid = note.trim().length <= NOTE_MAX;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(occurredAt) && occurredAt <= today;
  const formValid = propertyId !== "" && category !== null && amountMinor !== null && dateValid && noteValid;

  const selectedProperty = properties.find((p) => p.id === propertyId);

  function confirm() {
    if (createExpense.isPending || !online || !formValid || !category || amountMinor === null) return;
    createExpense.mutate(
      {
        propertyId,
        category,
        amountMinor,
        occurredAt,
        note: note.trim() ? note.trim() : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("expenses.recordedToast"));
          setRecordExpenseOpen(false);
        },
        onError: (error) => {
          setValidationError(error instanceof Error ? error.message : t("errors.somethingWrong"));
        },
      },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setRecordExpenseOpen}
      title={t("expenses.record")}
      description={t("expenses.subtitle")}
    >
      <div className="space-y-5">
          {/* Property (landlord with >1 property picks; single-property roles skip) */}
          {properties.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="expense-property" className="text-label">
                {t("expenses.propertyLabel")}
              </Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger id="expense-property" className="h-11 sm:h-10 w-full">
                  <SelectValue placeholder={t("expenses.propertyLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Category chip grid — Monty pastel icon tiles (44px targets). */}
          <div className="space-y-2">
            <p className="text-label font-medium">{t("expenses.category")}</p>
            <div role="radiogroup" aria-label={t("expenses.category")} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((option) => {
                const selected = category === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCategory(option)}
                    className={cn(
                      "h-11 px-3 rounded-xl flex items-center gap-2.5 text-left text-label font-medium",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all",
                      selected
                        ? "border border-primary/40 bg-primary/10 text-primary shadow-xs"
                        : "border border-border hover:bg-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-7 shrink-0 rounded-lg grid place-items-center text-caption font-bold",
                        selected ? "bg-primary/15 text-primary" : CATEGORY_STYLE[option],
                      )}
                    >
                      {CATEGORY_ICON[option]}
                    </span>
                    <span className="min-w-0 truncate">{t(categoryKey(option))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount + date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="expense-amount" className="text-label">
                {t("expenses.amountLabel")}
              </Label>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground font-medium"
                >
                  KES
                </span>
                <Input
                  id="expense-amount"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t("expenses.amountPlaceholder")}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  aria-invalid={validationError ? true : undefined}
                  className="h-11 sm:h-10 pl-13 tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date" className="text-label">
                {t("expenses.dateLabel")}
              </Label>
              <Input
                id="expense-date"
                type="date"
                max={today}
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="h-11 sm:h-10"
              />
            </div>
          </div>

          {/* Note (optional, ≤140) */}
          <div className="space-y-2">
            <Label htmlFor="expense-note" className="text-label">
              {t("expenses.noteLabel")}
            </Label>
            <Textarea
              id="expense-note"
              rows={2}
              maxLength={NOTE_MAX}
              placeholder={t("expenses.notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-body"
            />
            <p className="text-caption text-muted-foreground tabular-nums" aria-live="polite">
              {note.length}/{NOTE_MAX}
            </p>
          </div>

          {/* Validation / offline */}
          {validationError ? (
            <p className="text-caption text-destructive flex items-start gap-2" role="alert">
              <TriangleAlert className="size-4 shrink-0 mt-px" aria-hidden />
              {validationError}
            </p>
          ) : !online ? (
            <p className="text-caption text-attention flex items-start gap-2" role="status">
              <TriangleAlert className="size-4 shrink-0 mt-px" aria-hidden />
              {t("expenses.needOnline")}
            </p>
          ) : null}

          {/* Actions — the confirm states the exact money before commit. */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-10"
              onClick={() => setRecordExpenseOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  className="h-11 sm:h-10 px-6"
                  disabled={!formValid || createExpense.isPending || !online}
                >
                  {createExpense.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Receipt className="size-4" aria-hidden />
                  )}
                  {t("expenses.record")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-h3">{t("expenses.record")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {formValid && category && amountMinor !== null && selectedProperty
                      ? `${t(categoryKey(category))} · ${formatKes(amountMinor)} · ${occurredAt} · ${selectedProperty.name}${
                          role === "CARETAKER" ? `. ${t("expenses.subtitle")}` : ""
                        }`
                      : ""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={confirm} disabled={createExpense.isPending}>
                    {createExpense.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    {t("expenses.record")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
    </ResponsiveModal>
  );
}
