// /admin — staff dashboard.
//
// Three sections, top-to-bottom: Overview (stats, on-time ring, recent
// trips, live map), Operations (incidents queue, alerts editor), Insights
// (driver leaderboard, route efficiency, popular weekend stops).
//
// All sections use the same single /api/admin/dashboard payload — one
// fetch, refetched every 30 seconds via TanStack Query. Incident and
// alert mutations invalidate this query so the UI refreshes automatically.
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { api } from "@/api/client";
import type {
  AdminAlert,
  AdminDashboard,
  AdminIncident,
  AdminRecentTrip,
  IncidentStatus,
  LiveShuttle,
  Severity,
} from "@/api/types";
import { useLiveShuttles } from "@/hooks/useLiveShuttles";
import { shuttleIcon } from "@/components/map/markers";
import {
  DEFAULT_ZOOM,
  SEWANEE_CENTER,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/lib/map";
import { formatDuration, formatTripDate } from "@/lib/datetime";
import { cn } from "@/lib/cn";

export function Admin() {
  const qc = useQueryClient();
  const dashQuery = useQuery<AdminDashboard>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<AdminDashboard>("/api/admin/dashboard"),
    refetchInterval: 30_000,
  });

  const dash = dashQuery.data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <header>
        <p className="text-[10px] font-bold text-sewanee-purple uppercase tracking-widest">
          Staff dashboard
        </p>
        <h1 className="text-3xl font-black text-gray-900">Operations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live system view. Refreshes every 30 seconds; mutations refresh
          immediately.
        </p>
      </header>

      {dashQuery.isLoading ? (
        <p className="text-sm text-gray-400 font-mono">Loading dashboard…</p>
      ) : dashQuery.isError || !dash ? (
        <p className="text-sm text-red-500">Couldn't load dashboard.</p>
      ) : (
        <>
          <OverviewSection dash={dash} />
          <OperationsSection
            incidents={dash.incidents}
            alerts={dash.alerts}
            onInvalidate={() =>
              qc.invalidateQueries({ queryKey: ["admin", "dashboard"] })
            }
          />
          <InsightsSection dash={dash} />
        </>
      )}
    </div>
  );
}

/* ============================================================
   Overview
   ============================================================ */

