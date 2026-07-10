"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMapInstance, Marker, Polyline, Layer } from "leaflet";
import { TYPE_HEX, type MapEvent } from "./mapTypes";

type LeafletNS = typeof import("leaflet");

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

/** Smaller ringed marker for a route's arrival endpoint (no number). */
function destMarkerHtml(ev: MapEvent, active: boolean): string {
  const color = TYPE_HEX[ev.type] ?? TYPE_HEX.misc;
  return `<div class="od-marker dest ${active ? "active" : ""}" style="border-color:${color};color:${color}"><span>↓</span></div>`;
}

/** True when the event has an explicit arrival pin to render. */
function hasDest(ev: MapEvent): boolean {
  return ev.destLat != null && ev.destLng != null;
}

export function LeafletMap({ events, activeDay, selectedId, showRoute, onSelect }: LeafletMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const destMarkersRef = useRef<Record<string, Marker>>({});
  const polylineRef = useRef<Polyline | null>(null);
  const flightLayersRef = useRef<Layer[]>([]);
  const [ready, setReady] = useState(false);

  // Keep latest onSelect without re-running the init effect.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // The marker-render effect reads the selection for initial styling but must
  // not redraw every marker on each selection change (the lighter effect below
  // handles that) — so it reads through a ref instead of depending on it.
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    const el = elRef.current;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod.default ?? mod) as LeafletNS;
      if (cancelled || !el) return;
      // Leaflet tags containers it has claimed; clear a stale tag from HMR.
      const claimed = el as HTMLDivElement & { _leaflet_id?: number };
      if (claimed._leaflet_id) delete claimed._leaflet_id;

      const map = L.map(el, { zoomControl: false, attributionControl: false }).setView([35.6, 139.5], 5);
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
      if (el) delete (el as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
    };
  }, []);

  // Render markers + polyline + fit bounds when the data or filters change.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};
    if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null; }
    flightLayersRef.current.forEach((l) => map.removeLayer(l));
    flightLayersRef.current = [];
    destMarkersRef.current = {};

    const filtered = events.filter((e) => activeDay === "all" || e.dayId === activeDay);

    filtered.forEach((ev) => {
      const active = selectedIdRef.current === ev.id;
      const icon = L.divIcon({ className: "", html: markerHtml(ev, active), iconSize: [32, 32], iconAnchor: [16, 32] });
      const m = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: active ? 1000 : 0 });
      m.bindTooltip(`${ev.globalIdx}. ${ev.title}`, { className: "od-tip", direction: "top", offset: [0, -28] });
      m.on("click", () => onSelectRef.current(ev.id));
      m.addTo(map);
      markersRef.current[ev.id] = m;

      // Point-to-point events (flight/transport): draw the path line, plus an
      // arrival pin when the destination is explicit. Inferred transport lines
      // are fainter and have no second pin.
      if (ev.routePath) {
        const color = TYPE_HEX[ev.type] ?? TYPE_HEX.misc;
        const path = L.polyline(ev.routePath, ev.routeInferred
          ? { color, weight: 2, opacity: 0.4, dashArray: "1 9" }
          : { color, weight: 2.5, opacity: 0.75, dashArray: "2 7" }
        ).addTo(map);
        flightLayersRef.current.push(path);
      }

      if (hasDest(ev)) {
        const active2 = selectedIdRef.current === ev.id;
        const destIcon = L.divIcon({ className: "", html: destMarkerHtml(ev, active2), iconSize: [28, 28], iconAnchor: [14, 28] });
        const dm = L.marker([ev.destLat as number, ev.destLng as number], { icon: destIcon, zIndexOffset: active2 ? 1000 : 0 });
        dm.bindTooltip(`${ev.globalIdx}. ${ev.title} — arrival${ev.destLocation ? `: ${ev.destLocation}` : ""}`, { className: "od-tip", direction: "top", offset: [0, -24] });
        dm.on("click", () => onSelectRef.current(ev.id));
        dm.addTo(map);
        flightLayersRef.current.push(dm);
        destMarkersRef.current[ev.id] = dm;
      }
    });

    if (showRoute && filtered.length >= 2) {
      polylineRef.current = L.polyline(filtered.map((e) => [e.lat, e.lng]), {
        color: "#6F66B7", weight: 2.5, opacity: 0.6, dashArray: "6 8",
      }).addTo(map);
    }

    // Bounds include flight arrival endpoints so both ends stay in view.
    const points: [number, number][] = [];
    filtered.forEach((e) => {
      points.push([e.lat, e.lng]);
      if (hasDest(e)) points.push([e.destLat as number, e.destLng as number]);
    });

    if (points.length === 1) {
      map.setView(points[0], 13);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: activeDay === "all" ? 9 : 13 });
    }
  }, [ready, activeDay, showRoute, events]);

  // Update marker styling + pan when the selection changes.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const ev = events.find((e) => e.id === id);
      if (!ev) return;
      const active = selectedId === id;
      m.setIcon(L.divIcon({ className: "", html: markerHtml(ev, active), iconSize: [32, 32], iconAnchor: [16, 32] }));
      m.setZIndexOffset(active ? 1000 : 0);
      if (active) map.panTo([ev.lat, ev.lng], { animate: true, duration: 0.5 });
    });

    // Mirror active styling onto flight arrival markers.
    Object.entries(destMarkersRef.current).forEach(([id, m]) => {
      const ev = events.find((e) => e.id === id);
      if (!ev) return;
      const active = selectedId === id;
      m.setIcon(L.divIcon({ className: "", html: destMarkerHtml(ev, active), iconSize: [28, 28], iconAnchor: [14, 28] }));
      m.setZIndexOffset(active ? 1000 : 0);
    });
  }, [ready, selectedId, events]);

  return <div id="leaflet-map" ref={elRef} />;
}
