"use client";

/**
 * S-12c · Application detail pushed screen (Phase 4, issue #47; shared — P4-d's
 * landlord approvals UI reaches it from their listings). The trust centrepiece:
 * the append-only event timeline (oldest first, delivered order verbatim) that
 * every status change appends to server-side.
 *
 * GET /api/applications/[id] — ListingApplicationDto. Actions are role-fenced
 * (server-enforced; the UI mirrors it): AGENT runs the pipeline
 * (Contacted / Viewing / Withdraw quick actions) and never decides; LANDLORD
 * decides (Approve / Reject behind an AlertDialog with an optional note) and
 * never staffs the pipeline. Decided or withdrawn applications are read-only.
 */

import * as React from "react";
import { Check, CheckCircle2, Loader2, Phone, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ApplicationEventDto, ApplicationStatus, ListingApplicationDto } from "@/lib/types";
import { useSession } from "@/hooks/use-overview";
import { useApplication, useApplicationStatus } from "@/hooks/use-listings";
import { formatDate, formatPhone, timeAgo } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { ErrorState } from "@/components/nest/shared/error-state";
import {
  APPLICATION_STATUS_LABEL_KEYS,
  ApplicationSourceChip,
  ApplicationStatusChip,
} from "@/components/nest/shared/listing-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

/** Live pipeline statuses — an undecided, unwithdrawn applicant. */
const LIVE_STATUSES: readonly ApplicationStatus[] = ["NEW", "CONTACTED", "VIEWING"];

