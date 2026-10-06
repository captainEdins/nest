"use client";

/**
 * S-31a · Log-visitor sheet — P3-0 CONTRACT STUB (issue #33).
 *
 * Written contract for P3-c (issue #36): bottom sheet (Drawer, mobile-first)
 * for logging a visitor in ≤3 taps: name (required), phone (optional),
 * purpose chip row (VISITOR/DELIVERY/CONTRACTOR/VIEWING/OTHER — single tap),
 * unit picker (optional, Select with the shift property's units).
 * POST /api/visitors { visitorName, visitorPhone?, purpose, unitId? } — the
 * property is derived server-side from the ACTIVE shift, never sent.
 * Toast on success (guard.visitors.logged). i18n: guard.visitors.*.
 */

import { useUIStore } from "@/lib/ui-store";

export function LogVisitorSheet() {
  const open = useUIStore((s) => s.logVisitorOpen);
  void open; // P3-c: render the Drawer form
  return null;
}
