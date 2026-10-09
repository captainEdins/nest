"use client";

/**
 * NEST · Notification Center (S-14 + Phase 7, issue #70).
 *
 * Tenant: a tab fed by the cached overview. Other roles: header-bell modal
 * with a lazy /api/notifications fetch. Phase 7 adds the read state everywhere:
 * - bell badge counts unread rows (30s poll, /api/notifications/unread-count)
 * - rows: unread tint + dot + per-row mark-read (44px target)
 * - "Mark all read" in the header of both surfaces
 * - All / Unread filter pills (same shape as the payments ledger chips)
 * - every emitted templateKey (11) renders a translated heading
 */

import { useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Bell, Check, CheckCheck, MessageCircle, MessageSquare } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { NotificationChannel, NotificationDto } from "@/lib/types";
import { useMarkNotificationsRead, useNotifications, useTenantOverview } from "@/hooks/use-overview";
import { useUIStore } from "@/lib/ui-store";
import { formatDate, formatTime } from "./format";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { ListSkeleton } from "./skeletons";
import { StatusBadge } from "./status-badge";
import { SegmentedControl } from "./segmented-control";
import { ResponsiveModal } from "./responsive-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

const CHANNEL_ICON: Record<NotificationChannel, LucideIcon> = {
  SMS: MessageSquare,
  WHATSAPP: MessageCircle,
  IN_APP: Bell,
};

function channelKey(channel: NotificationChannel): "channel.sms" | "channel.whatsapp" | "channel.inApp" {
  switch (channel) {
    case "SMS":
      return "channel.sms";
    case "WHATSAPP":
      return "channel.whatsapp";
    case "IN_APP":
      return "channel.inApp";
  }
}

/** Phase 7: every emitted templateKey gets a translated heading (11 total). */
const TEMPLATE_KEY_TO_I18N: Record<string, TranslationKey> = {
  RECEIPT_ISSUED: "notifications.receiptIssued",
  ARREARS_REMINDER: "notifications.arrearsReminder",
  UNMATCHED_PAYMENT: "notifications.paymentNeedsReview",
  DEPOSIT_SETTLED: "notifications.depositSettled",
  APPLICATION_RECORDED: "notifications.applicationRecorded",
  APPLICATION_DECIDED: "notifications.applicationDecided",
  APPLICATION_STATUS: "notifications.applicationStatus",
  INCIDENT_FILED: "notifications.incidentFiled",
  INCIDENT_ACKED: "notifications.incidentAcked",
  TICKET_CREATED: "notifications.ticketCreated",
  TICKET_UPDATED: "notifications.ticketUpdated",
  MOVE_IN: "notifications.moveIn",
};

function templateLine(templateKey: string, t: ReturnType<typeof useI18n>["t"]): string | null {
  const key = TEMPLATE_KEY_TO_I18N[templateKey];
  return key ? t(key) : null;
}

interface DayGroup {
  label: string;
  items: NotificationDto[];
}

function groupByDay(notifications: NotificationDto[], t: ReturnType<typeof useI18n>["t"]): DayGroup[] {
  const groups: DayGroup[] = [];
  const now = new Date();
  for (const notification of notifications) {
    let label: string;
    try {
      const days = differenceInCalendarDays(now, parseISO(notification.createdAt));
      if (days <= 0) label = t("notifications.today");
      else if (days === 1) label = t("notifications.yesterday");
      else label = formatDate(notification.createdAt);
    } catch {
      label = formatDate(notification.createdAt);
    }
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(notification);
    else groups.push({ label, items: [notification] });
  }
  return groups;
}

