"use client";

/**
 * S-29 · Deposit detail pushed screen (Phase 2 stub — Task P2-d replaces this file).
 *
 * Tenant surface: amount held, append-only movements ledger (HOLD/DEDUCT/
 * REFUND/ADJUST with reasons + actors), MOVE_IN/MOVE_OUT condition reports.
 * Data: GET /api/deposits/mine via useQuery(["deposits", "mine"]).
 * STUB CONTRACT (do not change the export name):
 *   export function DepositDetailScreen()
 * The shell renders it with the back button already wired — content only.
 */

export function DepositDetailScreen() {
  return null; // stub — ledger timeline lands with Task P2-d
}
