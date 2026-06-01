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