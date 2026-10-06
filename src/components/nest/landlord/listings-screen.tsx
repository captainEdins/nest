"use client";

/**
 * S-13 · Landlord listings screen (Phase 4, issue #48 — More tab). The
 * landlord observes the vacancy funnel while the agent runs it (matrix
 * §4.2): NO create / publish / pause affordances here — read-only listing
 * rows that tap into the shared ListingDetailScreen (agent CTAs hidden by
 * role), plus the Applicants segment: the landlord's decision queue. Rows
 * arrive newest-first (listings: newest-updated; applications: newest
 * created) in the delivered order, verbatim; undecided rows carry the
 * amber attention pulse, decided rows show the decidedBy line muted.
 * Approve / Reject themselves live on the shared application timeline
 * screen (AlertDialog + optional note), never inline here.
 */

import * as React from "react";
import { CheckCircle2, ChevronRight, Megaphone, Users, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import type { ListingApplicationDto, ListingDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useApplications, useListings } from "@/hooks/use-listings";
import { formatDate, formatPhone, timeAgo } from "@/components/nest/shared/format";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import {
  ApplicationSourceChip,
  ApplicationStatusChip,
  ListingStatusChip,
  NewBadge,
} from "@/components/nest/shared/listing-chips";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ListingsSegment = "listings" | "applicants";

/** Live pipeline statuses — an undecided, unwithdrawn applicant. */
const LIVE_APPLICATION_STATUSES: ReadonlySet<ListingApplicationDto["status"]> = new Set([
  "NEW",
  "CONTACTED",
  "VIEWING",
]);

export function LandlordListingsScreen() {
  const { t } = useI18n();
  const segment = useUIStore((s) => s.listingsSegment);
  const setSegment = useUIStore((s) => s.setListingsSegment);
  const listingsQuery = useListings();
  const applicationsQuery = useApplications();

  const pendingCount = React.useMemo(
    () => (applicationsQuery.data ?? []).filter((a) => LIVE_APPLICATION_STATUSES.has(a.status)).length,
    [applicationsQuery.data],
  );

  const options: { value: ListingsSegment; label: string; count?: number; amber?: boolean }[] = [
    {
      value: "listings",
      label: t("nav.listings"),
      count: listingsQuery.data != null ? listingsQuery.data.length : undefined,
    },
    {
      value: "applicants",
      label: t("nav.applicants"),
      count: applicationsQuery.data != null ? applicationsQuery.data.length : undefined,
      amber: pendingCount > 0,
    },
  ];

  return (
    <section aria-label={t("nav.listings")} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("nav.listings")}</h1>
        {listingsQuery.data != null ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {listingsQuery.data.length}
          </span>
        ) : null}
      </div>

      {/* Segmented control — 2× 44px targets, live counts (the security idiom);
          the Applicants count turns amber while decisions pend. */}
      <div
        role="group"
        aria-label={t("nav.listings")}
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {options.map((option) => {
          const active = segment === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setSegment(option.value)}
              className="h-11 px-1 rounded-md text-label font-medium flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors"
              style={{ backgroundColor: active ? "var(--card)" : undefined }}
            >
              <span className="truncate">{option.label}</span>
              {typeof option.count === "number" ? (
                <span
                  className={cn(
                    "text-caption tabular-nums shrink-0",
                    option.amber ? "text-attention font-semibold" : "opacity-70",
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {segment === "listings" ? (
        <ListingsSegment query={listingsQuery} />
      ) : (
        <ApplicantsSegment query={applicationsQuery} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Listings — read-only funnel rows (the agent runs the lifecycle, §4.2)
// ---------------------------------------------------------------------------

function ListingsSegment({ query }: { query: ReturnType<typeof useListings> }) {
  const { t } = useI18n();

  if (query.error != null) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }
  if (query.isPending) {
    return <ListSkeleton rows={3} />;
  }
  const listings = query.data ?? [];
  if (listings.length === 0) {
    return <EmptyState icon={Megaphone} title={t("landlord.emptyListings")} />;
  }

  return (
    <Card className="divide-y animate-in fade-in duration-300">
      {listings.map((listing) => (
        <LandlordListingRow key={listing.id} listing={listing} />
      ))}
    </Card>
  );
}

function LandlordListingRow({ listing }: { listing: ListingDto }) {
  const { t } = useI18n();
  const openListing = useUIStore((s) => s.openListing);

  return (
    <button
      type="button"
      onClick={() => openListing(listing.id)}
      aria-label={`${listing.title}. ${listing.unitLabel}. ${formatKes(listing.rentAmountMinor)}`}
      className="w-full text-left p-4 min-h-16 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition active:scale-[0.99] hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ListingStatusChip status={listing.status} />
          {listing.newApplicationCount > 0 ? (
            <NewBadge count={listing.newApplicationCount} />
          ) : null}
        </div>
        <p className="text-body font-semibold truncate mt-1.5">{listing.title}</p>
        <p className="text-caption text-muted-foreground mt-0.5 truncate">
          {listing.unitLabel} · {listing.propertyName} ·{" "}
          <span className="tabular-nums">{formatKes(listing.rentAmountMinor)}</span>
        </p>
        <p className="text-caption text-muted-foreground tabular-nums mt-1">
          {t("applicant.count", { count: listing.applicationCount })} ·{" "}
          {t("agent.updatedAt", { date: timeAgo(listing.updatedAt, t) })}
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Applicants — the landlord's review queue (all statuses, newest first)
// ---------------------------------------------------------------------------

function ApplicantsSegment({ query }: { query: ReturnType<typeof useApplications> }) {
  const { t } = useI18n();

  if (query.error != null) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }
  if (query.isPending) {
    return <ListSkeleton rows={4} />;
  }
  const applications = query.data ?? [];
  if (applications.length === 0) {
    return <EmptyState icon={Users} title={t("agent.emptyApplicants")} />;
  }

  return (
    <Card className="divide-y animate-in fade-in duration-300">
      {applications.map((application) => (
        <LandlordApplicantRow key={application.id} application={application} />
      ))}
    </Card>
  );
}

function LandlordApplicantRow({ application }: { application: ListingApplicationDto }) {
  const { t } = useI18n();
  const openApplication = useUIStore((s) => s.openApplication);

  const live = LIVE_APPLICATION_STATUSES.has(application.status);
  const approved = application.status === "APPROVED";
  const decided = approved || application.status === "REJECTED";

  const meta: string[] = [formatPhone(application.applicantPhone)];
  meta.unshift(application.unitLabel);
  meta.push(application.propertyName);
  meta.push(timeAgo(application.createdAt, t));

  return (
    <button
      type="button"
      onClick={() => openApplication(application.id)}
      aria-label={`${application.applicantName}. ${application.applicantPhone}`}
      className={cn(
        "w-full text-left p-3.5 sm:p-4 min-h-16 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition active:scale-[0.99] hover:bg-muted/40 active:bg-muted/60",
        decided && "opacity-80",
      )}
    >
      <AvatarInitials fullName={application.applicantName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold truncate">{application.applicantName}</p>
        <p className="text-caption text-muted-foreground truncate">{meta.join(" · ")}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <ApplicationStatusChip status={application.status} />
          <ApplicationSourceChip source={application.source} />
        </div>
        {live ? (
          <p className="text-caption font-medium text-attention flex items-center gap-1.5 mt-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-attention animate-pulse shrink-0" />
            {t("landlord.awaitingDecision")}
          </p>
        ) : null}
        {decided && application.decidedByName ? (
          <p
            className={cn(
              "text-caption font-medium flex items-center gap-1.5 mt-1.5 tabular-nums",
              approved ? "text-success" : "text-destructive",
            )}
          >
            {approved ? (
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <XCircle className="size-3.5 shrink-0" aria-hidden />
            )}
            {t("agent.decidedBy", {
              name: application.decidedByName,
              date: application.decidedAt ? formatDate(application.decidedAt) : "—",
            })}
          </p>
        ) : null}
        {application.note ? (
          <p className="text-body text-muted-foreground italic border-l-2 border-border pl-3 break-words mt-1.5 line-clamp-2">
            {application.note}
          </p>
        ) : null}
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden />
    </button>
  );
}
