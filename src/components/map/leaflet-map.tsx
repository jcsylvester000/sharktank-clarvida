"use client";
// OpenStreetMap base map (FT-170) with Leaflet: markers, clustering, rings, route lines and county demand circles.
// Tiles come from tile.openstreetmap.org (light, interactive use with attribution, per the OSM tile usage policy).
import { useEffect, useRef, useState } from "react";
import L from "./leaflet-setup";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { LatLng } from "@/lib/geo";

export interface MapMarker extends LatLng {
  id: string;
  label: string;
  /** Short glyph or letters inside the pin. */
  glyph?: string;
  color: string;
  /** Glyph colour; dark ink on the light blues so the letters stay readable. */
  text?: string;
  ring?: string;
  shape?: "pin" | "office" | "visit" | "dot";
  selected?: boolean;
  cluster?: boolean;
  order?: number; // route stop number
}
export interface MapCircle extends LatLng { id: string; radiusMi: number; color: string; dashed?: boolean; fill?: number; label?: string }
export interface MapLine { id: string; points: LatLng[]; color: string; dashed?: boolean }
export interface MapBubble extends LatLng { id: string; radiusMi: number; color: string; opacity: number; label: string; pulse?: boolean }

export interface LeafletMapProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  circles?: MapCircle[];
  lines?: MapLine[];
  bubbles?: MapBubble[];
  onMarkerClick?: (id: string) => void;
  focus?: LatLng | null;
  className?: string;
  ariaLabel: string;
}

const MILE = 1609.34;

