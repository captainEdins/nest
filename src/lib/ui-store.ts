"use client";

/**
 * NEST — global SPA UI state (single-route app, D-004).
 *
 * Cross-screen actions (open a flow modal, push a secondary screen, switch
 * tabs, open the More sheet) live here instead of prop drilling through the
 * shell. Data state lives in TanStack Query; this store is UI-only.
 */

import { create } from "zustand";
import type { PaymentDto } from "./types";

export type TabId =
  | "home"
  | "arrears"
  | "payments"
  | "properties"
  | "units"
  | "collections"
  | "receipts"
  | "notifications"
  | "repairs"
  | "visitors" // Phase 3: guard gate register
  | "incidents" // Phase 3: guard incident queue
  | "security" // Phase 3: landlord/caretaker security digest (More tab)
  | "listings" // Phase 4: agent listings (the marketing funnel)
  | "applicants" // Phase 4: agent applicant pipeline
  | "analytics" // Phase 5: landlord analytics dashboard (More tab)
  | "kra" // Phase 5: landlord KRA/MRI tax assistant (More tab)
  | "statement" // Phase 6: tenant monthly statement (More tab)
;
export type PaymentsFilter = "ALL" | "MPESA" | "CASH" | "UNMATCHED";

/** Receipt detail opened from a payment row (payment = fallback data). */
export interface ReceiptView {
  receiptNo: string;
  fallbackPayment?: PaymentDto;
}

