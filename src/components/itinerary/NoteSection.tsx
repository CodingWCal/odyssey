"use client";

import { useRef, useLayoutEffect } from "react";
import { Icons } from "@/components/shared/Icons";
import type { TripNoteSection } from "@/lib/tripNotes";

interface NoteSectionProps {
  section: TripNoteSection;
  collapsed: boolean;
  readOnly?: boolean;
  onToggleCollapse: () => void;
  onTitleChange: (title: string) => void;
  onTextChange: (text: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}

/** One collapsible, renamable shared-notes section (ODY-104), e.g. "Packing List". */
export function NoteSection({
  section,
  collapsed,
  readOnly = false,
  onToggleCollapse,
  onTitleChange,
  onTextChange,
  onBlur,
  onRemove,
}: NoteSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow to fit the section's text — same technique as the pinned
  // note (ODY-102), never DayBlock's fixed-max-height trick (ODY-103).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [section.text, collapsed]);

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
        <textarea
          ref={textareaRef}
          className="note-section-editor"
          value={section.text}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={onBlur}
          placeholder={readOnly ? "" : "Add items…"}
          rows={2}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
