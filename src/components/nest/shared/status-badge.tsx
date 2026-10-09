"use client";

/**
 * Status badge — exact mapping from design-system §9.2, Phase 9 (D-022)
 * Monty pastel-chip treatment: soft `/opacity` tint + deep semantic text
 * instead of solid fills. Never color-only: every badge carries an icon +
 * text label (the icon keeps the chip readable even where the tint fails).
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
  // Charge / payment statuses — pastel tints (icon + label always present).
  PAID: { className: "bg-success/15 text-success border-transparent", icon: CheckCircle2, labelKey: "status.paid" },
  PART: { className: "bg-warning/15 text-attention border-transparent", icon: AlertTriangle, labelKey: "status.partial" },
  UNPAID: { className: "bg-warning/15 text-attention border-transparent", icon: AlertTriangle, labelKey: "status.unpaid" },
  PENDING: { className: "bg-warning/15 text-attention border-transparent", icon: Clock, labelKey: "status.pending" },
  UNMATCHED: { className: "border-warning/50 text-attention bg-warning/10", icon: HelpCircle, labelKey: "status.unmatched" },
  COMPLETED: { className: "border-success/40 text-success bg-success/10", icon: CheckCircle2, labelKey: "status.completed" },
  REVERSED: { className: "bg-muted text-muted-foreground border-transparent", icon: XCircle, labelKey: "status.reversed" },
  // Unit / tenancy statuses
  VACANT: { className: "bg-muted text-muted-foreground border-transparent", icon: DoorOpen, labelKey: "status.vacant" },
  OCCUPIED: { className: "border-success/40 text-success bg-success/10", icon: CheckCircle2, labelKey: "status.occupied" },
  NOTICE: { className: "border-warning/50 text-attention bg-warning/10", icon: Flag, labelKey: "status.onNotice" },
  ACTIVE: { className: "border-success/40 text-success bg-success/10", icon: CheckCircle2, labelKey: "status.active" },
  // Notification statuses
  QUEUED: { className: "bg-muted text-muted-foreground border-transparent", icon: Clock, labelKey: "status.queued" },
  SENT: { className: "bg-secondary text-secondary-foreground border-transparent", icon: CheckCircle2, labelKey: "status.sent" },
  FAILED: { className: "bg-warning/15 text-attention border-transparent", icon: XCircle, labelKey: "status.failed" },
  // Payment sources — neutral pills (a source is a fact, not a status).
  MPESA: { className: "bg-muted/70 text-muted-foreground border-transparent", icon: Smartphone, labelKey: "source.mpesa" },
  CASH: { className: "bg-muted/70 text-muted-foreground border-transparent", icon: Banknote, labelKey: "source.cash" },
  BANK: { className: "bg-muted/70 text-muted-foreground border-transparent", icon: Landmark, labelKey: "source.bank" },
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
