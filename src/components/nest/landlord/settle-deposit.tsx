"use client";

/**
 * S-30 · Deposit settlement modal (Phase 2 stub — Task P2-d replaces this file).
 *
 * Landlord flow on a NOTICE tenancy: deduction line editor (reason + amount,
 * add/remove, live remainder), confirm dialog with the exact breakdown,
 * success state. Submits POST /api/deposits/[tenancyId]/settle.
 * STUB CONTRACT (do not change the export name):
 *   export function SettleDepositModal() — reads `settleDeposit` from the
 *   ui-store (tenancyId inside), closes itself via closeSettleDeposit(), and
 *   invalidates deposit + overview queries on success.
 */

export function SettleDepositModal() {
  return null; // stub — settlement editor lands with Task P2-d
}