function OverviewSection({ dash }: { dash: AdminDashboard }) {
  const { shuttles } = useLiveShuttles();

  return (
    <section className="space-y-5">
      <SectionHeader title="Overview" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Total trips"
          value={dash.stats.total_trips.toLocaleString()}
        />
        <StatTile
          label="Active drivers"
          value={`${dash.stats.active_drivers} / ${dash.stats.registered_drivers}`}
          hint="on shift / registered"
        />
        <StatTile
          label="On-time rate"
          value={`${dash.ontime_rate}%`}
          accent={
            dash.ontime_rate >= 90
              ? "good"
              : dash.ontime_rate >= 70
              ? "warn"
              : "bad"
          }
        />
        <StatTile
          label="Open incidents"
          value={String(dash.stats.open_incidents)}
          accent={dash.stats.open_incidents > 0 ? "warn" : "good"}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-5">
        <Card title="Live fleet" subtitle={`${shuttles.length} shuttles streaming`}>
          <div className="h-[360px] w-full overflow-hidden">
            <MapContainer
              center={SEWANEE_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              {shuttles.map((s) => (
                <FleetMarker key={s.shuttle_id} shuttle={s} />
              ))}
            </MapContainer>
          </div>
        </Card>

        <Card title="Recent trips" subtitle={`last ${dash.recent_trips.length}`}>
          <ul className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
            {dash.recent_trips.map((t) => (
              <RecentTripRow key={t.trip_id} trip={t} />
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

function FleetMarker({ shuttle }: { shuttle: LiveShuttle }) {
  return (
    <Marker
      position={[shuttle.latitude, shuttle.longitude]}
      icon={shuttleIcon}
    >
      <Popup>
        <div className="text-xs">
          <p className="font-bold text-sm">{shuttle.shuttle_name}</p>
          <p className="text-gray-500">{shuttle.route_name}</p>
          <p className="text-gray-500">Driver: {shuttle.driver}</p>
          <p className="text-gray-400 mt-1 font-mono">
            {shuttle.seconds_ago}s ago
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

function RecentTripRow({ trip }: { trip: AdminRecentTrip }) {
  return (
    <li className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {trip.route_name}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {trip.shuttle_name} · {trip.driver_name}
        </p>
        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
          {formatTripDate(trip.start_time)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold font-mono text-gray-700">
          {trip.duration_min !== null
            ? formatDuration(Math.round(trip.duration_min))
            : "—"}
        </p>
        <PunctualityPill p={trip.punctuality} />
      </div>
    </li>
  );
}

function PunctualityPill({
  p,
}: {
  p: AdminRecentTrip["punctuality"];
}) {
  if (!p) return null;
  const styles =
    p === "delayed"
      ? "bg-red-100 text-red-700"
      : p === "early"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700";
  return (
    <span
      className={cn(
        "inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-bold uppercase",
        styles
      )}
    >
      {p.replace("_", " ")}
    </span>
  );
}

/* ============================================================
   Operations: incidents + alerts
   ============================================================ */

function OperationsSection({
  incidents,
  alerts,
  onInvalidate,
}: {
  incidents: AdminIncident[];
  alerts: AdminAlert[];
  onInvalidate: () => void;
}) {
  return (
    <section className="space-y-5">
      <SectionHeader title="Operations" />
      <div className="grid lg:grid-cols-2 gap-5">
        <IncidentsCard incidents={incidents} onInvalidate={onInvalidate} />
        <AlertsCard alerts={alerts} onInvalidate={onInvalidate} />
      </div>
    </section>
  );
}

function IncidentsCard({
  incidents,
  onInvalidate,
}: {
  incidents: AdminIncident[];
  onInvalidate: () => void;
}) {
  const statusMut = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: IncidentStatus;
    }) => api.post(`/api/incidents/${id}/status`, { status }),
    onSuccess: onInvalidate,
  });

  return (
    <Card
      title="Incidents"
      subtitle={`${incidents.filter((i) => i.status !== "resolved").length} active`}
    >
      {incidents.length === 0 ? (
        <EmptyRow text="No reported incidents." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {incidents.map((i) => (
            <li key={i.incident_id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CategoryBadge category={i.category} />
                    <StatusBadge status={i.status} />
                  </div>
                  <p className="text-sm text-gray-800">{i.description}</p>
                  {i.location && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      📍 {i.location}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 font-mono mt-1">
                    {i.reporter_name} · {formatTripDate(i.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(["open", "reviewing", "resolved"] as IncidentStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={i.status === s || statusMut.isPending}
                      onClick={() =>
                        statusMut.mutate({ id: i.incident_id, status: s })
                      }
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-semibold transition",
                        i.status === s
                          ? "bg-sewanee-purple text-white cursor-default"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {s}
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AlertsCard({
  alerts,
  onInvalidate,
}: {
  alerts: AdminAlert[];
  onInvalidate: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/api/alerts/${id}`),
    onSuccess: onInvalidate,
  });

  return (
    <Card
      title="Alerts"
      subtitle={`${alerts.filter((a) => a.is_active).length} active`}
      action={
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1 rounded-md text-xs font-bold bg-sewanee-gold text-white hover:bg-sewanee-gold-light transition"
        >
          {showForm ? "Cancel" : "+ Post alert"}
        </button>
      }
    >
      {showForm && (
        <AlertForm
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            onInvalidate();
          }}
        />
      )}
      {alerts.length === 0 && !showForm ? (
        <EmptyRow text="No alerts posted." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {alerts.map((a) => (
            <li
              key={a.alert_id}
              className="px-4 py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={a.severity} />
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {a.title}
                  </p>
                </div>
                <p className="text-sm text-gray-600">{a.body}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-1">
                  {a.author_name} · {formatTripDate(a.created_at)}
                </p>
              </div>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (confirm(`Delete alert "${a.title}"?`)) {
                    deleteMut.mutate(a.alert_id);
                  }
                }}
                className="shrink-0 text-xs text-red-500 font-semibold hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AlertForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");

  const createMut = useMutation({
    mutationFn: () =>
      api.post("/api/alerts", { title, body, severity }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setSeverity("info");
      onCreated();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim() && body.trim()) {
      createMut.mutate();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="px-4 py-4 bg-gray-50 border-b border-gray-100 space-y-3"
    >
      <input
        type="text"
        placeholder="Alert title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sewanee-purple/30 focus:border-sewanee-purple"
        maxLength={120}
        required
      />
      <textarea
        placeholder="Body — what should riders know?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sewanee-purple/30 focus:border-sewanee-purple resize-none"
        rows={3}
        maxLength={500}
        required
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["info", "warning", "critical"] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition",
                severity === s
                  ? severityClasses(s).active
                  : severityClasses(s).inactive
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              createMut.isPending || !title.trim() || !body.trim()
            }
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-sewanee-purple text-white hover:bg-sewanee-purple-light transition disabled:opacity-50"
          >
            {createMut.isPending ? "Posting…" : "Post alert"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ============================================================
   Insights
   ============================================================ */

function InsightsSection({ dash }: { dash: AdminDashboard }) {
  return (
    <section className="space-y-5">
      <SectionHeader title="Insights" />
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Driver leaderboard" subtitle="hours logged">
          <ul className="divide-y divide-gray-100">
            {dash.all_drivers_ranked.map((d, i) => (
              <li
                key={d.driver}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black font-mono shrink-0",
                      i === 0
                        ? "bg-sewanee-gold text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {d.driver}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono text-gray-700">
                  {d.total_hours.toFixed(1)}h
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Route efficiency" subtitle="actual vs scheduled">
          <ul className="divide-y divide-gray-100">
            {dash.route_efficiency.map((r) => (
              <li key={r.route_name} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {r.route_name}
                  </p>
                  <DeltaBadge minutes={r.minutes_over_schedule} />
                </div>
                <p className="text-[11px] text-gray-500 font-mono">
                  avg {r.avg_actual_minutes.toFixed(1)}m · plan{" "}
                  {r.scheduled_minutes}m
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Popular weekend stops" subtitle="visits">
          <ul className="divide-y divide-gray-100">
            {dash.weekend_stops.map((s) => (
              <li
                key={s.stop_name}
                className="px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm text-gray-800">{s.stop_name}</span>
                <span className="text-sm font-bold font-mono text-gray-700">
                  {s.visits}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

function DeltaBadge({ minutes }: { minutes: number }) {
  const rounded = Math.round(minutes);
  if (Math.abs(rounded) < 1) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
        on plan
      </span>
    );
  }
  if (rounded > 0) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700">
        +{rounded}m
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
      {rounded}m
    </span>
  );
}

/* ============================================================
   Shared primitives
   ============================================================ */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-grow bg-gray-200" />
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {title}
      </p>
      <span className="h-px flex-grow bg-gray-200" />
    </div>
  );
}

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "good" | "warn" | "bad";
}) {
  const ring =
    accent === "good"
      ? "ring-2 ring-green-200"
      : accent === "warn"
      ? "ring-2 ring-yellow-200"
      : accent === "bad"
      ? "ring-2 ring-red-200"
      : "";
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-gray-100 p-4 shadow-sm",
        ring
      )}
    >
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-2xl font-black font-mono text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-6 text-xs text-center text-gray-400">{text}</p>;
}

function CategoryBadge({
  category,
}: {
  category: AdminIncident["category"];
}) {
  const emoji =
    category === "shuttle"
      ? "🚐"
      : category === "stop"
      ? "📍"
      : category === "driver"
      ? "👤"
      : category === "safety"
      ? "⚠️"
      : "•";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold uppercase">
      {emoji} {category}
    </span>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const styles =
    status === "resolved"
      ? "bg-green-100 text-green-700"
      : status === "reviewing"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
        styles
      )}
    >
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
        severityClasses(severity).inactive
      )}
    >
      {severity}
    </span>
  );
}

function severityClasses(s: Severity) {
  if (s === "critical") {
    return {
      active: "bg-red-500 text-white",
      inactive: "bg-red-100 text-red-700",
    };
  }
  if (s === "warning") {
    return {
      active: "bg-yellow-500 text-white",
      inactive: "bg-yellow-100 text-yellow-700",
    };
  }
  return {
    active: "bg-sewanee-purple text-white",
    inactive: "bg-sewanee-purple/10 text-sewanee-purple",
  };
}