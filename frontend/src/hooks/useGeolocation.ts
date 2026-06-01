// Browser geolocation as a React hook.
//
// watchPosition keeps streaming updates as the user walks around campus —
// each fix has its own accuracy reading. We surface accuracy so the
// sidebar can show the "X meters" GPS quality indicator from the
// original view.html template.
import { useEffect, useState } from "react";

export interface GeoFix {
  latitude: number;
  longitude: number;
  /** Reported accuracy radius, in meters. Smaller = more confident. */
  accuracy: number;
  /** Wall-clock time the fix came in. */
  timestamp: number;
}

export type GeoStatus = "idle" | "acquiring" | "ok" | "denied" | "unavailable";

export function useGeolocation() {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("acquiring");

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setFix({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setStatus("ok");
      },
      (err) => {
        // PERMISSION_DENIED = 1
        if (err.code === 1) {
          setStatus("denied");
        } else {
          setStatus("unavailable");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        // 20s — enough time for a cold GPS lock in a dorm-room corner.
        timeout: 20_000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { fix, status };
}