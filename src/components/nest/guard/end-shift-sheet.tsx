"use client";

/**
 * S-34b · End-shift sheet — P3-0 CONTRACT STUB (issue #33).
 *
 * Written contract for P3-c (issue #36): bottom sheet to end the ACTIVE
 * shift with an optional handover note (guard.handoverPlaceholder).
 * AlertDialog confirm before POST /api/shifts/[id]/end { notes } — the
 * handover note is the relay record, so the confirm states it will be saved
 * and shown to the next guard + the landlord. Toast: guard.shiftEnded.
 */

import { useUIStore } from "@/lib/ui-store";

export function EndShiftSheet() {
  const open = useUIStore((s) => s.endShiftOpen);
  void open; // P3-c: render the handover-note form + confirm
  return null;
}
