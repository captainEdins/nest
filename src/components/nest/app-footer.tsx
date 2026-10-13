"use client";

/**
 * S-16 · Footer — brand line + sandbox honesty. Sticks to the bottom of the
 * viewport on short pages, pushed down naturally on long pages (mt-auto inside
 * the shell's flex column). Never fixed, never interactive.
 */

import { useI18n } from "@/lib/i18n";

export function AppFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto pb-24 lg:pb-8 pt-6 px-4 sm:px-6 lg:px-8 print:hidden">
      {/* Phase 18 (D-031): the hairline anchors the footer to the content
          column — a floating centered block read as an afterthought. */}
      <div className="max-w-7xl mx-auto border-t border-border/60 pt-4 text-center space-y-0.5">
        <p className="text-caption text-muted-foreground">NEST — {t("footer.madeFor")}</p>
        <p className="text-caption text-muted-foreground">{t("footer.sandbox")}</p>
        <p className="text-caption text-muted-foreground tabular-nums">
          {t("misc.phaseNotice", { phase: "Phase 20" })} · v0.20.0
        </p>
      </div>
    </footer>
  );
}
