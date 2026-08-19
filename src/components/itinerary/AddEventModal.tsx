"use client";

import { useState, useTransition } from "react";
import { createEvent, updateEvent, deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import { Modal } from "@/components/shared/Modal";
import { toast } from "@/components/shared/Toast";
import { Icons, EVENT_TYPES } from "@/components/shared/Icons";
import { LocationAutocomplete } from "./LocationAutocomplete";
import type { TripEvent, EventType } from "@/types";

interface AddEventModalProps {
  open: boolean;
  tripId: string;
  dayId: string;
  dayLabel: string;
  existing?: TripEvent;
  onClose: () => void;
  onSuccess?: () => void;
  /** Trip destination — biases location search toward it (ODY-091). */
  destination?: string;
}

export function AddEventModal({ open, tripId, dayId, dayLabel, existing, onClose, onSuccess, destination }: AddEventModalProps) {
  const isEdit = !!existing;
  const [isPending, startTransition] = useTransition();
  const [titleError, setTitleError] = useState(false);

  const initialForm = () => ({
    type: (existing?.type ?? "activity") as EventType,
    title: existing?.title ?? "",
    location: existing?.location ?? "",
    startTime: existing?.startTime ?? "",
    endTime: existing?.endTime ?? "",
    cost: existing?.cost != null ? String(existing.cost) : "",
    notes: existing?.notes ?? "",
    lat: (existing?.lat ?? undefined) as number | undefined,
    lng: (existing?.lng ?? undefined) as number | undefined,
    destLocation: existing?.destLocation ?? "",
    destLat: (existing?.destLat ?? undefined) as number | undefined,
    destLng: (existing?.destLng ?? undefined) as number | undefined,
    confirmationCode: existing?.confirmationCode ?? "",
    bookingUrl: existing?.bookingUrl ?? "",
    checkIn: existing?.checkIn ?? "",
  });
  const [form, setForm] = useState(initialForm);
  // Booking details are collapsed by default, but opened when the event
  // already has any (ODY-086).
  const hasBooking = Boolean(existing?.confirmationCode || existing?.bookingUrl || existing?.checkIn);
  const [bookingOpen, setBookingOpen] = useState(hasBooking);

  // Re-seed the form each time the modal opens ("adjust state during render"
  // — the React-sanctioned replacement for a reset-on-open effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(initialForm());
      setTitleError(false);
      setBookingOpen(hasBooking);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  const isFlight = form.type === "flight";
  // Flights and transport (Uber/Lyft, trains…) are point-to-point and get a
  // second "To" endpoint; everything else has a single location.
  const hasRoute = form.type === "flight" || form.type === "transport";

  function handleSave() {
    if (!form.title.trim()) {
      setTitleError(true);
      toast("Give this event a title first.");
      return;
    }
    // Add a scheme to a bare URL so "acme.com/booking" saves as a valid link.
    const bookingUrl = form.bookingUrl.trim();
    const normalizedUrl = bookingUrl && !/^https?:\/\//i.test(bookingUrl) ? `https://${bookingUrl}` : bookingUrl;

    startTransition(async () => {
      const payload = {
        type: form.type,
        title: form.title,
        location: form.location || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        notes: form.notes || undefined,
        lat: form.lat,
        lng: form.lng,
        // Arrival endpoint applies to route-type events. Send "" otherwise so
        // switching away from flight/transport clears any stale destination.
        destLocation: hasRoute ? form.destLocation || "" : "",
        destLat: hasRoute ? form.destLat : undefined,
        destLng: hasRoute ? form.destLng : undefined,
        // Booking details (ODY-086) — sent as raw strings so an emptied field
        // clears on edit ("" → null in the action).
        confirmationCode: form.confirmationCode,
        bookingUrl: normalizedUrl,
        checkIn: form.checkIn,
      };
      try {
        if (isEdit && existing) {
          await updateEvent(existing.id, payload);
        } else {
          await createEvent({ tripId, dayId, ...payload } as Parameters<typeof createEvent>[0]);
        }
        onSuccess?.();
        onClose();
      } catch {
        toast(isEdit ? "Couldn't save those changes — try again." : "Couldn't add this event — try again.");
      }
    });
  }

  function handleDelete() {
    if (!existing) return;
    startTransition(async () => {
      try {
        await deleteEvent(existing.id);
        onSuccess?.();
        onClose();
      } catch {
        toast(`Couldn't delete "${existing.title}" — try again.`);
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={isEdit ? "Edit event" : "Add event"}>
      <div className="modal-head">
        <div className="left">
          <h3>{isEdit ? "Edit event" : "Add an event"}</h3>
          <p>{dayLabel}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icons.close size={16} />
        </button>
      </div>

      <div className="modal-body">
        <div className="field">
          <label>Type</label>
          <div className="type-grid">
            {EVENT_TYPES.map((tp) => {
              const Icon = Icons[tp];
              return (
                <button
                  key={tp}
                  type="button"
                  className={`type-chip t-${tp} ${form.type === tp ? "selected" : ""}`}
                  onClick={() => set("type", tp)}
                >
                  <Icon size={18} />
                  {tp}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label htmlFor="ev-title">Title</label>
          <input
            id="ev-title"
            className={`input${titleError ? " invalid" : ""}`}
            value={form.title}
            onChange={(e) => {
              set("title", e.target.value);
              if (titleError) setTitleError(false);
            }}
            placeholder="Flight to Tokyo"
            autoFocus
            aria-invalid={titleError}
            aria-describedby={titleError ? "ev-title-error" : undefined}
          />
          {titleError && (
            <p id="ev-title-error" className="form-error">
              Give this event a title first.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="ev-loc">
            {isFlight ? "From (departure)" : hasRoute ? "From (pickup)" : "Location"}
          </label>
          <LocationAutocomplete
            id="ev-loc"
            value={form.location}
            placeholder={isFlight ? "John F. Kennedy International Airport" : hasRoute ? "Hotel lobby" : "Narita International Airport"}
            near={destination}
            onChange={(text) => setForm((s) => ({ ...s, location: text }))}
            onPick={(s) => setForm((f) => ({ ...f, location: s.display, lat: s.lat, lng: s.lng }))}
          />
        </div>

        {hasRoute && (
          <div className="field">
            <label htmlFor="ev-dest">{isFlight ? "To (arrival)" : "To (drop-off)"}</label>
            <LocationAutocomplete
              id="ev-dest"
              value={form.destLocation}
              placeholder={isFlight ? "Narita International Airport" : "Leave blank to use the next stop"}
              near={destination}
              onChange={(text) => setForm((s) => ({ ...s, destLocation: text }))}
              onPick={(s) => setForm((f) => ({ ...f, destLocation: s.display, destLat: s.lat, destLng: s.lng }))}
            />
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label htmlFor="ev-start">Starts</label>
            <input id="ev-start" type="time" className="input mono" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev-end">Ends</label>
            <input id="ev-end" type="time" className="input mono" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ev-cost">Cost</label>
          <div className="input-with-prefix">
            <span className="prefix">$</span>
            <input
              id="ev-cost"
              className="input mono"
              inputMode="decimal"
              value={form.cost}
              onChange={(e) => set("cost", e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ev-note">Note</label>
          <textarea
            id="ev-note"
            className="input"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="What to bring, reminders… Start lines with - for bullets."
          />
        </div>

        {/* Booking details (ODY-086) — collapsed by default so the common case
            stays uncluttered; opens automatically when the event already has any. */}
        <div className="field">
          <button
            type="button"
            className="ev-booking-toggle"
            onClick={() => setBookingOpen((o) => !o)}
            aria-expanded={bookingOpen}
            aria-controls="ev-booking-fields"
          >
            <Icons.chevron size={14} /> Booking details
          </button>
          {bookingOpen && (
            <div id="ev-booking-fields" className="ev-booking-fields">
              <div className="field">
                <label htmlFor="ev-conf">Confirmation #</label>
                <input
                  id="ev-conf"
                  className="input mono"
                  value={form.confirmationCode}
                  onChange={(e) => set("confirmationCode", e.target.value)}
                  placeholder="ABC123"
                />
              </div>
              <div className="field">
                <label htmlFor="ev-url">Reservation link</label>
                <input
                  id="ev-url"
                  className="input"
                  type="url"
                  inputMode="url"
                  value={form.bookingUrl}
                  onChange={(e) => set("bookingUrl", e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="field">
                <label htmlFor="ev-checkin">
                  {form.type === "hotel" ? "Check-in" : "Check-in / boarding"}
                </label>
                <input
                  id="ev-checkin"
                  className="input"
                  value={form.checkIn}
                  onChange={(e) => set("checkIn", e.target.value)}
                  placeholder={form.type === "hotel" ? "After 3:00 PM" : "Boards 45 min before"}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="modal-foot">
        {isEdit && (
          <button className="btn btn-danger mr-auto" onClick={handleDelete} disabled={isPending}>
            <Icons.trash size={14} /> Delete
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose} disabled={isPending}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add to itinerary"}
        </button>
      </div>
    </Modal>
  );
}
