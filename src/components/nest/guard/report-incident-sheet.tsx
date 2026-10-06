"use client";

/**
 * S-32a · Report-incident sheet — P3-0 CONTRACT STUB (issue #33).
 *
 * Written contract for P3-c (issue #36): bottom sheet for filing an incident:
 * category chips (SECURITY/DAMAGE/DISPUTE/THEFT/OTHER), severity chips
 * (LOW/MEDIUM/HIGH/CRITICAL — HIGH/CRITICAL styled destructive, CRITICAL
 * pulses), description (required textarea), action taken (optional).
 * POST /api/incidents — property derived from the ACTIVE shift server-side.
 * HIGH/CRITICAL notifies landlord + caretaker (server behavior; UI copy says
 * so under the severity row). Toast on success (guard.incidents.filed).
 */

import { useUIStore } from "@/lib/ui-store";

export function ReportIncidentSheet() {
  const open = useUIStore((s) => s.reportIncidentOpen);
  void open; // P3-c: render the Drawer form
  return null;
}
