"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { Icons } from "@/components/shared/Icons";
import { TYPE_HEX, type MapDay, type MapEvent } from "./mapTypes";

const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, background: "var(--paper-3)" }} />,
});

interface MapClientProps {
  days: MapDay[];
  events: MapEvent[];
  eyebrow: string;
  dayCount: number;
}

export function MapClient({ days, events, eyebrow, dayCount }: MapClientProps) {
  const [activeDay, setActiveDay] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(true);

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const visibleDays = days.filter((d) => activeDay === "all" || d.id === activeDay);

  if (events.length === 0) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--paper-3)", textAlign: "center", padding: 32 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🗺️</p>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: "0 0 8px", color: "var(--ink)" }}>
          No pins <em style={{ fontStyle: "italic", color: "var(--peri)" }}>yet</em>
        </h3>
        <p style={{ color: "var(--ink-2)", fontSize: 14, maxWidth: 360, margin: 0 }}>
          Add a location to events in the itinerary — they&apos;ll appear here on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="map-layout">
      <aside className="map-panel">
        <div className="map-panel-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2>The <em>route</em></h2>
          <div className="sub">{events.length} pins across {dayCount} days</div>
        </div>

        <div className="filter-chips">
          <button className={`chip ${activeDay === "all" ? "active" : ""}`} onClick={() => { setActiveDay("all"); setSelectedId(null); }}>
            All
          </button>
          {days.map((d) => (
            <button key={d.id} className={`chip ${activeDay === d.id ? "active" : ""}`} onClick={() => { setActiveDay(d.id); setSelectedId(null); }}>
              {d.label}
            </button>
          ))}
        </div>

        <div className="map-pin-list">
          {visibleDays.map((d) => (
            <div className="map-day" key={d.id}>
              <div className="day-label">{d.label} · {d.dateShort}</div>
              {d.events.map((ev) => (
                <div
                  key={ev.id}
                  className={`map-pin ${selectedId === ev.id ? "active" : ""}`}
                  onClick={() => setSelectedId(ev.id)}
                >
                  <span className="num" style={{ "--pin-color": TYPE_HEX[ev.type] } as React.CSSProperties}>
                    {ev.globalIdx}
                  </span>
                  <div className="body">
                    <div className="title">{ev.title}</div>
                    <div className="meta">
                      {ev.startTime && <span>{ev.startTime}</span>}
                      {ev.location && <span>{ev.startTime ? " · " : ""}{ev.location}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="map-canvas">
        <LeafletMap
          events={events}
          activeDay={activeDay}
          selectedId={selectedId}
          showRoute={showRoute}
          onSelect={setSelectedId}
        />

        {activeDay !== "all" && (
          <button className="map-overview-link" onClick={() => { setActiveDay("all"); setSelectedId(null); }}>
            ← Show whole trip
          </button>
        )}

        <div className="map-controls">
          <button className={`map-ctrl ${showRoute ? "active" : ""}`} onClick={() => setShowRoute((r) => !r)} title="Toggle route line">
            {showRoute ? "Route on" : "Route off"}
          </button>
        </div>

        {selected && (
          <div className="map-card">
            <div className="card-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 8 }}><TypeBadge type={selected.type} /></div>
                <h3>{selected.title}</h3>
              </div>
              <button className="icon-btn" onClick={() => setSelectedId(null)} aria-label="Close">
                <Icons.close size={16} />
              </button>
            </div>
            <div className="card-meta">
              {selected.location && (
                <span className="row">
                  <Icons.pin size={13} />{" "}
                  {(selected.type === "flight" || selected.type === "transport") && selected.destLocation
                    ? `${selected.location} → ${selected.destLocation}`
                    : selected.location}
                </span>
              )}
              {selected.startTime && (
                <span className="row mono">
                  <Icons.clock size={13} /> {selected.startTime}{selected.endTime ? ` → ${selected.endTime}` : ""}
                </span>
              )}
              <span className="row" style={{ color: "var(--peri)" }}>
                {selected.dayLabel} · {selected.dayDate}
              </span>
              {selected.cost != null && (
                <span className="row"><span className="cost">${Number(selected.cost).toLocaleString("en-US")}</span></span>
              )}
            </div>
            {selected.notes && <div className="note">&ldquo;{selected.notes}&rdquo;</div>}
          </div>
        )}
      </div>
    </div>
  );
}
