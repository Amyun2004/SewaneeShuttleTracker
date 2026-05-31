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
  bearing_deg: number | null;
  seconds_ago: number;
}

export interface NearestShuttle extends LiveShuttle {
  distance_meters: number;
  eta_seconds: number | null;
}