"use client";

/**
 * Arrears row (S-03 / S-11): tenant, unit·property, months behind, amber
 * balance, one-tap Send reminder (60s cooldown to prevent spam).
 */

import * as React from "react";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ArrearsRowDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useOnline } from "@/components/nest/offline-banner";
import { Button } from "@/components/ui/button";

/** Send reminder with 60s cooldown — shared by card rows and table rows. */
export function SendReminderButton({ row, compact = false }: { row: ArrearsRowDto; compact?: boolean }) {
  const { t } = useI18n();
  const online = useOnline();
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(false), 60_000);
    return () => window.clearTimeout(timer);
  }, [sent]);

  async function sendReminder() {
    setSending(true);
    try {
      await apiPost("/api/notifications/reminders", { tenancyId: row.tenancyId });
      toast.success(t("arrears.reminderSent", { name: row.tenantName }));
      setSent(true);
    } catch (error) {
      const message =
        error instanceof ApiError && (error.code === "NETWORK" || error.code === "OFFLINE")
          ? t("errors.needOnline")
          : t("errors.somethingWrong");
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size="sm"
      className={compact ? "h-9 text-label" : "h-11 sm:h-9"}
      disabled={sending || sent || !online}
      onClick={sendReminder}
      aria-live={sent ? "polite" : undefined}
    >
      {sending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {sent ? t("arrears.sent") : t("arrears.sendReminder")}
    </Button>
  );
}

export function ArrearsRow({ row }: { row: ArrearsRowDto }) {
  const { t } = useI18n();
  const monthsLabel =
    row.monthsBehind <= 1
      ? t("arrears.monthBehind")
      : t("arrears.monthsBehind", { count: row.monthsBehind });

  return (
    <div className="p-4 min-h-14">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium truncate" title={row.tenantName}>
            {row.tenantName}
          </p>
          <p className="text-caption text-muted-foreground truncate">
            {row.unitLabel} · {row.propertyName} · {monthsLabel}
          </p>
        </div>
        <p className="text-attention font-semibold tabular-nums flex items-center gap-1 shrink-0">
          <TriangleAlert className="size-3.5" aria-hidden />
          {formatKes(row.balanceMinor)}
        </p>
      </div>
      <div className="mt-2 flex justify-end">
        <SendReminderButton row={row} compact />
      </div>
    </div>
  );
}
