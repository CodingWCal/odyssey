"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { createEvent, updateEvent, deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import type { TripEvent, EventType } from "@/types";

const EVENT_TYPES: EventType[] = ["flight", "hotel", "restaurant", "activity", "transport", "misc"];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  flight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
    </svg>
  ),
  hotel: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 22V12M21 22V12M12 22V9M3 12V3h18v9M3 12h18M12 9H9a2 2 0 0 0-2 2v2h10v-2a2 2 0 0 0-2-2z"/>
    </svg>
  ),
  restaurant: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  transport: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 3v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  misc: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  ),
};

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

interface AddEventModalProps {
  open: boolean;
  tripId: string;
  dayId: string;
  dayLabel: string;
  existing?: TripEvent;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddEventModal({ open, tripId, dayId, dayLabel, existing, onClose, onSuccess }: AddEventModalProps) {
  const isEdit = !!existing;
  const [isPending, startTransition] = useTransition();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "found" | "not_found">("idle");

  const [form, setForm] = useState({
    type: (existing?.type ?? "activity") as EventType,
    title: existing?.title ?? "",
    location: existing?.location ?? "",
    startTime: existing?.startTime ?? "",
    endTime: existing?.endTime ?? "",
    cost: existing?.cost != null ? String(existing.cost) : "",
    notes: existing?.notes ?? "",
    lat: existing?.lat,
    lng: existing?.lng,
  });

  useEffect(() => {
    if (open) {
      setForm({
        type: (existing?.type ?? "activity") as EventType,
        title: existing?.title ?? "",
        location: existing?.location ?? "",
        startTime: existing?.startTime ?? "",
        endTime: existing?.endTime ?? "",
        cost: existing?.cost != null ? String(existing.cost) : "",
        notes: existing?.notes ?? "",
        lat: existing?.lat,
        lng: existing?.lng,
      });
      setGeocodeStatus(existing?.lat != null ? "found" : "idle");
    }
  }, [open, existing]);

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, handleKey]);

  if (!open) return null;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function handleGeocode() {
    if (!form.location.trim()) return;
    setIsGeocoding(true);
    setGeocodeStatus("idle");
    const result = await geocodeAddress(form.location);
    if (result) {
      set("lat", result.lat);
      set("lng", result.lng);
      setGeocodeStatus("found");
    } else {
      setGeocodeStatus("not_found");
    }
    setIsGeocoding(false);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    startTransition(async () => {
      const payload = {
        type: form.type,
        title: form.title,
        location: form.location || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        notes: form.notes || undefined,
        lat: form.lat ?? undefined,
        lng: form.lng ?? undefined,
      };
      if (isEdit && existing) {
        await updateEvent(existing.id, payload);
      } else {
        await createEvent({ tripId, dayId, ...payload } as any);
      }
      onSuccess?.();
      onClose();
    });
  }

  function handleDelete() {
    if (!existing) return;
    startTransition(async () => {
      await deleteEvent(existing.id);
      onSuccess?.();
      onClose();
    });
  }

  return (
    <div
      className="od-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="od-modal" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit event" : "Add event"}>
        {/* Header */}
        <div className="od-modal-head">
          <div>
            <h3>{isEdit ? "Edit event" : "Add an event"}</h3>
            <p>{dayLabel}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="od-modal-body">
          {/* Type picker */}
          <div className="od-field">
            <label>Type</label>
            <div className="od-type-grid">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`od-type-chip t-${t}${form.type === t ? " selected" : ""}`}
                  onClick={() => set("type", t)}
                >
                  {TYPE_ICONS[t]}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="od-field">
            <label htmlFor="ev-title">Title</label>
            <input
              id="ev-title"
              className="od-input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Flight to Tokyo"
              autoFocus
            />
          </div>

          {/* Location + geocode */}
          <div className="od-field">
            <label htmlFor="ev-loc">Address / Location</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="ev-loc"
                className="od-input"
                style={{ flex: 1 }}
                value={form.location}
                onChange={(e) => { set("location", e.target.value); setGeocodeStatus("idle"); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGeocode(); } }}
                placeholder="Narita International Airport"
              />
              <button
                type="button"
                className="od-btn od-btn-ghost"
                style={{ padding: "0 12px", fontSize: 13, gap: 4 }}
                onClick={handleGeocode}
                disabled={isGeocoding || !form.location.trim()}
                title="Pin location on map"
              >
                {isGeocoding ? "…" : "📍 Pin"}
              </button>
            </div>
            {geocodeStatus === "found" && (
              <p style={{ fontSize: 12, color: "var(--teal)", margin: 0 }}>✓ Location pinned on map</p>
            )}
            {geocodeStatus === "not_found" && (
              <p style={{ fontSize: 12, color: "var(--coral)", margin: 0 }}>Couldn&apos;t find that address — try being more specific</p>
            )}
          </div>

          {/* Times */}
          <div className="od-field-row">
            <div className="od-field">
              <label htmlFor="ev-start">Starts</label>
              <input
                id="ev-start"
                type="time"
                className="od-input mono"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </div>
            <div className="od-field">
              <label htmlFor="ev-end">Ends</label>
              <input
                id="ev-end"
                type="time"
                className="od-input mono"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>

          {/* Cost */}
          <div className="od-field">
            <label htmlFor="ev-cost">Cost</label>
            <div className="od-input-prefix">
              <span className="pfx">$</span>
              <input
                id="ev-cost"
                className="od-input mono"
                style={{ paddingLeft: 28 }}
                inputMode="decimal"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="od-field">
            <label htmlFor="ev-note">Note</label>
            <textarea
              id="ev-note"
              className="od-input"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Confirmation #, what to bring, who's meeting where…"
              rows={3}
              style={{ height: "auto", minHeight: 72 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="od-modal-foot">
          {isEdit && (
            <button
              className="od-btn od-btn-danger"
              onClick={handleDelete}
              disabled={isPending}
              style={{ marginRight: "auto" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Delete
            </button>
          )}
          <button className="od-btn od-btn-ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            className="od-btn od-btn-primary"
            onClick={handleSave}
            disabled={!form.title.trim() || isPending}
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Add to itinerary"}
          </button>
        </div>
      </div>
    </div>
  );
}
