"use client";

import { useState, useRef, useTransition } from "react";
import { updateDayNotes } from "@/app/trips/[tripId]/itinerary/actions";
import { Icons } from "@/components/shared/Icons";

interface DayNotesProps {
  dayId: string;
  tripId: string;
  initialNotes: string | null;
}

/**
 * Slim per-day note (`.day-notes`), autosaving on blur. Matches the design's
 * day-level note panel.
 */
export function DayNotes({ dayId, tripId, initialNotes }: DayNotesProps) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initialNotes ?? "");

  function save(next: string) {
    if (next === lastSaved.current) return;
    lastSaved.current = next;
    startTransition(async () => {
      await updateDayNotes(dayId, tripId, next);
    });
  }

  return (
    <div className="day-notes">
      <span className="icon"><Icons.note size={13} /></span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save(value)}
        placeholder="A note for this day…"
        rows={1}
      />
      {value && (
        <button
          className="icon-btn"
          aria-label="Clear day note"
          title="Clear"
          onClick={() => { setValue(""); save(""); }}
          style={{ width: 22, height: 22 }}
        >
          <Icons.close size={12} />
        </button>
      )}
    </div>
  );
}
