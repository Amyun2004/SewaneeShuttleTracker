// Imperative map controller. Sits inside <MapContainer> as an invisible
// child so it has access to the Leaflet map instance via useMap(). When
// the `target` prop changes, it pans there.
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

interface PanToProps {
  target: LatLngExpression | null;
  zoom?: number;
}

export function PanTo({ target, zoom }: PanToProps) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target, zoom ?? map.getZoom(), { duration: 0.7 });
  }, [target, zoom, map]);
  return null;
}