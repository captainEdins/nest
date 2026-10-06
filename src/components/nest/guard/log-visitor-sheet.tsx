"use client";

/**
 * S-31a · Log-visitor sheet (Phase 3, issue #36).
 *
 * Bottom sheet (Drawer < sm, Dialog ≥ sm — the pay-flow idiom) for logging a
 * visitor in ≤3 taps: open → type name → submit. Purpose defaults to VISITOR
 * (single-select chip row); phone is optional.
 *
 * POST /api/visitors — the property is derived server-side from the ACTIVE
 * shift, never sent; off-duty submits come back 409 with guidance (the sheet
 * also states it up front when there is no active shift).
 *
 * P3-c FINDING (closed in P4-e): guards had no unit list to pick from —
 * /api/units is LANDLORD/CARETAKER-scoped (403 for guards). The overview
 * now carries `activePropertyUnits` (the ACTIVE shift's property units), so
 * this sheet picks a unit from that — never from /api/units. "No specific
 * unit" (default) keeps the old no-unitId behaviour; a picked unitId is
 * validated server-side against the shift property (P3-b).
 */

import * as React from "react";
import { Loader2, TriangleAlert, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import { VISITOR_PURPOSES, type VisitorPurpose } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useGuardOverview } from "@/hooks/use-overview";
import { useLogVisitor } from "@/hooks/use-guard";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const NAME_MIN = 2;
const NAME_MAX = 80;
/** Same shape the server enforces (P3-a): optional, 9-15 digits, optional leading +. */
const VISITOR_PHONE_RE = /^\+?[0-9\s-]{9,15}$/;

export function LogVisitorSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.logVisitorOpen);
  const setOpen = useUIStore((s) => s.setLogVisitorOpen);
  const { data: overview } = useGuardOverview();
  const logVisitor = useLogVisitor();

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [purpose, setPurpose] = React.useState<VisitorPurpose>("VISITOR");
  const [unitId, setUnitId] = React.useState<string | null>(null);

  // Reset the form when the sheet closes (after the slide-out animation).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setName("");
      setPhone("");
      setPurpose("VISITOR");
      setUnitId(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const trimmedPhone = phone.trim();
  const nameValid = name.trim().length >= NAME_MIN && name.length <= NAME_MAX;
  const phoneValid = trimmedPhone.length === 0 || VISITOR_PHONE_RE.test(trimmedPhone);
  const formValid = nameValid && phoneValid;
  const onDuty = overview?.activeShift != null;
  // The ACTIVE shift's property units (guard-scoped source — P4-e). Off duty
  // ⇒ [] ⇒ the picker is hidden and submits stay unit-less (409 anyway).
  const units = overview?.activePropertyUnits ?? [];

  function submit() {
    if (logVisitor.isPending || !online || !formValid) return;
    logVisitor.mutate(
      {
        visitorName: name.trim(),
        purpose,
        ...(unitId ? { unitId } : {}),
        ...(trimmedPhone ? { visitorPhone: trimmedPhone } : {}),
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t("guard.visitors.logVisitor")}
      description={t("guard.visitors.logVisitorDesc")}
    >
      <div className="space-y-4">
        {/* Off duty — the server rejects writes without an ACTIVE shift. */}
        {overview != null && !onDuty ? (
          <div className="rounded-lg border border-warning/40 bg-warning/15 dark:bg-warning/10 p-3 flex items-start gap-2.5">
            <TriangleAlert className="size-4 text-attention shrink-0 mt-0.5" aria-hidden />
            <p className="text-caption text-attention">{t("guard.visitors.offDutyHint")}</p>
          </div>
        ) : null}

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="visitor-name" className="text-label">
            {t("guard.visitors.nameLabel")}
          </Label>
          <Input
            id="visitor-name"
            autoComplete="off"
            autoFocus
            maxLength={NAME_MAX}
            value={name}
            placeholder={t("guard.visitors.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            className="h-11 sm:h-10"
            aria-invalid={name.length > 0 && !nameValid ? true : undefined}
          />
        </div>

        {/* Phone (optional) */}
        <div className="space-y-2">
          <Label htmlFor="visitor-phone" className="text-label">
            {t("guard.visitors.phoneLabel")}
          </Label>
          <Input
            id="visitor-phone"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            placeholder={t("guard.visitors.phonePlaceholder")}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 sm:h-10"
            aria-invalid={phone.length > 0 && !phoneValid ? true : undefined}
          />
          {phone.length > 0 && !phoneValid ? (
            <p className="text-caption text-destructive" role="alert">
              {t("errors.phoneLooksWrong")}
            </p>
          ) : null}
        </div>

        {/* Purpose — single tap (VISITOR preselected) */}
        <fieldset className="space-y-2">
          <legend className="text-label font-medium">{t("guard.visitors.purpose")}</legend>
          <div
            role="radiogroup"
            aria-label={t("guard.visitors.purpose")}
            className="grid grid-cols-3 gap-2"
          >
            {VISITOR_PURPOSES.map((option) => {
              const selected = purpose === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPurpose(option)}
                  className={cn(
                    "h-11 rounded-lg border text-label font-medium transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-transparent bg-secondary text-secondary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {t(`guard.visitors.purpose.${option}` as TranslationKey)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Unit — optional chip picker from the ACTIVE property (guard-scoped:
            overview.activePropertyUnits, never /api/units). Default = no unit
            (unitId absent — same wire behaviour as before). */}
        {units.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-label font-medium">{t("guard.visitors.visitingUnit")}</legend>
            <div
              role="radiogroup"
              aria-label={t("guard.visitors.visitingUnit")}
              className="space-y-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={unitId == null}
                onClick={() => setUnitId(null)}
                className={cn(
                  "w-full h-11 rounded-lg border text-label font-medium transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  unitId == null
                    ? "border-transparent bg-secondary text-secondary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {t("guard.visitors.noUnit")}
              </button>
              <div className="grid grid-cols-3 gap-2">
                {units.map((unit) => {
                  const selected = unitId === unit.id;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setUnitId(unit.id)}
                      className={cn(
                        "h-11 rounded-lg border text-label font-medium transition-colors outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-transparent bg-secondary text-secondary-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <span className="tabular-nums">{unit.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        ) : null}

        {/* Submit */}
        <div className="space-y-1.5">
          <Button
            className="w-full h-11 sm:h-10"
            disabled={logVisitor.isPending || !online || !formValid}
            aria-busy={logVisitor.isPending}
            onClick={submit}
          >
            {logVisitor.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <UserPlus aria-hidden />
            )}
            {logVisitor.isPending ? t("guard.visitors.logging") : t("guard.visitors.logVisitor")}
          </Button>
          {!online ? (
            <p className="text-caption text-muted-foreground text-center">
              {t("errors.needOnline")}
            </p>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  );
}
