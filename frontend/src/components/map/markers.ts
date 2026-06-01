// Custom Leaflet markers. Using divIcon (HTML) instead of Leaflet's
// default raster pins because:
//   1. Default pins don't ship cleanly with Vite (asset path issues).
//   2. HTML lets us match the brand colors — gold for shuttles, purple
//      for the user — without shipping more PNGs.
import L from "leaflet";

export const shuttleIcon = L.divIcon({
  className: "", // suppress Leaflet's default class
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  html: `
    <div style="
      width: 36px; height: 36px; border-radius: 50%;
      background: #C8A051;
      border: 3px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    ">🚐</div>
  `,
});

export const userIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `
    <div style="
      width: 22px; height: 22px; border-radius: 50%;
      background: #582C83;
      border: 3px solid white;
      box-shadow: 0 0 0 6px rgba(88, 44, 131, 0.18);
    "></div>
  `,
});