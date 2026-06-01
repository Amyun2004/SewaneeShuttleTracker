// /map — riders' live tracking page.
//
// Layout mirrors the original templates/view.html: full-height sidebar
// on the left (purple "Your Location" header + scrollable shuttle list
// + bottom action buttons), Leaflet map filling the rest of the screen.
import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { NearestShuttle } from "@/api/types";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLiveShuttles } from "@/hooks/useLiveShuttles";
import { shuttleIcon, userIcon } from "@/components/map/markers";
import { PanTo } from "@/components/map/PanTo";
import {
  SEWANEE_CENTER,
  DEFAULT_ZOOM,
  TILE_URL,
  TILE_ATTRIBUTION,
} from "@/lib/map";
import { cn } from "@/lib/cn";

export function MapView() {
  const { fix, status } = useGeolocation();
  const { shuttles, connection } = useLiveShuttles();
  const [panTarget, setPanTarget] = useState<LatLngExpression | null>(null);

  // Initial center: user's location if we have it, Sewanee otherwise.
  // useMemo so it only resolves once — re-rendering with a new center
  // mid-session would jerk the map around.
  const initialCenter = useMemo<LatLngExpression>(
    () => (fix ? [fix.latitude, fix.longitude] : SEWANEE_CENTER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Nearest shuttle: re-query whenever we get a new geo fix.
  const nearestQuery = useQuery<NearestShuttle | null>({
    queryKey: ["shuttles", "nearest", fix?.latitude, fix?.longitude],
    queryFn: () =>
      api.get<NearestShuttle | null>(
        `/api/shuttles/nearest?lat=${fix!.latitude}&lng=${fix!.longitude}`
      ),
    enabled: !!fix && shuttles.length > 0,
    staleTime: 10_000,
  });

  function centerOnMe() {
    if (fix) setPanTarget([fix.latitude, fix.longitude]);
  }

  function centerOnNearest() {
    const target = nearestQuery.data;
    if (target) setPanTarget([target.latitude, target.longitude]);
  }

  return (
    <div
      className="flex flex-col lg:flex-row w-full"
      style={{ minHeight: "calc(100vh - 64px)" }}
    >
      {/* SIDEBAR */}
      <aside className="w-full lg:w-96 bg-white border-r border-gray-200 shadow-xl z-20 flex flex-col shrink-0">
        {/* Header card */}
        <div className="p-6 border-b border-gray-100 bg-sewanee-purple">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">
                Your Location
              </p>
              <h2 className="text-2xl font-bold text-white leading-tight">
                {locationLabel(status)}
              </h2>
              <p className="text-white/50 text-xs mt-1 font-mono">
                {fix
                  ? `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`
                  : "Waiting for GPS"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-sewanee-gold font-mono leading-none">
                {fix ? Math.round(fix.accuracy) : "—"}
              </p>
              <p className="text-white/60 text-xs font-semibold uppercase">
                meters
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <GpsBadge status={status} />
            <ConnectionBadge state={connection} />
          </div>
        </div>

        {/* Live shuttles list */}
        <div className="p-6 overflow-y-auto flex-grow">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Live Shuttles
            </p>
            <span className="text-xs font-bold text-gray-400 font-mono">
              {shuttles.length}
            </span>
          </div>

          {shuttles.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl">🚐</span>
              </div>
              <p className="text-sm font-bold text-gray-700">
                No shuttles in service
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Check the schedule for upcoming runs.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {shuttles.map((s) => (
                <li key={s.shuttle_id}>
                  <button
                    type="button"
                    onClick={() =>
                      setPanTarget([s.latitude, s.longitude] as LatLngExpression)
                    }
                    className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 text-sm">
                        {s.shuttle_name}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 uppercase">
                        {s.seconds_ago}s ago
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {s.route_name} · {s.driver}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Nearest panel */}
          {nearestQuery.data && (
            <div className="mt-6 p-4 rounded-xl bg-sewanee-gold/10 border border-sewanee-gold/30">
              <p className="text-[10px] font-bold text-sewanee-gold uppercase tracking-widest mb-1">
                Nearest to you
              </p>
              <p className="font-bold text-gray-900 text-sm">
                {nearestQuery.data.shuttle_name}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {nearestQuery.data.distance_feet} ft ·{" "}
                {nearestQuery.data.walking_minutes} min walk
              </p>
              {nearestQuery.data.shuttle_eta_minutes !== null && (
                <p className="text-xs text-gray-600">
                  Arrives ~{nearestQuery.data.shuttle_eta_minutes} min
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 grid grid-cols-2 gap-3">
          <button
            onClick={centerOnMe}
            disabled={!fix}
            className={cn(
              "py-2.5 rounded-xl text-sm font-semibold transition",
              "bg-sewanee-purple text-white hover:bg-sewanee-purple-light",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            🎯 Center Me
          </button>
          <button
            onClick={centerOnNearest}
            disabled={!nearestQuery.data}
            className={cn(
              "py-2.5 rounded-xl text-sm font-semibold transition",
              "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            🚐 Show Shuttle
          </button>
        </div>
      </aside>

      {/* MAP */}
      <div className="flex-grow h-[60vh] lg:h-auto overflow-hidden relative">
        <MapContainer
          center={initialCenter}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <PanTo target={panTarget} zoom={16} />

          {fix && (
            <Marker
              position={[fix.latitude, fix.longitude]}
              icon={userIcon}
            >
              <Popup>You are here · ±{Math.round(fix.accuracy)} m</Popup>
            </Marker>
          )}

          {shuttles.map((s) => (
            <Marker
              key={s.shuttle_id}
              position={[s.latitude, s.longitude]}
              icon={shuttleIcon}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-sm">{s.shuttle_name}</p>
                  <p className="text-gray-500">{s.route_name}</p>
                  <p className="text-gray-500 mt-1">Driver: {s.driver}</p>
                  {s.speed_mph !== null && (
                    <p className="text-gray-500">
                      {Math.round(s.speed_mph)} mph
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function locationLabel(status: ReturnType<typeof useGeolocation>["status"]) {
  if (status === "denied") return "Location denied";
  if (status === "unavailable") return "GPS unavailable";
  if (status === "acquiring") return "Locating…";
  if (status === "ok") return "On campus";
  return "—";
}

function GpsBadge({ status }: { status: ReturnType<typeof useGeolocation>["status"] }) {
  if (status === "ok") {
    return (
      <span className="px-3 py-1 bg-green-500/20 border border-green-400/30 text-green-300 font-bold text-xs rounded-full uppercase tracking-wide">
        ● GPS Live
      </span>
    );
  }
  if (status === "denied") {
    return (
      <span className="px-3 py-1 bg-red-500/20 border border-red-400/30 text-red-300 font-bold text-xs rounded-full uppercase tracking-wide">
        ⊘ Denied
      </span>
    );
  }
  return (
    <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-400/30 text-yellow-300 font-bold text-xs rounded-full uppercase tracking-wide">
      ⌛ Acquiring
    </span>
  );
}

function ConnectionBadge({
  state,
}: {
  state: ReturnType<typeof useLiveShuttles>["connection"];
}) {
  if (state === "live") {
    return (
      <span className="text-white/60 text-xs font-mono">
        ws · streaming
      </span>
    );
  }
  if (state === "polling") {
    return (
      <span className="text-white/40 text-xs font-mono">poll · 8s</span>
    );
  }
  if (state === "connecting") {
    return (
      <span className="text-white/40 text-xs font-mono">connecting…</span>
    );
  }
  return (
    <span className="text-white/40 text-xs font-mono">offline</span>
  );
}