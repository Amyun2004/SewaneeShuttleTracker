// Map constants. Keeping them in one file so we don't have lat/lng
// scattered through components.
import { LatLngExpression } from "leaflet";

/** Sewanee campus rough center — fallback when geolocation isn't available. */
export const SEWANEE_CENTER: LatLngExpression = [35.2046, -85.9213];

/** Default zoom: close enough to see campus stops, wide enough to see all live shuttles. */
export const DEFAULT_ZOOM = 15;

/** OpenStreetMap tile URL + attribution. Free, well-cached, fine for a portfolio project. */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  