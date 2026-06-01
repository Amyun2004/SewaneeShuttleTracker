// Wire-format types that mirror the FastAPI Pydantic schemas.
// Kept in one file so a backend schema change shows up as a single
// TypeScript diff. Property names match the backend exactly (snake_case
// from Python) — no client-side renaming, no leaky abstractions.

export type Role = "rider" | "driver" | "admin";

export interface UserOut {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  active_role: Role;
  all_roles: Role[];
}

export interface LoginIn {
  email: string;
  password: string;
  mode: "rider" | "staff";
}

export interface RegisterIn {
  username: string;
  email: string;
  name: string;
  password: string;
  agreed_to_terms: boolean;
}

export interface LiveShuttle {
  shuttle_id: number;
  shuttle_name: string;
  driver: string;
  route_id: number;
  route_name: string;
  latitude: number;
  longitude: number;
  speed_mph: number | null;
  seconds_ago: number;
}

export interface NearestShuttle extends LiveShuttle {
  distance_m: number;
  distance_miles: number;
  distance_feet: number;
  bearing: number;
  walking_minutes: number;
  shuttle_eta_minutes: number | null;
}
export interface RouteSummary {
  route_id: number;
  route_name: string;
  description: string | null;
}

export interface Stop {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  description: string | null;
  sequence_number: number | null;
  expected_min_from_start: number | null;
}

export interface RouteDetail {
  route_id: number;
  route_name: string;
  description: string | null;
  stops: Stop[];
}

export interface HistoryTrip {
  trip_id: number;
  route_id: number;
  route_name: string;
  shuttle_id: number;
  shuttle_name: string;
  driver_name: string;
  start_time: string;
  end_time: string | null;
  /** Backend returns `duration_min`, not `duration_minutes`. */
  duration_min: number | null;
  /** Ordered [lat, lng] pairs forming the trip's path. May be empty. */
  path: [number, number][];
}

/** The full response from /api/history — includes filter options inline. */
export interface HistoryResponse {
  trips: HistoryTrip[];
  routes: { route_id: number; route_name: string }[];
  shuttles: { shuttle_id: number; shuttle_name: string }[];
  days: number;
}

// ---------- Admin dashboard ----------

export type Severity = "info" | "warning" | "critical";
export type IncidentStatus = "open" | "reviewing" | "resolved";
export type IncidentCategory =
  | "shuttle"
  | "stop"
  | "driver"
  | "safety"
  | "other";

export interface DashStats {
  total_trips: number;
  active_drivers: number;
  registered_drivers: number;
  open_incidents: number;
}

export interface DriverRow {
  driver: string;
  total_hours: number;
  trip_count?: number;
}

export interface StopVisit {
  stop_name: string;
  visits: number;
}

export interface RouteEfficiency {
  route_name: string;
  avg_actual_minutes: number;
  scheduled_minutes: number;
  minutes_over_schedule: number;
}

export interface NewDriver {
  username: string;
  full_name: string;
  email: string;
  created_at: string;
  trip_count: number;
}

export interface AdminIncident {
  incident_id: number;
  category: IncidentCategory;
  location: string | null;
  description: string;
  status: IncidentStatus;
  created_at: string;
  reporter_username: string;
  reporter_name: string;
}

export interface AdminAlert {
  alert_id: number;
  title: string;
  body: string;
  severity: Severity;
  created_at: string;
  expires_at: string | null;
  author_name: string;
  is_active: boolean;
}

/** Public alert shape from GET /api/alerts. Same as AdminAlert minus is_active. */
export interface PublicAlert {
  alert_id: number;
  title: string;
  body: string;
  severity: Severity;
  created_at: string;
  expires_at: string | null;
  author_name: string;
}

export interface AdminRecentTrip {
  trip_id: number;
  start_time: string;
  end_time: string | null;
  route_name: string;
  shuttle_name: string;
  driver_name: string;
  duration_min: number | null;
  scheduled_minutes: number | null;
  punctuality: "on_time" | "delayed" | "early" | null;
}

export interface AdminDashboard {
  stats: DashStats;
  ontime_rate: number;
  top_driver: { driver: string; total_hours: number; trip_count: number } | null;
  all_drivers_ranked: DriverRow[];
  weekend_stops: StopVisit[];
  route_efficiency: RouteEfficiency[];
  new_drivers: NewDriver[];
  incidents: AdminIncident[];
  alerts: AdminAlert[];
  recent_trips: AdminRecentTrip[];
}