"use client";

/**
 * Shared visitor register row (Phase 3, issue #37 — CONVERGED in P4-e,
 * issue #49). The ONE row both sides of the gate render:
 *
 * - guard register (guard/visitors.tsx) — arms the Mark-exit action;
 * - landlord/caretaker Security screen (security-screen.tsx) — adds the
 *   logging guard's attribution line.
 *
 * Renders: initials avatar, name + purpose chip, unit chip (dash when the
 * visitor had no unit), phone (or an honest "no phone" caption), In→Out
 * times (shared/format formatTime — the single time helper), the live
 * on-site badge until exit is stamped, and "Exited HH:mm" once it is.
 *
 * The gate-register visual primitives (PurposeChip, OnSiteBadge,
 * visitorPurposeLabel) also live here — guard home and the tenant visitors
 * section import them, so purpose tones are identical everywhere.
 */

import { CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { VisitorLogDto, VisitorPurpose } from "@/lib/types";
import { formatPhone, formatTime } from "@/components/nest/shared/format";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Purpose chip tones — token palette only (stone/amber/green), no blue. */
const PURPOSE_CHIP: Record<VisitorPurpose, string> = {
  VISITOR: "border-transparent bg-secondary text-secondary-foreground",
  DELIVERY: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
  CONTRACTOR: "border-primary/40 bg-primary/10 text-primary",
  VIEWING: "border-transparent bg-muted text-muted-foreground",
  OTHER: "border-border bg-transparent text-muted-foreground",
};

/** Localized purpose label ("Visitor", "Delivery", …). */
export function visitorPurposeLabel(
  purpose: VisitorPurpose,
  t: (key: TranslationKey) => string,
): string {
  return t(`guard.visitors.purpose.${purpose}` as TranslationKey);
}

/** Purpose chip — shape + colour, never colour-only. */
export function PurposeChip({
  purpose,
  className,
}: {
  purpose: VisitorPurpose;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-caption font-medium w-fit whitespace-nowrap shrink-0 transition-colors duration-300",
        PURPOSE_CHIP[purpose],
        className,
      )}
    >
      {visitorPurposeLabel(purpose, t)}
    </span>
  );
}

/** On-site badge — green pulse dot + label (guard.visitors.onSite). */
export function OnSiteBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 text-success px-2.5 h-6 text-caption font-medium shrink-0",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden />
      {t("guard.visitors.onSite")}
    </span>
  );
}

/** Unit chip — the unit the visitor is heading to; dash when there is none. */
function UnitLabel({ label }: { label: string | null }) {
  if (label == null) return <span>—</span>;
  return (
    <span className="inline-flex items-center rounded-md border px-1.5 text-caption font-medium text-muted-foreground shrink-0 tabular-nums">
      {label}
    </span>
  );
}

export interface VisitorRowProps {
  visitor: VisitorLogDto;
  /** Guard register: arms the Mark-exit action (POST /api/visitors/[id]/exit). */
  onMarkExit?: (visitor: VisitorLogDto) => void;
  /** Guard register: THIS row's exit POST is in flight (row spinner). */
  exitPending?: boolean;
  /** Guard register: any exit POST in flight (every row's button disables). */
  exitDisabled?: boolean;
  /** Security screen: adds the "Logged by {guard}" attribution line. */
  showGuard?: boolean;
}

/** One register entry — informational by default; the guard side can act. */
export function VisitorRow({
  visitor,
  onMarkExit,
  exitPending,
  exitDisabled,
  showGuard,
}: VisitorRowProps) {
  const { t } = useI18n();
  const exitedAt = visitor.exitedAt;

  return (
    <div className="p-3.5 sm:p-4 min-h-16 flex items-center gap-3 animate-in fade-in duration-300 fill-mode-both">
      <AvatarInitials fullName={visitor.visitorName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-body font-semibold truncate">{visitor.visitorName}</p>
          <PurposeChip purpose={visitor.purpose} />
        </div>
        <p className="text-caption text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap tabular-nums">
          <UnitLabel label={visitor.unitLabel} />
          <span aria-hidden>·</span>
          <span className="truncate max-w-40">
            {visitor.visitorPhone
              ? formatPhone(visitor.visitorPhone)
              : t("guard.visitors.noPhone")}
          </span>
          <span aria-hidden>·</span>
          <span>
            {t("guard.visitors.entry")} {formatTime(visitor.enteredAt)}
          </span>
        </p>
        {showGuard ? (
          <p className="text-caption text-muted-foreground mt-0.5 truncate">
            {t("guard.visitors.by", { guard: visitor.guardName })}
          </p>
        ) : null}
      </div>

      {exitedAt == null ? (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <OnSiteBadge />
          {onMarkExit ? (
            <Button
              variant="ghost"
              className="h-11 px-3 text-label"
              disabled={exitPending || exitDisabled}
              aria-busy={exitPending}
              aria-label={t("guard.visitors.markExit")}
              onClick={() => onMarkExit(visitor)}
            >
              {exitPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("guard.visitors.markExit")}
            </Button>
          ) : null}
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 text-caption text-muted-foreground shrink-0 whitespace-nowrap tabular-nums">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("guard.visitors.exited")} {formatTime(exitedAt)}
        </span>
      )}
    </div>
  );
}
