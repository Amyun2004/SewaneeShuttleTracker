// /history — past trips with filters and a per-trip polyline preview.
//
// Filter chips (date window, route, shuttle), trip cards on the left,
// sticky map on the right that draws the selected trip's GPS path.
// The backend's /api/history returns trips PLUS routes/shuttles in one
// payload, so we don't need separate /api/routes or /api/shuttles
// calls here — one query, one re-fetch when filters change.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { api } from "@/api/client";
import type { HistoryResponse, HistoryTrip } from "@/api/types";
import { FitBounds } from "@/components/map/FitBounds";
import { shuttleIcon } from "@/components/map/markers";
import {
  DEFAULT_ZOOM,
  SEWANEE_CENTER,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/lib/map";
import { formatDuration, formatTripDate } from "@/lib/datetime";
import { cn } from "@/lib/cn";

type DayWindow = 1 | 7 | 30;

export function History() {
  const [days, setDays] = useState<DayWindow>(7);
  const [routeId, setRouteId] = useState<number | null>(null);
  const [shuttleId, setShuttleId] = useState<number | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  const historyQuery = useQuery<HistoryResponse>({
    queryKey: ["history", days, routeId, shuttleId],
    queryFn: () => {
      const params = new URLSearchParams({ days: String(days) });
      if (routeId !== null) params.set("route_id", String(routeId));
      if (shuttleId !== null) params.set("shuttle_id", String(shuttleId));
      return api.get<HistoryResponse>(`/api/history?${params.toString()}`);
    },
  });

  const trips = historyQuery.data?.trips ?? [];
  const routes = historyQuery.data?.routes ?? [];
  const shuttles = historyQuery.data?.shuttles ?? [];

  // Auto-select the first trip whenever the filter result set changes,
  // so the map preview isn't empty on a fresh visit.
  useEffect(() => {
    if (trips.length === 0) {
      setSelectedTripId(null);
      return;
    }
    if (!trips.find((t) => t.trip_id === selectedTripId)) {
      setSelectedTripId(trips[0].trip_id);
    }
  }, [trips, selectedTripId]);

  const selectedTrip = useMemo(
    () => trips.find((t) => t.trip_id === selectedTripId) ?? null,
    [trips, selectedTripId]
  );

  const polyline: LatLngExpression[] = useMemo(
    () =>
      selectedTrip ? selectedTrip.path.map(([lat, lng]) => [lat, lng]) : [],
    [selectedTrip]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-gray-900">History</h1>
          <p className="text-sm text-gray-500 mt-1">
            Past trips with GPS traces. Filter by date, route, or shuttle.
          </p>
        </div>
        <p className="text-xs font-mono text-gray-400">
          {historyQuery.isLoading ? "loading…" : `${trips.length} trips`}
        </p>
      </div>

      {/* Filter chips */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <FilterGroup label="Window">
          {([1, 7, 30] as DayWindow[]).map((d) => (
            <Chip
              key={d}
              active={days === d}
              onClick={() => setDays(d)}
              label={d === 1 ? "Today" : `${d} days`}
            />
          ))}
        </FilterGroup>

        <Divider />

        <FilterGroup label="Route">
          <Chip
            active={routeId === null}
            onClick={() => setRouteId(null)}
            label="All"
          />
          {routes.map((r) => (
            <Chip
              key={r.route_id}
              active={routeId === r.route_id}
              onClick={() => setRouteId(r.route_id)}
              label={r.route_name}
            />
          ))}
        </FilterGroup>

        <Divider />

        <FilterGroup label="Shuttle">
          <Chip
            active={shuttleId === null}
            onClick={() => setShuttleId(null)}
            label="All"
          />
          {shuttles.map((s) => (
            <Chip
              key={s.shuttle_id}
              active={shuttleId === s.shuttle_id}
              onClick={() => setShuttleId(s.shuttle_id)}
              label={s.shuttle_name}
            />
          ))}
        </FilterGroup>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        {/* Trip list */}
        <section>
          {historyQuery.isLoading ? (
            <p className="text-sm text-gray-400 font-mono">Loading…</p>
          ) : historyQuery.isError ? (
            <p className="text-sm text-red-500">Couldn't load history.</p>
          ) : trips.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3">
              {trips.map((t) => (
                <li key={t.trip_id}>
                  <TripCard
                    trip={t}
                    active={t.trip_id === selectedTripId}
                    onClick={() => setSelectedTripId(t.trip_id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Trip preview map */}
        <aside className="lg:sticky lg:top-20 self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                GPS trace
              </p>
              {selectedTrip ? (
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {selectedTrip.route_name}
                </p>
              ) : (
                <p className="text-sm text-gray-400">No trip selected</p>
              )}
            </div>
            <div className="h-[420px] w-full">
              <MapContainer
                center={polyline[0] ?? SEWANEE_CENTER}
                zoom={DEFAULT_ZOOM}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
                {polyline.length > 0 && (
                  <>
                    <FitBounds points={polyline} />
                    <Polyline
                      positions={polyline}
                      pathOptions={{
                        color: "#582C83",
                        weight: 4,
                        opacity: 0.9,
                      }}
                    />
                    <Marker
                      position={polyline[polyline.length - 1]}
                      icon={shuttleIcon}
                    >
                      <Popup>End of trip</Popup>
                    </Marker>
                  </>
                )}
              </MapContainer>
            </div>
            {selectedTrip && (
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 grid grid-cols-2 gap-2">
                <span>
                  <span className="font-bold text-gray-700">
                    {selectedTrip.path.length}
                  </span>{" "}
                  pings
                </span>
                <span>
                  <span className="font-bold text-gray-700">
                    {formatDuration(selectedTrip.duration_min)}
                  </span>{" "}
                  total
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TripCard({
  trip,
  active,
  onClick,
}: {
  trip: HistoryTrip;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-2xl border transition",
        active
          ? "bg-white border-sewanee-purple shadow-md ring-2 ring-sewanee-purple/20"
          : "bg-white border-gray-100 hover:border-sewanee-purple/40"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold text-gray-900 text-sm">{trip.route_name}</p>
          <p className="text-xs text-gray-500">
            {trip.shuttle_name} · {trip.driver_name}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-gray-400">
          #{trip.trip_id}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{formatTripDate(trip.start_time)}</span>
        <span className="flex items-center gap-2">
          <span className="font-bold text-gray-700 font-mono">
            {formatDuration(trip.duration_min)}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-sewanee-purple/10 text-sewanee-purple text-[10px] font-bold font-mono">
            {trip.path.length}p
          </span>
        </span>
      </div>
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold transition border",
        active
          ? "bg-sewanee-purple text-white border-sewanee-purple"
          : "bg-white text-gray-600 border-gray-200 hover:border-sewanee-purple/40 hover:text-sewanee-purple"
      )}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="hidden sm:inline-block w-px h-6 bg-gray-200" />;
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
      <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
        <span className="text-2xl">📊</span>
      </div>
      <h3 className="font-bold text-gray-900 text-sm">
        No trips in this window
      </h3>
      <p className="text-xs text-gray-500 mt-1">
        Try widening the date range or clearing route/shuttle filters.
      </p>
    </div>
  );
}