"use client";

/**
 * Shared visitor register row (Phase 3, issue #37) — the register entry the
 * landlord/caretaker security screen renders: initials avatar, name, purpose
 * chip, unit label (or dash), in/out times and the live on-site badge.
 *
 * NOTE (file-set separation): the guard's own register screen (P3-c) builds
 * its own row with exit actions — the small duplication is deliberate and
 * documented in the worklog; convergence candidate for a later sweep.
 */

import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { VisitorLogDto, VisitorPurpose } from "@/lib/types";
import { formatTime } from "@/components/nest/shared/format";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
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
export function PurposeChip({ purpose }: { purpose: VisitorPurpose }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-caption font-medium shrink-0 transition-colors duration-300",
        PURPOSE_CHIP[purpose],
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

/** One register entry — informational (no actions on this side of the gate). */
export function VisitorRow({ visitor }: { visitor: VisitorLogDto }) {
  const { t } = useI18n();
  const exitedAt = visitor.exitedAt;

  return (
    <div className="p-4 min-h-16 flex items-center gap-3 animate-in fade-in duration-300 fill-mode-both">
      <AvatarInitials fullName={visitor.visitorName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-body font-semibold truncate">{visitor.visitorName}</p>
          <PurposeChip purpose={visitor.purpose} />
        </div>
        <p className="text-caption text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap tabular-nums">
          <span className="truncate max-w-32">{visitor.unitLabel ?? "—"}</span>
          <span aria-hidden>·</span>
          <span>
            {t("guard.visitors.entry")} {formatTime(visitor.enteredAt)}
          </span>
          {exitedAt != null ? (
            <>
              <span aria-hidden>→</span>
              <span>
                {t("guard.visitors.exit")} {formatTime(exitedAt)}
              </span>
            </>
          ) : null}
        </p>
      </div>
      {exitedAt == null ? <OnSiteBadge /> : null}
    </div>
  );
}
