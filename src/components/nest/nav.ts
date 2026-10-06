"use client";

/** Per-role tab definitions (binding — screen-specs S-02 / design-system §6.1). */

import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  ChartColumn,
  DoorOpen,
  Home,
  Landmark,
  Megaphone,
  Receipt,
  Shield,
  ShieldAlert,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n/en";
import type { Role } from "@/lib/types";
import type { TabId } from "@/lib/ui-store";

export interface TabDef {
  id: TabId;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

/** Content tabs per role (max 4 — the 5th mobile slot is the More tab). */
export const TABS: Record<Role, TabDef[]> = {
  LANDLORD: [
    { id: "home", labelKey: "nav.home", icon: Home },
    { id: "arrears", labelKey: "nav.arrears", icon: AlertTriangle },
    { id: "payments", labelKey: "nav.payments", icon: Receipt },
    { id: "repairs", labelKey: "nav.repairs", icon: Wrench },
  ],
  CARETAKER: [
    { id: "home", labelKey: "nav.home", icon: Home },
    { id: "units", labelKey: "nav.units", icon: DoorOpen },
    { id: "collections", labelKey: "nav.collections", icon: Receipt },
    { id: "repairs", labelKey: "nav.repairs", icon: Wrench },
  ],
  TENANT: [
    { id: "home", labelKey: "nav.home", icon: Home },
    { id: "repairs", labelKey: "nav.repairs", icon: Wrench },
    { id: "receipts", labelKey: "nav.receipts", icon: Receipt },
    { id: "notifications", labelKey: "nav.notifications", icon: Bell },
  ],
  AGENT: [
    { id: "home", labelKey: "nav.home", icon: Home },
    { id: "listings", labelKey: "nav.listings", icon: Megaphone },
    { id: "applicants", labelKey: "nav.applicants", icon: Users },
  ],
  GUARD: [
    { id: "home", labelKey: "nav.home", icon: Home },
    { id: "visitors", labelKey: "nav.visitors", icon: BookOpen },
    { id: "incidents", labelKey: "nav.incidents", icon: ShieldAlert },
  ],
};

/**
 * Overflow tabs that lost their bottom-nav slot to a higher-priority Phase 2 tab
 * (mobile: reached via the More sheet; desktop sidebar appends them after TABS).
 * Landlord "listings" (Phase 4) is read-only funnel observation — matrix §4.2
 * (the agent runs the listings; the landlord decides on applicants).
 * Landlord "analytics" (Phase 5, issue #57) is the charts dashboard —
 * collection trend, arrears aging, occupancy.
 * Landlord "kra" (Phase 5, issue #59) is the Tax assistant — the MRI
 * monthly rent summary, 7.5% estimate and CSV export (record-keeping
 * assistance, never tax advice).
 */
export const MORE_TABS: Partial<Record<Role, TabDef[]>> = {
  LANDLORD: [
    { id: "properties", labelKey: "nav.properties", icon: Building2 },
    { id: "listings", labelKey: "nav.listings", icon: Megaphone },
    { id: "security", labelKey: "nav.security", icon: Shield },
    { id: "analytics", labelKey: "nav.analytics", icon: ChartColumn },
    { id: "kra", labelKey: "nav.taxAssistant", icon: Landmark },
  ],
  CARETAKER: [{ id: "security", labelKey: "nav.security", icon: Shield }],
};

export function roleLabelKey(role: Role): TranslationKey {
  switch (role) {
    case "LANDLORD":
      return "role.landlord";
    case "CARETAKER":
      return "role.caretaker";
    case "TENANT":
      return "role.tenant";
    case "AGENT":
      return "role.agent";
    case "GUARD":
      return "role.guard";
  }
}
