// Forces Leaflet to recompute its container size after mount.
//
// MapContainer measures its pixel dimensions when it initializes, but our
// maps live inside flex/grid containers whose height resolves a beat later
// (and on Schedule, the map only mounts once a route is picked). The result
// is tiles laid out against a zero/short height — the classic "gray map
// until you nudge it" bug. We invalidate the size on mount, across a couple
// of frames so layout has settled, and again on every window resize. Sits
// inside <MapContainer> as an invisible child, same pattern as PanTo/FitBounds.
import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function InvalidateSize() {
  const map = useMap();

  useEffect(() => {
    // After the current paint, once the container has its real height.
    const raf = requestAnimationFrame(() => map.invalidateSize());
    // Belt-and-suspenders: a slightly later pass catches slow layout
    // (web fonts loading, sidebar/grid transitions, etc.).
    const timer = window.setTimeout(() => map.invalidateSize(), 250);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  return null;
}