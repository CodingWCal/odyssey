"use client";

import { useState, useRef, useTransition } from "react";
import { updateDayNotes } from "@/app/trips/[tripId]/itinerary/actions";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";

interface DayNotesProps {
  dayId: string;
  tripId: string;
  initialNotes: string | null;
  /** Viewers can read but not edit day notes (ODY-001). */
  readOnly?: boolean;
}

/**
 * Slim per-day note (`.day-notes`), autosaving on blur. Matches the design's
 * day-level note panel.
 */
export function DayNotes({ dayId, tripId, initialNotes, readOnly = false }: DayNotesProps) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initialNotes ?? "");

  function save(next: string) {
    if (next === lastSaved.current) return;
    const previous = lastSaved.current;
    lastSaved.current = next;
    startTransition(async () => {
      try {
        await updateDayNotes(dayId, tripId, next);
      } catch {
        lastSaved.current = previous;
        toast("Day note didn't save — try again.");
      }
    });
  }

  return (
    <div className="day-notes">
      <span className="icon"><Icons.note size={13} /></span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save(value)}
        placeholder={readOnly ? "No note for this day." : "A note for this day…"}
        rows={1}
        readOnly={readOnly}
      />
      {value && !readOnly && (
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
