"use client";
import dynamic from "next/dynamic";
import type { LeafletMapProps } from "./leaflet-map";
import { Skeleton } from "@/components/brand/brand";

/** Client-only OpenStreetMap (Leaflet touches window, so it never renders on the server). */
const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

export function OsmMap(props: LeafletMapProps) {
  return <LeafletMap {...props} />;
}
export type { MapMarker, MapCircle, MapLine, MapBubble } from "./leaflet-map";
