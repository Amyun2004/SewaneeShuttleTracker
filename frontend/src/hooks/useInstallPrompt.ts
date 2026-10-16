// "Install app" support for Chrome / Edge / Android.
//
// The browser fires `beforeinstallprompt` once it decides the PWA is
// installable. We stash that event so the header can show its own
// "Install app" button and call prompt() when the user taps it.
//
// The listener is attached at module load (not inside a component) because
// the event can fire before React has mounted the Header. iOS Safari never
// fires it — iPhone users install via Share → Add to Home Screen.
import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

window.addEventListener("beforeinstallprompt", (e) => {
  // Stop Chrome's mini-infobar; we show our own button instead.
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  notify();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    subscribe,
    () => deferredPrompt !== null,
    () => false
  );

  async function install() {
    const evt = deferredPrompt;
    if (!evt) return;
    // A prompt event can only be used once, so clear it before showing.
    deferredPrompt = null;
    notify();
    await evt.prompt();
  }

  return { canInstall, install };
}