function iconFor(m: MapMarker): L.DivIcon {
  const sel = m.selected ? " cv-pin--sel" : "";
  if (m.shape === "office") {
    return L.divIcon({ className: "cv-office", html: `<span class="cv-office-badge" style="--c:${m.color}"><img src="/brand/logo-symbol.png" alt="" /></span>`, iconSize: [40, 40], iconAnchor: [20, 20] });
  }
  if (m.shape === "visit") {
    return L.divIcon({ className: "cv-visit", html: `<span class="cv-visit-dot" style="--c:${m.color}">✓</span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
  }
  const num = m.order ? `<span class="cv-pin-order">${m.order}</span>` : "";
  return L.divIcon({
    className: "cv-pin-wrap",
    html: `<span class="cv-pin${sel}" style="--c:${m.color};--r:${m.ring ?? "#fff"};--t:${m.text ?? "#fff"}"><span class="cv-pin-glyph">${m.glyph ?? ""}</span></span>${num}`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
  });
}

export default function LeafletMap({ center, zoom = 11, markers = [], circles = [], lines = [], bubbles = [], onMarkerClick, focus, className, ariaLabel }: LeafletMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ cluster: L.MarkerClusterGroup; plain: L.LayerGroup; shapes: L.LayerGroup } | null>(null);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: [center.lat, center.lng], zoom, maxZoom: 18, minZoom: 3, zoomControl: true, scrollWheelZoom: true, attributionControl: true });
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      className: "cv-tiles",
    });
    // Offline (Wi-Fi off on stage): request no tiles at all, so the demo makes zero external requests (AC-NF-03);
    // markers, rings and routes still draw over a plain background and the offline notice explains why.
    const online = () => { if (!m.hasLayer(tiles)) tiles.addTo(m); };
    const offline = () => { if (m.hasLayer(tiles)) m.removeLayer(tiles); setTilesFailed(true); };
    if (typeof navigator !== "undefined" && navigator.onLine === false) offline(); else tiles.addTo(m);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    let errors = 0;
    tiles.on("tileerror", () => { errors += 1; if (errors > 3) setTilesFailed(true); });
    tiles.on("tileload", () => setTilesFailed(false));
    m.attributionControl.setPrefix(false);
    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 56, spiderfyOnMaxZoom: true, iconCreateFunction: (c) => L.divIcon({ className: "cv-cluster-wrap", html: `<span class="cv-cluster">${c.getChildCount()}</span>`, iconSize: [36, 36] }) });
    const shapes = L.layerGroup().addTo(m);
    const plain = L.layerGroup().addTo(m);
    cluster.addTo(m);
    layers.current = { cluster, plain, shapes };
    map.current = m;
    // Leaflet measures its container on mount; re-measure after layout settles.
    let alive = true;
    const resize = () => { if (alive) m.invalidateSize({ animate: false }); };
    const settle = setTimeout(resize, 50);
    const ro = new ResizeObserver(resize);
    ro.observe(el.current);
    return () => {
      // Leaving the page mid-animation (guided demo Next) must not leave timers poking a removed map.
      alive = false;
      clearTimeout(settle);
      window.removeEventListener("online", online); window.removeEventListener("offline", offline); ro.disconnect();
      m.stop(); cluster.clearLayers(); m.off(); m.remove();
      map.current = null; layers.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data layers
  useEffect(() => {
    const ls = layers.current;
    if (!ls) return;
    ls.cluster.clearLayers();
    ls.plain.clearLayers();
    ls.shapes.clearLayers();
    for (const b of bubbles) {
      L.circle([b.lat, b.lng], { radius: b.radiusMi * MILE, color: b.color, weight: 1.5, fillColor: b.color, fillOpacity: b.opacity, interactive: true, className: b.pulse ? "cv-pulse" : undefined })
        .bindTooltip(b.label, { direction: "top", className: "cv-tip" })
        .addTo(ls.shapes);
    }
    for (const c of circles) {
      const circle = L.circle([c.lat, c.lng], { radius: c.radiusMi * MILE, color: c.color, weight: 2, dashArray: c.dashed ? "6 6" : undefined, fill: (c.fill ?? 0) > 0, fillColor: c.color, fillOpacity: c.fill ?? 0, interactive: false }).addTo(ls.shapes);
      if (c.label) {
        const north = L.latLng(c.lat + c.radiusMi / 69, c.lng);
        L.marker(north, { interactive: false, icon: L.divIcon({ className: "cv-ring-label", html: `<span>${c.label}</span>`, iconSize: [80, 20], iconAnchor: [40, 10] }) }).addTo(ls.shapes);
      }
      void circle;
    }
    for (const ln of lines) {
      L.polyline(ln.points.map((p) => [p.lat, p.lng] as [number, number]), { color: ln.color, weight: 4, opacity: 0.9, dashArray: ln.dashed ? "8 8" : undefined }).addTo(ls.shapes);
    }
    for (const mk of markers) {
      // Visit ticks are decoration (details live in the Visits list), so they are not separate tap targets (WCAG 2.5.8).
      const decorative = mk.shape === "visit";
      const marker = L.marker([mk.lat, mk.lng], { icon: iconFor(mk), title: decorative ? undefined : mk.label, alt: decorative ? "" : mk.label, interactive: !decorative, keyboard: !decorative, riseOnHover: true, zIndexOffset: mk.selected ? 1000 : mk.shape === "office" ? 500 : 0 });
      marker.bindTooltip(mk.label, { direction: "top", offset: [0, -30], className: "cv-tip" });
      marker.on("click", () => clickRef.current?.(mk.id));
      marker.on("keypress", (e: L.LeafletKeyboardEvent) => { if (e.originalEvent.key === "Enter") clickRef.current?.(mk.id); });
      (mk.cluster ? ls.cluster : ls.plain).addLayer(marker);
    }
  }, [markers, circles, lines, bubbles]);

  useEffect(() => {
    if (focus && map.current) map.current.panTo([focus.lat, focus.lng], { animate: true });
  }, [focus]);

  useEffect(() => {
    map.current?.setView([center.lat, center.lng], map.current.getZoom() || zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={el} role="application" aria-label={ariaLabel} className="h-full w-full" />
      {tilesFailed ? (
        <p role="status" className="absolute left-14 top-3 z-[500] max-w-xs rounded-xl bg-surface/95 px-3 py-2 text-xs text-ink-2 shadow">
          Street map needs an internet connection. Organizations, offices and rings still show on their real positions.
        </p>
      ) : null}
    </div>
  );
}
