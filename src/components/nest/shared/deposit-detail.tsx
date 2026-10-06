"use client";

/**
 * S-29 · Deposit detail (pushed screen, Task P2-d — issue #24; caretaker
 * view added in P3-d, issue #37).
 *
 * The trust view of a security deposit: the amount held (or the settled
 * story), the append-only movements ledger (HOLD/DEDUCT/REFUND/ADJUST with
 * reasons, actors and dates on a kind-coloured timeline rail) and the
 * MOVE_IN / MOVE_OUT condition reports that make any deduction arguable.
 *
 * Data: TENANT → GET /api/deposits/mine (own ACTIVE/NOTICE tenancy).
 * CARETAKER → GET /api/deposits/[tenancyId] (property-chain scope, Phase 2
 * leftover shipped with issue #37). The app shell renders the back header
 * + "Security deposit" heading — content only.
 *
 * Read-only for every caller: no settle CTA exists here — settlement lives
 * in the landlord-only SettleDepositModal (role-gated in the shell).
 */

import { ClipboardCheck, ClipboardList } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { DepositMovementDto, DepositMovementKind, DepositStatus } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useDeposit, useMyDeposit } from "@/hooks/use-deposits";
import { formatDate } from "./format";
import { SectionHeader } from "./section-header";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { HeroSkeleton, ListSkeleton } from "./skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Kind-coloured primitives (shared with the landlord settlement modal)
// ---------------------------------------------------------------------------

/** Badge tone per movement kind — HOLD secondary, DEDUCT amber, REFUND green, ADJUST primary outline. */
const KIND_BADGE: Record<DepositMovementKind, string> = {
  HOLD: "bg-secondary text-secondary-foreground border-transparent",
  DEDUCT: "bg-warning text-warning-foreground border-transparent",
  REFUND: "bg-success text-success-foreground border-transparent",
  ADJUST: "border border-primary text-primary bg-transparent",
};

/** Timeline rail dot per movement kind. */
const KIND_DOT: Record<DepositMovementKind, string> = {
  HOLD: "bg-secondary-foreground/50",
  DEDUCT: "bg-warning",
  REFUND: "bg-success",
  ADJUST: "bg-primary",
};

export function DepositKindBadge({ kind, className }: { kind: DepositMovementKind; className?: string }) {
  const { t } = useI18n();
  return (
    <Badge className={cn("text-caption", KIND_BADGE[kind], className)}>
      {t(`deposit.kind.${kind}` as const)}
    </Badge>
  );
}

/** DEDUCT/REFUND leave the held amount — render with a leading minus. */
export function movementAmountText(kind: DepositMovementKind, amountMinor: number): string {
  if (kind === "DEDUCT" || kind === "REFUND") return `− ${formatKes(amountMinor)}`;
  return formatKes(amountMinor);
}

function DepositStatusBadge({ status, className }: { status: DepositStatus; className?: string }) {
  const { t } = useI18n();
  return (
    <Badge
      className={cn(
        "text-caption",
        status === "HELD"
          ? "bg-secondary text-secondary-foreground border-transparent"
          : "bg-success text-success-foreground border-transparent",
        className,
      )}
    >
      {status === "HELD" ? t("deposit.statusHeld") : t("deposit.statusReleased")}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function DepositDetailScreen({ tenancyId }: { tenancyId?: string }) {
  const { t } = useI18n();
  // TENANT reads /mine; CARETAKER (Phase 3) reads the tenancy-scoped ledger.
  // Both hooks mount unconditionally; only the active one is read below.
  const mine = useMyDeposit();
  const byId = useDeposit(tenancyId);
  const { data: deposit, isPending, error, refetch } = tenancyId != null ? byId : mine;

  if (error != null) {
    return (
      <div className="max-w-md">
        <ErrorState onRetry={() => refetch()} message={t("deposit.loadError")} />
      </div>
    );
  }

  if (isPending || !deposit) {
    return (
      <div className="space-y-4 sm:space-y-6" aria-busy>
        <HeroSkeleton />
        <ListSkeleton rows={3} />
        <ListSkeleton rows={2} />
      </div>
    );
  }

  const heldSince = deposit.movements[0]?.createdAt ?? null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero — the number the tenant cares about */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-label text-muted-foreground">{t("deposit.held")}</p>
              <p className="text-kpi font-bold tabular-nums tracking-tight break-all">
                {formatKes(deposit.heldMinor)}
              </p>
            </div>
            <DepositStatusBadge status={deposit.status} className="shrink-0" />
          </div>
          <p className="text-caption text-muted-foreground mt-1.5 truncate">
            {deposit.unitLabel} · {deposit.propertyName}
          </p>
          {heldSince ? (
            <p className="text-caption text-muted-foreground mt-0.5">
              {t("deposit.heldBy", { date: formatDate(heldSince) })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Ledger — the append-only money story */}
      <section aria-label={t("deposit.movements")}>
        <SectionHeader title={t("deposit.movements")} count={deposit.movements.length} className="mb-3" />
        {deposit.movements.length > 0 ? (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <MovementsTimeline movements={deposit.movements} />
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* Condition reports — the paper trail */}
      <section aria-label={t("deposit.conditionReports")}>
        <SectionHeader
          title={t("deposit.conditionReports")}
          count={deposit.conditionReports.length}
          className="mb-3"
        />
        {deposit.conditionReports.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState icon={ClipboardList} title={t("deposit.noReports")} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {deposit.conditionReports.map((report) => (
              <Card key={report.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {report.kind === "MOVE_IN" ? (
                      <ClipboardList className="size-4 text-muted-foreground shrink-0" aria-hidden />
                    ) : (
                      <ClipboardCheck className="size-4 text-muted-foreground shrink-0" aria-hidden />
                    )}
                    <p className="text-h3 font-semibold">
                      {report.kind === "MOVE_IN" ? t("deposit.moveIn") : t("deposit.moveOut")}
                    </p>
                  </div>
                  <p className="text-body text-muted-foreground break-words">{report.notes}</p>
                  <p className="text-caption text-muted-foreground">
                    {t("deposit.recordedBy", { name: report.recordedByName })} · {formatDate(report.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger timeline — left rail with kind-coloured dots, amounts right-aligned
// ---------------------------------------------------------------------------

function MovementsTimeline({ movements }: { movements: DepositMovementDto[] }) {
  const { t } = useI18n();
  return (
    <ol className="space-y-5">
      {movements.map((movement, index) => {
        const isLast = index === movements.length - 1;
        return (
          <li
            key={movement.id}
            className="relative pl-7 last:pb-0 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
            style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
          >
            {/* rail + kind-coloured dot */}
            {!isLast ? (
              <span
                className="absolute left-[4.5px] top-4 bottom-[-1.25rem] w-px bg-border"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "absolute left-0 top-1.5 size-2.5 rounded-full ring-4 ring-card",
                KIND_DOT[movement.kind],
              )}
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DepositKindBadge kind={movement.kind} />
                <p className="text-body mt-1 break-words">
                  {movement.reason ?? "—"}
                </p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  {movement.actorName
                    ? `${t("repairs.by", { name: movement.actorName })} · `
                    : ""}
                  {formatDate(movement.createdAt)}
                </p>
              </div>
              <p
                className={cn(
                  "text-body font-semibold tabular-nums shrink-0",
                  movement.kind === "DEDUCT" && "text-attention",
                  movement.kind === "REFUND" && "text-success",
                )}
                aria-label={`${t(`deposit.kind.${movement.kind}` as const)}: ${formatKes(movement.amountMinor)}`}
              >
                {movementAmountText(movement.kind, movement.amountMinor)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
