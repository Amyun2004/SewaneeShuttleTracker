// Keeps the screen awake while a condition is true. Chrome, Edge, and
// Safari mobile all support the Wake Lock API; Firefox doesn't, but
// we degrade gracefully — failing silently is fine since the worst
// case is the screen sleeps and the driver taps to wake it.
import { useEffect } from "react";

declare global {
  interface WakeLockSentinel extends EventTarget {
    released: boolean;
    type: "screen";
    release: () => Promise<void>;
  }
  interface Navigator {
    wakeLock?: {
      request: (type: "screen") => Promise<WakeLockSentinel>;
    };
  }
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock!.request("screen");
        if (cancelled) {
          lock.release();
          return;
        }
        sentinel = lock;

        // The browser auto-releases when the tab is hidden. Re-acquire
        // on visibility change so the lock comes back when the driver
        // returns to the tab.
        lock.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // Permission denied, low battery, etc. Silent fail by design.
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !sentinel) {
        acquire();
      }
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
      }
    };
  }, [active]);
}