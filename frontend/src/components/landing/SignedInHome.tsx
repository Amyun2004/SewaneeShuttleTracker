// Signed-in home for riders and admins. Three blocks:
//   1. Active alerts banner (admin can edit/delete inline)
//   2. Nearest shuttle card (uses /api/shuttles/nearest with geolocation)
//   3. Quick links to Map / Schedule / History (Admin gets a 4th link)
//
// The alert edit path piggybacks on the admin alert endpoints we already
// have. Non-admins see a read-only list. The form mounts only when an
// admin clicks "+ Post alert", same UX as the admin dashboard.
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { cn } from "@/lib/cn";
import { formatTripDate } from "@/lib/datetime";

import type { IncidentCategory, NearestShuttle, PublicAlert, Severity } from "@/api/types";
interface SignedInHomeProps {
  isAdmin: boolean;
}

export function SignedInHome({ isAdmin }: SignedInHomeProps) {
  const { user } = useAuth();
  const firstName = user?.full_name.split(" ")[0] ?? "there";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header>
        <p className="text-[10px] font-bold text-sewanee-purple uppercase tracking-widest">
          Welcome
        </p>
        <h1 className="text-3xl font-black text-gray-900">Hi, {firstName}.</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quick overview of the shuttle system right now.
        </p>
      </header>

      <AlertsBlock isAdmin={isAdmin} />
      <NearestShuttleBlock />
      <IncidentReportBlock />
      <QuickLinks isAdmin={isAdmin} />
    </div>
  );
}

/* ============================================================ */

function AlertsBlock({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const alertsQuery = useQuery<PublicAlert[]>({
    queryKey: ["alerts", "public"],
    queryFn: () => api.get<PublicAlert[]>("/api/alerts"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/api/alerts/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["alerts", "public"] }),
  });

  const alerts = alertsQuery.data ?? [];

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Service alerts
          {alerts.length > 0 && (
            <span className="ml-2 text-gray-700">· {alerts.length}</span>
          )}
        </p>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="px-3 py-1 rounded-md text-xs font-bold bg-sewanee-gold text-white hover:bg-sewanee-gold-light transition"
          >
            {showForm ? "Cancel" : "+ Post alert"}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <AlertForm
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["alerts", "public"] });
          }}
        />
      )}

      {alertsQuery.isLoading ? (
        <p className="text-sm text-gray-400 font-mono">Loading…</p>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center">
          <p className="text-sm text-gray-500">No active alerts. ✨</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.alert_id}>
              <AlertCard
                alert={a}
                isAdmin={isAdmin}
                onDelete={() => {
                  if (confirm(`Delete alert "${a.title}"?`)) {
                    deleteMut.mutate(a.alert_id);
                  }
                }}
                disabled={deleteMut.isPending}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertCard({
  alert,
  isAdmin,
  onDelete,
  disabled,
}: {
  alert: PublicAlert;
  isAdmin: boolean;
  onDelete: () => void;
  disabled: boolean;
}) {
  const cls = severityClasses(alert.severity);
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex items-start justify-between gap-3",
        cls.border,
        cls.bg
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
              cls.pill
            )}
          >
            {alert.severity}
          </span>
          <p className="text-sm font-bold text-gray-900 truncate">{alert.title}</p>
        </div>
        <p className="text-sm text-gray-700">{alert.body}</p>
        <p className="text-[10px] text-gray-400 font-mono mt-1">
          {alert.author_name} · {formatTripDate(alert.created_at)}
        </p>
      </div>
      {isAdmin && (
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className="shrink-0 text-xs text-red-500 font-semibold hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
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
    mutationFn: () => api.post("/api/alerts", { title, body, severity }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setSeverity("info");
      onCreated();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim() && body.trim()) createMut.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 space-y-3"
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
                  : severityClasses(s).pill
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
            disabled={createMut.isPending || !title.trim() || !body.trim()}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-sewanee-purple text-white hover:bg-sewanee-purple-light transition disabled:opacity-50"
          >
            {createMut.isPending ? "Posting…" : "Post alert"}
          </button>
        </div>
      </div>
    </form>
  );
}

function severityClasses(s: Severity) {
  if (s === "critical") {
    return {
      border: "border-red-200",
      bg: "bg-red-50",
      pill: "bg-red-100 text-red-700",
      active: "bg-red-500 text-white",
    };
  }
  if (s === "warning") {
    return {
      border: "border-yellow-200",
      bg: "bg-yellow-50",
      pill: "bg-yellow-100 text-yellow-700",
      active: "bg-yellow-500 text-white",
    };
  }
  return {
    border: "border-sewanee-purple/20",
    bg: "bg-sewanee-purple/5",
    pill: "bg-sewanee-purple/10 text-sewanee-purple",
    active: "bg-sewanee-purple text-white",
  };
}

/* ============================================================ */

function NearestShuttleBlock() {
  const { fix, status } = useGeolocation();

  const nearestQuery = useQuery<NearestShuttle | null>({
    queryKey: ["shuttles", "nearest", fix?.latitude, fix?.longitude],
    queryFn: () =>
      api.get<NearestShuttle | null>(
        `/api/shuttles/nearest?lat=${fix!.latitude}&lng=${fix!.longitude}`
      ),
    enabled: !!fix,
    staleTime: 15_000,
  });

  return (
    <section>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        Closest shuttle to you
      </p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {status === "denied" ? (
          <NearestMessage
            emoji="📍"
            title="Location denied"
            body="Allow location in your browser to see the closest shuttle."
          />
        ) : status === "unavailable" ? (
          <NearestMessage
            emoji="📡"
            title="GPS unavailable"
            body="We couldn't get a location fix from this device."
          />
        ) : !fix ? (
          <NearestMessage
            emoji="⏳"
            title="Locating you…"
            body="Waiting for the browser to share your position."
          />
        ) : nearestQuery.isLoading ? (
          <p className="text-sm text-gray-400 font-mono">Finding nearest…</p>
        ) : !nearestQuery.data ? (
          <NearestMessage
            emoji="🚐"
            title="No shuttles in service"
            body="Check the schedule or come back later."
          />
        ) : (
          <NearestPanel nearest={nearestQuery.data} />
        )}
      </div>
    </section>
  );
}

