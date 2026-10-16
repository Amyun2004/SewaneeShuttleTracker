// /schedule — the printed Tiger Transit timetable, served from the database.
//
// Routes on the left. For the selected route: pick a day, see every run
// as a row with the stops across (same layout as the paper schedule), and
// the next departure highlighted. Below that, a map of the stops and the
// stop order with minutes from the start of a loop.
import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { api } from "@/api/client";
import type { RouteDetail, RouteSummary, ScheduleRun, Stop } from "@/api/types";
import { stopIcon } from "@/components/map/markers";
import { FitBounds } from "@/components/map/FitBounds";
import { InvalidateSize } from "@/components/map/InvalidateSize";
import {
  DEFAULT_ZOOM,
  SEWANEE_CENTER,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/lib/map";
import {
  WEEKDAYS,
  dayName,
  formatClock,
  formatWait,
  isoWeekday,
  nextDeparture,
  serviceMinutesNow,
} from "@/lib/schedule";
import { cn } from "@/lib/cn";

/** Runs more than this far apart get a "shuttle rests" divider. */
const REST_GAP_MIN = 30;

/** Current time, refreshed every 30 seconds so "next" stays accurate. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function Schedule() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const routesQuery = useQuery<RouteSummary[]>({
    queryKey: ["routes"],
    queryFn: () => api.get<RouteSummary[]>("/api/routes"),
  });

  // Default to the first route so the timetable shows up straight away.
  const activeId = selectedId ?? routesQuery.data?.[0]?.route_id ?? null;

  const detailQuery = useQuery<RouteDetail>({
    queryKey: ["routes", activeId],
    queryFn: () => api.get<RouteDetail>(`/api/routes/${activeId}`),
    enabled: activeId !== null,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tiger Transit timetable. Times are when the shuttle reaches each stop.
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
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
                const active = r.route_id === activeId;
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
                            "text-xs mt-1",
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
          {activeId === null ? (
            <div className="p-8">
              <p className="text-sm text-gray-400">No routes yet.</p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="p-8">
              <p className="text-sm text-gray-400 font-mono">Loading route…</p>
            </div>
          ) : detailQuery.isError ? (
            <div className="p-8">
              <p className="text-sm text-red-500">Couldn't load route.</p>
            </div>
          ) : detailQuery.data ? (
            // key resets the day picker when you switch routes
            <RouteBody key={detailQuery.data.route_id} detail={detailQuery.data} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function RouteBody({ detail }: { detail: RouteDetail }) {
  const now = useNow();
  const next = nextDeparture(detail.runs, now);
  const [day, setDay] = useState<number>(
    () => next?.serviceDay ?? isoWeekday(new Date())
  );

  const runsToday = detail.runs.filter((r) => r.service_days.includes(day));
  const showExtension = runsToday.some((r) => r.includes_extension);
  const columns = detail.stops.filter((s) => showExtension || !s.extension_only);
  const firstStop = detail.stops[0]?.stop_name ?? "the first stop";

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
        <NextBanner next={next} firstStop={firstStop} now={now} />
      </div>

      {/* Day picker */}
      <div className="px-6 pt-5 flex flex-wrap gap-2">
        {WEEKDAYS.map((d) => {
          const runs = detail.runs.some((r) => r.service_days.includes(d.iso));
          const selected = d.iso === day;
          const isToday = d.iso === isoWeekday(now);
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => setDay(d.iso)}
              className={cn(
                "relative px-3 py-1.5 rounded-lg text-xs font-bold border transition",
                selected
                  ? "bg-sewanee-purple text-white border-sewanee-purple"
                  : runs
                    ? "bg-white text-gray-700 border-gray-200 hover:border-sewanee-purple/40"
                    : "bg-gray-50 text-gray-300 border-gray-100"
              )}
            >
              {d.short}
              {isToday && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sewanee-gold" />
              )}
            </button>
          );
        })}
      </div>

      {/* Timetable */}
      <div className="p-6">
        {runsToday.length === 0 ? (
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-6 text-center">
            <p className="text-sm font-bold text-gray-700">
              No {detail.route_name} on {dayName(day)}.
            </p>
          </div>
        ) : (
          <Timetable
            runs={runsToday}
            columns={columns}
            nowInDay={serviceMinutesNow(day, now)}
            nextRunId={next && next.serviceDay === day ? next.run.run_id : null}
          />
        )}
        {showExtension && (
          <p className="text-[11px] text-gray-400 mt-3">
            Shaded columns: only the last loop before each break continues to
            these stops.
          </p>
        )}
      </div>

      <StopsMap stops={detail.stops} />
      <StopList stops={detail.stops} />
    </>
  );
}

