// leaflet.markercluster extends the global L, so expose Leaflet on window before the plugin loads.
import L from "leaflet";
if (typeof window !== "undefined") (window as unknown as { L: typeof L }).L = L;
export default L;
