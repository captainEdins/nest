"use client";

/**
 * S-27 · Ticket detail pushed screen (Phase 2, issue #23) + the shared ticket
 * list primitives every role's repairs tab reuses.
 *
 * Exports:
 * - TicketStatusBadge / PriorityChip / TicketRow / TicketStatusFilterChips —
 *   the shared visual language for tickets (status-badge.tsx stays untouched;
 *   these variants live here per the Phase 2 file-ownership contract).
 * - TicketDetailScreen({ ticketId }) — the pushed screen the shell renders
 *   with its own back button; content only.
 *
 * Data: useTicket/useTicketUpdate (GET /api/tickets/[id], POST …/updates).
 * TENANT timelines are read-only (403 server-side) — the composer and
 * transition buttons simply don't render for tenants.
 */

import * as React from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  History,
  Loader2,
  Minus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { TicketDto, TicketPriority, TicketStatus, TicketUpdateDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useSession } from "@/hooks/use-overview";
import { TICKET_STATUS_LABEL_KEYS, useTicket, useTicketUpdate } from "@/hooks/use-tickets";
import { formatDate, formatTime } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

// ---------------------------------------------------------------------------
// Status badge — OPEN secondary · IN_PROGRESS primary outline · RESOLVED
// success · CLOSED muted (token palette only; never color-only: icon + label).
// ---------------------------------------------------------------------------

const TICKET_STATUS_STYLES: Record<TicketStatus, { className: string; icon: LucideIcon }> = {
  OPEN: { className: "border-transparent bg-secondary text-secondary-foreground", icon: CircleDot },
  IN_PROGRESS: { className: "border-primary text-primary bg-transparent", icon: Wrench },
  RESOLVED: { className: "border-transparent bg-success text-success-foreground", icon: CheckCircle2 },
  CLOSED: { className: "border-transparent bg-muted text-muted-foreground", icon: Archive },
};

