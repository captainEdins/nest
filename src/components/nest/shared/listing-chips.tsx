"use client";

/**
 * Funnel visual primitives (Phase 4, issue #47) — the chips every listing and
 * applicant surface shares (agent tabs here; the landlord approvals UI in P4-d
 * reuses the same exports). Token palette only, never color-alone (label
 * always), PUBLISHED carries the guard on-duty-style pulsing dot and NEW
 * pulses amber — the Phase 3 style bar.
 */

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { ApplicationSource, ApplicationStatus, ListingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Listings — DRAFT outline · PUBLISHED green + live dot · PAUSED amber · LET gray
// ---------------------------------------------------------------------------

const LISTING_STATUS_STYLES: Record<ListingStatus, string> = {
  DRAFT: "border-border bg-transparent text-muted-foreground",
  PUBLISHED: "border-success/40 bg-success/10 text-success",
  PAUSED: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
  LET: "border-transparent bg-muted text-muted-foreground",
};

export const LISTING_STATUS_LABEL_KEYS: Record<ListingStatus, TranslationKey> = {
  DRAFT: "listing.draft",
  PUBLISHED: "listing.published",
  PAUSED: "listing.paused",
  LET: "listing.let",
};

export function ListingStatusChip({
  status,
  className,
  animateEntry = false,
}: {
  status: ListingStatus;
  className?: string;
  /** Remount with `key={status}` — replays the zoom so a status change visibly animates. */
  animateEntry?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Badge
      className={cn(
        LISTING_STATUS_STYLES[status],
        "text-caption gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-300",
        animateEntry && "animate-in fade-in zoom-in-50 duration-300",
        className,
      )}
    >
      {status === "PUBLISHED" ? (
        <span aria-hidden className="size-1.5 rounded-full bg-success animate-pulse" />
      ) : null}
      {t(LISTING_STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Applicants — NEW amber + pulse · CONTACTED muted · VIEWING green tint ·
// APPROVED green solid · REJECTED destructive · WITHDRAWN gray outline
// ---------------------------------------------------------------------------

const APPLICATION_STATUS_STYLES: Record<ApplicationStatus, string> = {
  NEW: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
  CONTACTED: "border-border bg-muted text-muted-foreground",
  VIEWING: "border-primary/40 bg-primary/10 dark:bg-primary/15 text-primary",
  APPROVED: "border-transparent bg-success text-success-foreground",
  REJECTED: "border-destructive/50 bg-destructive/10 text-destructive",
  WITHDRAWN: "border-border bg-transparent text-muted-foreground",
};

export const APPLICATION_STATUS_LABEL_KEYS: Record<ApplicationStatus, TranslationKey> = {
  NEW: "applicant.new",
  CONTACTED: "applicant.contacted",
  VIEWING: "applicant.viewing",
  APPROVED: "applicant.approved",
  REJECTED: "applicant.rejected",
  WITHDRAWN: "applicant.withdrawn",
};

export function ApplicationStatusChip({
  status,
  className,
  animateEntry = false,
}: {
  status: ApplicationStatus;
  className?: string;
  /** Remount with `key={status}` — replays the zoom so a status move visibly animates. */
  animateEntry?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Badge
      className={cn(
        APPLICATION_STATUS_STYLES[status],
        "text-caption gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-300",
        animateEntry && "animate-in fade-in zoom-in-50 duration-300",
        className,
      )}
    >
      {status === "NEW" ? (
        <span aria-hidden className="size-1.5 rounded-full bg-attention animate-pulse" />
      ) : null}
      {t(APPLICATION_STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}

/** Amber pulsing "New" badge — a listing's unseen applicants (count included). */
export function NewBadge({ count }: { count?: number }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-caption font-medium whitespace-nowrap shrink-0 transition-colors duration-300",
        "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-attention animate-pulse" />
      {t("applicant.new")}
      {typeof count === "number" ? (
        <span className="tabular-nums font-semibold">{count}</span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lead source — secondary chip (the M-Pesa/Cash source-badge family)
// ---------------------------------------------------------------------------

export const APPLICATION_SOURCE_LABEL_KEYS: Record<ApplicationSource, TranslationKey> = {
  WALK_IN: "source.walkIn",
  PHONE: "source.phone",
  WHATSAPP: "source.whatsapp",
  FACEBOOK: "source.facebook",
  OTHER: "source.other",
};

export function ApplicationSourceChip({
  source,
  className,
}: {
  source: ApplicationSource;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <Badge
      variant="secondary"
      className={cn("text-caption whitespace-nowrap shrink-0", className)}
    >
      {t(APPLICATION_SOURCE_LABEL_KEYS[source])}
    </Badge>
  );
}
