"use client";

/** Per-role tab definitions (binding — screen-specs S-02 / design-system §6.1). */

import {
  AlertTriangle,
  Bell,
  Building2,
  DoorOpen,
  Home,
  Receipt,
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
    { id: "properties", labelKey: "nav.properties", icon: Building2 },
  ],
  CARETAKER: [
    { id: "home", labelKey: "nav.home", icon: Home },
    { id: "units", labelKey: "nav.units", icon: DoorOpen },
    { id: "collections", labelKey: "nav.collections", icon: Receipt },
  ],
  TENANT: [
    { id: "home", labelKey: "nav.home", icon: Home },
    { id: "receipts", labelKey: "nav.receipts", icon: Receipt },
    { id: "notifications", labelKey: "nav.notifications", icon: Bell },
  ],
  AGENT: [{ id: "home", labelKey: "nav.home", icon: Home }],
  GUARD: [{ id: "home", labelKey: "nav.home", icon: Home }],
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
