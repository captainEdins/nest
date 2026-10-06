"use client";

/**
 * S-28 · Report-an-issue sheet (Phase 2, issue #23).
 *
 * Mounted for TENANT + CARETAKER (see app-shell). Bottom sheet (Drawer) on
 * mobile, dialog on ≥sm — the pay-flow idiom. Tenants' unit is derived from
 * their ACTIVE tenancy server-side; caretakers MUST pick a unit (their
 * property's, from the cached overview — works in dead-signal basements).
 *
 * POST /api/tickets → invalidate ["tickets"] + success toast (in the hook),
 * then the sheet closes and resets.
 */

import * as React from "react";
import { Loader2, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import { TICKET_PRIORITIES, type TicketPriority } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useSession, useCaretakerOverview } from "@/hooks/use-overview";
import { useCreateTicket } from "@/hooks/use-tickets";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TITLE_MAX = 120;
const DESC_MIN = 10;
const DESC_MAX = 2000;

export function ReportIssueSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.reportIssueOpen);
  const setOpen = useUIStore((s) => s.setReportIssueOpen);
  const { data: session } = useSession();
  const { data: caretakerOverview } = useCaretakerOverview();
  const create = useCreateTicket();

  const isCaretaker = session?.profile.role === "CARETAKER";
  const units = React.useMemo(
    () => [...(caretakerOverview?.units ?? [])].sort((a, b) => a.label.localeCompare(b.label)),
    [caretakerOverview],
  );

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<TicketPriority>("NORMAL");
  const [unitId, setUnitId] = React.useState("");

  // Reset the form when the sheet closes (after the slide-out animation).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setTitle("");
      setDescription("");
      setPriority("NORMAL");
      setUnitId("");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const titleValid = title.trim().length >= 3;
  const descValid = description.trim().length >= DESC_MIN && description.length <= DESC_MAX;
  const unitValid = !isCaretaker || unitId.length > 0;
  const formValid = titleValid && descValid && unitValid;

  function submit() {
    if (create.isPending || !online || !formValid) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        priority,
        // TENANT: backend derives the unit; CARETAKER: unitId is required.
        ...(isCaretaker ? { unitId } : {}),
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  const descShort = description.length > 0 && description.trim().length < DESC_MIN;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t("repairs.reportIssue")}
      description={t("repairs.reportIssueDesc")}
    >
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="ticket-title" className="text-label">
            {t("repairs.issueTitle")}
          </Label>
          <Input
            id="ticket-title"
            autoComplete="off"
            maxLength={TITLE_MAX}
            value={title}
            placeholder={t("repairs.issueTitlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 sm:h-10"
            aria-invalid={title.length > 0 && !titleValid ? true : undefined}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="ticket-description" className="text-label">
            {t("repairs.issueDetails")}
          </Label>
          <Textarea
            id="ticket-description"
            rows={4}
            maxLength={DESC_MAX}
            value={description}
            placeholder={t("repairs.issueDetailsPlaceholder")}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={descShort ? true : undefined}
          />
          <p
            className={cn(
              "text-caption text-right tabular-nums",
              descShort ? "text-attention" : "text-muted-foreground",
            )}
          >
            {description.length}/{DESC_MAX}
          </p>
        </div>

        {/* Priority */}
        <fieldset className="space-y-2">
          <legend className="text-label font-medium">{t("repairs.priority")}</legend>
          <div role="radiogroup" aria-label={t("repairs.priority")} className="grid grid-cols-4 gap-2">
            {TICKET_PRIORITIES.map((option) => {
              const selected = priority === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPriority(option)}
                  className={cn(
                    "h-11 rounded-lg border text-label font-medium transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? option === "URGENT"
                        ? "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention"
                        : "border-transparent bg-secondary text-secondary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {t(`repairs.priority.${option}` as TranslationKey)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Unit picker — caretaker only (tenant unit is derived server-side). */}
        {isCaretaker ? (
          <div className="space-y-2">
            <Label htmlFor="ticket-unit" className="text-label">
              {t("repairs.pickUnit")}
            </Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger id="ticket-unit" className="w-full h-11 sm:h-10">
                <SelectValue placeholder={t("repairs.pickUnitPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id} className="min-h-11">
                    {unit.tenancy ? `${unit.label} · ${unit.tenancy.tenantName}` : unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Submit */}
        <div className="space-y-1.5">
          <Button
            className="w-full h-11 sm:h-10"
            disabled={create.isPending || !online || !formValid}
            aria-busy={create.isPending}
            onClick={submit}
          >
            {create.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Wrench aria-hidden />
            )}
            {create.isPending ? t("repairs.submitting") : t("repairs.submit")}
          </Button>
          {!online ? (
            <p className="text-caption text-muted-foreground text-center">{t("errors.needOnline")}</p>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  );
}
