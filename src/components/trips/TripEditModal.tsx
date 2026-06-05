"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/shared/Modal";
import { Icons } from "@/components/shared/Icons";
import { updateTrip } from "@/app/trips/actions";

interface TripEditModalProps {
  open: boolean;
  tripId: string;
  initialTitle: string;
  initialDestination: string;
  onClose: () => void;
}

// Inner form is mounted only while the modal is open, so its initial state is
// always seeded fresh from the current trip values (no reset effect needed).
function TripEditForm({ tripId, initialTitle, initialDestination, onClose }: Omit<TripEditModalProps, "open">) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [destination, setDestination] = useState(initialDestination);

  function handleSave() {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    // Only send destination when non-empty — updateTripSchema requires a
    // non-blank value, and an empty field should leave it unchanged.
    if (destination.trim()) fd.set("destination", destination.trim());
    startTransition(async () => {
      await updateTrip(tripId, fd);
      onClose();
    });
  }

  return (
    <>
      <div className="modal-head">
        <div className="left">
          <h3>Edit trip</h3>
          <p>Update the name or destination</p>
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

export function TripEditModal({ open, tripId, initialTitle, initialDestination, onClose }: TripEditModalProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Edit trip">
      <TripEditForm
        tripId={tripId}
        initialTitle={initialTitle}
        initialDestination={initialDestination}
        onClose={onClose}
      />
    </Modal>
  );
}
