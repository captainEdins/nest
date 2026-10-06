"use client";

/** Offline banner — amber, directly under the header, z-30 (design-system §8). */

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

/** Server snapshot: assume online (never render the banner during SSR). */
function getServerOnlineSnapshot(): boolean {
  return true;
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
}

export function OfflineBanner() {
  const { t } = useI18n();
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      className="z-30 bg-warning/15 dark:bg-warning/10 border-y border-warning/40 text-attention"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center gap-2">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <p className="text-label font-medium truncate">{t("offline.youAreOffline")}</p>
      </div>
    </div>
  );
}
