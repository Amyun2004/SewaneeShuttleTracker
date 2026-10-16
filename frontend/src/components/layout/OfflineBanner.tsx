// Thin bar under the header when the device goes offline.
//
// The service worker keeps the app shell loading with no connection, but
// /api and /ws always need the network. This tells the rider why shuttle
// positions have stopped moving instead of leaving them guessing.
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="w-full bg-sewanee-navy text-center px-4 py-2 text-sm font-medium text-sewanee-gold"
    >
      You're offline. Live shuttle positions will resume when you reconnect.
    </div>
  );
}