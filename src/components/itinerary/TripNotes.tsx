"use client";

import { useState, useRef, useLayoutEffect, useTransition } from "react";
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
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow to fit the note — no internal scrollbar on mobile (ODY-102).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value, collapsed]);

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
      <button
        type="button"
        className="notes-head"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="left">
          <span className="notes-pin"><Icons.note size={14} /></span>
          <span className="notes-label">Trip notes — pinned</span>
        </div>
        <div className="right">
          <span className={`save-pill ${isPending || saved ? "show" : ""} ${saved && !isPending ? "saved" : ""}`}>
            <span className="dot" />
            {isPending ? "Saving…" : "Saved just now"}
          </span>
          <span className={`notes-chevron${collapsed ? " collapsed" : ""}`} aria-hidden="true">
            <Icons.chevron size={16} />
          </span>
        </div>
      </button>
      {!collapsed && (
        <textarea
          ref={textareaRef}
          className="notes-editor"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); save(); }}
          placeholder={readOnly ? "No trip notes yet." : "What's the vibe? Confirmations, must-knows, packing reminders…"}
          rows={2}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
