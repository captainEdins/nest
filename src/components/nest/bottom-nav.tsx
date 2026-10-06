"use client";

/**
 * Mobile bottom tab bar — fixed, 56px + safe-area, max 5 tabs (design-system
 * §6.1). The last slot is always the "More" tab (opens the S-15 sheet).
 */

import { MoreHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import type { TabDef } from "@/components/nest/nav";
import { cn } from "@/lib/utils";

export function BottomNav({ tabs }: { tabs: TabDef[] }) {
  const { t } = useI18n();
  const tab = useUIStore((s) => s.tab);
  const pushedScreen = useUIStore((s) => s.pushedScreen);
  const setTab = useUIStore((s) => s.setTab);
  const moreOpen = useUIStore((s) => s.moreOpen);
  const setMoreOpen = useUIStore((s) => s.setMoreOpen);

  return (
    <nav
      aria-label={t("nav.home")}
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-card border-t bottom-nav-safe"
    >
      <div className="flex h-14 max-w-7xl mx-auto">
        {tabs.map((def) => {
          const Icon = def.icon;
          const active = tab === def.id && pushedScreen === null;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => setTab(def.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex-1 min-h-11 flex flex-col items-center justify-center gap-1",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card outline-none",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {active ? (
                <span aria-hidden className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-primary" />
              ) : null}
              <Icon size={20} aria-hidden />
              <span className="text-label font-medium">{t(def.labelKey)}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className={cn(
            "relative flex-1 min-h-11 flex flex-col items-center justify-center gap-1",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card outline-none",
            moreOpen ? "text-primary" : "text-muted-foreground",
          )}
        >
          {moreOpen ? (
            <span aria-hidden className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-primary" />
          ) : null}
          <MoreHorizontal size={20} aria-hidden />
          <span className="text-label font-medium">{t("nav.more")}</span>
        </button>
      </div>
    </nav>
  );
}
