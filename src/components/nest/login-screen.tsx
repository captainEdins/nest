"use client";

/**
 * S-01 · Role Select (demo login).
 * Seeded demo identities as role cards (one per role, demo-story order) +
 * a manual phone-entry fallback (zod-validated Kenyan MSISDN).
 */

import * as React from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, Loader2, TriangleAlert } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { useI18n, LANGS } from "@/lib/i18n";
import type { ProfileDto, Role, SessionDto } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n/en";
import { useProfiles } from "@/hooks/use-overview";
import { syncOutbox } from "@/hooks/use-outbox";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import { formatPhone, normalizeKePhone } from "@/components/nest/shared/format";
import { NestLogo } from "@/components/nest/nest-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleSelectSkeleton } from "@/components/nest/shared/skeletons";
import { ErrorState } from "@/components/nest/shared/error-state";

const ROLE_ORDER: Role[] = ["LANDLORD", "CARETAKER", "TENANT", "AGENT", "GUARD"];

const ROLE_KEY: Record<Role, TranslationKey> = {
  LANDLORD: "role.landlord",
  CARETAKER: "role.caretaker",
  TENANT: "role.tenant",
  AGENT: "role.agent",
  GUARD: "role.guard",
};

const ROLE_DESC_KEY: Record<Role, TranslationKey> = {
  LANDLORD: "roleDesc.landlord",
  CARETAKER: "roleDesc.caretaker",
  TENANT: "roleDesc.tenant",
  AGENT: "roleDesc.agent",
  GUARD: "roleDesc.guard",
};

/** One card per role (first seeded profile of each), demo-story order. */
function pickDemoCards(profiles: ProfileDto[]): ProfileDto[] {
  return ROLE_ORDER.map((role) => profiles.find((p) => p.role === role)).filter(
    (p): p is ProfileDto => p !== undefined,
  );
}

const phoneSchema = z.string().refine((v) => normalizeKePhone(v) !== null, {
  message: "invalid",
});

export function LoginScreen() {
  const { t, lang, setLang } = useI18n();
  const queryClient = useQueryClient();
  const { data: profiles, isPending, error, refetch } = useProfiles();

  const [manualPhone, setManualPhone] = React.useState("");
  const [manualError, setManualError] = React.useState<string | null>(null);

  const login = useMutation({
    mutationFn: (phone: string) => apiPost<SessionDto>("/api/auth/login", { phone }),
    onSuccess: (session) => {
      // Drop any cached data from a previous session, then publish the session.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "profiles" });
      queryClient.setQueryData(["auth", "me"], session);
      // After login, retry any cash collections queued while offline (D-012).
      void syncOutbox().then((synced) => {
        if (synced > 0) toast.success(t("offline.itemsSynced", { count: synced }));
      });
    },
    onError: (e) => {
      const message =
        e instanceof ApiError && (e.code === "NETWORK" || e.code === "OFFLINE")
          ? t("errors.network")
          : t("errors.phoneLooksWrong");
      toast.error(message);
    },
  });

  const demoCards = React.useMemo(() => (profiles ? pickDemoCards(profiles) : []), [profiles]);
  const busyPhone = login.isPending ? login.variables ?? null : null;

  function signInWithCard(profile: ProfileDto) {
    if (login.isPending) return;
    login.mutate(profile.phone);
  }

  function signInManually(event: React.FormEvent) {
    event.preventDefault();
    const parsed = phoneSchema.safeParse(manualPhone.trim());
    if (!parsed.success) {
      setManualError(t("errors.phoneLooksWrong"));
      return;
    }
    setManualError(null);
    const normalized = normalizeKePhone(manualPhone.trim());
    if (normalized) login.mutate(normalized);
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background relative">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(90% 42% at 50% -8%, color-mix(in oklab, var(--primary) 9%, transparent) 0%, transparent 62%), radial-gradient(55% 28% at 8% 10%, color-mix(in oklab, var(--primary) 7%, transparent) 0%, transparent 60%)",
        }}
      />
      <main className="relative flex-1 w-full max-w-lg mx-auto px-4 py-8 sm:py-12 flex flex-col">
        {/* Language switcher — top right */}
        <div className="flex justify-end">
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
        </div>

        {/* Brand + tagline (the screen's h1) — Monty display scale */}
        <div className="flex flex-col items-center text-center gap-3 mt-2">
          <span className="grid place-items-center size-20 rounded-3xl bg-primary/10">
            <NestLogo className="size-14" />
          </span>
          <h1 className="text-[2rem] sm:text-[2.375rem] font-bold leading-tight tracking-tight">
            {t("app.tagline")}
          </h1>
          <p className="text-body-lg sm:text-body text-muted-foreground">{t("login.heading")}</p>
          <p className="text-caption text-muted-foreground max-w-xs">{t("login.demoNote")}</p>
        </div>

        {/* Demo identity cards */}
        <div className="mt-8 space-y-4">
          {isPending ? <RoleSelectSkeleton /> : null}
          {error ? <ErrorState onRetry={() => refetch()} /> : null}
          {demoCards.map((profile) => {
            const isBusy = busyPhone === profile.phone;
            const roleLabel = t(ROLE_KEY[profile.role]);
            return (
              <Card key={profile.id} className="border transition-transform duration-200 hover:-translate-y-0.5">
                <CardContent className="p-0">
                  <button
                    type="button"
                    disabled={login.isPending}
                    onClick={() => signInWithCard(profile)}
                    aria-label={`${profile.fullName}, ${roleLabel}`}
                    className="w-full min-h-16 text-left p-4 flex items-center gap-4 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60 transition-opacity"
                  >
                    {isBusy ? (
                      <span className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      </span>
                    ) : (
                      <AvatarInitials fullName={profile.fullName} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-h3 font-semibold truncate">{profile.fullName}</span>
                        <Badge
                          variant="secondary"
                          className="text-caption rounded-full bg-primary/10 text-primary border-transparent dark:bg-primary/15"
                        >
                          {roleLabel}
                        </Badge>
                      </div>
                      <p className="text-caption text-muted-foreground tabular-nums mt-0.5">
                        {formatPhone(profile.phone)}
                      </p>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {isBusy ? t("login.signingIn") : t(ROLE_DESC_KEY[profile.role])}
                      </p>
                    </div>
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Manual phone fallback */}
        <form onSubmit={signInManually} className="mt-8 space-y-2" noValidate>
          <Label htmlFor="login-phone" className="text-label">
            {t("login.phoneLabel")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="login-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={t("login.phonePlaceholder")}
              value={manualPhone}
              onChange={(e) => {
                setManualPhone(e.target.value);
                if (manualError) setManualError(null);
              }}
              aria-invalid={manualError ? true : undefined}
              className="h-11 sm:h-10"
            />
            <Button type="submit" disabled={login.isPending} className="h-11 sm:h-10 px-5">
              {login.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("login.signIn")}
            </Button>
          </div>
          {manualError ? (
            <p className="text-caption text-destructive" role="alert">
              {manualError}
            </p>
          ) : null}
        </form>

        {/* Sandbox honesty */}
        <p className="mt-auto pt-8 text-caption text-muted-foreground flex items-center justify-center gap-1.5 text-center">
          <TriangleAlert className="size-3.5 shrink-0 text-attention" aria-hidden />
          {t("footer.sandbox")}
        </p>
      </main>
    </div>
  );
}
