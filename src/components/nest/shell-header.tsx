"use client";

/**
 * Shell header — 56px, solid background, no blur (design-system §6.3).
 * Logo (mobile) · role badge · language · theme · notification bell.
 */

import { Bell, Globe, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useI18n, LANGS } from "@/lib/i18n";
import type { SessionDto } from "@/lib/types";
import { useUnreadCount } from "@/hooks/use-overview";
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
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);

  // Tenant: the bell navigates to the Notifications tab. Phase 7: every role
  // gets a numeric unread badge from the cheap 30s poll (read-state, not
  // delivery-state — IN_APP rows are SENT on creation, so the old QUEUED dot
  // almost never showed).
  const isTenant = session.profile.role === "TENANT";
  const { data: unread } = useUnreadCount();

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

        {/* Global search (Phase 10, issue #76) — Monty top-bar search pattern.
         *  Mobile: 44px icon button. Desktop: labelled pill with the platform
         *  kbd hint (⌘ K on Apple, Ctrl K elsewhere — same physical chord). */}
        <Button
          variant="ghost"
          onClick={() => setSearchOpen(true)}
          aria-label={t("search.trigger")}
          aria-keyshortcuts="Control+K Meta+K"
          className="h-11 gap-2 px-2.5 sm:px-3 text-muted-foreground"
        >
          <Search size={18} aria-hidden />
          <span className="hidden md:inline text-body-sm">{t("search.trigger")}…</span>
          <kbd className="hidden md:inline text-caption px-1.5 py-0.5 rounded-md border bg-muted tabular-nums">
            {/Mac|iPhone|iPad/.test(
              typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent,
            )
              ? "⌘ K"
              : "Ctrl K"}
          </kbd>
        </Button>

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

        {/* Notifications — Phase 7 badge shows unread count (9+ beyond 9) */}
        <Button
          variant="ghost"
          className="relative h-11 w-11"
          onClick={onBellClick}
          aria-label={
            unread
              ? `${t("notifications.title")} — ${t("notifications.unreadCount", { count: unread })}`
              : t("notifications.title")
          }
        >
          <Bell aria-hidden />
          {unread ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-caption font-semibold tabular-nums flex items-center justify-center shadow-sm"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </div>
    </header>
  );
}
