"use client";

/**
 * S-12d · Create-listing sheet (Phase 4, issue #47).
 *
 * Bottom sheet (Drawer < sm, Dialog ≥ sm — the pay-flow idiom) turning a
 * vacant, unlisted unit into a DRAFT listing: unit select (rent hint), title,
 * description, rent prefilled in whole shillings from the unit (converted to
 * integer minor units on submit — money never travels as a float).
 *
 * POST /api/listings — propertyId derives server-side from the unit; the
 * server 409s a not-vacant or duplicate-listing attempt with guidance. Demo
 * data ships with no unlisted vacant unit, so the sheet's honest empty state
 * IS the expected UX until a unit frees up.
 */

import * as React from "react";
import { toast } from "sonner";
import { Home, Loader2, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes, minorToShillingsInput, shillingsToMinor } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useAgentOverview } from "@/hooks/use-overview";
import { useCreateListing } from "@/hooks/use-listings";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { EmptyState } from "@/components/nest/shared/empty-state";
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

const TITLE_MIN = 5;
const TITLE_MAX = 120;
const DESC_MIN = 20;
const DESC_MAX = 2000;

export function CreateListingSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.createListingOpen);
  const setOpen = useUIStore((s) => s.setCreateListingOpen);
  const openListing = useUIStore((s) => s.openListing);
  const { data: overview } = useAgentOverview();
  const createListing = useCreateListing();

  const units = overview?.unlistedVacantUnits ?? [];

  const [unitId, setUnitId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [rent, setRent] = React.useState("");
  const [rentError, setRentError] = React.useState<string | null>(null);

  // Reset the form when the sheet closes (after the slide-out animation).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setUnitId(null);
      setTitle("");
      setDescription("");
      setRent("");
      setRentError(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;

  /** Unit pick also prefills the rent (whole shillings; minor on the wire). */
  function pickUnit(id: string) {
    setUnitId(id);
    setRentError(null);
    const unit = units.find((candidate) => candidate.id === id);
    setRent(unit ? minorToShillingsInput(unit.rentAmountMinor) : "");
  }

  const titleValid = title.trim().length >= TITLE_MIN;
  const descValid = description.trim().length >= DESC_MIN;
  const formValid =
    unitId != null && titleValid && descValid && rentError == null;

  function submit() {
    if (createListing.isPending || !online || !formValid || !selectedUnit) return;
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedTitle.length < TITLE_MIN) {
      toast.error(t("agent.titleShort"));
      return;
    }
    if (trimmedDescription.length < DESC_MIN) {
      toast.error(t("agent.descShort"));
      return;
    }
    // Empty rent → omit; the server defaults to the unit's rent.
    let rentAmountMinor: number | undefined;
    const trimmedRent = rent.trim();
    if (trimmedRent.length > 0) {
      const parsed = shillingsToMinor(trimmedRent);
      if (parsed == null || parsed <= 0) {
        setRentError(t("errors.invalidAmount"));
        return;
      }
      rentAmountMinor = parsed;
    }
    createListing.mutate(
      {
        unitId: selectedUnit.id,
        title: trimmedTitle,
        description: trimmedDescription,
        ...(rentAmountMinor != null ? { rentAmountMinor } : {}),
      },
      {
        onSuccess: (created) => {
          setOpen(false);
          // Straight into the new listing — publishing is the next step.
          openListing(created.id);
        },
      },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t("agent.createListing")}
      description={t("agent.createListingDesc")}
    >
      <div className="space-y-4">
        {units.length === 0 ? (
          /* Honest empty state — every vacant unit already has a live listing. */
          <EmptyState icon={Home} title={t("agent.emptyVacancies")} />
        ) : (
          <>
            {/* Vacant unit — the listing's anchor */}
            <div className="space-y-2">
              <Label htmlFor="listing-unit" className="text-label">
                {t("agent.pickUnit")}
              </Label>
              <Select value={unitId ?? undefined} onValueChange={pickUnit}>
                <SelectTrigger id="listing-unit" className="w-full h-11 sm:h-10">
                  <SelectValue placeholder={t("agent.pickUnit")} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem
                      key={unit.id}
                      value={unit.id}
                      textValue={`${unit.label} · ${unit.propertyName}`}
                    >
                      <span className="flex flex-col py-0.5">
                        <span>
                          {unit.label} · {unit.propertyName}
                        </span>
                        <span className="text-caption text-muted-foreground tabular-nums">
                          {formatKes(unit.rentAmountMinor)} {t("agent.perMonth")}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="listing-title" className="text-label">
                {t("agent.listingTitle")}
              </Label>
              <Input
                id="listing-title"
                autoComplete="off"
                maxLength={TITLE_MAX}
                value={title}
                placeholder={t("agent.titlePlaceholder")}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 sm:h-10"
                aria-invalid={title.length > 0 && !titleValid ? true : undefined}
              />
              {title.length > 0 && !titleValid ? (
                <p className="text-caption text-destructive" role="alert">
                  {t("agent.titleShort")}
                </p>
              ) : null}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="listing-description" className="text-label">
                {t("agent.description")}
              </Label>
              <Textarea
                id="listing-description"
                rows={4}
                maxLength={DESC_MAX}
                value={description}
                placeholder={t("agent.descPlaceholder")}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={description.length > 0 && !descValid ? true : undefined}
              />
              {description.length > 0 && !descValid ? (
                <p className="text-caption text-destructive" role="alert">
                  {t("agent.descShort")}
                </p>
              ) : null}
            </div>

            {/* Rent — whole shillings in the field, minor units on the wire */}
            <div className="space-y-2">
              <Label htmlFor="listing-rent" className="text-label">
                {t("agent.rent")}
              </Label>
              <Input
                id="listing-rent"
                type="number"
                inputMode="numeric"
                min={1}
                value={rent}
                placeholder={selectedUnit ? minorToShillingsInput(selectedUnit.rentAmountMinor) : undefined}
                onChange={(e) => {
                  setRent(e.target.value);
                  if (rentError) setRentError(null);
                }}
                className="h-11 sm:h-10 tabular-nums"
                aria-invalid={rentError ? true : undefined}
              />
              <p className="text-caption text-muted-foreground">
                {t("agent.rentPrefilled")}
              </p>
              {rentError ? (
                <p className="text-caption text-destructive" role="alert">
                  {rentError}
                </p>
              ) : null}
            </div>

            {/* Submit */}
            <div className="space-y-1.5">
              <Button
                className="w-full h-11 sm:h-10"
                disabled={createListing.isPending || !online || !formValid}
                aria-busy={createListing.isPending}
                onClick={submit}
              >
                {createListing.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Plus aria-hidden />
                )}
                {createListing.isPending ? t("common.loading") : t("agent.createListing")}
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
