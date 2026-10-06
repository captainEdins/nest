"use client";

/**
 * NEST — offline outbox store (D-012). A cached-snapshot external store so
 * components can react to queue/flush events (badge counts, toasts).
 */

import { useSyncExternalStore } from "react";
import { flushOutbox, getOutbox, queueOffline, type OutboxEntry } from "@/lib/api";

const OUTBOX_EVENT = "nest-outbox-change";

const listeners = new Set<() => void>();
let countCache: number | null = null;

function snapshot(): number {
  if (countCache === null) countCache = getOutbox().length;
  return countCache;
}

function serverSnapshot(): number {
  return 0;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(OUTBOX_EVENT, onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(OUTBOX_EVENT, onStoreChange);
  };
}

function emit(): void {
  countCache = getOutbox().length;
  for (const listener of listeners) listener();
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

/** Number of cash collections queued offline (reactive). */
export function useOutboxCount(): number {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Queue a cash collection and notify subscribers. */
export function enqueueOffline(entry: Omit<OutboxEntry, "queuedAt">): void {
  queueOffline(entry);
  emit();
}

/** Try to sync queued collections. Returns the number synced. */
export async function syncOutbox(): Promise<number> {
  const synced = await flushOutbox();
  emit();
  return synced;
}