export function TicketStatusBadge({
  status,
  className,
  animateEntry = false,
}: {
  status: TicketStatus;
  className?: string;
  /** Remount with `key={status}` in the detail header — replays the zoom so status changes visibly animate. */
  animateEntry?: boolean;
}) {
  const { t } = useI18n();
  const style = TICKET_STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <Badge
      className={cn(
        style.className,
        "text-caption transition-colors duration-300",
        animateEntry && "animate-in fade-in zoom-in-50 duration-300",
        className,
      )}
    >
      <Icon aria-hidden />
      {t(TICKET_STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Priority chip — URGENT/HIGH warning/attention tones (URGENT pulses), muted
// for NORMAL/LOW. Icons keep it color-plus-shape, never color-only.
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<TicketPriority, { className: string; icon?: LucideIcon; pulse?: boolean }> = {
  URGENT: { className: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention", pulse: true },
  HIGH: { className: "border-warning/60 bg-transparent text-attention", icon: ArrowUp },
  NORMAL: { className: "border-transparent bg-muted text-muted-foreground", icon: Minus },
  LOW: { className: "border-transparent bg-muted text-muted-foreground", icon: ArrowDown },
};

export function PriorityChip({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  const { t } = useI18n();
  const style = PRIORITY_STYLES[priority];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-caption font-medium w-fit whitespace-nowrap shrink-0 gap-1 transition-colors duration-300",
        style.className,
        className,
      )}
    >
      {style.pulse ? (
        <span aria-hidden className="size-1.5 rounded-full bg-attention animate-pulse" />
      ) : Icon ? (
        <Icon className="size-3" aria-hidden />
      ) : null}
      {t(`repairs.priority.${priority}` as TranslationKey)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ticket row — the card row every repairs tab list renders. Tap → openTicket.
// ---------------------------------------------------------------------------

export function TicketRow({
  ticket,
  showReporter = false,
  showProperty = false,
}: {
  ticket: TicketDto;
  /** Caretaker/landlord queues show who reported it. */
  showReporter?: boolean;
  /** Landlord (multi-property) cards carry the property name. */
  showProperty?: boolean;
}) {
  const { t } = useI18n();
  const openTicket = useUIStore((s) => s.openTicket);

  const meta: string[] = [];
  if (showReporter) meta.push(ticket.reportedByName);
  meta.push(ticket.unitLabel);
  if (showProperty) meta.push(ticket.propertyName);
  meta.push(`${t("repairs.reported")} ${formatDate(ticket.createdAt)}`);

  return (
    <button
      type="button"
      onClick={() => openTicket(ticket.id)}
      aria-label={`${ticket.title}. ${t("repairs.viewTicket")}`}
      className="group w-full text-left p-4 min-h-16 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition active:scale-[0.99] hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold truncate">{ticket.title}</p>
        <p className="text-caption text-muted-foreground mt-0.5 truncate">{meta.join(" · ")}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <TicketStatusBadge status={ticket.status} />
          <PriorityChip priority={ticket.priority} />
        </div>
      </div>
      <ChevronRight
        className="size-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status filter chips — payments-ledger chip pattern (h-11, 44px targets) with
// a BottomNav-style active dot and live counts.
// ---------------------------------------------------------------------------

export type TicketStatusFilter = "ALL" | TicketStatus;

export function TicketStatusFilterChips({
  value,
  onChange,
  tickets,
}: {
  value: TicketStatusFilter;
  onChange: (next: TicketStatusFilter) => void;
  /** Full unfiltered list — drives the counts. */
  tickets: TicketDto[] | undefined;
}) {
  const { t } = useI18n();
  const counts = React.useMemo(() => {
    const byStatus: Record<TicketStatus, number> = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
    for (const ticket of tickets ?? []) byStatus[ticket.status] += 1;
    return byStatus;
  }, [tickets]);

  const options: { value: TicketStatusFilter; labelKey: TranslationKey; count: number | undefined }[] = [
    { value: "OPEN", labelKey: "repairs.filterOpen", count: tickets ? counts.OPEN : undefined },
    { value: "IN_PROGRESS", labelKey: "repairs.filterInProgress", count: tickets ? counts.IN_PROGRESS : undefined },
    { value: "RESOLVED", labelKey: "repairs.filterResolved", count: tickets ? counts.RESOLVED : undefined },
    { value: "CLOSED", labelKey: "repairs.filterClosed", count: tickets ? counts.CLOSED : undefined },
    { value: "ALL", labelKey: "repairs.filterAll", count: tickets?.length },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label={t("common.status")}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative shrink-0 h-11 px-4 rounded-full text-caption font-medium border transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-secondary text-secondary-foreground border-transparent"
                : "border-border text-muted-foreground",
            )}
          >
            <span className="flex items-baseline gap-1.5">
              {t(option.labelKey)}
              {typeof option.count === "number" ? (
                <span className="tabular-nums opacity-70">{option.count}</span>
              ) : null}
            </span>
            {active ? (
              <span
                aria-hidden
                className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-current animate-in fade-in duration-200"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail screen
// ---------------------------------------------------------------------------

export function TicketDetailScreen({ ticketId }: { ticketId: string }) {
  const { t } = useI18n();
  const { data: ticket, isPending, error, refetch } = useTicket(ticketId);

  if (isPending) {
    return <TicketDetailSkeleton />;
  }
  if (error != null || !ticket) {
    // 404 = out of scope or gone — retrying cannot fix it, so no button.
    const notFound = error instanceof ApiError && error.code === "NOT_FOUND";
    return (
      <ErrorState
        onRetry={notFound ? undefined : () => refetch()}
        message={t("repairs.loadError")}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header block */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <TicketStatusBadge key={ticket.status} status={ticket.status} animateEntry />
          <PriorityChip priority={ticket.priority} />
        </div>
        <h2 className="text-h2 font-semibold break-words">{ticket.title}</h2>
        <p className="text-body text-muted-foreground">
          {ticket.unitLabel} · {ticket.propertyName}
        </p>
        <p className="text-caption text-muted-foreground tabular-nums">
          {t("repairs.by", { name: ticket.reportedByName })} ·{" "}
          {t("repairs.reported")} {formatDate(ticket.createdAt)} ·{" "}
          {t("repairs.updated")} {formatDate(ticket.updatedAt)}
        </p>
      </div>

      {/* Description */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <p className="text-body whitespace-pre-wrap break-words">{ticket.description}</p>
        </CardContent>
      </Card>

      {/* Timeline (history, oldest first — rendered in delivered order) */}
      {ticket.updates.length > 0 ? (
        <section aria-label={t("repairs.timeline")}>
          <SectionHeader title={t("repairs.timeline")} count={ticket.updates.length} className="mb-3" />
          <Card>
            <CardContent className="p-4 sm:p-6">
              <ol className="relative">
                <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-0.5 rounded bg-border" />
                {ticket.updates.map((update) => (
                  <TimelineItem key={update.id} update={update} />
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <TicketActionBar ticket={ticket} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const TIMELINE_DOT_TONES: Record<TicketStatus | "NOTE", string> = {
  OPEN: "bg-secondary-foreground",
  IN_PROGRESS: "bg-primary",
  RESOLVED: "bg-success",
  CLOSED: "bg-muted-foreground",
  NOTE: "bg-muted-foreground/50",
};

const STATUS_PILL_TONES: Record<TicketStatus, string> = {
  OPEN: "border-border bg-muted text-muted-foreground",
  IN_PROGRESS: "border-primary/40 bg-primary/10 text-primary",
  RESOLVED: "border-success/40 bg-success/10 text-success",
  CLOSED: "border-border bg-muted text-muted-foreground",
};

function TimelineItem({ update }: { update: TicketUpdateDto }) {
  const { t } = useI18n();
  const isTransition = update.statusFrom != null && update.statusTo != null;
  const dotTone = isTransition ? TIMELINE_DOT_TONES[update.statusTo!] : TIMELINE_DOT_TONES.NOTE;
  return (
    <li className="relative pl-6 pb-5 last:pb-0">
      <span
        aria-hidden
        className={cn("absolute left-0 top-1 size-3 rounded-full ring-4 ring-card transition-colors duration-300", dotTone)}
      />
      <p className="text-label font-medium flex items-baseline gap-2 flex-wrap min-w-0">
        <span className="truncate">{update.authorName}</span>
        <span className="text-caption text-muted-foreground font-normal tabular-nums shrink-0">
          {formatDate(update.createdAt)} · {formatTime(update.createdAt)}
        </span>
      </p>
      {isTransition ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 h-6 text-caption font-medium mt-1 transition-colors duration-300",
            STATUS_PILL_TONES[update.statusTo!],
          )}
        >
          {t("repairs.statusChanged", {
            from: t(TICKET_STATUS_LABEL_KEYS[update.statusFrom!]),
            to: t(TICKET_STATUS_LABEL_KEYS[update.statusTo!]),
          })}
        </span>
      ) : null}
      {update.note ? (
        <p className="text-body text-muted-foreground whitespace-pre-wrap break-words mt-1">{update.note}</p>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Action bar — role-aware. TENANT: read-only (nothing renders).
// Transitions always carry a note (backend requires ≥1 char): the button label
// itself is the note, e.g. "Start work".
// ---------------------------------------------------------------------------

function TicketActionBar({ ticket }: { ticket: TicketDto }) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const role = session?.profile.role;
  const update = useTicketUpdate(ticket.id);
  const [note, setNote] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);

  const canAct = role === "CARETAKER" || role === "LANDLORD";
  if (!canAct) return null;

  const pendingStatusTo = update.isPending ? update.variables?.statusTo : undefined;
  const busy = update.isPending;

  /** Button-triggered transition — the label doubles as the required note. */
  function transition(statusTo: TicketStatus, noteText: string) {
    update.mutate({ note: noteText, statusTo, statusFrom: ticket.status });
  }

  function postNote() {
    const trimmed = note.trim();
    if (trimmed.length < 1) {
      setNoteError(t("repairs.requiresNote"));
      return;
    }
    setNoteError(null);
    update.mutate({ note: trimmed, statusFrom: ticket.status });
  }

  const showStartWork = ticket.status === "OPEN";
  const showMarkResolved = ticket.status === "IN_PROGRESS";
  const showReopen = ticket.status === "RESOLVED";
  const showClose = ticket.status === "RESOLVED" && role === "LANDLORD";
  const hasAnyAction = showStartWork || showMarkResolved || showReopen || showClose;
  const composerAllowed = ticket.status !== "CLOSED";

  if (!hasAnyAction && !composerAllowed) return null;

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-3">
        {hasAnyAction ? (
          <div className="flex gap-2 flex-wrap">
            {showStartWork ? (
              <Button
                className="h-11 sm:h-10 flex-1 sm:flex-none"
                disabled={busy}
                aria-busy={pendingStatusTo === "IN_PROGRESS"}
                onClick={() => transition("IN_PROGRESS", t("repairs.startWork"))}
              >
                {pendingStatusTo === "IN_PROGRESS" ? <Loader2 className="animate-spin" aria-hidden /> : <Wrench aria-hidden />}
                {t("repairs.startWork")}
              </Button>
            ) : null}

            {showMarkResolved ? (
              <Button
                className="h-11 sm:h-10 flex-1 sm:flex-none"
                disabled={busy}
                aria-busy={pendingStatusTo === "RESOLVED"}
                onClick={() => transition("RESOLVED", t("repairs.markResolved"))}
              >
                {pendingStatusTo === "RESOLVED" ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
                {t("repairs.markResolved")}
              </Button>
            ) : null}

            {showClose ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="h-11 sm:h-10 flex-1 sm:flex-none" disabled={busy} aria-busy={pendingStatusTo === "CLOSED"}>
                    {pendingStatusTo === "CLOSED" ? <Loader2 className="animate-spin" aria-hidden /> : <Archive aria-hidden />}
                    {t("repairs.closeTicket")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("repairs.closeTicket")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("repairs.confirmClose")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-11 sm:h-10">{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="h-11 sm:h-10"
                      onClick={() => transition("CLOSED", t("repairs.closeTicket"))}
                    >
                      {t("repairs.closeTicket")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            {showReopen ? (
              <Button
                variant="outline"
                className="h-11 sm:h-10 flex-1 sm:flex-none"
                disabled={busy}
                aria-busy={pendingStatusTo === "IN_PROGRESS"}
                onClick={() => transition("IN_PROGRESS", t("repairs.reopen"))}
              >
                {pendingStatusTo === "IN_PROGRESS" ? <Loader2 className="animate-spin" aria-hidden /> : <History aria-hidden />}
                {t("repairs.reopen")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {composerAllowed ? (
          <div className="space-y-2">
            <Textarea
              id="ticket-note"
              rows={3}
              maxLength={2000}
              value={note}
              placeholder={t("repairs.notePlaceholder")}
              aria-label={t("repairs.notePlaceholder")}
              aria-invalid={noteError ? true : undefined}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError) setNoteError(null);
              }}
            />
            {noteError ? (
              <p className="text-caption text-destructive" role="alert">
                {noteError}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption text-muted-foreground tabular-nums">{note.length}/2000</span>
              <Button
                variant="secondary"
                className="h-11 sm:h-10"
                disabled={busy}
                aria-busy={busy && pendingStatusTo === undefined}
                onClick={postNote}
              >
                {busy && pendingStatusTo === undefined ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {busy && pendingStatusTo === undefined ? t("repairs.posting") : t("repairs.addNote")}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — reserves the final layout (badges + title + description card +
// timeline) so data arrival causes no shift.
// ---------------------------------------------------------------------------

function TicketDetailSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