export function ApplicationDetailScreen({ applicationId }: { applicationId: string }) {
  const { t } = useI18n();
  const { data: application, isPending, error, refetch } = useApplication(applicationId);

  if (isPending) {
    return <ApplicationDetailSkeleton />;
  }
  if (error != null || !application) {
    // 404 = out of scope or gone — retrying cannot fix it, so no button.
    const notFound = error instanceof ApiError && error.code === "NOT_FOUND";
    return <ErrorState onRetry={notFound ? undefined : () => refetch()} />;
  }

  const approved = application.status === "APPROVED";
  const decided = approved || application.status === "REJECTED";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Applicant header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <ApplicationStatusChip
            key={application.status}
            status={application.status}
            animateEntry
            className="text-label px-2.5 py-1"
          />
          <ApplicationSourceChip source={application.source} />
        </div>
        <h2 className="text-h2 font-semibold break-words">{application.applicantName}</h2>
        <a
          href={`tel:${application.applicantPhone}`}
          className="text-body font-medium text-primary underline-offset-2 hover:underline tabular-nums w-fit"
        >
          {formatPhone(application.applicantPhone)}
        </a>
        <p className="text-body text-muted-foreground">
          {application.unitLabel} · {application.propertyName}
        </p>
        <p className="text-caption text-muted-foreground tabular-nums">
          {t("agent.recordedBy", { name: application.handledByName })} ·{" "}
          {formatDate(application.createdAt)}
        </p>
        {decided && application.decidedByName ? (
          <p
            className={cn(
              "text-caption font-medium flex items-center gap-1.5 tabular-nums",
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
      </div>

      {/* First note — the intake quote */}
      {application.note ? (
        <p className="text-body text-muted-foreground italic border-l-2 border-border pl-3 break-words">
          {application.note}
        </p>
      ) : null}

      {/* Timeline — the append-only trust record (oldest first) */}
      <section aria-label={t("agent.timeline")}>
        <SectionHeader title={t("agent.timeline")} count={application.events.length} className="mb-3" />
        <Card>
          <CardContent className="p-4 sm:p-6">
            <ol className="relative">
              <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-0.5 rounded bg-border" />
              {application.events.map((event) => (
                <TimelineEvent key={event.id} event={event} />
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <ApplicationActions application={application} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline — left rail + dots colored by toStatus; notes as sub-line quotes
// ---------------------------------------------------------------------------

const TIMELINE_DOT_TONES: Record<ApplicationStatus, string> = {
  NEW: "bg-muted-foreground",
  CONTACTED: "bg-attention",
  VIEWING: "bg-primary",
  APPROVED: "bg-success",
  REJECTED: "bg-destructive",
  WITHDRAWN: "bg-muted-foreground/50",
};

const TIMELINE_PILL_TONES: Record<ApplicationStatus, string> = {
  NEW: "border-border bg-muted text-muted-foreground",
  CONTACTED: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
  VIEWING: "border-primary/40 bg-primary/10 dark:bg-primary/15 text-primary",
  APPROVED: "border-success/40 bg-success/10 text-success",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  WITHDRAWN: "border-border bg-muted text-muted-foreground",
};

function TimelineEvent({ event }: { event: ApplicationEventDto }) {
  const { t } = useI18n();
  return (
    <li className="relative pl-6 pb-5 last:pb-0">
      {event.toStatus === "APPROVED" ? (
        // Green filled + check — the decision dot.
        <span
          aria-hidden
          className="absolute left-0 top-1 size-3 rounded-full bg-success ring-4 ring-card flex items-center justify-center"
        >
          <Check className="size-2 text-success-foreground" strokeWidth={3} aria-hidden />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1 size-3 rounded-full ring-4 ring-card transition-colors duration-300",
            TIMELINE_DOT_TONES[event.toStatus],
          )}
        />
      )}
      <p className="text-label font-medium flex items-baseline gap-2 flex-wrap min-w-0">
        <span className="truncate">{event.actorName}</span>
        <span className="text-caption text-muted-foreground font-normal tabular-nums shrink-0">
          {timeAgo(event.createdAt, t)}
        </span>
      </p>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 h-6 text-caption font-medium mt-1 transition-colors duration-300",
          TIMELINE_PILL_TONES[event.toStatus],
        )}
      >
        {t(APPLICATION_STATUS_LABEL_KEYS[event.toStatus])}
      </span>
      {event.note ? (
        <p className="text-body text-muted-foreground italic border-l-2 border-border pl-3 break-words mt-1">
          {event.note}
        </p>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Actions — role-fenced, state-driven. Live statuses only; decided/withdrawn
// rows render nothing (the server 409s are the backstop, never the UI's job).
// ---------------------------------------------------------------------------

function ApplicationActions({ application }: { application: ListingApplicationDto }) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const role = session?.profile.role;
  const statusMutation = useApplicationStatus(application.id);

  const live = LIVE_STATUSES.includes(application.status);
  if (!live) return null;
  if (role !== "AGENT" && role !== "LANDLORD") return null;

  const busy = statusMutation.isPending;
  const pendingTarget = statusMutation.variables?.status;

  if (role === "AGENT") {
    // The pipeline is the agent's: Contacted → Viewing → (landlord decides).
    const agentTargets: { status: ApplicationStatus; label: string; variant: "secondary" | "outline" }[] = [
      { status: "CONTACTED", label: t("applicant.contacted"), variant: "secondary" },
      { status: "VIEWING", label: t("applicant.markViewing"), variant: "secondary" },
      { status: "WITHDRAWN", label: t("applicant.withdraw"), variant: "outline" },
    ];
    return (
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <p className="text-label font-medium text-muted-foreground">{t("applicant.moveTo")}</p>
          <div className="flex gap-2 flex-wrap">
            {agentTargets.map((target) => {
              const isCurrent = application.status === target.status;
              const isBusy = busy && pendingTarget === target.status;
              return (
                <Button
                  key={target.status}
                  variant={target.variant}
                  className={cn(
                    "h-11 sm:h-10 flex-1 sm:flex-none",
                    target.status === "WITHDRAWN" &&
                      "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10",
                  )}
                  disabled={busy || isCurrent}
                  aria-busy={isBusy}
                  onClick={() => statusMutation.mutate({ status: target.status })}
                >
                  {isBusy ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : target.status === "CONTACTED" ? (
                    <Phone aria-hidden />
                  ) : null}
                  {target.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // LANDLORD — the decision of record, behind a confirm + optional note.
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 flex gap-2 flex-wrap">
        <DecisionDialog
          application={application}
          triggerLabel={t("agent.approveCta")}
          title={t("agent.approveTitle")}
          description={t("agent.approveDesc")}
          busy={busy && pendingTarget === "APPROVED"}
          disabled={busy}
          onConfirm={(note) => statusMutation.mutate({ status: "APPROVED", ...(note ? { note } : {}) })}
        />
        <DecisionDialog
          application={application}
          triggerLabel={t("agent.rejectCta")}
          title={t("agent.rejectTitle")}
          description={t("agent.rejectDesc")}
          busy={busy && pendingTarget === "REJECTED"}
          disabled={busy}
          destructive
          onConfirm={(note) => statusMutation.mutate({ status: "REJECTED", ...(note ? { note } : {}) })}
        />
      </CardContent>
    </Card>
  );
}

/** Confirm + optional note — stays open while the decision is in flight. */
function DecisionDialog({
  application,
  triggerLabel,
  title,
  description,
  busy,
  disabled,
  destructive = false,
  onConfirm,
}: {
  application: ListingApplicationDto;
  triggerLabel: string;
  title: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  destructive?: boolean;
  onConfirm: (note: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  function confirm(event: React.MouseEvent<HTMLButtonElement>) {
    // Keep the dialog open while the mutation is in flight; it closes on
    // success (the status chip flips) and stays put on error (toast).
    event.preventDefault();
    onConfirm(note.trim());
    setNote("");
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setNote("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant={destructive ? "outline" : "default"}
          className={cn(
            "h-11 sm:h-10 flex-1 sm:flex-none",
            destructive &&
              "border-destructive/50 text-destructive bg-transparent hover:bg-destructive/10 hover:text-destructive dark:bg-transparent dark:hover:bg-destructive/10",
          )}
          disabled={disabled}
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : destructive ? (
            <ThumbsDown aria-hidden />
          ) : (
            <ThumbsUp aria-hidden />
          )}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title} — {application.applicantName}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          rows={3}
          maxLength={500}
          value={note}
          placeholder={t("agent.decisionPlaceholder")}
          aria-label={t("agent.decisionNote")}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1"
        />
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 sm:h-10" disabled={busy}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "h-11 sm:h-10",
              destructive &&
                "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60",
            )}
            disabled={busy}
            onClick={confirm}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {triggerLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — reserves header + quote + timeline rows
// ---------------------------------------------------------------------------

function ApplicationDetailSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-4 w-5/6" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-3 rounded-full mt-1 shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
