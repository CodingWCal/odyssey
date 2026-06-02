"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { TYPE_HEX, type MapEvent } from "./mapTypes";

interface LeafletMapProps {
  events: MapEvent[];
  activeDay: string;
  selectedId: string | null;
  showRoute: boolean;
  onSelect: (id: string) => void;
}

function markerHtml(ev: MapEvent, active: boolean): string {
  const color = TYPE_HEX[ev.type] ?? TYPE_HEX.misc;
  return `<div class="od-marker ${active ? "active" : ""}" style="background:${color}"><span>${ev.globalIdx}</span></div>`;
}

export function LeafletMap({ events, activeDay, selectedId, showRoute, onSelect }: LeafletMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const polylineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Keep latest onSelect without re-running the init effect.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default as any;
      if (cancelled || !elRef.current) return;
      if ((elRef.current as any)._leaflet_id) delete (elRef.current as any)._leaflet_id;

      const map = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView([35.6, 139.5], 5);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19, pane: "shadowPane" }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      LRef.current = L;
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      if (elRef.current) delete (elRef.current as any)._leaflet_id;
    };
  }, []);

  // Render markers + polyline + fit bounds when the data or filters change.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    Object.values(markersRef.current).forEach((m: any) => map.removeLayer(m));
    markersRef.current = {};
    if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null; }

    const filtered = events.filter((e) => activeDay === "all" || e.dayId === activeDay);

    filtered.forEach((ev) => {
      const active = selectedId === ev.id;
      const icon = L.divIcon({ className: "", html: markerHtml(ev, active), iconSize: [32, 32], iconAnchor: [16, 32] });
      const m = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: active ? 1000 : 0 });
      m.bindTooltip(`${ev.globalIdx}. ${ev.title}`, { className: "od-tip", direction: "top", offset: [0, -28] });
      m.on("click", () => onSelectRef.current(ev.id));
      m.addTo(map);
      markersRef.current[ev.id] = m;
    });

    if (showRoute && filtered.length >= 2) {
      polylineRef.current = L.polyline(filtered.map((e) => [e.lat, e.lng]), {
        color: "#6F66B7", weight: 2.5, opacity: 0.6, dashArray: "6 8",
      }).addTo(map);
    }

    if (filtered.length === 1) {
      map.setView([filtered[0].lat, filtered[0].lng], 13);
    } else if (filtered.length > 1) {
      const bounds = L.latLngBounds(filtered.map((e) => [e.lat, e.lng]));
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: activeDay === "all" ? 9 : 13 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeDay, showRoute, events]);

  // Update marker styling + pan when the selection changes.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    Object.entries(markersRef.current).forEach(([id, m]: [string, any]) => {
      const ev = events.find((e) => e.id === id);
      if (!ev) return;
      const active = selectedId === id;
      m.setIcon(L.divIcon({ className: "", html: markerHtml(ev, active), iconSize: [32, 32], iconAnchor: [16, 32] }));
      m.setZIndexOffset(active ? 1000 : 0);
      if (active) map.panTo([ev.lat, ev.lng], { animate: true, duration: 0.5 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId]);

  return <div id="leaflet-map" ref={elRef} />;
}
