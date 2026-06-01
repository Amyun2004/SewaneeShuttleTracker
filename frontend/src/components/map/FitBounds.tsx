// Auto-fits the map view to a set of coordinates. Used by the schedule
// page so the preview map always shows the full route — no manual
// "where is this stop" panning required.
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";

interface FitBoundsProps {
  points: LatLngExpression[];
  /** Pixel padding around the fitted area. */
  padding?: number;
}

export function FitBounds({ points, padding = 40 }: FitBoundsProps) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [padding, padding] });
  }, [points, padding, map]);
  return null;
}