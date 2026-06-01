// /track — driver UI.
//
// Pre-trip: pick a route and a shuttle, big "Start Trip" button.
// Active trip: full-screen status — current position on a map, live
// stats (speed, distance, duration, ping count), big red "End Trip"
// button. Screen wake lock is acquired while a trip is active.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { api } from "@/api/client";
import type { RouteSummary, ShuttleSummary } from "@/api/types";
import { useTrip } from "@/hooks/useTrip";
import { useWakeLock } from "@/hooks/useWakeLock";
import { shuttleIcon, userIcon } from "@/components/map/markers";
import { PanTo } from "@/components/map/PanTo";
import {
  DEFAULT_ZOOM,
  SEWANEE_CENTER,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/lib/map";
import { formatDistance } from "@/lib/distance";
import { cn } from "@/lib/cn";

export function Track() {
  const {
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
  } = useTrip();

  useWakeLock(state === "active");

  if (state === "active" || state === "ending") {
    return (
      <ActiveTripView
        current={current}
        path={path}
        distanceM={distanceM}
        pingCount={pingCount}
        elapsedMs={elapsedMs}
        ending={state === "ending"}
        onEnd={endTrip}
      />
    );
  }

  if (state === "ended" && trip) {
    return (
      <TripSummary
        distanceM={distanceM}
        pingCount={pingCount}
        elapsedMs={elapsedMs}
        onReset={() => window.location.reload()}
      />
    );
  }

  return <PreTripSetup onStart={startTrip} state={state} error={error} />;
}

/* ------------------------------------------------------------------ */
/* Pre-trip                                                            */
/* ------------------------------------------------------------------ */

function PreTripSetup({
  onStart,
  state,
  error,
}: {
  onStart: (args: { route_id: number; shuttle_id: number }) => void;
  state: ReturnType<typeof useTrip>["state"];
  error: string | null;
}) {
  const [routeId, setRouteId] = useState<number | null>(null);
  const [shuttleId, setShuttleId] = useState<number | null>(null);

  const routesQuery = useQuery<RouteSummary[]>({
    queryKey: ["routes"],
    queryFn: () => api.get<RouteSummary[]>("/api/routes"),
  });
  const shuttlesQuery = useQuery<ShuttleSummary[]>({
    queryKey: ["shuttles", "list"],
    queryFn: () => api.get<ShuttleSummary[]>("/api/shuttles"),
  });

  const ready = routeId !== null && shuttleId !== null && state !== "starting";

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-sewanee-purple text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Driver
          </p>
          <h1 className="text-3xl font-black mt-1">Start a trip</h1>
          <p className="text-sm text-white/70 mt-1">
            Pick your route and shuttle, then hit Start. Your phone will share
            its location with riders while the trip is active.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <Picker
            label="Route"
            options={(routesQuery.data ?? []).map((r) => ({
              id: r.route_id,
              name: r.route_name,
              hint: r.description ?? "",
            }))}
            value={routeId}
            onChange={setRouteId}
            empty="Loading routes…"
          />
          <Picker
            label="Shuttle"
            options={(shuttlesQuery.data ?? []).map((s) => ({
              id: s.shuttle_id,
              name: s.shuttle_name,
            }))}
            value={shuttleId}
            onChange={setShuttleId}
            empty="Loading shuttles…"
          />

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              ready &&
              onStart({ route_id: routeId!, shuttle_id: shuttleId! })
            }
            className={cn(
              "w-full py-4 rounded-2xl text-base font-black uppercase tracking-wide transition",
              "bg-sewanee-gold text-white hover:bg-sewanee-gold-light",
              "disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            )}
          >
            {state === "starting" ? "Starting…" : "🚐 Start Trip"}
          </button>

          <p className="text-[10px] text-gray-400 leading-relaxed">
            We'll request location access. The trip will be visible on the
            rider map until you tap End Trip.
          </p>
        </div>
      </div>
    </div>
  );
}

interface PickerOption {
  id: number;
  name: string;
  hint?: string;
}

function Picker({
  label,
  options,
  value,
  onChange,
  empty,
}: {
  label: string;
  options: PickerOption[];
  value: number | null;
  onChange: (id: number) => void;
  empty: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        {label}
      </p>
      {options.length === 0 ? (
        <p className="text-sm text-gray-400 font-mono">{empty}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {options.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange(opt.id)}
                className={cn(
                  "text-left p-3 rounded-xl border transition",
                  active
                    ? "bg-sewanee-purple text-white border-sewanee-purple shadow-md"
                    : "bg-white border-gray-200 hover:border-sewanee-purple/40"
                )}
              >
                <p className={cn("font-bold text-sm", active ? "text-white" : "text-gray-900")}>
                  {opt.name}
                </p>
                {opt.hint && (
                  <p
                    className={cn(
                      "text-xs mt-0.5 line-clamp-1",
                      active ? "text-white/70" : "text-gray-500"
                    )}
                  >
                    {opt.hint}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Active trip                                                         */
/* ------------------------------------------------------------------ */

function ActiveTripView({
  current,
  path,
  distanceM,
  pingCount,
  elapsedMs,
  ending,
  onEnd,
}: {
  current: ReturnType<typeof useTrip>["current"];
  path: [number, number][];
  distanceM: number;
  pingCount: number;
  elapsedMs: number;
  ending: boolean;
  onEnd: () => void;
}) {
  const center: LatLngExpression = current
    ? [current.latitude, current.longitude]
    : SEWANEE_CENTER;

  const polylinePoints: LatLngExpression[] = path.map(([lat, lng]) => [
    lat,
    lng,
  ]);

  const speedMph =
    current?.speed != null ? Math.round(current.speed * 2.23694) : null;

  return (
    <div
      className="flex flex-col bg-sewanee-navy"
      style={{ minHeight: "calc(100vh - 64px)" }}
    >
      {/* Status strip */}
      <div className="px-4 sm:px-6 py-3 bg-sewanee-purple text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest">
            Trip Active
          </span>
        </div>
        <span className="text-xs font-mono text-white/70">
          {pingCount} pings sent
        </span>
      </div>

      {/* Map */}
      <div className="flex-grow relative">
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <PanTo target={current ? [current.latitude, current.longitude] : null} />
          {polylinePoints.length > 1 && (
            <Polyline
              positions={polylinePoints}
              pathOptions={{
                color: "#C8A051",
                weight: 4,
                opacity: 0.9,
              }}
            />
          )}
          {current && (
            <Marker
              position={[current.latitude, current.longitude]}
              icon={shuttleIcon}
            />
          )}
        </MapContainer>
      </div>

      {/* Stats + End button */}
      <div className="bg-sewanee-navy text-white px-4 py-4 grid grid-cols-3 gap-3 border-t border-white/10">
        <Stat label="Duration" value={formatElapsed(elapsedMs)} />
        <Stat label="Distance" value={formatDistance(distanceM)} />
        <Stat label="Speed" value={speedMph !== null ? `${speedMph} mph` : "—"} />
      </div>

      <div className="bg-sewanee-navy px-4 pb-6">
        <button
          type="button"
          onClick={onEnd}
          disabled={ending}
          className={cn(
            "w-full py-4 rounded-2xl text-base font-black uppercase tracking-wide transition",
            "bg-red-500 text-white hover:bg-red-600",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {ending ? "Ending…" : "⏹ End Trip"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2 border border-white/10">
      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-xl font-black font-mono mt-0.5">{value}</p>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

function TripSummary({
  distanceM,
  pingCount,
  elapsedMs,
  onReset,
}: {
  distanceM: number;
  pingCount: number;
  elapsedMs: number;
  onReset: () => void;
}) {
  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900">Trip ended</h1>
        <p className="text-sm text-gray-500 mt-1">
          Riders will see the route in History momentarily.
        </p>

        <div className="grid grid-cols-3 gap-3 mt-6 text-left">
          <Summary label="Duration" value={formatElapsed(elapsedMs)} />
          <Summary label="Distance" value={formatDistance(distanceM)} />
          <Summary label="Pings" value={String(pingCount)} />
        </div>

        <button
          type="button"
          onClick={onReset}
          className="w-full mt-6 py-3 rounded-2xl bg-sewanee-purple text-white text-sm font-bold hover:bg-sewanee-purple-light transition"
        >
          Start another trip
        </button>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-lg font-black font-mono text-gray-900 mt-0.5">
        {value}
      </p>
    </div>
  );
}