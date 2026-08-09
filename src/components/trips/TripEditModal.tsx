"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/shared/Modal";
import { Icons } from "@/components/shared/Icons";
import { updateTrip } from "@/app/trips/actions";
import { COVER_GRADIENTS } from "@/components/trips/cover";
import { TRIP_CURRENCIES } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { toast } from "@/components/shared/Toast";

interface TripEditModalProps {
  open: boolean;
  tripId: string;
  initialTitle: string;
  initialDestination: string;
  initialStartDate?: Date;
  initialEndDate?: Date;
  /** Trip-level 12h/24h time display preference (ODY-041). */
  initialTimeFormat?: "12h" | "24h";
  /** Cover mood index (ODY-047). */
  initialCoverIndex?: number;
  /** Trip base currency, ISO 4217 (ODY-024). */
  initialCurrency?: string;
  onClose: () => void;
}

// Inner form is mounted only while the modal is open, so its initial state is
// always seeded fresh from the current trip values (no reset effect needed).
function TripEditForm({
  tripId,
  initialTitle,
  initialDestination,
  initialStartDate,
  initialEndDate,
  initialTimeFormat = "12h",
  initialCoverIndex = 0,
  initialCurrency = "USD",
  onClose,
}: Omit<TripEditModalProps, "open">) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [destination, setDestination] = useState(initialDestination);
  const [startDate, setStartDate] = useState(initialStartDate ? toDateInputValue(initialStartDate) : "");
  const [endDate, setEndDate] = useState(initialEndDate ? toDateInputValue(initialEndDate) : "");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">(initialTimeFormat);
  const [coverIndex, setCoverIndex] = useState(initialCoverIndex);
  const [currency, setCurrency] = useState(initialCurrency);

  function handleSave() {
    if (!title.trim()) return;
    if (startDate && endDate && startDate > endDate) {
      toast("Start date must be before end date.");
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    if (destination.trim()) fd.set("destination", destination.trim());
    if (startDate) fd.set("startDate", startDate);
    if (endDate) fd.set("endDate", endDate);
    fd.set("timeFormat", timeFormat);
    fd.set("coverIndex", String(coverIndex));
    fd.set("currency", currency);
    startTransition(async () => {
      try {
        await updateTrip(tripId, fd);
        onClose();
      } catch {
        toast("Couldn't save trip details — try again.");
      }
    });
  }

  return (
    <>
      <div className="modal-head">
        <div className="left">
          <h3>Edit trip</h3>
          <p>Update trip details and dates</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icons.close size={16} />
        </button>
      </div>

      <div className="modal-body">
        <div className="field">
          <label htmlFor="trip-title">Trip name</label>
          <input
            id="trip-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summer in Japan"
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="trip-dest">Destination</label>
          <input
            id="trip-dest"
            className="input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Tokyo, Japan"
          />
        </div>

        <div className="field">
          <label htmlFor="trip-start-date">Start date</label>
          <input
            id="trip-start-date"
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="trip-end-date">End date</label>
          <input
            id="trip-end-date"
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Time display</label>
          <div className="opt-chips">
            <button
              type="button"
              className={`rounded-xl opt-chip ${timeFormat === "12h" ? "on" : ""}`}
              aria-pressed={timeFormat === "12h"}
              onClick={() => setTimeFormat("12h")}
            >
              2:30 PM
            </button>
            <button
              type="button"
              className={`rounded-xl opt-chip ${timeFormat === "24h" ? "on" : ""}`}
              aria-pressed={timeFormat === "24h"}
              onClick={() => setTimeFormat("24h")}
            >
              14:30
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="trip-currency">Currency</label>
          <select
            id="trip-currency"
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {TRIP_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Cover mood</label>
          <div className="wz-moods">
            {COVER_GRADIENTS.map((g, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Cover mood ${i + 1}`}
                aria-pressed={coverIndex === i}
                className={`wz-mood cover-art ${coverIndex === i ? "on" : ""}`}
                style={{ "--cover-img": g } as React.CSSProperties}
                onClick={() => setCoverIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose} disabled={isPending}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim() || isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}

export function TripEditModal({
  open,
  tripId,
  initialTitle,
  initialDestination,
  initialStartDate,
  initialEndDate,
  initialTimeFormat,
  initialCoverIndex,
  initialCurrency,
  onClose,
}: TripEditModalProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Edit trip">
      <TripEditForm
        tripId={tripId}
        initialTitle={initialTitle}
        initialDestination={initialDestination}
        initialStartDate={initialStartDate}
        initialEndDate={initialEndDate}
        initialTimeFormat={initialTimeFormat}
        initialCoverIndex={initialCoverIndex}
        initialCurrency={initialCurrency}
        onClose={onClose}
      />
    </Modal>
  );
}
