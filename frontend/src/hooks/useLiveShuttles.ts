// Live shuttle stream.
//
// 1. Initial state: REST GET /api/shuttles/live → fills the map immediately
//    on first render.
// 2. Then opens WebSocket to /ws/live. Backend sends {type:"hello"} on
//    connect, then a ping event for every driver POST /trips/{id}/ping.
//    Each ping updates the shuttle's row in our local cache.
// 3. If the socket drops (server restart, network blip), we fall back to
//    polling /live every 8 seconds and try to reconnect every 5.
//
// The polling fallback exists because in production a flaky cellular
// signal will kill WebSockets routinely. Polling isn't great but means
// users still see *something* moving rather than a frozen map.
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { LiveShuttle } from "@/api/types";

type PingEvent = {
  type: "ping";
  trip_id: number;
  shuttle_id: number;
  latitude: number;
  longitude: number;
  speed_mph: number | null;
  recorded_at: string;
};

type HelloEvent = { type: "hello" };
type WsEvent = PingEvent | HelloEvent;

export type ConnectionState = "connecting" | "live" | "polling" | "offline";

const POLL_INTERVAL_MS = 8_000;
const RECONNECT_DELAY_MS = 5_000;

export function useLiveShuttles() {
  const [shuttles, setShuttles] = useState<LiveShuttle[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  const wsRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  // useRef so the latest list is readable from inside the WS message handler
  // without forcing a re-subscribe on every state change.
  const shuttlesRef = useRef<LiveShuttle[]>([]);

  useEffect(() => {
    shuttlesRef.current = shuttles;
  }, [shuttles]);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      try {
        const list = await api.get<LiveShuttle[]>("/api/shuttles/live");
        if (!cancelled) setShuttles(list);
      } catch {
        // Non-fatal: WebSocket might still deliver fresh data shortly.
      }
    }

    function startPolling() {
      if (pollTimerRef.current !== null) return;
      setConnection("polling");
      pollTimerRef.current = window.setInterval(fetchInitial, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    function connect() {
      // Vite dev-proxy maps /ws/* over to ws://localhost:8000 in dev;
      // in production this URL is same-origin, so a relative URL works
      // in both.
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${window.location.host}/ws/live`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        startPolling();
        return;
      }
      wsRef.current = ws;
      setConnection("connecting");

      ws.onopen = () => {
        setConnection("live");
        stopPolling();
      };

      ws.onmessage = (e) => {
        let msg: WsEvent;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type !== "ping") return;

        // Merge the new ping into our local list. If we already had this
        // shuttle, replace its lat/lng/speed; if not, fall back to a
        // full re-fetch so we pick up the driver name + route name.
        const existing = shuttlesRef.current.find(
          (s) => s.shuttle_id === msg.shuttle_id
        );
        if (existing) {
          setShuttles((prev) =>
            prev.map((s) =>
              s.shuttle_id === msg.shuttle_id
                ? {
                    ...s,
                    latitude: msg.latitude,
                    longitude: msg.longitude,
                    speed_mph: msg.speed_mph,
                    seconds_ago: 0,
                  }
                : s
            )
          );
        } else {
          fetchInitial();
        }
      };

      ws.onerror = () => {
        // onerror almost always precedes onclose. Let onclose drive the
        // reconnect logic; just don't blow up here.
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;
        startPolling();
        reconnectTimerRef.current = window.setTimeout(
          connect,
          RECONNECT_DELAY_MS
        );
      };
    }

    fetchInitial();
    connect();

    return () => {
      cancelled = true;
      stopPolling();
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { shuttles, connection };
}