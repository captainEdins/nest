"use client";

/**
 * NEST — app root (Task 2-b).
 *
 * Providers → I18nProvider → auth gate (["auth","me"]) → login (S-01) or the
 * role shell (S-02): header, offline banner, tab content, sticky footer,
 * mobile bottom nav / desktop sidebar, and the global flow modals.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { apiGetSession, setUnauthorizedHandler } from "@/lib/api";
import { I18nProvider, useI18n, en as enDict, sw as swDict } from "@/lib/i18n";
import type { Role, SessionDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { syncOutbox } from "@/hooks/use-outbox";
import { useCaretakerOverview, useLandlordOverview } from "@/hooks/use-overview";
import { Providers } from "@/components/nest/providers";
import { LoginScreen } from "@/components/nest/login-screen";
import { ShellHeader } from "@/components/nest/shell-header";
import { BottomNav } from "@/components/nest/bottom-nav";
import { DesktopSidebar } from "@/components/nest/desktop-sidebar";
import { AppFooter } from "@/components/nest/app-footer";
import { OfflineBanner } from "@/components/nest/offline-banner";
import { TABS } from "@/components/nest/nav";
import { FullShellSkeleton } from "@/components/nest/shared/skeletons";
import { ErrorState } from "@/components/nest/shared/error-state";
import { LandlordHome } from "@/components/nest/landlord/home";
import { ArrearsScreen } from "@/components/nest/shared/arrears-screen";
import { PaymentsLedger } from "@/components/nest/landlord/payments-ledger";
import { PropertiesScreen } from "@/components/nest/landlord/properties";
import { LandlordTickets } from "@/components/nest/landlord/tickets";
import { SettleDepositModal } from "@/components/nest/landlord/settle-deposit";
import { CaretakerHome } from "@/components/nest/caretaker/home";
import { CaretakerUnits } from "@/components/nest/caretaker/units";
import { CaretakerTickets } from "@/components/nest/caretaker/tickets";
import { TenantHome } from "@/components/nest/tenant/home";
import { TenantTickets } from "@/components/nest/tenant/tickets";
import { TenantReceiptsScreen } from "@/components/nest/tenant/receipts";
import { TenantNotificationsScreen, NotificationsModal } from "@/components/nest/shared/notifications";
import { AgentHome } from "@/components/nest/agent/home";
import { GuardHome } from "@/components/nest/guard/home";
import { GuardVisitors } from "@/components/nest/guard/visitors";
import { GuardIncidents } from "@/components/nest/guard/incidents";
import { GuardShiftLog } from "@/components/nest/guard/shift-log";
import { LogVisitorSheet } from "@/components/nest/guard/log-visitor-sheet";
import { ReportIncidentSheet } from "@/components/nest/guard/report-incident-sheet";
import { StartShiftSheet } from "@/components/nest/guard/start-shift-sheet";
import { EndShiftSheet } from "@/components/nest/guard/end-shift-sheet";
import { SecurityScreen } from "@/components/nest/shared/security/security-screen";
import { MatchModal } from "@/components/nest/landlord/match-modal";
import { CashFlowModal } from "@/components/nest/caretaker/cash-collection";
import { StkRequestModal } from "@/components/nest/caretaker/stk-request";
import { PayFlowModal } from "@/components/nest/tenant/pay-flow";
import { ReceiptDetailModal } from "@/components/nest/shared/receipt-detail";
import { TicketDetailScreen } from "@/components/nest/shared/ticket-detail";
import { ReportIssueSheet } from "@/components/nest/shared/report-issue-sheet";
import { DepositDetailScreen } from "@/components/nest/shared/deposit-detail";
import { MoreSheetContent } from "@/components/nest/shared/more-sheet";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function AppShell() {
  return (
    <Providers>
      <I18nProvider>
        <AuthGate />
      </I18nProvider>
    </Providers>
  );
}

/** 401 anywhere → session invalidated, back to S-01 (neutral, no error noise). */
function useUnauthorizedHandler() {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      // Only treat as "session expired" when a session actually existed —
      // a signed-out visitor probing /api/auth/me is a normal state, never a toast.
      const hadSession = queryClient.getQueryData(["auth", "me"]) != null;
      queryClient.setQueryData(["auth", "me"], null);
      // Cancel in-flight queries first so late responses cannot repopulate
      // data for a signed-out role; then drop cached data EXCEPT the auth
      // probe itself (removing it re-creates the query → refetch loop).
      void queryClient.cancelQueries({
        predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "profiles",
      });
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "profiles",
      });
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
        logVisitorOpen: false,
        reportIncidentOpen: false,
        startShiftOpen: false,
        endShiftOpen: false,
        securitySegment: "visitors",
      });
      if (hadSession) {
        // Neutral toast outside React — read the persisted language directly.
        let lang: "en" | "sw" = "en";
        try {
          if (window.localStorage.getItem("nest-lang") === "sw") lang = "sw";
        } catch {
          /* storage unavailable */
        }
        toast(lang === "sw" ? swDict["errors.sessionExpired"] : enDict["errors.sessionExpired"]);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);
}

