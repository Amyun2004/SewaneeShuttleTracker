// Small formatters for ISO datetime strings coming from the backend.
// Single source of truth so the look stays consistent across pages.

/**
 * "Wed, May 30 · 12:34 PM"
 * Uses the user's locale for ordering, but always en-US weekday names
 * for predictability across browsers.
 */
export function formatTripDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

/** "28 min" or "1h 12m" */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}