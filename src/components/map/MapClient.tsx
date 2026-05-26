"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { TripEvent } from "@/types";
import { formatCurrency } from "@/lib/utils";

const LeafletMap = dynamic(
  () => import("./LeafletMap").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: "100%", width: "100%",
          background: "var(--paper-3)", animation: "pulse 2s infinite",
        }}
      />
    ),
  }
);

const TYPE_COLOR: Record<string, string> = {
  flight:     "var(--coral)",
  hotel:      "var(--gold)",
  restaurant: "var(--peach)",
  activity:   "var(--teal)",
  transport:  "var(--peri)",
  misc:       "var(--slate)",
};

interface MapClientProps {
  events: TripEvent[];
}

export function MapClient({ events }: MapClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null);

  return (
    <div style={{ height: "100%", position: "relative" }}>
      <LeafletMap events={events} onPinClick={(id) => setSelectedEvent(events.find((e) => e.id === id) ?? null)} />

      {/* Floating event card */}
      {selectedEvent && (
        <div className="map-card" style={{
          position: "absolute", left: 24, bottom: 24, width: 320,
          background: "var(--paper-2)", border: "1px solid var(--rule)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 60px -20px rgba(31,34,56,.35), 0 4px 12px rgba(31,34,56,.1)",
          padding: "20px 22px", zIndex: 999,
          animation: "od-modal-in .25s cubic-bezier(.16,1,.3,1)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, margin: 0, lineHeight: 1.15, color: "var(--ink)" }}>
              {selectedEvent.title}
            </h3>
            <button
              className="icon-btn"
              onClick={() => setSelectedEvent(null)}
              aria-label="Close"
              style={{ flexShrink: 0, marginTop: 2 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <span
            className={`od-badge t-${selectedEvent.type}`}
            style={{ "--type-color": TYPE_COLOR[selectedEvent.type] ?? "var(--slate)" } as React.CSSProperties}
          >
            {selectedEvent.type}
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, fontSize: 12.5, color: "var(--ink-2)" }}>
            {selectedEvent.location && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {selectedEvent.location}
              </div>
            )}
            {selectedEvent.startTime && (
              <div style={{ fontFamily: "var(--font-mono)" }}>
                {selectedEvent.startTime}{selectedEvent.endTime ? ` → ${selectedEvent.endTime}` : ""}
              </div>
            )}
            {selectedEvent.cost != null && (
              <div style={{ color: "var(--teal)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {formatCurrency(selectedEvent.cost)}
              </div>
            )}
          </div>

          {selectedEvent.notes && (
            <p style={{
              marginTop: 10, paddingTop: 10,
              borderTop: "1px dashed var(--rule-2)",
              fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5,
              fontStyle: "italic", margin: "10px 0 0",
            }}>
              {selectedEvent.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
