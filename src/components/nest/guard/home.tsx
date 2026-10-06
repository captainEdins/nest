"use client";

/**
 * S-13 · Guard home — honest Phase-1 preview. Property name when in scope,
 * phase notice, disabled preview tiles. NO money data (matrix §6).
 */

import { BookOpen, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useGuardOverview, useSession } from "@/hooks/use-overview";
import { ErrorState } from "@/components/nest/shared/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function GuardHome() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const { data, isPending, error } = useGuardOverview();

  if (error != null) {
    // Silent degradation (S-13): the notice still renders from i18n.
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-h3 font-semibold">{t("common.greeting", { name: session?.profile.fullName.split(" ")[0] ?? "" })}</h1>
        <PhaseNoticeCard />
        <ErrorState />
      </div>
    );
  }

  const name = session?.profile.fullName.split(" ")[0] ?? "";
  const property = data?.property ?? null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-h3 font-semibold truncate">
        {t("common.greeting", { name })}
        {property ? <span className="text-muted-foreground font-normal"> · {property.name}</span> : null}
      </h1>

      {isPending ? (
        <Card aria-busy>
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : (
        <PhaseNoticeCard />
      )}

      {/* Coming next phase — preview tiles */}
      <section aria-label={t("misc.nextPhase")}>
        <h2 className="text-label font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t("misc.nextPhase")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PreviewTile icon={BookOpen} title={t("guard.visitorLog")} desc={t("guard.visitorLogDesc")} />
          <PreviewTile icon={ShieldAlert} title={t("guard.incidents")} desc={t("guard.incidentsDesc")} />
        </div>
      </section>
    </div>
  );
}

function PhaseNoticeCard() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/15 dark:bg-warning/10 p-4 flex items-start gap-3">
      <ShieldAlert className="size-5 text-attention shrink-0 mt-0.5" aria-hidden />
      <p className="text-body text-attention">{t("phase.guardNotice", { phase: "Phase 3" })}</p>
    </div>
  );
}

function PreviewTile({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof BookOpen;
  title: string;
  desc: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className="rounded-xl border p-4 opacity-60 pointer-events-none"
      aria-disabled="true"
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
        <Badge variant="secondary" className="text-caption">
          {t("misc.nextPhase")}
        </Badge>
      </div>
      <p className="text-body font-medium mt-2">{title}</p>
      <p className="text-caption text-muted-foreground">{desc}</p>
    </div>
  );
}
