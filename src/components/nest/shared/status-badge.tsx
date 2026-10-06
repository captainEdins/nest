"use client";

/**
 * Status badge — exact mapping from design-system §9.2.
 * Never color-only: every badge carries an icon + text label.
 */

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleAlert,
  Clock,
  DoorOpen,
  Flag,
  HelpCircle,
  Landmark,
  Smartphone,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";

type BadgeStyle = {
  className: string
  icon: LucideIcon
  labelKey: TranslationKey
}

const STYLES: Record<string, BadgeStyle> = {
  // Charge / payment statuses
  PAID: { className: "bg-success text-success-foreground border-transparent", icon: CheckCircle2, labelKey: "status.paid" },
  PART: { className: "bg-warning text-warning-foreground border-transparent", icon: AlertTriangle, labelKey: "status.partial" },
  UNPAID: { className: "bg-warning text-warning-foreground border-transparent", icon: AlertTriangle, labelKey: "status.unpaid" },
  PENDING: { className: "bg-warning text-warning-foreground border-transparent", icon: Clock, labelKey: "status.pending" },
  UNMATCHED: { className: "border border-warning text-attention bg-transparent", icon: HelpCircle, labelKey: "status.unmatched" },
  COMPLETED: { className: "border border-success text-success bg-transparent", icon: CheckCircle2, labelKey: "status.completed" },
  REVERSED: { className: "bg-muted text-muted-foreground border-transparent", icon: XCircle, labelKey: "status.reversed" },
  // Unit / tenancy statuses
  VACANT: { className: "bg-muted text-muted-foreground border-transparent", icon: DoorOpen, labelKey: "status.vacant" },
  OCCUPIED: { className: "border border-success text-success bg-transparent", icon: CheckCircle2, labelKey: "status.occupied" },
  NOTICE: { className: "border border-warning text-attention bg-transparent", icon: Flag, labelKey: "status.onNotice" },
  ACTIVE: { className: "border border-success text-success bg-transparent", icon: CheckCircle2, labelKey: "status.active" },
  // Notification statuses
  QUEUED: { className: "bg-muted text-muted-foreground border-transparent", icon: Clock, labelKey: "status.queued" },
  SENT: { className: "bg-secondary text-secondary-foreground border-transparent", icon: CheckCircle2, labelKey: "status.sent" },
  FAILED: { className: "bg-warning text-warning-foreground border-transparent", icon: XCircle, labelKey: "status.failed" },
  // Payment sources
  MPESA: { className: "bg-secondary text-secondary-foreground border-transparent", icon: Smartphone, labelKey: "source.mpesa" },
  CASH: { className: "bg-secondary text-secondary-foreground border-transparent", icon: Banknote, labelKey: "source.cash" },
  BANK: { className: "bg-secondary text-secondary-foreground border-transparent", icon: Landmark, labelKey: "source.bank" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const style = STYLES[status];
  if (!style) {
    // Unknown status: still label + icon (never color-only).
    return (
      <Badge variant="secondary" className={className}>
        <CircleAlert aria-hidden />
        {status}
      </Badge>
    );
  }
  const Icon = style.icon;
  return (
    <Badge className={`${style.className} text-caption ${className ?? ""}`}>
      <Icon aria-hidden />
      {t(style.labelKey)}
    </Badge>
  );
}
