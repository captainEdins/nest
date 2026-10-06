"use client";

/**
 * S-15 · More / Settings sheet content (shared by the mobile bottom drawer
 * and the desktop sidebar popover). Language, theme, install, sign out —
 * the only settings in Phase 1.
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Check, Download } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useI18n, LANGS } from "@/lib/i18n";
import type { SessionDto } from "@/lib/types";
import { useOutboxCount } from "@/hooks/use-outbox";
import { useUIStore } from "@/lib/ui-store";
import { MORE_TABS, roleLabelKey } from "@/components/nest/nav";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import { formatPhone } from "@/components/nest/shared/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/** Module store for the captured PWA install prompt (fires before open). */
let deferredInstallPrompt: (Event & { prompt: () => Promise<void> }) | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as Event & { prompt: () => Promise<void> };
    for (const listener of installListeners) listener();
  });
}

function useInstallState(): {
  available: boolean;
  installed: boolean;
  install: () => void;
} {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    const listener = () => force();
    installListeners.add(listener);
    const mql = window.matchMedia("(display-mode: standalone)");
    const onDisplayMode = () => setInstalled(mql.matches);
    onDisplayMode();
    mql.addEventListener("change", onDisplayMode);
    return () => {
      installListeners.delete(listener);
      mql.removeEventListener("change", onDisplayMode);
    };
  }, [force]);

  return {
    available: deferredInstallPrompt !== null,
    installed,
    install: () => {
      void deferredInstallPrompt?.prompt().finally(() => {
        deferredInstallPrompt = null;
        force();
      });
    },
  };
}

function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className="h-9 rounded-md text-label font-medium flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors"
          style={{ backgroundColor: value === option.value ? "var(--card)" : undefined }}
        >
          {value === option.value ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MoreSheetContent({ session }: { session: SessionDto }) {
  const { t, lang, setLang } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const outboxCount = useOutboxCount();
  const install = useInstallState();

  const signOut = useMutation({
    mutationFn: () => apiPost("/api/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "profiles" });
      useUIStore.setState({
        tab: "home",
        pushedScreen: null,
        moreOpen: false,
        notificationsOpen: false,
        matchPayment: null,
        receiptView: null,
        cashFlow: { open: false },
        stkRequest: { open: false },
        payFlowOpen: false,
        ticketViewId: null,
        reportIssueOpen: false,
        settleDeposit: { open: false },
      });
    },
    onError: () => toast.error(t("errors.somethingWrong")),
  });

  const setMoreOpen = useUIStore((s) => s.setMoreOpen);
  const setTab = useUIStore((s) => s.setTab);
  const overflowTabs = MORE_TABS[session.profile.role] ?? [];

  return (
    <div className="space-y-5">
      {/* User */}
      <div className="flex items-center gap-3">
        <AvatarInitials fullName={session.profile.fullName} />
        <div className="min-w-0">
          <p className="text-h3 font-semibold truncate">{session.profile.fullName}</p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {formatPhone(session.profile.phone)} · {t(roleLabelKey(session.profile.role))}
          </p>
        </div>
      </div>

      <Separator />

      {/* Overflow tabs that lost their bottom-nav slot (Phase 2) */}
      {overflowTabs.length > 0 ? (
        <div className="space-y-1">
          {overflowTabs.map((def) => {
            const Icon = def.icon;
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => {
                  setTab(def.id);
                  setMoreOpen(false);
                }}
                className="w-full h-11 px-3 rounded-md flex items-center gap-3 text-body focus-visible:ring-2 focus-visible:ring-ring outline-none hover:bg-secondary/60 transition-colors"
              >
                <Icon className="size-4" aria-hidden />
                <span className="flex-1 text-left">{t(def.labelKey)}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Language */}
      <div className="space-y-2">
        <p className="text-label font-medium text-muted-foreground">{t("misc.language")}</p>
        <Segmented
          ariaLabel={t("misc.language")}
          options={LANGS.map((l) => ({ value: l.value, label: t(`lang.${l.value}` as const) }))}
          value={lang}
          onChange={(value) => setLang(value as typeof lang)}
        />
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <p className="text-label font-medium text-muted-foreground">{t("more.theme")}</p>
        <Segmented
          ariaLabel={t("more.theme")}
          options={[
            { value: "light", label: t("more.themeLight") },
            { value: "dark", label: t("more.themeDark") },
          ]}
          value={resolvedTheme === "dark" ? "dark" : "light"}
          onChange={(value) => setTheme(value)}
        />
      </div>

      {/* Install app */}
      {install.available || install.installed ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Download className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <p className="text-body truncate">{t("common.installApp")}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            disabled={install.installed}
            onClick={install.install}
          >
            {install.installed ? t("pwa.installed") : t("common.installApp")}
          </Button>
        </div>
      ) : null}

      {/* Offline outbox status */}
      {outboxCount > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-body truncate">{t("offline.queuedForSync")}</p>
          <Badge className="bg-warning text-warning-foreground border-transparent text-caption tabular-nums">
            {outboxCount}
          </Badge>
        </div>
      ) : null}

      <Separator />

      {/* Sign out — destructive outline (design-system §4 dark rule) */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full h-11 sm:h-10 border-destructive text-destructive bg-transparent",
              "dark:bg-transparent hover:bg-destructive/10",
            )}
          >
            {t("common.signOut")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-h3">{t("more.signOutConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("more.signOutDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => signOut.mutate()} disabled={signOut.isPending}>
              {t("common.signOut")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
