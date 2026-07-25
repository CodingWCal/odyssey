"use client";

import { useState, useRef, useTransition } from "react";
import { upsertNote } from "@/app/trips/[tripId]/notes/actions";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";

interface TripNotesProps {
  tripId: string;
  initialText: string;
  /** Viewers can read but not edit trip notes (ODY-001). */
  readOnly?: boolean;
}

/**
 * Pinned trip-level notes card (`.notes-card`). Autosaves on blur.
 * Stores canonical v1 Note.content (`{ v:1, text, doc }`) via plain patch (ODY-051).
 */
export function TripNotes({ tripId, initialText, readOnly = false }: TripNotesProps) {
  const [value, setValue] = useState(initialText);
  const [focused, setFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(initialText);

  function save() {
    if (value === lastSaved.current) return;
    const previous = lastSaved.current;
    lastSaved.current = value;
    startTransition(async () => {
      try {
        await upsertNote(tripId, { text: value });
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      } catch {
        lastSaved.current = previous;
        toast("Trip notes didn't save — try again.");
      }
    });
  }

  return (
    <div className={`notes-card ${focused ? "focused" : ""}`}>
      <div className="notes-head">
        <div className="left">
          <span className="notes-pin"><Icons.note size={14} /></span>
          <span className="notes-label">Trip notes — pinned</span>
        </div>
        <span className={`save-pill ${isPending || saved ? "show" : ""} ${saved && !isPending ? "saved" : ""}`}>
          <span className="dot" />
          {isPending ? "Saving…" : "Saved just now"}
        </span>
      </div>
      <textarea
        className="notes-editor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); save(); }}
        placeholder={readOnly ? "No trip notes yet." : "What's the vibe? Confirmations, must-knows, packing reminders…"}
        rows={2}
        readOnly={readOnly}
      />
    </div>
  );
}
