"use client";

/**
 * S-34a · Start-shift sheet — P3-0 CONTRACT STUB (issue #33).
 *
 * Written contract for P3-c (issue #36): bottom sheet to go on duty. Lists
 * the guard's worked properties (overview `properties`); single property →
 * one big confirm button (1 tap). POST /api/shifts { propertyId } — server
 * rejects properties without shift history (403/404) and double starts (409).
 * Toast: guard.shiftStarted.
 */

import { useUIStore } from "@/lib/ui-store";

export function StartShiftSheet() {
  const open = useUIStore((s) => s.startShiftOpen);
  void open; // P3-c: render the property picker
  return null;
}
