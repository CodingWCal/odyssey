"use client";

import { useState, useRef, useLayoutEffect, useTransition } from "react";
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
 * day-level note panel. Collapsed to a 2-line preview by default (ODY-142)
 * so a long note doesn't get lost in its own single-line scrollbar — a
 * "More details" control expands it to full height, focusing to edit does
 * the same so typing is never hidden below the fold.
 */
export function DayNotes({ dayId, tripId, initialNotes, readOnly = false }: DayNotesProps) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initialNotes ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Expanded: auto-grow to fit the full note. Collapsed: clear any grown
  // height so the native 2-row size takes over, then measure whether the
  // full text actually overflows that 2-line preview — the "More details"
  // control only shows when there's really more to see.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (expanded) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    } else {
      el.style.height = "";
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    }
  }, [value, expanded]);

  return (
    <div className="day-notes">
      <span className="icon"><Icons.note size={13} /></span>
      <div className="day-notes-content">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setExpanded(true)}
          onBlur={() => save(value)}
          placeholder={readOnly ? "No note for this day." : "A note for this day…"}
          rows={2}
          readOnly={readOnly}
        />
        {!expanded && overflowing && (
          <button type="button" className="day-notes-more" onClick={() => setExpanded(true)}>
            More details
          </button>
        )}
        {expanded && (
          <button
            type="button"
            className="day-notes-more"
            onClick={() => { textareaRef.current?.blur(); setExpanded(false); }}
          >
            Show less
          </button>
        )}
      </div>
      {value && !readOnly && (
        <button
          className="icon-btn sm"
          aria-label="Clear day note"
          title="Clear"
          onClick={() => { setValue(""); save(""); }}
        >
          <Icons.close size={12} />
        </button>
      )}
    </div>
  );
}