function NextBanner({
  next,
  firstStop,
  now,
}: {
  next: ReturnType<typeof nextDeparture>;
  firstStop: string;
  now: Date;
}) {
  if (!next) return null;
  const time = formatClock(next.run.start_minutes);
  const leavesOn = ((isoWeekday(now) - 1 + next.daysAhead) % 7) + 1;
  const when =
  next.minutesAway < 12 * 60
    ? formatWait(next.minutesAway)
    : next.daysAhead === 0
      ? "today"
      : next.daysAhead === 1
        ? "tomorrow"
        : `on ${dayName(leavesOn)}`;
  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white/10 px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-sewanee-gold">
        Next loop
      </span>
      <span className="text-sm font-semibold">
        Leaves {firstStop} at {time}, {when}
      </span>
    </div>
  );
}

function Timetable({
  runs,
  columns,
  nowInDay,
  nextRunId,
}: {
  runs: ScheduleRun[];
  columns: Stop[];
  nowInDay: number | null;
  nextRunId: number | null;
}) {
  const minutesTo = (stops: Stop[]) =>
    Math.max(0, ...stops.map((s) => s.expected_min_from_start ?? 0));
  const regularLength = minutesTo(columns.filter((s) => !s.extension_only));
  const extendedLength = minutesTo(columns);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="min-w-max text-xs font-mono border-collapse">
        <thead>
          <tr className="bg-sewanee-lavender">
            {columns.map((s, i) => (
              <th
                key={s.sequence_number ?? i}
                scope="col"
                className={cn(
                  "w-[76px] px-2 py-2 align-bottom text-left font-sans text-[10px] font-bold text-gray-600 leading-tight",
                  i === 0 && "sticky left-0 z-10 bg-sewanee-lavender",
                  s.extension_only && "bg-gray-100"
                )}
              >
                {s.stop_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run, idx) => {
            const prev = runs[idx - 1];
            const rests = prev && run.start_minutes - prev.start_minutes > REST_GAP_MIN;
            const isNext = run.run_id === nextRunId;
            const runEnds =
              run.start_minutes +
              (run.includes_extension ? extendedLength : regularLength);
            const isPast = nowInDay !== null && runEnds < nowInDay;
            return (
              <Fragment key={run.run_id}>
                {rests && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="bg-gray-100 py-1 font-sans text-[10px] font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {/* sticky so it stays in view when the table scrolls */}
                      <span className="sticky left-2 px-2">Shuttle rests</span>
                    </td>
                  </tr>
                )}
                <tr
                  className={cn(
                    "border-t border-gray-100",
                    isNext && "bg-sewanee-gold/15 font-bold text-gray-900",
                    isPast && "text-gray-300",
                    !isNext && !isPast && "text-gray-700"
                  )}
                >
                  {columns.map((s, i) => {
                    const skip = s.extension_only && !run.includes_extension;
                    return (
                      <td
                        key={s.sequence_number ?? i}
                        className={cn(
                          "px-2 py-1.5 whitespace-nowrap",
                          i === 0 && "sticky left-0 z-10",
                          i === 0 && (isNext ? "bg-[#f7f1e5]" : "bg-white"),
                          s.extension_only && "bg-gray-50"
                        )}
                      >
                        {skip
                          ? ""
                          : formatClock(run.start_minutes + (s.expected_min_from_start ?? 0))}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StopsMap({ stops }: { stops: Stop[] }) {
  // A loop visits some stops twice; show each place once.
  const unique = stops.filter(
    (s, i) => stops.findIndex((x) => x.stop_id === s.stop_id) === i
  );
  const points: LatLngExpression[] = unique.map((s) => [s.latitude, s.longitude]);

  return (
    <div className="h-64 sm:h-72 w-full border-t border-gray-100">
      <MapContainer
        center={points[0] ?? SEWANEE_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <InvalidateSize />
        <FitBounds points={points} />
        {unique.map((s, i) => (
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
  );
}

function StopList({ stops }: { stops: Stop[] }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Stops in order
        </p>
        <span className="text-xs font-mono text-gray-400">
          minutes after leaving {stops[0]?.stop_name ?? "the first stop"}
        </span>
      </div>
      <ol className="relative border-l-2 border-gray-200 ml-3">
        {stops.map((s, i) => (
          <li key={s.sequence_number ?? i} className="pl-8 pb-4 relative last:pb-0">
            <span
              className={cn(
                "absolute -left-[15px] top-0 w-7 h-7 rounded-full text-xs font-bold font-mono flex items-center justify-center",
                s.extension_only
                  ? "bg-gray-200 text-gray-600"
                  : "bg-sewanee-purple text-white"
              )}
            >
              {s.sequence_number ?? i + 1}
            </span>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900 text-sm">{s.stop_name}</p>
                {s.extension_only ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Last loop before a break only
                  </p>
                ) : (
                  s.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  )
                )}
              </div>
              {s.expected_min_from_start != null && (
                <span className="shrink-0 px-2 py-0.5 rounded-md bg-sewanee-gold/15 text-sewanee-gold text-[11px] font-bold font-mono">
                  +{s.expected_min_from_start}m
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}