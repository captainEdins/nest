"use client";

/**
 * S-12f · Agent applicants tab (Phase 4, issue #47) — the pipeline across the
 * whole portfolio. GET /api/applications (newest first, delivered order
 * verbatim) behind a 5-segment filter: All · New · Contacted · Viewing ·
 * Decided (APPROVED + REJECTED). Withdrawn rows live under All only.
 */

import * as React from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ListingApplicationDto } from "@/lib/types";
import { useApplications } from "@/hooks/use-listings";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { ApplicantRow } from "@/components/nest/shared/listing-detail-screen";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ApplicantsSegment = "all" | "new" | "contacted" | "viewing" | "decided";

const DECIDED_STATUSES: ReadonlySet<ListingApplicationDto["status"]> = new Set([
  "APPROVED",
  "REJECTED",
]);

function segmentMatches(segment: ApplicantsSegment, application: ListingApplicationDto): boolean {
  switch (segment) {
    case "all":
      return true;
    case "new":
      return application.status === "NEW";
    case "contacted":
      return application.status === "CONTACTED";
    case "viewing":
      return application.status === "VIEWING";
    case "decided":
      return DECIDED_STATUSES.has(application.status);
  }
}

export function AgentApplicantsScreen() {
  const { t } = useI18n();
  const [segment, setSegment] = React.useState<ApplicantsSegment>("all");
  const { data: applications, isPending, error, refetch } = useApplications();

  const counts = React.useMemo(() => {
    const bySegment: Record<ApplicantsSegment, number> = {
      all: 0,
      new: 0,
      contacted: 0,
      viewing: 0,
      decided: 0,
    };
    for (const application of applications ?? []) {
      bySegment.all += 1;
      if (application.status === "NEW") bySegment.new += 1;
      else if (application.status === "CONTACTED") bySegment.contacted += 1;
      else if (application.status === "VIEWING") bySegment.viewing += 1;
      else if (DECIDED_STATUSES.has(application.status)) bySegment.decided += 1;
    }
    return bySegment;
  }, [applications]);

  const options: { value: ApplicantsSegment; label: string; count?: number }[] = [
    { value: "all", label: t("common.filterAll"), count: applications ? counts.all : undefined },
    { value: "new", label: t("applicant.new"), count: applications ? counts.new : undefined },
    {
      value: "contacted",
      label: t("applicant.contacted"),
      count: applications ? counts.contacted : undefined,
    },
    {
      value: "viewing",
      label: t("applicant.viewing"),
      count: applications ? counts.viewing : undefined,
    },
    {
      value: "decided",
      label: t("applicant.decided"),
      count: applications ? counts.decided : undefined,
    },
  ];

  const filtered = React.useMemo(
    () => (applications ?? []).filter((application) => segmentMatches(segment, application)),
    [applications, segment],
  );

  return (
    <section aria-label={t("nav.applicants")} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("nav.applicants")}</h1>
        {applications != null ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {applications.length}
          </span>
        ) : null}
      </div>

      {/* Segmented filter — 5× 44px targets, live counts (the security idiom) */}
      <div
        role="group"
        aria-label={t("nav.applicants")}
        className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-1"
      >
        {options.map((option) => {
          const active = segment === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setSegment(option.value)}
              className="h-11 px-1 rounded-md text-caption font-medium flex flex-col items-center justify-center gap-0.5 focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors"
              style={{ backgroundColor: active ? "var(--card)" : undefined }}
            >
              <span className="truncate max-w-full">{option.label}</span>
              {typeof option.count === "number" ? (
                <span
                  className={cn(
                    "tabular-nums leading-none",
                    active ? "text-foreground font-semibold" : "opacity-70",
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={t("agent.emptyApplicants")} />
      ) : (
        <Card className="divide-y animate-in fade-in duration-300">
          {filtered.map((application) => (
            <ApplicantRow key={application.id} application={application} showUnit />
          ))}
        </Card>
      )}
    </section>
  );
}
