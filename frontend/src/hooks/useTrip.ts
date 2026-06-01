// Drives the active trip's lifecycle.
//
// State machine:
//   idle → starting → active → ending → ended
//                              ↘ error
//
// While active:
//   - watchPosition keeps streaming GPS fixes
//   - on each fix we (a) update local "current location" state,
//     (b) accumulate trip distance, (c) push to a `pings` buffer
//   - every PING_INTERVAL_MS we POST the latest ping to the backend.
//     Throttling here matters: a phone can emit fixes 10x/sec, and
//     hammering the trip endpoint with 600 requests/minute is rude.
//
// On error or `endTrip()`, POST /api/trips/{id}/end and tear down.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { haversineMeters } from "@/lib/distance";

export type TripState =
  | "idle"
  | "starting"
  | "active"
  | "ending"
  | "ended"
  | "error";

export interface ActiveFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  /** m/s from the device, if available. */
  speed: number | null;
  /** Wall-clock time of the fix. */
  timestamp: number;
}

interface TripSummary {
  trip_id: number;
  route_id: number;
  shuttle_id: number;
}

interface StartArgs {
  route_id: number;
  shuttle_id: number;
}

/** How often (ms) we POST to /ping. The geolocation watcher fires far
 *  more often than we want to broadcast. */
const PING_INTERVAL_MS = 3_000;

export function useTrip() {
  const [state, setState] = useState<TripState>("idle");
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [current, setCurrent] = useState<ActiveFix | null>(null);
  const [path, setPath] = useState<[number, number][]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [pingCount, setPingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Refs so the geolocation callback can read latest state without
  // forcing it to re-subscribe every render.
  const watchIdRef = useRef<number | null>(null);
  const tripIdRef = useRef<number | null>(null);
  const lastFixRef = useRef<ActiveFix | null>(null);
  const lastPingedAtRef = useRef<number>(0);
  const lastPositionRef = useRef<{ latitude: number; longitude: number } | null>(
    null
  );

  // Push a ping to the backend. Called by the rAF/throttle loop, NOT
  // on every geolocation fire — that's the whole point of the throttle.
  const flushPing = useCallback(async () => {
    const tripId = tripIdRef.current;
    const fix = lastFixRef.current;
    if (!tripId || !fix) return;

    const now = Date.now();
    if (now - lastPingedAtRef.current < PING_INTERVAL_MS) return;
    lastPingedAtRef.current = now;

    try {
      await api.post(`/api/trips/${tripId}/ping`, {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        speed: fix.speed ?? undefined,
      });
      setPingCount((p) => p + 1);
    } catch {
      // Network blips are common on a moving phone. Drop this ping;
      // the next one will retry. Don't bail out of the trip.
    }
  }, []);

  const startTrip = useCallback(
    async ({ route_id, shuttle_id }: StartArgs) => {
      if (state !== "idle" && state !== "ended" && state !== "error") return;
      setState("starting");
      setError(null);
      setPath([]);
      setDistanceM(0);
      setPingCount(0);
      lastPingedAtRef.current = 0;
      lastPositionRef.current = null;

      try {
        const t = await api.post<TripSummary>("/api/trips/start", {
          route_id,
          shuttle_id,
        });
        setTrip(t);
        tripIdRef.current = t.trip_id;
        setStartedAt(Date.now());

        // Start watching position.
        if (!("geolocation" in navigator)) {
          setError("Geolocation isn't available on this device.");
          setState("error");
          return;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const fix: ActiveFix = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            };
            lastFixRef.current = fix;
            setCurrent(fix);

            // Accumulate distance from previous accepted fix.
            const last = lastPositionRef.current;
            if (last) {
              const delta = haversineMeters(last, fix);
              // Reject jitter: tiny accuracy-radius noise jumps the
              // point a few meters even when stationary. 2m floor
              // eliminates most of that without rejecting walking.
              if (delta > 2) {
                setDistanceM((d) => d + delta);
                setPath((p) => [...p, [fix.latitude, fix.longitude]]);
                lastPositionRef.current = {
                  latitude: fix.latitude,
                  longitude: fix.longitude,
                };
              }
            } else {
              lastPositionRef.current = {
                latitude: fix.latitude,
                longitude: fix.longitude,
              };
              setPath([[fix.latitude, fix.longitude]]);
            }

            // Push to backend (throttled inside flushPing).
            flushPing();
          },
          (err) => {
            setError(
              err.code === 1
                ? "Location permission denied."
                : "Couldn't get GPS fix."
            );
            setState("error");
          },
          {
            enableHighAccuracy: true,
            maximumAge: 1_000,
            timeout: 20_000,
          }
        );

        setState("active");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start trip.");
        setState("error");
      }
    },
    [state, flushPing]
  );

  const endTrip = useCallback(async () => {
    if (state !== "active" && state !== "error") return;
    setState("ending");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const tripId = tripIdRef.current;
    if (tripId) {
      try {
        await api.post(`/api/trips/${tripId}/end`);
      } catch {
        // If end-of-trip POST fails, log it as ended client-side anyway.
        // Operator can mark the trip ended from the admin page later.
      }
    }

    setState("ended");
    tripIdRef.current = null;
  }, [state]);

  // Cleanup if the page unmounts mid-trip (driver navigated away).
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Elapsed-time ticker. We don't need this to be exact; once a second
  // for the "12:34 elapsed" display is plenty.
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (state !== "active" || !startedAt) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1_000);
    return () => clearInterval(id);
  }, [state, startedAt]);

  return {
    state,
    trip,
    current,
    path,
    distanceM,
    pingCount,
    error,
    elapsedMs,
    startTrip,
    endTrip,
  };
}