"use client";

/**
 * Mobile bottom tab bar — max 5 tabs (design-system §6.1); the last slot is
 * always the "More" tab (opens the S-15 sheet).
 *
 * Phase 9 (D-022): Monty floating dock — the bar detaches from the screen
 * edge (inset + 20px radius + layered shadow), and the active tab sits in a
 * soft primary-tint pill instead of a top hairline. Still 44px targets and
 * a solid bg-card surface (no backdrop-blur — caretaker low-end Android).
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
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] pt-1 pointer-events-none"
    >
      <div className="mx-auto max-w-lg flex h-16 items-stretch rounded-2xl bg-card border nest-float-shadow pointer-events-auto overflow-x-auto nest-scrollbar">
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
                "relative flex-1 min-h-11 min-w-16 flex flex-col items-center justify-center gap-1",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card outline-none",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 inset-y-1.5 -z-10 rounded-xl bg-primary/10"
                />
              ) : null}
              <Icon size={20} aria-hidden />
              <span className="text-label font-medium leading-4">{t(def.labelKey)}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className={cn(
            "relative flex-1 min-h-11 min-w-16 flex flex-col items-center justify-center gap-1",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card outline-none",
            moreOpen ? "text-primary" : "text-muted-foreground",
          )}
        >
          {moreOpen ? (
            <span
              aria-hidden
              className="absolute inset-x-2 inset-y-1.5 -z-10 rounded-xl bg-primary/10"
            />
          ) : null}
          <MoreHorizontal size={20} aria-hidden />
          <span className="text-label font-medium leading-4">{t("nav.more")}</span>
        </button>
      </div>
    </nav>
  );
}
