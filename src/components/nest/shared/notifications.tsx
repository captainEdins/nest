"use client";

/**
 * S-14 · Notifications — one feed of what NEST sent (SMS/WhatsApp/in-app).
 * Tenant: a tab fed by the cached overview. Other roles: header-bell modal
 * with a lazy /api/notifications fetch.
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import { Bell, MessageCircle, MessageSquare } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { NotificationChannel, NotificationDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useNotifications, useTenantOverview } from "@/hooks/use-overview";
import { formatDate, formatTime } from "./format";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { ListSkeleton } from "./skeletons";
import { StatusBadge } from "./status-badge";
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

function templateLine(templateKey: string, t: ReturnType<typeof useI18n>["t"]): string | null {
  if (templateKey === "RECEIPT_ISSUED") return t("notifications.receiptIssued");
  if (templateKey === "ARREARS_REMINDER") return t("notifications.arrearsReminder");
  if (templateKey === "UNMATCHED_PAYMENT") return t("notifications.paymentNeedsReview");
  return null;
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
}: {
  notification: NotificationDto;
  /** Tab holding the unmatched queue for this role, or null to hide the action. */
  matchTab: "payments" | "collections" | null;
}) {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const setPaymentsFilter = useUIStore((s) => s.setPaymentsFilter);
  const setNotificationsOpen = useUIStore((s) => s.setNotificationsOpen);

  const Icon = CHANNEL_ICON[notification.channel];
  const heading = templateLine(notification.templateKey, t);
  const needsReview = notification.templateKey === "UNMATCHED_PAYMENT" && matchTab !== null;

  return (
    <div className="p-4 min-h-14 flex items-start gap-2">
      <span className="w-2 shrink-0 self-center" aria-hidden>
        {notification.status === "QUEUED" ? (
          <span className="block size-2 rounded-full bg-primary" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        {heading ? (
          <p className="text-body font-medium truncate">{heading}</p>
        ) : null}
        <p className="text-body text-muted-foreground break-words line-clamp-2">{notification.body}</p>
        <p className="text-caption text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1">
          <Badge variant="secondary" className="text-caption gap-1">
            <Icon className="size-3" aria-hidden />
            {t(channelKey(notification.channel))}
          </Badge>
          <span className="tabular-nums">{formatTime(notification.createdAt)}</span>
          <StatusBadge status={notification.status} />
        </p>
      </div>
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
  );
}

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
              <NotificationRow key={notification.id} notification={notification} matchTab={matchTab} />
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

/** Tenant Notifications tab — fed by the cached overview (one call per home). */
export function TenantNotificationsScreen() {
  const { t } = useI18n();
  const { data, isPending, error, refetch } = useTenantOverview();

  return (
    <section aria-label={t("notifications.title")}>
      <h1 className="text-h2 font-semibold mb-4">{t("notifications.title")}</h1>
      {isPending ? <ListSkeleton rows={6} /> : null}
      {error != null ? <ErrorState onRetry={() => refetch()} /> : null}
      {data ? (
        data.notifications.length === 0 ? (
          <EmptyState icon={Bell} title={t("notifications.empty")} />
        ) : (
          <NotificationsList notifications={data.notifications} />
        )
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
        data.length === 0 ? (
          <EmptyState icon={Bell} title={t("notifications.empty")} />
        ) : (
          <NotificationsList notifications={data} matchTab={matchTab} />
        )
      ) : null}
    </ResponsiveModal>
  );
}