function NotificationRow({
  notification,
  matchTab,
  onMarkRead,
  marking,
}: {
  notification: NotificationDto;
  /** Tab holding the unmatched queue for this role, or null to hide the action. */
  matchTab: "payments" | "collections" | null;
  /** Phase 7: mark this row read (own row — server re-checks scope). */
  onMarkRead: ((id: string) => void) | null;
  marking: boolean;
}) {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const setPaymentsFilter = useUIStore((s) => s.setPaymentsFilter);
  const setNotificationsOpen = useUIStore((s) => s.setNotificationsOpen);

  const Icon = CHANNEL_ICON[notification.channel];
  const heading = templateLine(notification.templateKey, t);
  const needsReview = notification.templateKey === "UNMATCHED_PAYMENT" && matchTab !== null;
  const unread = notification.readAt == null;

  return (
    <div
      className={cn(
        "group/row p-4 min-h-14 flex items-start gap-2 transition-colors",
        unread ? "bg-primary/[0.045] border-l-2 border-primary" : "border-l-2 border-transparent",
      )}
    >
      <span className="w-2 shrink-0 self-center" aria-hidden>
        {unread ? <span className="block size-2 rounded-full bg-primary" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        {heading ? (
          <p className={cn("text-body truncate", unread ? "font-semibold" : "font-medium")}>{heading}</p>
        ) : null}
        <p
          className={cn(
            "text-body break-words line-clamp-2",
            unread ? "text-foreground/90" : "text-muted-foreground",
          )}
        >
          {notification.body}
        </p>
        <p className="text-caption text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1">
          <Badge variant="secondary" className="text-caption gap-1">
            <Icon className="size-3" aria-hidden />
            {t(channelKey(notification.channel))}
          </Badge>
          <span className="tabular-nums">{formatTime(notification.createdAt)}</span>
          <StatusBadge status={notification.status} />
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
        {unread && onMarkRead ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 sm:h-9 sm:w-9 p-0"
            disabled={marking}
            onClick={() => onMarkRead(notification.id)}
            aria-label={t("notifications.markRead")}
          >
            <Check className="size-4" aria-hidden />
          </Button>
        ) : null}
        {needsReview && matchTab ? (
          <Button
            variant="outline"
            size="sm"
            className="h-11 sm:h-9 shrink-0"
            onClick={() => {
              setPaymentsFilter("UNMATCHED");
              setTab(matchTab);
              setNotificationsOpen(false);
            }}
          >
            {t("unmatched.matchToTenant")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Phase 7 filter values for the feed. */
type FeedFilter = "ALL" | "UNREAD";

interface FeedControlsProps {
  filter: FeedFilter;
  setFilter: (f: FeedFilter) => void;
  unreadCount: number;
  totalCount: number;
  onMarkAll: (() => void) | null;
  marking: boolean;
}

/** Filter pills + "Mark all read" — shared by the modal and the tenant tab.
 *  Phase 9 (D-022): Monty SegmentedControl replaces the bespoke pill row. */
function FeedControls({ filter, setFilter, unreadCount, totalCount, onMarkAll, marking }: FeedControlsProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SegmentedControl
        ariaLabel={t("notifications.title")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "ALL", label: t("notifications.filterAll"), count: totalCount },
          { value: "UNREAD", label: t("notifications.filterUnread"), count: unreadCount, attention: true },
        ]}
      />
      <div className="flex-1" />
      {unreadCount > 0 && onMarkAll ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-11 gap-1.5 text-caption"
          disabled={marking}
          onClick={onMarkAll}
        >
          <CheckCheck className="size-4" aria-hidden />
          {t("notifications.markAllRead")}
        </Button>
      ) : null}
    </div>
  );
}

/** Day-grouped card list WITHOUT controls — used by the tenant home preview. */
export function NotificationsList({
  notifications,
  matchTab = null,
}: {
  notifications: NotificationDto[];
  matchTab?: "payments" | "collections" | null;
}) {
  const { t } = useI18n();
  const groups = groupByDay(notifications, t);
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="text-label font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {group.label}
          </h2>
          <Card className="divide-y">
            {group.items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                matchTab={matchTab}
                onMarkRead={null}
                marking={false}
              />
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

/**
 * The full feed: controls + day-grouped list. Pure of data-fetching so the
 * tenant tab (overview cache) and the bell modal (lazy fetch) share it.
 */
export function NotificationsFeed({
  notifications,
  matchTab = null,
  onMarkOne,
  onMarkAll,
  marking = false,
  maxHeight = null,
}: {
  notifications: NotificationDto[];
  matchTab?: "payments" | "collections" | null;
  onMarkOne?: (id: string) => void;
  onMarkAll?: () => void;
  marking?: boolean;
  /** e.g. "max-h-[60vh]" for the modal; null scrolls with the page. */
  maxHeight?: string | null;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<FeedFilter>("ALL");

  const unreadCount = notifications.filter((n) => n.readAt == null).length;
  const filtered = filter === "UNREAD" ? notifications.filter((n) => n.readAt == null) : notifications;
  const groups = groupByDay(filtered, t);

  const list = (
    <div className="space-y-4">
      <FeedControls
        filter={filter}
        setFilter={setFilter}
        unreadCount={unreadCount}
        totalCount={notifications.length}
        onMarkAll={onMarkAll ?? null}
        marking={marking}
      />
      {filter === "UNREAD" && unreadCount === 0 ? (
        <EmptyState icon={CheckCheck} title={t("notifications.allCaughtUp")} success />
      ) : groups.length === 0 ? (
        <EmptyState icon={Bell} title={t("notifications.empty")} />
      ) : (
        groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="text-label font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {group.label}
            </h2>
            <Card className="divide-y">
              {group.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  matchTab={matchTab}
                  onMarkRead={onMarkOne ?? null}
                  marking={marking}
                />
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );

  if (maxHeight) {
    return (
      <div className={cn("overflow-y-auto pr-1 nest-scrollbar", maxHeight)}>{list}</div>
    );
  }
  return list;
}

/** Tenant Notifications tab — fed by the cached overview (one call per home). */
export function TenantNotificationsScreen() {
  const { t } = useI18n();
  const { data, isPending, error, refetch } = useTenantOverview();
  const markRead = useMarkNotificationsRead();
  const notifications = data?.notifications ?? [];

  return (
    <section aria-label={t("notifications.title")}>
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h1 className="text-h2 font-semibold">{t("notifications.title")}</h1>
        {data && notifications.some((n) => n.readAt == null) ? (
          <span className="text-caption text-attention font-medium tabular-nums">
            {t("notifications.unreadCount", {
              count: notifications.filter((n) => n.readAt == null).length,
            })}
          </span>
        ) : null}
      </div>
      {isPending ? <ListSkeleton rows={6} /> : null}
      {error != null ? <ErrorState onRetry={() => refetch()} /> : null}
      {data ? (
        <NotificationsFeed
          notifications={notifications}
          onMarkOne={(id) => markRead.mutate({ ids: [id] })}
          onMarkAll={() => markRead.mutate({ all: true })}
          marking={markRead.isPending}
        />
      ) : null}
    </section>
  );
}

/** Header-bell modal for non-tenant roles (lazy fetch). */
export function NotificationsModal({
  matchTab,
}: {
  matchTab: "payments" | "collections" | null;
}) {
  const { t } = useI18n();
  const open = useUIStore((s) => s.notificationsOpen);
  const setOpen = useUIStore((s) => s.setNotificationsOpen);
  const { data, isPending, error, refetch } = useNotifications(open);
  const markRead = useMarkNotificationsRead();
  const notifications = data ?? [];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t("notifications.title")}
      wide
    >
      {isPending ? <ListSkeleton rows={6} /> : null}
      {error != null ? <ErrorState onRetry={() => refetch()} /> : null}
      {data ? (
        <NotificationsFeed
          notifications={notifications}
          matchTab={matchTab}
          onMarkOne={(id) => markRead.mutate({ ids: [id] })}
          onMarkAll={() => markRead.mutate({ all: true })}
          marking={markRead.isPending}
          maxHeight="max-h-[65vh]"
        />
      ) : null}
    </ResponsiveModal>
  );
}