function NearestPanel({ nearest }: { nearest: NearestShuttle }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-xs font-bold text-sewanee-gold uppercase tracking-widest">
          {nearest.route_name}
        </p>
        <p className="text-2xl font-black text-gray-900 mt-1">
          {nearest.shuttle_name}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{nearest.driver}</p>
      </div>
      <div className="text-right">
        <p className="text-3xl font-black font-mono text-sewanee-purple leading-none">
          {nearest.distance_feet}
          <span className="text-base text-gray-400 font-bold ml-1">ft</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {nearest.walking_minutes} min walk
          {nearest.shuttle_eta_minutes !== null && (
            <> · arrives ~{nearest.shuttle_eta_minutes} min</>
          )}
        </p>
      </div>
      <Link
        to="/map"
        className="w-full sm:w-auto text-center px-5 py-2.5 rounded-xl bg-sewanee-purple text-white text-sm font-bold hover:bg-sewanee-purple-light transition"
      >
        Open live map →
      </Link>
    </div>
  );
}

function NearestMessage({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="text-center py-4">
      <div className="text-3xl mb-2">{emoji}</div>
      <p className="font-bold text-gray-900 text-sm">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{body}</p>
    </div>
  );
}

/* ============================================================ */

function QuickLinks({ isAdmin }: { isAdmin: boolean }) {
  return (
    <section>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        Jump to
      </p>
      <div
        className={cn(
          "grid gap-3",
          isAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        )}
      >
        <QuickLink to="/map" emoji="📍" label="Live map" hint="See every shuttle now" />
        <QuickLink to="/schedule" emoji="⏰" label="Schedule" hint="Routes and stops" />
        <QuickLink to="/history" emoji="📊" label="History" hint="Past trips & traces" />
        {isAdmin && (
          <QuickLink
            to="/admin"
            emoji="⚙️"
            label="Admin"
            hint="Operations dashboard"
          />
        )}
      </div>
    </section>
  );
}

function QuickLink({
  to,
  emoji,
  label,
  hint,
}: {
  to: string;
  emoji: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:border-sewanee-purple/40 hover:-translate-y-0.5 transition"
    >
      <div className="text-2xl mb-2">{emoji}</div>
      <p className="font-bold text-gray-900 text-sm">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
    </Link>
  );
}

/* ============================================================ */

const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string }[] = [
  { value: "shuttle", label: "Shuttle problem (late, broken, etc.)" },
  { value: "stop", label: "Stop issue (sign, lighting, safety)" },
  { value: "driver", label: "Driver concern" },
  { value: "safety", label: "Safety / harassment" },
  { value: "other", label: "Other" },
];

function IncidentReportBlock() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Something wrong?
        </p>
        {!done && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-1 rounded-md text-xs font-bold bg-sewanee-purple text-white hover:bg-sewanee-purple-light transition"
          >
            {open ? "Cancel" : "⚠ Report an issue"}
          </button>
        )}
      </div>

      {done ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-5 text-center">
          <div className="text-2xl mb-1">✅</div>
          <p className="text-sm font-bold text-gray-900">Report submitted</p>
          <p className="text-xs text-gray-500 mt-1">
            Thanks — transit admins will review it.
          </p>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setOpen(false);
            }}
            className="mt-3 text-xs font-semibold text-sewanee-purple hover:underline"
          >
            Report another
          </button>
        </div>
      ) : open ? (
        <IncidentForm
          onCancel={() => setOpen(false)}
          onSubmitted={() => setDone(true)}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4">
          <p className="text-sm text-gray-500">
            Spot a problem with a shuttle, a stop, or a driver? Let the transit
            team know.
          </p>
        </div>
      )}
    </section>
  );
}

function IncidentForm({
  onCancel,
  onSubmitted,
}: {
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [category, setCategory] = useState<IncidentCategory | "">("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      api.post("/api/incidents", {
        category,
        location: location.trim() || null,
        description: description.trim(),
      }),
    onSuccess: () => onSubmitted(),
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message || "Couldn't submit your report."
          : "Network error. Try again."
      ),
  });

  const ready =
    category !== "" && description.trim().length >= 10 && !createMut.isPending;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (ready) createMut.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
    >
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as IncidentCategory | "")}
          required
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sewanee-purple/30 focus:border-sewanee-purple"
        >
          <option value="">Select a category…</option>
          {INCIDENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Location{" "}
          <span className="text-gray-300 normal-case font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={120}
          placeholder="e.g. Near McClurg, around 3:15 PM"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sewanee-purple/30 focus:border-sewanee-purple"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          minLength={10}
          maxLength={1000}
          placeholder="Tell us what happened…"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sewanee-purple/30 focus:border-sewanee-purple resize-none"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          {description.trim().length < 10
            ? `At least 10 characters (${description.trim().length}/10).`
            : `${description.length}/1000`}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="px-3 py-1.5 rounded-md text-xs font-bold bg-sewanee-purple text-white hover:bg-sewanee-purple-light transition disabled:opacity-50"
        >
          {createMut.isPending ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </form>
  );
}