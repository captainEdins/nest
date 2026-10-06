"use client";

/**
 * S-32a · Report-incident sheet (Phase 3, issue #36).
 *
 * Bottom sheet for filing an incident: category chips (single-select,
 * SECURITY preselected), severity chips (LOW preselected; HIGH + CRITICAL
 * carry destructive styling, CRITICAL pulses), description (required), and
 * action taken (optional).
 *
 * POST /api/incidents — property derived from the ACTIVE shift server-side;
 * HIGH/CRITICAL notify the landlord AND caretaker immediately (stated under
 * the severity row). Off-duty submits come back 409 with guidance.
 */

import * as React from "react";
import { Loader2, ShieldAlert, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  type IncidentCategory,
  type IncidentSeverity,
} from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useGuardOverview } from "@/hooks/use-overview";
import { useReportIncident } from "@/hooks/use-guard";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DESC_MIN = 5;
const DESC_MAX = 1000;
const ACTION_MAX = 1000;

/** HIGH/CRITICAL chips take destructive tones while selected; CRITICAL pulses. */
function severityChipClass(severity: IncidentSeverity, selected: boolean): string {
  if (!selected) return "border-border text-muted-foreground";
  if (severity === "HIGH" || severity === "CRITICAL") {
    return "border-destructive/60 bg-destructive/10 text-destructive";
  }
  return "border-transparent bg-secondary text-secondary-foreground";
}

export function ReportIncidentSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.reportIncidentOpen);
  const setOpen = useUIStore((s) => s.setReportIncidentOpen);
  const { data: overview } = useGuardOverview();
  const reportIncident = useReportIncident();

  const [category, setCategory] = React.useState<IncidentCategory>("SECURITY");
  const [severity, setSeverity] = React.useState<IncidentSeverity>("LOW");
  const [description, setDescription] = React.useState("");
  const [actionTaken, setActionTaken] = React.useState("");

  // Reset the form when the sheet closes (after the slide-out animation).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setCategory("SECURITY");
      setSeverity("LOW");
      setDescription("");
      setActionTaken("");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const descValid = description.trim().length >= DESC_MIN && description.length <= DESC_MAX;
  const formValid = descValid;
  const onDuty = overview?.activeShift != null;

  function submit() {
    if (reportIncident.isPending || !online || !formValid) return;
    reportIncident.mutate(
      {
        category,
        severity,
        description: description.trim(),
        ...(actionTaken.trim() ? { actionTaken: actionTaken.trim() } : {}),
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  const descShort = description.length > 0 && description.trim().length < DESC_MIN;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t("guard.incidents.report")}
      description={t("guard.incidents.reportDesc")}
    >
      <div className="space-y-4">
        {/* Off duty — the server rejects writes without an ACTIVE shift. */}
        {overview != null && !onDuty ? (
          <div className="rounded-lg border border-warning/40 bg-warning/15 dark:bg-warning/10 p-3 flex items-start gap-2.5">
            <TriangleAlert className="size-4 text-attention shrink-0 mt-0.5" aria-hidden />
            <p className="text-caption text-attention">{t("guard.incidents.offDutyHint")}</p>
          </div>
        ) : null}

        {/* Category */}
        <fieldset className="space-y-2">
          <legend className="text-label font-medium">{t("guard.incidents.category")}</legend>
          <div
            role="radiogroup"
            aria-label={t("guard.incidents.category")}
            className="grid grid-cols-3 gap-2"
          >
            {INCIDENT_CATEGORIES.map((option) => {
              const selected = category === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCategory(option)}
                  className={cn(
                    "h-11 rounded-lg border text-label font-medium transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-transparent bg-secondary text-secondary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {t(`guard.incidents.category.${option}` as TranslationKey)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Severity */}
        <fieldset className="space-y-2">
          <legend className="text-label font-medium">{t("guard.incidents.severity")}</legend>
          <div
            role="radiogroup"
            aria-label={t("guard.incidents.severity")}
            className="grid grid-cols-4 gap-2"
          >
            {INCIDENT_SEVERITIES.map((option) => {
              const selected = severity === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSeverity(option)}
                  className={cn(
                    "h-11 rounded-lg border text-label font-medium transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    severityChipClass(option, selected),
                  )}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {selected && option === "CRITICAL" ? (
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-destructive animate-pulse"
                      />
                    ) : null}
                    {t(`guard.incidents.severity.${option}` as TranslationKey)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-caption text-muted-foreground">{t("guard.incidents.notifyHint")}</p>
        </fieldset>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="incident-description" className="text-label">
            {t("guard.incidents.description")}
          </Label>
          <Textarea
            id="incident-description"
            rows={4}
            maxLength={DESC_MAX}
            value={description}
            placeholder={t("guard.incidents.descriptionPlaceholder")}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={descShort ? true : undefined}
          />
          <p
            className={cn(
              "text-caption text-right tabular-nums",
              descShort ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {description.length}/{DESC_MAX}
          </p>
        </div>

        {/* Action taken */}
        <div className="space-y-2">
          <Label htmlFor="incident-action" className="text-label">
            {t("guard.incidents.actionTaken")}
          </Label>
          <Input
            id="incident-action"
            maxLength={ACTION_MAX}
            value={actionTaken}
            placeholder={t("guard.incidents.actionTakenPlaceholder")}
            onChange={(e) => setActionTaken(e.target.value)}
            className="h-11 sm:h-10"
          />
        </div>

        {/* Submit */}
        <div className="space-y-1.5">
          <Button
            className="w-full h-11 sm:h-10"
            disabled={reportIncident.isPending || !online || !formValid}
            aria-busy={reportIncident.isPending}
            onClick={submit}
          >
            {reportIncident.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ShieldAlert aria-hidden />
            )}
            {reportIncident.isPending ? t("guard.incidents.filing") : t("guard.incidents.report")}
          </Button>
          {!online ? (
            <p className="text-caption text-muted-foreground text-center">
              {t("errors.needOnline")}
            </p>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  );
}
