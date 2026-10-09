"use client";

/** Desktop sidebar — 264px fixed left (design-system §6.2).
 *  Phase 9 (D-022): Monty nav treatment — active pill (primary/10 tint,
 *  12px radius, leading icon colored), soft hover, brand lockup with the
 *  role chip in the pastel family. */

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import type { SessionDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { roleLabelKey, TABS, MORE_TABS } from "@/components/nest/nav";
import { MoreSheetContent } from "@/components/nest/shared/more-sheet";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import { useTenantOverview } from "@/hooks/use-overview";
import { NestLogo } from "@/components/nest/nest-logo";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DesktopSidebar({ session }: { session: SessionDto }) {
  const { t } = useI18n();
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  const tabs = React.useMemo(
    () => [...TABS[session.profile.role], ...(MORE_TABS[session.profile.role] ?? [])],
    [session.profile.role]
  );

  // Unread chip on the tenant's Notifications nav item (cached overview data).
  const { data: tenantOverview } = useTenantOverview();
  const undeliveredCount =
    session.profile.role === "TENANT"
      ? (tenantOverview?.notifications ?? []).filter((n) => n.status === "QUEUED").length
      : 0;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col bg-background border-r z-30">
      {/* Brand + role */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b">
        <NestLogo className="h-7 w-7" />
        <span className="font-bold text-h3">NEST</span>
        <Badge variant="secondary" className="text-caption px-2 py-0.5 rounded-full bg-primary/10 text-primary border-transparent dark:bg-primary/15">
          {t(roleLabelKey(session.profile.role))}
        </Badge>
      </div>

      {/* Nav items */}
      <nav aria-label={t("nav.home")} className="flex-1 overflow-y-auto p-3 space-y-1">
        {tabs.map((def) => {
          const Icon = def.icon;
          const active = tab === def.id;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => setTab(def.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "w-full h-10 px-3 rounded-xl flex items-center gap-3 text-body",
                "focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <Icon size={20} aria-hidden className={active ? "text-primary" : undefined} />
              <span className="flex-1 text-left truncate">{t(def.labelKey)}</span>
              {def.id === "notifications" && undeliveredCount > 0 ? (
                <span className="text-caption tabular-nums text-primary font-medium">
                  {undeliveredCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* User chip → More sheet (S-15) */}
      <div className="p-3 border-t">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full h-12 px-2 rounded-xl flex items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-ring outline-none hover:bg-muted transition-colors"
            >
              <AvatarInitials fullName={session.profile.fullName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium truncate">
                  {session.profile.fullName}
                </span>
                <span className="block text-caption text-muted-foreground truncate">
                  {t(roleLabelKey(session.profile.role))}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-80">
            <MoreSheetContent session={session} />
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}
