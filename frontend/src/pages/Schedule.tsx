// /schedule — routes and stops listing.
//
// Two-pane: routes on the left (card list), the selected route's stops
// on the right with a small preview map. Uses /api/routes to fetch the
// list and /api/routes/{id} for each route's full stop list.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { api } from "@/api/client";
import type { RouteDetail, RouteSummary } from "@/api/types";
import { stopIcon } from "@/components/map/markers";
import { FitBounds } from "@/components/map/FitBounds";
import {
  DEFAULT_ZOOM,
  SEWANEE_CENTER,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/lib/map";
import { cn } from "@/lib/cn";

export function Schedule() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const routesQuery = useQuery<RouteSummary[]>({
    queryKey: ["routes"],
    queryFn: () => api.get<RouteSummary[]>("/api/routes"),
  });

  const detailQuery = useQuery<RouteDetail>({
    queryKey: ["routes", selectedId],
    queryFn: () => api.get<RouteDetail>(`/api/routes/${selectedId}`),
    enabled: selectedId !== null,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tiger Transit routes and their stops, in order.
        </p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Routes list */}
        <aside>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Routes
          </p>
          {routesQuery.isLoading ? (
            <p className="text-sm text-gray-400 font-mono">Loading…</p>
          ) : routesQuery.isError ? (
            <p className="text-sm text-red-500">Couldn't load routes.</p>
          ) : (
            <ul className="space-y-2">
              {(routesQuery.data ?? []).map((r) => {
                const active = r.route_id === selectedId;
                return (
                  <li key={r.route_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.route_id)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition",
                        active
                          ? "bg-sewanee-purple text-white border-sewanee-purple shadow-md"
                          : "bg-white border-gray-200 hover:border-sewanee-purple/40 hover:bg-sewanee-purple/5"
                      )}
                    >
                      <p
                        className={cn(
                          "font-bold text-sm",
                          active ? "text-white" : "text-gray-900"
                        )}
                      >
                        {r.route_name}
                      </p>
                      {r.description && (
                        <p
                          className={cn(
                            "text-xs mt-1 line-clamp-2",
                            active ? "text-white/70" : "text-gray-500"
                          )}
                        >
                          {r.description}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Route detail */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {selectedId === null ? (
            <EmptyState />
          ) : detailQuery.isLoading ? (
            <div className="p-8">
              <p className="text-sm text-gray-400 font-mono">Loading route…</p>
            </div>
          ) : detailQuery.isError ? (
            <div className="p-8">
              <p className="text-sm text-red-500">Couldn't load route.</p>
            </div>
          ) : detailQuery.data ? (
            <RouteBody detail={detailQuery.data} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-16 h-16 bg-sewanee-purple/10 rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">🚐</span>
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Pick a route on the left
      </h2>
      <p className="text-sm text-gray-500 max-w-xs">
        We'll show you the stops in order and where they are on campus.
      </p>
    </div>
  );
}

function RouteBody({ detail }: { detail: RouteDetail }) {
  const stopPoints: LatLngExpression[] = detail.stops.map((s) => [
    s.latitude,
    s.longitude,
  ]);

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-sewanee-purple text-white">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
          Route {detail.route_id}
        </p>
        <h2 className="text-2xl font-black">{detail.route_name}</h2>
        {detail.description && (
          <p className="text-sm text-white/80 mt-1">{detail.description}</p>
        )}
      </div>

      {/* Map preview */}
      <div className="h-64 sm:h-72 w-full">
        <MapContainer
          center={stopPoints[0] ?? SEWANEE_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <FitBounds points={stopPoints} />
          {detail.stops.map((s, i) => (
            <Marker
              key={s.stop_id}
              position={[s.latitude, s.longitude]}
              icon={stopIcon(s.sequence_number ?? i + 1)}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-sm">{s.stop_name}</p>
                  {s.description && (
                    <p className="text-gray-500 mt-0.5">{s.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Stops list */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Stops
          </p>
          <span className="text-xs font-mono text-gray-400">
            {detail.stops.length} stops
          </span>
        </div>
        <ol className="relative border-l-2 border-gray-200 ml-3">
          {detail.stops.map((s, i) => (
            <li key={s.stop_id} className="pl-8 pb-4 relative last:pb-0">
              <span className="absolute -left-[15px] top-0 w-7 h-7 rounded-full bg-sewanee-purple text-white text-xs font-bold font-mono flex items-center justify-center">
                {s.sequence_number ?? i + 1}
              </span>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    {s.stop_name}
                  </p>
                  {s.description && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.description}
                    </p>
                  )}
                </div>
                {s.expected_min_from_start !== null &&
                s.expected_min_from_start !== undefined ? (
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-sewanee-gold/15 text-sewanee-gold text-[11px] font-bold font-mono">
                    +{s.expected_min_from_start}m
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}