function AuthGate() {
  useUnauthorizedHandler();
  const { data: session, isPending, error, refetch } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: apiGetSession,
    staleTime: 5 * 60_000,
  });

  if (isPending) return <FullShellSkeleton />;
  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <ErrorState onRetry={() => refetch()} />
        </div>
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <Shell session={session} />;
}

function Shell({ session }: { session: SessionDto }) {
  const { t, setLang } = useI18n();
  const queryClient = useQueryClient();
  const tab = useUIStore((s) => s.tab);
  const pushedScreen = useUIStore((s) => s.pushedScreen);
  const popScreen = useUIStore((s) => s.popScreen);
  const ticketViewId = useUIStore((s) => s.ticketViewId);
  const moreOpen = useUIStore((s) => s.moreOpen);
  const setMoreOpen = useUIStore((s) => s.setMoreOpen);
  const role: Role = session.profile.role;

  // Seed the profile's language once (a stored device choice outranks it).
  const langSyncedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (langSyncedFor.current === session.profile.id) return;
    langSyncedFor.current = session.profile.id;
    try {
      if (window.localStorage.getItem("nest-lang") === null) {
        setLang(session.profile.language);
      }
    } catch {
      /* storage unavailable — keep current language */
    }
  }, [session.profile.id, session.profile.language, setLang]);

  // Outbox: retry when back online (D-012) and once after (re)login.
  React.useEffect(() => {
    async function trySync() {
      if (!navigator.onLine) return;
      const synced = await syncOutbox();
      if (synced > 0) {
        toast.success(t("offline.itemsSynced", { count: synced }));
        void queryClient.invalidateQueries();
      }
    }
    window.addEventListener("online", trySync);
    void trySync();
    return () => window.removeEventListener("online", trySync);
  }, [session.profile.id]);

  const tabs = TABS[role];

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <ShellHeader session={session} />
      <OfflineBanner />

      <DesktopSidebar session={session} />

      <div className="flex-1 flex flex-col w-full lg:pl-[264px]">
        <main
          id="main"
          className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6"
        >
          {pushedScreen === "arrears" && role === "CARETAKER" ? (
            <section aria-label={t("landlord.arrears")}>
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={popScreen} aria-label={t("common.back")}>
                  <ArrowLeft aria-hidden />
                </Button>
                <h1 className="text-h2 font-semibold">{t("landlord.arrears")}</h1>
              </div>
              <CaretakerArrears />
            </section>
          ) : pushedScreen === "ticket" && ticketViewId != null ? (
            <section aria-label={t("repairs.title")}>
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={popScreen} aria-label={t("common.back")}>
                  <ArrowLeft aria-hidden />
                </Button>
                <h1 className="text-h2 font-semibold">{t("repairs.title")}</h1>
              </div>
              <TicketDetailScreen ticketId={ticketViewId} />
            </section>
          ) : pushedScreen === "deposit" && role === "TENANT" ? (
            <section aria-label={t("deposit.title")}>
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={popScreen} aria-label={t("common.back")}>
                  <ArrowLeft aria-hidden />
                </Button>
                <h1 className="text-h2 font-semibold">{t("deposit.title")}</h1>
              </div>
              <DepositDetailScreen />
            </section>
          ) : pushedScreen === "shift" && role === "GUARD" ? (
            <section aria-label={t("guard.shiftLog")}>
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={popScreen} aria-label={t("common.back")}>
                  <ArrowLeft aria-hidden />
                </Button>
                <h1 className="text-h2 font-semibold">{t("guard.shiftLog")}</h1>
              </div>
              <GuardShiftLog />
            </section>
          ) : (
            <TabContent role={role} tab={tab} />
          )}
        </main>
        <AppFooter />
      </div>

      <BottomNav tabs={tabs} />

      {/* Global flow modals (role-scoped) */}
      {role === "CARETAKER" ? <CashFlowModal /> : null}
      {role === "CARETAKER" ? <StkRequestModal /> : null}
      {role === "TENANT" ? <PayFlowModal /> : null}
      {role === "LANDLORD" || role === "CARETAKER" ? <MatchModal /> : null}
      {role !== "GUARD" ? <ReceiptDetailModal /> : null}
      {role !== "TENANT" ? (
        <NotificationsModal matchTab={role === "LANDLORD" ? "payments" : role === "CARETAKER" ? "collections" : null} />
      ) : null}
      {/* Phase 2: report-an-issue sheet (tenant + caretaker) */}
      {role === "TENANT" || role === "CARETAKER" ? <ReportIssueSheet /> : null}
      {/* Phase 2: deposit settlement (landlord only) */}
      {role === "LANDLORD" ? <SettleDepositModal /> : null}
      {/* Phase 3: guard flow sheets (guard only) */}
      {role === "GUARD" ? (
        <>
          <LogVisitorSheet />
          <ReportIncidentSheet />
          <StartShiftSheet />
          <EndShiftSheet />
        </>
      ) : null}

      {/* Mobile "More" drawer (S-15) */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>{t("nav.more")}</DrawerTitle>
            <DrawerDescription>{t("misc.settings")}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <MoreSheetContent session={session} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function TabContent({ role, tab }: { role: Role; tab: string }) {
  switch (role) {
    case "LANDLORD": {
      if (tab === "arrears") return <LandlordArrears />;
      if (tab === "payments") return <PaymentsLedger variant="landlord" />;
      if (tab === "properties") return <PropertiesScreen />;
      if (tab === "repairs") return <LandlordTickets />;
      if (tab === "security") return <SecurityScreen />;
      return <LandlordHome />;
    }
    case "CARETAKER": {
      if (tab === "units") return <CaretakerUnits />;
      if (tab === "collections") return <PaymentsLedger variant="caretaker" />;
      if (tab === "repairs") return <CaretakerTickets />;
      if (tab === "security") return <SecurityScreen />;
      return <CaretakerHome />;
    }
    case "TENANT": {
      if (tab === "receipts") return <TenantReceiptsScreen />;
      if (tab === "notifications") return <TenantNotificationsScreen />;
      if (tab === "repairs") return <TenantTickets />;
      return <TenantHome />;
    }
    case "AGENT":
      return <AgentHome />;
    case "GUARD": {
      if (tab === "visitors") return <GuardVisitors />;
      if (tab === "incidents") return <GuardIncidents />;
      return <GuardHome />;
    }
  }
}

/** Landlord arrears tab (S-11) — data from the cached overview. */
function LandlordArrears() {
  const { data, isPending, error, refetch } = useLandlordOverview();
  return (
    <ArrearsScreen
      rows={data?.arrears ?? []}
      totalMinor={data?.totals.arrearsMinor ?? 0}
      tenantCount={data?.totals.arrearsTenantCount ?? 0}
      isPending={isPending}
      error={error != null}
      onRetry={() => refetch()}
    />
  );
}

/** Caretaker pushed arrears screen (S-11 via S-05 hero). */
function CaretakerArrears() {
  const { data, isPending, error, refetch } = useCaretakerOverview();
  return (
    <ArrearsScreen
      rows={data?.arrears ?? []}
      totalMinor={data?.totals.arrearsMinor ?? 0}
      tenantCount={data?.totals.arrearsTenantCount ?? 0}
      isPending={isPending}
      error={error != null}
      onRetry={() => refetch()}
    />
  );
}
