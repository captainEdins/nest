"use client";

/**
 * Phase 26 (issue #121) · Add-unit sheet (landlord) — the structural write
 * behind the property detail's CTA.
 *
 * Every field is one tap where possible: type is a chip grid of the six
 * unit types (the expense-category precedent), label + the two KES amounts
 * are numeric inputs (integer minor units — no floats), deposit PREFILLS
 * to the rent just typed (the Kenyan norm) and stays editable.
 *
 * TRUST: the confirm AlertDialog states the exact label · type · rent ·
 * deposit · property — and that the unit starts VACANT — before commit.
 * POST /api/units is the guard of record; the 409 duplicate-label answer
 * surfaces inline next to the label field (bilingual, keyed off the typed
 * error code — never the raw server string).
 *
 * Field rules: 44px targets, offline-guarded, tabular-nums money.
 */

import * as React from "react";
import { DoorOpen, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useLandlordOverview } from "@/hooks/use-overview";
import { useCreateUnit } from "@/hooks/use-deposits";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { formatKes } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { UNIT_TYPES, type UnitType } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** "2,500" | "2500" | "2 500" → 250_000 (integer minor units). */
function parseKesAmount(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const minor = Number(digits) * 100;
  if (!Number.isInteger(minor) || minor <= 0 || minor > 100_000_000) return null;
  return minor;
}

const LABEL_MAX = 12;

function unitTypeKey(type: UnitType): `unitType.${UnitType}` {
  return `unitType.${type}`;
}

export function AddUnitSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.addUnitOpen);
  const closeAddUnit = useUIStore((s) => s.closeAddUnit);
  const propertyId = useUIStore((s) => s.addUnitPropertyId);
  const createUnit = useCreateUnit();
  const { data: overview } = useLandlordOverview();

  const property = overview?.properties.find((p) => p.id === propertyId) ?? null;

  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<UnitType | null>(null);
  const [rent, setRent] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const labelValid = label.trim().length >= 1 && label.trim().length <= LABEL_MAX;
  const rentMinor = parseKesAmount(rent);
  const depositMinor = deposit.trim() === "" ? null : parseKesAmount(deposit);
  const formValid = property != null && labelValid && type != null && rentMinor !== null;

  // Reset on close (past the slide-out).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setLabel("");
      setType(null);
      setRent("");
      setDeposit("");
      setValidationError(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Deposit defaults to the rent just typed (the Kenyan norm) until the
  // landlord edits it — one less field to key in.
  const effectiveDepositMinor = depositMinor ?? rentMinor ?? 0;

  function confirm() {
    if (createUnit.isPending || !online || !formValid || !type || rentMinor === null || !property) {
      return;
    }
    createUnit.mutate(
      {
        propertyId: property.id,
        label: label.trim(),
        type,
        rentAmountMinor: rentMinor,
        depositAmountMinor: effectiveDepositMinor,
      },
      {
        onSuccess: () => closeAddUnit(),
        onError: (error) => {
          if (error instanceof ApiError && error.code === "CONFLICT") {
            setValidationError(t("property.unitDuplicate", { label: label.trim() }));
            return;
          }
          setValidationError(error instanceof Error ? error.message : t("errors.somethingWrong"));
        },
      },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (next) return; // opens only via the store anchor
        closeAddUnit();
      }}
      title={t("property.addUnit")}
      description={property ? t("property.addUnitSubtitle", { property: property.name }) : undefined}
    >
      <div className="space-y-5">
        {/* Unit label — "A1", "B 2"… */}
        <div className="space-y-2">
          <Label htmlFor="unit-label" className="text-label">
            {t("property.unitLabelLabel")}
          </Label>
          <Input
            id="unit-label"
            autoComplete="off"
            maxLength={LABEL_MAX}
            placeholder={t("property.unitLabelPlaceholder")}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (validationError) setValidationError(null);
            }}
            aria-invalid={validationError != null || (label.length > 0 && !labelValid) ? true : undefined}
            className="h-11 sm:h-10 uppercase"
          />
          <p className="text-caption text-muted-foreground tabular-nums" aria-live="polite">
            {label.trim().length}/{LABEL_MAX}
          </p>
        </div>

        {/* Type chip grid — the expense-category precedent (44px targets). */}
        <div className="space-y-2">
          <p className="text-label font-medium">{t("property.unitTypeLabel")}</p>
          <div role="radiogroup" aria-label={t("property.unitTypeLabel")} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {UNIT_TYPES.map((option) => {
              const selected = type === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(option)}
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
                      selected ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
                    )}
                  >
                    {option.charAt(0)}
                  </span>
                  <span className="min-w-0 truncate">{t(unitTypeKey(option))}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rent + deposit (deposit prefills to rent — the Kenyan norm). */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="unit-rent" className="text-label">
              {t("property.rentLabel")}
            </Label>
            <div className="relative">
              <span
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground font-medium"
              >
                KES
              </span>
              <Input
                id="unit-rent"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("expenses.amountPlaceholder")}
                value={rent}
                onChange={(e) => {
                  setRent(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                aria-invalid={rent.length > 0 && rentMinor === null ? true : undefined}
                className="h-11 sm:h-10 pl-13 tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit-deposit" className="text-label">
              {t("property.depositLabel")}
            </Label>
            <div className="relative">
              <span
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground font-medium"
              >
                KES
              </span>
              <Input
                id="unit-deposit"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("property.depositPlaceholder")}
                value={deposit}
                onChange={(e) => {
                  setDeposit(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                aria-invalid={deposit.length > 0 && depositMinor === null ? true : undefined}
                className="h-11 sm:h-10 pl-13 tabular-nums"
              />
            </div>
            <p className="text-caption text-muted-foreground">{t("property.depositHint")}</p>
          </div>
        </div>

        {/* Validation / offline / duplicate-label (409). */}
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

        {/* Actions — the confirm states the exact unit before commit. */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-10"
            onClick={closeAddUnit}
          >
            {t("common.cancel")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                className="h-11 sm:h-10 px-6"
                disabled={!formValid || createUnit.isPending || !online}
              >
                {createUnit.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {t("property.addUnit")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-h3">{t("property.addUnit")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {formValid && type && rentMinor !== null && property
                    ? t("property.addUnitConfirmBody", {
                        label: label.trim(),
                        type: t(unitTypeKey(type)),
                        rent: formatKes(rentMinor),
                        deposit: formatKes(effectiveDepositMinor),
                        property: property.name,
                      })
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={confirm} disabled={createUnit.isPending}>
                  {createUnit.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <DoorOpen className="size-4" aria-hidden />
                  )}
                  {t("property.addUnitConfirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </ResponsiveModal>
  );
}
