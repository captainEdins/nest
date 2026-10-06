"use client";

/**
 * Shell header — 56px, solid background, no blur (design-system §6.3).
 * Logo (mobile) · role badge · language · theme · notification bell.
 */

import { Bell, Globe, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useI18n, LANGS } from "@/lib/i18n";
import type { SessionDto } from "@/lib/types";
import { useTenantOverview } from "@/hooks/use-overview";
import { useUIStore } from "@/lib/ui-store";
import { roleLabelKey } from "@/components/nest/nav";
import { NestLogo } from "@/components/nest/nest-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ShellHeader({ session }: { session: SessionDto }) {
  const { t, lang, setLang } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const setTab = useUIStore((s) => s.setTab);
  const setNotificationsOpen = useUIStore((s) => s.setNotificationsOpen);

  // Tenant: the bell navigates to the Notifications tab; unread dot comes
  // from the already-cached overview (no extra call).
  const isTenant = session.profile.role === "TENANT";
  const { data: tenantOverview } = useTenantOverview();
  const hasUndelivered = isTenant
    ? (tenantOverview?.notifications ?? []).some((n) => n.status === "QUEUED")
    : false;

  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  function onBellClick() {
    if (isTenant) {
      setTab("notifications");
    } else {
      setNotificationsOpen(true);
    }
  }

  return (
    <header className="sticky top-0 z-40 h-14 bg-background border-b">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center gap-2">
        {/* Logo + wordmark — the desktop sidebar carries it at ≥lg */}
        <div className="flex items-center gap-2 lg:hidden">
          <NestLogo className="h-7 w-7" />
          <span className="hidden sm:inline font-bold text-h3">NEST</span>
        </div>
        <Badge variant="secondary" className="text-caption px-2 py-0.5 rounded-full shrink-0">
          {t(roleLabelKey(session.profile.role))}
        </Badge>

        <div className="flex-1" />

        {/* Language */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 w-11" aria-label={t("misc.language")}>
              <Globe aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={lang}
              onValueChange={(value) => setLang(value as typeof lang)}
            >
              {LANGS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme */}
        <Button
          variant="ghost"
          className="h-11 w-11"
          onClick={() => setTheme(nextTheme)}
          aria-label={resolvedTheme === "dark" ? t("misc.lightMode") : t("misc.darkMode")}
        >
          {resolvedTheme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          className="relative h-11 w-11"
          onClick={onBellClick}
          aria-label={t("notifications.title")}
        >
          <Bell aria-hidden />
          {hasUndelivered ? (
            <span
              aria-hidden
              className="absolute top-2.5 right-2.5 size-2 rounded-full bg-primary"
            />
          ) : null}
        </Button>
      </div>
    </header>
  );
}
