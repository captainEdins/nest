"use client";

/**
 * NEST — "Remind all" (Phase 13, issue #84 part A).
 *
 * One verified action for every tenant in arrears. Confirmation-first: the
 * dialog shows the recipient count, both channels, and an exact example
 * message (the largest balance) before anything is sent. After a successful
 * run the button reflects it; the server's 30-minute window is the real
 * lock, the button's 60s cooldown is just a soft guard (D-026).
 */

import * as React from "react";
import { toast } from "sonner";
import { BellRing, Loader2, Megaphone } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ArrearsRowDto, RemindAllResultDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useOnline } from "@/components/nest/offline-banner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** The exact server-side message shape, previewed for the biggest balance. */
function previewMessage(row: ArrearsRowDto): string {
  return (
    `NEST: Hi ${row.tenantName}, rent for ${row.unitLabel} ` +
    `(${row.propertyName}) is past due. Balance ${formatKes(row.balanceMinor)}. ` +
    `Pay via M-Pesa using account ref ${row.accountRef}.`
  );
}

export function RemindAllButton({ rows }: { rows: ArrearsRowDto[] }) {
  const { t } = useI18n();
  const online = useOnline();
  const [open, setOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sentCount, setSentCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (sentCount == null) return;
    const timer = window.setTimeout(() => setSentCount(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [sentCount]);

  // Largest balance is the example — the row a human would worry about first.
  const example = [...rows].sort((a, b) => b.balanceMinor - a.balanceMinor)[0];
  const count = rows.length;

  if (count === 0) return null;

  async function sendToAll() {
    setSending(true);
    try {
      const result = await apiPost<RemindAllResultDto>("/api/notifications/remind-all", {});
      setSentCount(result.notifiedCount);
      toast.success(t("arrears.remindAllSent", { count: result.notifiedCount }));
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONFLICT") {
        toast.info(t("arrears.remindAllCooldown"));
      } else {
        const message =
          error instanceof ApiError && (error.code === "NETWORK" || error.code === "OFFLINE")
            ? t("errors.needOnline")
            : t("errors.somethingWrong");
        toast.error(message);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-11 sm:h-9"
        disabled={sending || sentCount != null || !online}
        onClick={() => setOpen(true)}
        aria-live={sentCount != null ? "polite" : undefined}
      >
        {sending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : sentCount != null ? (
          <BellRing aria-hidden />
        ) : (
          <Megaphone className="size-4" aria-hidden />
        )}
        {sentCount != null ? t("arrears.sent") : t("arrears.remindAllCount", { count })}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("arrears.remindAllTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t("arrears.remindAllDesc", { count })}</p>
                {example ? (
                  <blockquote
                    className="rounded-lg border bg-muted/50 p-3 text-caption leading-relaxed"
                    aria-label={t("arrears.remindAllPreview", { name: example.tenantName })}
                  >
                    <p className="text-muted-foreground mb-1">
                      {t("arrears.remindAllPreview", { name: example.tenantName })}:
                    </p>
                    <p className="font-mono">{previewMessage(example)}</p>
                  </blockquote>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog open while the request runs (default closes it).
                event.preventDefault();
                void sendToAll();
              }}
              disabled={sending}
            >
              {sending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("arrears.remindAllConfirm", { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
