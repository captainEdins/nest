"use client";

/**
 * S-12b · Listing detail pushed screen (Phase 4, issue #47; shared — the
 * landlord approvals UI in P4-d reaches it through their own listings list).
 *
 * GET /api/listings/[id] — ListingDetailDto: the listing header (status,
 * title, unit · property · rent, description, listed/updated), the lifecycle
 * actions (AGENT: publish / pause / resume / record applicant; LET is closed
 * history with a quiet banner), and the applicant list (newest first) with
 * each row tapping into the application timeline screen.
 *
 * Status transitions: POST /api/listings/[id]/publish|pause (verb sub-paths —
 * the api client is GET/POST only). 409s surface as toast guidance.
 */

import { CheckCircle2, ChevronRight, Loader2, Pause, Play, Plus, Users } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import type { ListingApplicationDto, ListingStatus } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useSession } from "@/hooks/use-overview";
import { useListing, usePauseListing, usePublishListing } from "@/hooks/use-listings";
import { formatPhone, formatDate, timeAgo } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import {
  ApplicationSourceChip,
  ApplicationStatusChip,
  ListingStatusChip,
} from "@/components/nest/shared/listing-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ListingDetailScreen({ listingId }: { listingId: string }) {
  const { t } = useI18n();
  const { data: listing, isPending, error, refetch } = useListing(listingId);

  if (isPending) {
    return <ListingDetailSkeleton />;
  }
  if (error != null || !listing) {
    // 404 = out of scope or gone — retrying cannot fix it, so no button.
    const notFound = error instanceof ApiError && error.code === "NOT_FOUND";
    return <ErrorState onRetry={notFound ? undefined : () => refetch()} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header block */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <ListingStatusChip key={listing.status} status={listing.status} animateEntry />
        </div>
        <h2 className="text-h2 font-semibold break-words">{listing.title}</h2>
        <p className="text-body text-muted-foreground">
          {listing.unitLabel} · {listing.propertyName} ·{" "}
          <span className="tabular-nums font-medium text-foreground">
            {formatKes(listing.rentAmountMinor)}
          </span>{" "}
          {t("agent.perMonth")}
        </p>
        <p className="text-caption text-muted-foreground tabular-nums">
          {t("agent.listedAt", { date: formatDate(listing.createdAt) })} ·{" "}
          {t("agent.updatedAt", { date: formatDate(listing.updatedAt) })}
        </p>
      </div>

      {/* Description */}
      <p className="text-body text-muted-foreground whitespace-pre-wrap break-words">
        {listing.description}
      </p>

      {/* Lifecycle actions — the agent runs the marketing surface */}
      <ListingActions listingId={listing.id} status={listing.status} />

      {/* Applicants — the funnel below the listing */}
      <section aria-label={t("agent.applicantsFor", { unit: listing.unitLabel })}>
        <SectionHeader
          title={t("agent.applicantsFor", { unit: listing.unitLabel })}
          count={listing.applications.length}
          className="mb-3"
        />
        {listing.applications.length === 0 ? (
          <EmptyState icon={Users} title={t("agent.emptyApplicants")} />
        ) : (
          <Card className="divide-y">
            {listing.applications.map((application) => (
              <ApplicantRow key={application.id} application={application} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions — AGENT only (the landlord observes the funnel; their approvals
// surface lives on the application screen, not here — matrix §4.2). The LET
// "closed" banner is read-only history, so the landlord sees it too. DRAFT →
// Publish · PUBLISHED → Pause + Record applicant · PAUSED → Resume · LET.
// ---------------------------------------------------------------------------

function ListingActions({
  listingId,
  status,
}: {
  listingId: string;
  status: ListingStatus;
}) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const role = session?.profile.role;
  const publish = usePublishListing(listingId);
  const pause = usePauseListing(listingId);
  const openRecordApplicant = useUIStore((s) => s.openRecordApplicant);

  if (role !== "AGENT" && role !== "LANDLORD") return null;

  if (status === "LET") {
    return (
      <Card className="bg-muted/40">
        <CardContent className="p-4 flex items-center gap-2.5 text-muted-foreground">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <p className="text-body">{t("agent.letDone")}</p>
        </CardContent>
      </Card>
    );
  }

  if (role !== "AGENT") return null;

  const busy = publish.isPending || pause.isPending;

  return (
    <div className="flex gap-2 flex-wrap">
      {status === "DRAFT" ? (
        <Button
          className="h-11 sm:h-10 flex-1 sm:flex-none"
          disabled={busy}
          aria-busy={publish.isPending}
          onClick={() => publish.mutate({ resumed: false })}
        >
          {publish.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {t("agent.publish")}
        </Button>
      ) : null}

      {status === "PUBLISHED" ? (
        <>
          <Button
            className="h-11 sm:h-10 flex-1 sm:flex-none"
            disabled={busy}
            aria-busy={pause.isPending}
            onClick={() => pause.mutate()}
          >
            {pause.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            <Pause aria-hidden />
            {t("agent.pause")}
          </Button>
          <Button
            className="h-11 sm:h-10 flex-1 sm:flex-none"
            disabled={busy}
            onClick={() => openRecordApplicant(listingId)}
          >
            <Plus aria-hidden />
            {t("agent.recordApplicant")}
          </Button>
        </>
      ) : null}

      {status === "PAUSED" ? (
        <Button
          className="h-11 sm:h-10 flex-1 sm:flex-none"
          disabled={busy}
          aria-busy={publish.isPending}
          onClick={() => publish.mutate({ resumed: true })}
        >
          {publish.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {t("agent.resume")}
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applicant row — shared with the applicants tab (showUnit there)
// ---------------------------------------------------------------------------

export function ApplicantRow({
  application,
  showUnit = false,
}: {
  application: ListingApplicationDto;
  showUnit?: boolean;
}) {
  const { t } = useI18n();
  const openApplication = useUIStore((s) => s.openApplication);

  const meta: string[] = [formatPhone(application.applicantPhone)];
  if (showUnit) {
    meta.unshift(application.unitLabel);
    meta.push(application.propertyName);
  }
  meta.push(timeAgo(application.createdAt, t));

  return (
    <button
      type="button"
      onClick={() => openApplication(application.id)}
      aria-label={`${application.applicantName}. ${application.applicantPhone}`}
      className="w-full text-left p-3.5 sm:p-4 min-h-16 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition active:scale-[0.99] hover:bg-muted/40 active:bg-muted/60"
    >
      <AvatarInitials fullName={application.applicantName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold truncate">{application.applicantName}</p>
        <p className="text-caption text-muted-foreground truncate">{meta.join(" · ")}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <ApplicationStatusChip status={application.status} />
          <ApplicationSourceChip source={application.source} />
        </div>
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

// ---------------------------------------------------------------------------
// Skeleton — reserves the header + description + applicant rows
// ---------------------------------------------------------------------------

function ListingDetailSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 rounded-md" />
        <Skeleton className="h-11 w-40 rounded-md" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Card className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-36 rounded-md" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
