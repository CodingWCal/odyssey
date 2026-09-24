"use client";

import { useState, useTransition } from "react";
import { createEvent, updateEvent, deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import { Modal } from "@/components/shared/Modal";
import { toast } from "@/components/shared/Toast";
import { Icons, EVENT_TYPES, TYPE_LABEL } from "@/components/shared/Icons";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { FlightLegsFields, emptyLeg, type LegFormState } from "./FlightLegsFields";
import { categorizeEvent } from "@/lib/categorizeEvent";
import { toDateInputValue, shiftDateKeyBy } from "@/lib/dates";
import type { DayOption, TripEvent, EventType, FlightLeg } from "@/types";

interface AddEventModalProps {
  open: boolean;
  tripId: string;
  dayId: string;
  dayLabel: string;
  /** The day this event belongs to (its check-in day for lodging) — sets
   * the minimum selectable checkout date for multi-night lodging. */
  dayDate: Date | string;
  existing?: TripEvent;
  onClose: () => void;
  onSuccess?: () => void;
  /** Trip destination — biases location search toward it (ODY-091). */
  destination?: string;
  /** The trip's days — when editing, a Day picker moves the event to
   * another one (ODY-147). */
  days?: DayOption[];
}

function legToFormState(l: FlightLeg): LegFormState {
  return {
    flightNumber: l.flightNumber ?? "",
    from: l.from,
    fromLat: l.fromLat ?? undefined,
    fromLng: l.fromLng ?? undefined,
    to: l.to,
    toLat: l.toLat ?? undefined,
    toLng: l.toLng ?? undefined,
    departTime: l.departTime,
    arriveTime: l.arriveTime,
    operatedBy: l.operatedBy ?? "",
  };
}

/**
 * Seeds the leg-repeater form (ODY-144). A flight that already has
 * structured legs uses them as-is. An older flight (or one edited before
 * this feature existed) has no `legs` yet — upgrade it into a single leg 1
 * from its existing flat location/destLocation/startTime/endTime so editing
 * it moves to the new form without losing data; nothing is written until
 * Save. Any non-flight type, or a brand-new flight, just starts with one
 * blank leg.
 */
function initialLegs(existing?: TripEvent): LegFormState[] {
  if (existing?.type !== "flight") return [emptyLeg()];
  if (existing.legs && existing.legs.length > 0) return existing.legs.map(legToFormState);
  if (existing.location || existing.destLocation || existing.startTime || existing.endTime) {
    return [
      {
        flightNumber: "",
        from: existing.location ?? "",
        fromLat: existing.lat ?? undefined,
        fromLng: existing.lng ?? undefined,
        to: existing.destLocation ?? "",
        toLat: existing.destLat ?? undefined,
        toLng: existing.destLng ?? undefined,
        departTime: existing.startTime ?? "",
        arriveTime: existing.endTime ?? "",
        operatedBy: "",
      },
    ];
  }
  return [emptyLeg()];
}

export function AddEventModal({ open, tripId, dayId, dayLabel, dayDate, existing, onClose, onSuccess, destination, days = [] }: AddEventModalProps) {
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
    checkOutDate: existing?.checkOutDate ? toDateInputValue(existing.checkOutDate) : "",
    dayId: existing?.dayId ?? dayId,
    legs: initialLegs(existing),
  });
  const [form, setForm] = useState(initialForm);
  // Booking details are collapsed by default, but opened when the event
  // already has any (ODY-086).
  const hasBooking = Boolean(existing?.confirmationCode || existing?.bookingUrl || existing?.checkIn);
  const [bookingOpen, setBookingOpen] = useState(hasBooking);
  // ODY-127: auto-categorize from the title, but only for a brand-new event
  // and only until the user manually picks a type chip this session — never
  // fight an explicit choice or silently recategorize an existing event.
  const [typeTouched, setTypeTouched] = useState(isEdit);

  // Re-seed the form each time the modal opens ("adjust state during render"
  // — the React-sanctioned replacement for a reset-on-open effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(initialForm());
      setTitleError(false);
      setBookingOpen(hasBooking);
      setTypeTouched(isEdit);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  const isFlight = form.type === "flight";
  const isHotel = form.type === "hotel";
  // Flights and transport (Uber/Lyft, trains…) are point-to-point and get a
  // second "To" endpoint; everything else has a single location.
  const hasRoute = form.type === "flight" || form.type === "transport";

  // Move to another day (ODY-147) — editing only; a new event goes on the day
  // whose "Add event" was clicked.
  const canMoveDay = isEdit && days.length > 1;
  const selectedDay = days.find((d) => d.id === form.dayId);

  function changeDay(nextDayId: string) {
    setForm((s) => {
      const from = days.find((d) => d.id === s.dayId);
      const to = days.find((d) => d.id === nextDayId);
      // Moving a stay moves its checkout with it — same number of nights.
      const checkOutDate =
        s.type === "hotel" && s.checkOutDate && from && to
          ? shiftDateKeyBy(s.checkOutDate, from.date, to.date)
          : s.checkOutDate;
      return { ...s, dayId: nextDayId, checkOutDate };
    });
  }

  function handleSave() {
    if (!form.title.trim()) {
      setTitleError(true);
      toast("Give this event a title first.");
      return;
    }
    if (isFlight && form.legs.some((l) => !l.from.trim() || !l.to.trim() || !l.departTime || !l.arriveTime)) {
      toast("Fill in every leg's route and times.");
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
        // Multi-leg flights (ODY-144) — flight-only. An empty array clears
        // any previously-saved legs (e.g. switching away from flight); the
        // server derives location/startTime/etc. from these when non-empty.
        legs: isFlight
          ? form.legs.map((l) => ({
              flightNumber: l.flightNumber || null,
              from: l.from,
              fromLat: l.fromLat ?? null,
              fromLng: l.fromLng ?? null,
              to: l.to,
              toLat: l.toLat ?? null,
              toLng: l.toLng ?? null,
              departTime: l.departTime,
              arriveTime: l.arriveTime,
              operatedBy: l.operatedBy || null,
            }))
          : [],
        // Multi-night lodging checkout date is hotel-only. Send "" otherwise
        // so switching away from hotel clears any stale checkout date.
        checkOutDate: isHotel ? form.checkOutDate : "",
        // Move to another day (ODY-147) — the server verifies it's this trip's.
        ...(isEdit ? { dayId: form.dayId } : {}),
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
                  onClick={() => { set("type", tp); setTypeTouched(true); }}
                >
                  <Icon size={18} />
                  {TYPE_LABEL[tp]}
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
              const value = e.target.value;
              if (!isEdit && !typeTouched) {
                const guess = categorizeEvent(value);
                if (guess) {
                  setForm((s) => ({ ...s, title: value, type: guess }));
                  if (titleError) setTitleError(false);
                  return;
                }
              }
              set("title", value);
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

        {canMoveDay && (
          <div className="field">
            <label htmlFor="ev-day">{isHotel ? "Check-in day" : "Day"}</label>
            <select id="ev-day" className="input" value={form.dayId} onChange={(e) => changeDay(e.target.value)}>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  Day {String(d.dayNumber).padStart(2, "0")} · {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {isFlight ? (
          <FlightLegsFields
            legs={form.legs}
            destination={destination}
            onChange={(legs) => set("legs", legs)}
          />
        ) : (
          <>
            <div className="field">
              <label htmlFor="ev-loc">{hasRoute ? "From (pickup)" : "Location"}</label>
              <LocationAutocomplete
                id="ev-loc"
                value={form.location}
                placeholder={hasRoute ? "Hotel lobby" : "Narita International Airport"}
                near={destination}
                onChange={(text) => setForm((s) => ({ ...s, location: text }))}
                onPick={(s) => setForm((f) => ({ ...f, location: s.display, lat: s.lat, lng: s.lng }))}
              />
            </div>

            {hasRoute && (
              <div className="field">
                <label htmlFor="ev-dest">To (drop-off)</label>
                <LocationAutocomplete
                  id="ev-dest"
                  value={form.destLocation}
                  placeholder="Leave blank to use the next stop"
                  near={destination}
                  onChange={(text) => setForm((s) => ({ ...s, destLocation: text }))}
                  onPick={(s) => setForm((f) => ({ ...f, destLocation: s.display, destLat: s.lat, destLng: s.lng }))}
                />
              </div>
            )}
          </>
        )}

        {isHotel && (
          <div className="field">
            <label htmlFor="ev-checkout-date">Check-out date (optional)</label>
            <input
              id="ev-checkout-date"
              type="date"
              className="input mono"
              value={form.checkOutDate}
              min={selectedDay?.date ?? toDateInputValue(dayDate)}
              onChange={(e) => set("checkOutDate", e.target.value)}
            />
            <p className="field-hint">
              Leave blank for a same-day stay. Set a later date and this shows as an all-day stay across those nights.
            </p>
          </div>
        )}

        {!isFlight && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="ev-start">{isHotel ? "Check-in time" : "Starts"}</label>
              <input id="ev-start" type="time" className="input mono" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ev-end">{isHotel ? "Check-out time" : "Ends"}</label>
              <input id="ev-end" type="time" className="input mono" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </div>
          </div>
        )}

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
                {/* "Check-in" (hotel) would collide with the primary Check-in
                    time field above (ODY-lodging) — this one's a policy note
                    ("After 3:00 PM"), not a time, so it gets its own label. */}
                <label htmlFor="ev-checkin">
                  {form.type === "hotel" ? "Check-in note" : "Check-in / boarding"}
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
