"use client";

import { useState, useRef, useLayoutEffect, useTransition } from "react";
import { upsertNote } from "@/app/trips/[tripId]/notes/actions";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";
import { NoteSection } from "./NoteSection";
import { defaultNoteSections, type TripNoteSection } from "@/lib/tripNotes";

interface TripNotesProps {
  tripId: string;
  initialText: string;
  initialSections: TripNoteSection[];
  /** Viewers can read but not edit trip notes (ODY-001). */
  readOnly?: boolean;
}

function makeSectionId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Pinned trip-level notes card (`.notes-card`). Autosaves on blur.
 * Stores canonical v1 Note.content (`{ v:1, text, doc, sections }`) via
 * plain patch (ODY-051) plus shared notes sections (ODY-104), e.g.
 * "Important Reminders" / "Packing List" / "To Do".
 */
export function TripNotes({ tripId, initialText, initialSections, readOnly = false }: TripNotesProps) {
  const [value, setValue] = useState(initialText);
  const [focused, setFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sections, setSections] = useState<TripNoteSection[]>(() =>
    initialSections.length > 0 ? initialSections : defaultNoteSections()
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const lastSavedSections = useRef(sections);
  const [sectionsPending, startSectionsTransition] = useTransition();

  // Auto-grow to fit the note — no internal scrollbar on mobile (ODY-102).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value, collapsed]);

  function flashSaved() {
    setSaved(true);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);
    savedTimeout.current = setTimeout(() => setSaved(false), 2200);
  }

  function save() {
    if (value === lastSaved.current) return;
    const previous = lastSaved.current;
    lastSaved.current = value;
    startTransition(async () => {
      try {
        await upsertNote(tripId, { text: value });
        flashSaved();
      } catch {
        lastSaved.current = previous;
        toast("Trip notes didn't save — try again.");
      }
    });
  }

  function saveSections(next: TripNoteSection[]) {
    if (JSON.stringify(next) === JSON.stringify(lastSavedSections.current)) return;
    const previous = lastSavedSections.current;
    lastSavedSections.current = next;
    startSectionsTransition(async () => {
      try {
        await upsertNote(tripId, { sections: next });
        flashSaved();
      } catch {
        lastSavedSections.current = previous;
        setSections(previous);
        toast("Section didn't save — try again.");
      }
    });
  }

  function updateSection(id: string, patch: Partial<Pick<TripNoteSection, "title" | "text">>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    const next = [...sections, { id: makeSectionId(), title: "", text: "" }];
    setSections(next);
    saveSections(next);
  }

  function removeSection(id: string) {
    const next = sections.filter((s) => s.id !== id);
    setSections(next);
    saveSections(next);
    setCollapsedSections((prev) => {
      if (!prev.has(id)) return prev;
      const copy = new Set(prev);
      copy.delete(id);
      return copy;
    });
  }

  function toggleSectionCollapse(id: string) {
    setCollapsedSections((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  const anyPending = isPending || sectionsPending;

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
          <span className={`save-pill ${anyPending || saved ? "show" : ""} ${saved && !anyPending ? "saved" : ""}`}>
            <span className="dot" />
            {anyPending ? "Saving…" : "Saved just now"}
          </span>
          <span className={`notes-chevron${collapsed ? " collapsed" : ""}`} aria-hidden="true">
            <Icons.chevron size={16} />
          </span>
        </div>
      </button>
      {!collapsed && (
        <>
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

          {sections.length > 0 && (
            <div className="note-sections">
              {sections.map((section) => (
                <NoteSection
                  key={section.id}
                  section={section}
                  collapsed={collapsedSections.has(section.id)}
                  readOnly={readOnly}
                  onToggleCollapse={() => toggleSectionCollapse(section.id)}
                  onTitleChange={(title) => updateSection(section.id, { title })}
                  onTextChange={(text) => updateSection(section.id, { text })}
                  onBlur={() => saveSections(sections)}
                  onRemove={() => removeSection(section.id)}
                />
              ))}
            </div>
          )}

          {!readOnly && (
            <button type="button" className="note-add-section" onClick={addSection}>
              <span className="plus"><Icons.plus size={11} /></span>
              Add section
            </button>
          )}
        </>
      )}
    </div>
  );
}
