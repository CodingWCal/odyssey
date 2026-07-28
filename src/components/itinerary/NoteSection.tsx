"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { Icons } from "@/components/shared/Icons";
import { ChecklistText } from "@/components/shared/ChecklistText";
import { appendChecklistItem, lineEndOffset } from "@/lib/checklist";
import type { TripNoteSection } from "@/lib/tripNotes";

interface NoteSectionProps {
  section: TripNoteSection;
  collapsed: boolean;
  readOnly?: boolean;
  onToggleCollapse: () => void;
  onTitleChange: (title: string) => void;
  onTextChange: (text: string) => void;
  /** Save the section's current text immediately (e.g. a checkbox toggle) rather than waiting for blur. */
  onSaveNow: (text: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}

/**
 * One collapsible, renamable shared-notes section (ODY-104), e.g. "Packing
 * List". Renders a parsed checklist/bullet view (ODY-105) while blurred,
 * and the raw auto-grow textarea while being edited.
 */
export function NoteSection({
  section,
  collapsed,
  readOnly = false,
  onToggleCollapse,
  onTitleChange,
  onTextChange,
  onSaveNow,
  onBlur,
  onRemove,
}: NoteSectionProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursor = useRef<number | null>(null);

  // Auto-grow to fit the section's text — same technique as the pinned
  // note (ODY-102), never DayBlock's fixed-max-height trick (ODY-103).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [section.text, collapsed, editing]);

  // Focus the textarea (and place the caret) once it mounts after entering
  // edit mode (ODY-105) — it isn't in the DOM yet while showing ChecklistText.
  useLayoutEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    if (pendingCursor.current != null) {
      el.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [editing]);

  function enterEdit(lineIndex: number) {
    if (readOnly) return;
    pendingCursor.current = lineIndex < 0 ? section.text.length : lineEndOffset(section.text, lineIndex);
    setEditing(true);
  }

  function addItem() {
    if (readOnly) return;
    const { text: next, cursor } = appendChecklistItem(section.text);
    onTextChange(next);
    pendingCursor.current = cursor;
    setEditing(true);
  }

  return (
    <div className="note-section">
      <div className="note-section-head">
        <button
          type="button"
          className="icon-btn sm note-section-chevron-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? `Expand ${section.title || "section"}` : `Collapse ${section.title || "section"}`}
          aria-expanded={!collapsed}
        >
          <span className={`notes-chevron${collapsed ? " collapsed" : ""}`} aria-hidden="true">
            <Icons.chevron size={14} />
          </span>
        </button>
        <input
          className="note-section-title"
          value={section.title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Section title…"
          readOnly={readOnly}
          aria-label="Section title"
        />
        {!readOnly && (
          <button
            type="button"
            className="icon-btn sm danger"
            onClick={onRemove}
            aria-label={`Remove ${section.title || "section"}`}
            title="Remove section"
          >
            <Icons.trash size={13} />
          </button>
        )}
      </div>
      {!collapsed && (
        <>
          {editing ? (
            <textarea
              ref={textareaRef}
              className="note-section-editor"
              value={section.text}
              onChange={(e) => onTextChange(e.target.value)}
              onBlur={() => { setEditing(false); onBlur(); }}
              placeholder={readOnly ? "" : "Add items…"}
              rows={2}
              readOnly={readOnly}
            />
          ) : (
            <ChecklistText
              text={section.text}
              placeholder={readOnly ? "" : "Add items…"}
              readOnly={readOnly}
              onEnterEdit={enterEdit}
              onToggle={(next) => { onTextChange(next); onSaveNow(next); }}
            />
          )}
          {!readOnly && (
            <button type="button" className="note-add-item" onClick={addItem}>
              <span className="plus"><Icons.plus size={11} /></span>
              Add item
            </button>
          )}
        </>
      )}
    </div>
  );
}
