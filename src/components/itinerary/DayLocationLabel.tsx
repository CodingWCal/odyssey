"use client";

import { useState, useRef, useTransition } from "react";
import { updateDayLabel } from "@/app/trips/[tripId]/itinerary/actions";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";

interface DayLocationLabelProps {
  dayId: string;
  tripId: string;
  /** What to show when not editing: the manual override if set, else deriveDayLocation's guess, else the weekday. */
  displayText: string;
  /** The raw stored override (Day.label) — editing starts from this, not displayText's fallback chain. */
  initialLabel: string | null;
  readOnly?: boolean;
}

/**
 * The day header's location (ODY-124's deriveDayLocation guess by default),
 * editable to a manual override (ODY-141) — for a multi-city trip like
 * Hawaii, "Oahu" vs "Maui" per day can't always be auto-derived (no event
 * with a matching location yet). Sits inside DayBlock's clickable
 * collapse-toggle header, so every interaction here stops propagation.
 */
export function DayLocationLabel({ dayId, tripId, displayText, initialLabel, readOnly = false }: DayLocationLabelProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialLabel ?? "");
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initialLabel ?? "");

  function save(next: string) {
    const trimmed = next.trim();
    if (trimmed === lastSaved.current) return;
    const previous = lastSaved.current;
    lastSaved.current = trimmed;
    startTransition(async () => {
      try {
        await updateDayLabel(dayId, tripId, trimmed);
      } catch {
        lastSaved.current = previous;
        toast("Couldn't save that — try again.");
      }
    });
  }

  if (readOnly) {
    return <h2 className="day-title">{displayText}</h2>;
  }

  if (editing) {
    return (
      <input
        className="day-title day-title-edit"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => {
          setEditing(false);
          save(value);
        }}
        onKeyDown={(e) => {
          // Never let a keystroke here (incl. Space) reach the day-head's
          // own Enter/Space collapse-toggle handler.
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setValue(lastSaved.current);
            setEditing(false);
          }
        }}
        placeholder="e.g. Oahu"
        maxLength={80}
        autoFocus
      />
    );
  }

  return (
    <h2 className="day-title day-title-editable">
      {displayText}
      <button
        type="button"
        className="day-title-edit-btn"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        aria-label={`Edit this day's location (currently ${displayText})`}
      >
        <Icons.edit size={11} />
      </button>
    </h2>
  );
}
