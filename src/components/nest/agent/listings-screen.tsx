"use client";

/**
 * S-12a · Agent listings tab (Phase 4, issue #47) — the marketing funnel.
 *
 * GET /api/listings (newest-updated first, rendered verbatim) as tap-through
 * cards: status chip (PUBLISHED pulses), title, unit · property · rent,
 * applicant count + the amber NEW badge when applicants wait, listed time-ago.
 * "Create listing" opens the sheet; it is honest-disabled (with a caption)
 * while no vacant unit is free to list — the overview carries that count.
 */

import { Megaphone, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import type { ListingDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useAgentOverview } from "@/hooks/use-overview";
import { useListings } from "@/hooks/use-listings";
import { timeAgo } from "@/components/nest/shared/format";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { ListingStatusChip, NewBadge } from "@/components/nest/shared/listing-chips";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AgentListingsScreen() {
  const { t } = useI18n();
  const setCreateListingOpen = useUIStore((s) => s.setCreateListingOpen);
  const { data: listings, isPending, error, refetch } = useListings();
  // The overview (already cached under ["overview"]) carries the funnel
  // totals — the create CTA's enablement rides on its unlisted count.
  const { data: overview } = useAgentOverview();
  const unlistedCount = overview?.unlistedVacantUnits?.length;

  const createDisabled = unlistedCount != null && unlistedCount === 0;

  return (
    <section aria-label={t("nav.listings")} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("nav.listings")}</h1>
        {listings != null ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {listings.length}
          </span>
        ) : null}
      </div>

      {/* Create listing — the funnel's front door */}
      <div className="space-y-1.5">
        <Button
          className="w-full h-12 text-body-lg"
          disabled={createDisabled}
          aria-disabled={createDisabled}
          onClick={() => setCreateListingOpen(true)}
        >
          <Plus aria-hidden />
          {t("agent.createListing")}
        </Button>
        {createDisabled ? (
          <p className="text-caption text-muted-foreground text-center" role="note">
            {t("agent.noMoreVacant")}
          </p>
        ) : null}
      </div>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <ListSkeleton rows={4} />
      ) : listings == null || listings.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("agent.emptyListings")} />
      ) : (
        <Card className="divide-y animate-in fade-in duration-300">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </Card>
      )}
    </section>
  );
}

function ListingRow({ listing }: { listing: ListingDto }) {
  const { t } = useI18n();
  const openListing = useUIStore((s) => s.openListing);

  return (
    <button
      type="button"
      onClick={() => openListing(listing.id)}
      aria-label={`${listing.title}. ${listing.unitLabel}. ${formatKes(listing.rentAmountMinor)}`}
      className="w-full text-left p-4 min-h-16 flex items-start gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition active:scale-[0.99] hover:bg-muted/40 active:bg-muted/60"
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
          {t("agent.listedAt", { date: timeAgo(listing.createdAt, t) })}
        </p>
      </div>
    </button>
  );
}
