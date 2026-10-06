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
  | "repairs";

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
  /** Secondary screen pushed over the tab content (caretaker arrears; Phase 2: ticket + deposit detail). */
  pushedScreen: "arrears" | "ticket" | "deposit" | null;
  pushArrears: () => void;
  pushDeposit: () => void;
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
}

export const useUIStore = create<UIState>((set) => ({
  tab: "home",
  setTab: (tab) => set({ tab, pushedScreen: null }),
  pushedScreen: null,
  pushArrears: () => set({ pushedScreen: "arrears" }),
  pushDeposit: () => set({ pushedScreen: "deposit" }),
  popScreen: () => set({ pushedScreen: null }),
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
}));