interface UIState {
  /** Active bottom-nav / sidebar tab. */
  tab: TabId;
  setTab: (tab: TabId) => void;
  /** Secondary screen pushed over the tab content (caretaker arrears; Phase 2: ticket + deposit detail; Phase 3: guard shift log; Phase 4: listing + application detail). */
  pushedScreen: "arrears" | "ticket" | "deposit" | "shift" | "listing" | "application" | null;
  /** Tenancy whose deposit the pushed screen shows (caretaker, Phase 3); tenants use /api/deposits/mine. */
  depositTenancyId: string | null;
  /** Listing whose detail the pushed screen shows (Phase 4, agent + landlord). */
  listingViewId: string | null;
  /** Application whose detail the pushed screen shows (Phase 4, agent + landlord). */
  applicationViewId: string | null;
  pushArrears: () => void;
  pushDeposit: (tenancyId?: string) => void;
  pushShiftLog: () => void;
  openListing: (id: string) => void;
  openApplication: (id: string) => void;
  popScreen: () => void;
  /** Payments ledger filter (S-17a); the unmatched alert card presets it. */
  paymentsFilter: PaymentsFilter;
  setPaymentsFilter: (filter: PaymentsFilter) => void;
  /** Mobile "More" drawer (S-15). */
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
  /** Notifications modal for the header bell (non-tenant roles). */
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  /** Unmatched-payment match flow (S-04), landlord + caretaker. */
  matchPayment: PaymentDto | null;
  openMatch: (payment: PaymentDto) => void;
  closeMatch: () => void;
  /** Receipt detail (S-10b). */
  receiptView: ReceiptView | null;
  openReceipt: (view: ReceiptView) => void;
  closeReceipt: () => void;
  /** Cash collection flow (S-06), caretaker. */
  cashFlow: { open: boolean; tenancyId?: string };
  openCashFlow: (tenancyId?: string) => void;
  closeCashFlow: () => void;
  /** Caretaker M-Pesa request flow (S-07). */
  stkRequest: { open: boolean; tenancyId?: string };
  openStkRequest: (tenancyId?: string) => void;
  closeStkRequest: () => void;
  /** Tenant pay flow (S-09). */
  payFlowOpen: boolean;
  setPayFlowOpen: (open: boolean) => void;
  /** Repair ticket detail pushed screen (Phase 2) — id of the ticket to load. */
  ticketViewId: string | null;
  openTicket: (id: string) => void;
  /** Report-an-issue sheet (Phase 2), tenant + caretaker. */
  reportIssueOpen: boolean;
  setReportIssueOpen: (open: boolean) => void;
  /** Deposit settlement flow (Phase 2), landlord. */
  settleDeposit: { open: boolean; tenancyId?: string };
  openSettleDeposit: (tenancyId: string) => void;
  closeSettleDeposit: () => void;
  /** Log-visitor sheet (Phase 3), guard. */
  logVisitorOpen: boolean;
  setLogVisitorOpen: (open: boolean) => void;
  /** Report-incident sheet (Phase 3), guard. */
  reportIncidentOpen: boolean;
  setReportIncidentOpen: (open: boolean) => void;
  /** Start-shift sheet (Phase 3), guard. */
  startShiftOpen: boolean;
  setStartShiftOpen: (open: boolean) => void;
  /** End-shift sheet (Phase 3), guard. */
  endShiftOpen: boolean;
  setEndShiftOpen: (open: boolean) => void;
  /** Security screen segment (Phase 3), landlord/caretaker. */
  securitySegment: "visitors" | "incidents" | "shifts";
  setSecuritySegment: (segment: "visitors" | "incidents" | "shifts") => void;
  /** Landlord listings screen segment (Phase 4) — Listings | Applicants; the home
   *  attention card presets "applicants" (the decision queue), like the security
   *  card presets the incident queue. */
  listingsSegment: "listings" | "applicants";
  setListingsSegment: (segment: "listings" | "applicants") => void;
  /** Create-listing sheet (Phase 4), agent. */
  createListingOpen: boolean;
  setCreateListingOpen: (open: boolean) => void;
  /** Record-applicant sheet (Phase 4), agent — optionally anchored to a listing. */
  recordApplicantOpen: boolean;
  recordApplicantListingId: string | null;
  openRecordApplicant: (listingId?: string) => void;
  closeRecordApplicant: () => void;
  /** Move-in sheet (Phase 8, issue #72), landlord — anchored to an APPROVED
   *  application; prefills rent/deposit from the listing of record. */
  moveInOpen: boolean;
  moveInApplicationId: string | null;
  openMoveIn: (applicationId: string) => void;
  closeMoveIn: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  tab: "home",
  setTab: (tab) => set({ tab, pushedScreen: null }),
  pushedScreen: null,
  depositTenancyId: null,
  listingViewId: null,
  applicationViewId: null,
  pushArrears: () => set({ pushedScreen: "arrears" }),
  pushDeposit: (tenancyId) => set({ pushedScreen: "deposit", depositTenancyId: tenancyId ?? null }),
  pushShiftLog: () => set({ pushedScreen: "shift" }),
  openListing: (id) => set({ pushedScreen: "listing", listingViewId: id }),
  openApplication: (id) => set({ pushedScreen: "application", applicationViewId: id }),
  popScreen: () =>
    set({ pushedScreen: null, depositTenancyId: null, listingViewId: null, applicationViewId: null }),
  paymentsFilter: "ALL",
  setPaymentsFilter: (paymentsFilter) => set({ paymentsFilter }),
  moreOpen: false,
  setMoreOpen: (moreOpen) => set({ moreOpen }),
  notificationsOpen: false,
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  matchPayment: null,
  openMatch: (payment) => set({ matchPayment: payment }),
  closeMatch: () => set({ matchPayment: null }),
  receiptView: null,
  openReceipt: (receiptView) => set({ receiptView }),
  closeReceipt: () => set({ receiptView: null }),
  cashFlow: { open: false },
  openCashFlow: (tenancyId) => set({ cashFlow: { open: true, tenancyId } }),
  closeCashFlow: () => set({ cashFlow: { open: false } }),
  stkRequest: { open: false },
  openStkRequest: (tenancyId) => set({ stkRequest: { open: true, tenancyId } }),
  closeStkRequest: () => set({ stkRequest: { open: false } }),
  payFlowOpen: false,
  setPayFlowOpen: (payFlowOpen) => set({ payFlowOpen }),
  ticketViewId: null,
  openTicket: (id) => set({ pushedScreen: "ticket", ticketViewId: id }),
  reportIssueOpen: false,
  setReportIssueOpen: (reportIssueOpen) => set({ reportIssueOpen }),
  settleDeposit: { open: false },
  openSettleDeposit: (tenancyId) => set({ settleDeposit: { open: true, tenancyId } }),
  closeSettleDeposit: () => set({ settleDeposit: { open: false } }),
  logVisitorOpen: false,
  setLogVisitorOpen: (logVisitorOpen) => set({ logVisitorOpen }),
  reportIncidentOpen: false,
  setReportIncidentOpen: (reportIncidentOpen) => set({ reportIncidentOpen }),
  startShiftOpen: false,
  setStartShiftOpen: (startShiftOpen) => set({ startShiftOpen }),
  endShiftOpen: false,
  setEndShiftOpen: (endShiftOpen) => set({ endShiftOpen }),
  securitySegment: "visitors",
  setSecuritySegment: (securitySegment) => set({ securitySegment }),
  listingsSegment: "listings",
  setListingsSegment: (listingsSegment) => set({ listingsSegment }),
  createListingOpen: false,
  setCreateListingOpen: (createListingOpen) => set({ createListingOpen }),
  recordApplicantOpen: false,
  recordApplicantListingId: null,
  openRecordApplicant: (listingId) =>
    set({ recordApplicantOpen: true, recordApplicantListingId: listingId ?? null }),
  closeRecordApplicant: () =>
    set({ recordApplicantOpen: false, recordApplicantListingId: null }),
  moveInOpen: false,
  moveInApplicationId: null,
  openMoveIn: (applicationId) => set({ moveInOpen: true, moveInApplicationId: applicationId }),
  closeMoveIn: () => set({ moveInOpen: false, moveInApplicationId: null }),
}));
