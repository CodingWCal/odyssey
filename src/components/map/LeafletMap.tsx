"use client";

import { useEffect, useRef } from "react";
import type { TripEvent } from "@/types";
import { EVENT_TYPE_COLORS } from "@/types";

interface LeafletMapProps {
  events: TripEvent[];
  onPinClick: (eventId: string) => void;
}

export function LeafletMap({ events, onPinClick }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current) return;

      // Clear any stale Leaflet container state from a previous mount
      if ((mapRef.current as any)._leaflet_id) {
        delete (mapRef.current as any)._leaflet_id;
      }

      const L = (await import("leaflet")).default;

      // Bail out if the effect was cleaned up while imports were loading
      if (cancelled || !mapRef.current) return;

      const validEvents = events.filter((e) => e.lat != null && e.lng != null);

      let center: [number, number] = [20, 0];
      let zoom = 2;

      if (validEvents.length > 0) {
        const avgLat = validEvents.reduce((s, e) => s + e.lat!, 0) / validEvents.length;
        const avgLng = validEvents.reduce((s, e) => s + e.lng!, 0) / validEvents.length;
        center = [avgLat, avgLng];
        zoom = validEvents.length === 1 ? 13 : 10;
      }

      const map = L.map(mapRef.current).setView(center, zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      validEvents.forEach((event) => {
        const color = EVENT_TYPE_COLORS[event.type as keyof typeof EVENT_TYPE_COLORS] ?? "#5DCAA5";

        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });

        const marker = L.marker([event.lat!, event.lng!], { icon });
        marker.bindTooltip(event.title, { permanent: false, direction: "top" });
        marker.on("click", () => onPinClick(event.id));
        marker.addTo(map);
      });

      if (!cancelled) {
        mapInstanceRef.current = map;
      } else {
        map.remove();
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapRef.current) {
        delete (mapRef.current as any)._leaflet_id;
      }
    };
  }, []);

  return <div ref={mapRef} className="h-full w-full rounded-xl" aria-label="Trip map" />;
}
