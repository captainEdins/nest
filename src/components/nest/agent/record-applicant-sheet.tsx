"use client";

/**
 * S-12e · Record-applicant sheet (Phase 4, issue #47).
 *
 * The agent's intake desk (≤3 taps: open → name → submit). Phone is required
 * (the funnel calls back); source is a single-tap chip row (the LogVisitorSheet
 * purpose idiom); the first note is optional and becomes the origin event's
 * note on the timeline.
 *
 * POST /api/listings/[id]/applications — AGENT ONLY (a landlord POST gets a
 * real 403; the sheet is agent-mounted anyway). The listing must be PUBLISHED
 * (server 409s a draft/paused attempt). When the sheet is opened without a
 * listing context, a live-listing select picks the anchor.
 */

import * as React from "react";
import { Loader2, Megaphone, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { APPLICATION_SOURCES, type ApplicationSource } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useListings, useRecordApplication } from "@/hooks/use-listings";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { APPLICATION_SOURCE_LABEL_KEYS } from "@/components/nest/shared/listing-chips";
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

const NAME_MIN = 2;
const NAME_MAX = 80;
/** Same shape the server enforces (P4-b): 9-15 digits, optional leading +. */
const APPLICANT_PHONE_RE = /^\+?[0-9\s-]{9,15}$/;
const NOTE_MAX = 500;

export function RecordApplicantSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.recordApplicantOpen);
  const anchoredListingId = useUIStore((s) => s.recordApplicantListingId);
  const close = useUIStore((s) => s.closeRecordApplicant);

  // Without a listing anchor (opened from the listings tab / home) the agent
  // picks which live listing the applicant walked in for.
  const { data: listings } = useListings();
  const liveListings = React.useMemo(
    () => (listings ?? []).filter((listing) => listing.status === "PUBLISHED"),
    [listings],
  );

  const [pickedListingId, setPickedListingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [source, setSource] = React.useState<ApplicationSource>("WALK_IN");
  const [note, setNote] = React.useState("");

  // Reset the form when the sheet closes (after the slide-out animation).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setPickedListingId(null);
      setName("");
      setPhone("");
      setSource("WALK_IN");
      setNote("");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const listingId = anchoredListingId ?? pickedListingId;
  const record = useRecordApplication(listingId ?? "");

  const anchoredListing = liveListings.find((listing) => listing.id === anchoredListingId) ?? null;
  const pickedListing = liveListings.find((listing) => listing.id === pickedListingId) ?? null;

  const trimmedPhone = phone.trim();
  const nameValid = name.trim().length >= NAME_MIN && name.length <= NAME_MAX;
  const phoneValid = APPLICANT_PHONE_RE.test(trimmedPhone);
  const formValid = listingId != null && nameValid && phoneValid;

  function submit() {
    if (record.isPending || !online || !formValid || listingId == null) return;
    record.mutate(
      {
        applicantName: name.trim(),
        applicantPhone: trimmedPhone,
        source,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: () => close() },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        // Never dismiss mid-mutation — an intake in flight.
        if (!next && !record.isPending) close();
      }}
      title={t("agent.recordApplicant")}
      description={t("agent.recordApplicantDesc")}
    >
      <div className="space-y-4">
        {anchoredListing == null && liveListings.length === 0 ? (
          /* Intake needs a live listing — none is published. */
          <EmptyState icon={Megaphone} title={t("agent.emptyListings")} />
        ) : (
          <>
            {/* Listing anchor — preset from the listing detail, picked otherwise */}
            {anchoredListing == null ? (
              <div className="space-y-2">
                <Label htmlFor="applicant-listing" className="text-label">
                  {t("nav.listings")}
                </Label>
                <Select
                  value={pickedListingId ?? undefined}
                  onValueChange={setPickedListingId}
                >
                  <SelectTrigger id="applicant-listing" className="w-full h-11 sm:h-10">
                    <SelectValue placeholder={t("nav.listings")} />
                  </SelectTrigger>
                  <SelectContent>
                    {liveListings.map((listing) => (
                      <SelectItem
                        key={listing.id}
                        value={listing.id}
                        textValue={`${listing.unitLabel} · ${listing.title}`}
                      >
                        <span className="flex flex-col py-0.5">
                          <span>
                            {listing.unitLabel} · {listing.title}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            {t("applicant.count", { count: listing.applicationCount })}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="applicant-name" className="text-label">
                {t("agent.applicantName")}
              </Label>
              <Input
                id="applicant-name"
                autoComplete="off"
                autoFocus
                maxLength={NAME_MAX}
                value={name}
                placeholder={t("guard.visitors.namePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                className="h-11 sm:h-10"
                aria-invalid={name.length > 0 && !nameValid ? true : undefined}
              />
              {name.length > 0 && !nameValid ? (
                <p className="text-caption text-destructive" role="alert">
                  {t("agent.applicantNameShort")}
                </p>
              ) : null}
            </div>

            {/* Phone — required; the funnel calls back */}
            <div className="space-y-2">
              <Label htmlFor="applicant-phone" className="text-label">
                {t("agent.applicantPhone")}
              </Label>
              <Input
                id="applicant-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                placeholder="+254 7XX XXX XXX"
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 sm:h-10"
                aria-invalid={phone.length > 0 && !phoneValid ? true : undefined}
              />
              {phone.length > 0 && !phoneValid ? (
                <p className="text-caption text-destructive" role="alert">
                  {t("agent.applicantPhoneInvalid")}
                </p>
              ) : null}
            </div>

            {/* Lead source — single tap (WALK_IN preselected) */}
            <fieldset className="space-y-2">
              <legend className="text-label font-medium">{t("agent.leadSource")}</legend>
              <div
                role="radiogroup"
                aria-label={t("agent.leadSource")}
                className="grid grid-cols-3 gap-2"
              >
                {APPLICATION_SOURCES.map((option) => {
                  const selected = source === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSource(option)}
                      className={cn(
                        "h-11 rounded-lg border text-label font-medium transition-colors outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-transparent bg-secondary text-secondary-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {t(APPLICATION_SOURCE_LABEL_KEYS[option])}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* First note (optional) — becomes the origin event's note */}
            <div className="space-y-2">
              <Label htmlFor="applicant-note" className="text-label">
                {t("agent.firstNote")}
              </Label>
              <Textarea
                id="applicant-note"
                rows={3}
                maxLength={NOTE_MAX}
                value={note}
                placeholder={t("agent.notePlaceholder")}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="space-y-1.5">
              <Button
                className="w-full h-11 sm:h-10"
                disabled={record.isPending || !online || !formValid}
                aria-busy={record.isPending}
                onClick={submit}
              >
                {record.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <UserPlus aria-hidden />
                )}
                {record.isPending ? t("common.loading") : t("agent.recordApplicant")}
              </Button>
              {!online ? (
                <p className="text-caption text-muted-foreground text-center">
                  {t("errors.needOnline")}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
