"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { upsertNote } from "@/app/trips/[tripId]/notes/actions";
import { toast } from "@/components/shared/Toast";
import { useCallback, useEffect } from "react";

interface TiptapEditorProps {
  tripId: string;
  initialContent: object | null;
  lastUpdated: Date | null;
  lastUpdatedBy: string | null;
  /** Viewers can read but not edit notes (ODY-001). */
  readOnly?: boolean;
}

export function TiptapEditor({ tripId, initialContent, lastUpdated, lastUpdatedBy, readOnly = false }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    editable: !readOnly,
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "prose max-w-none min-h-[50vh] focus:outline-none",
        style: "font-family: var(--font-body); color: var(--ink); line-height: 1.65; font-size: 15px;",
        "aria-label": "Trip notes editor",
      },
    },
  });

  const handleBlur = useCallback(async () => {
    if (!editor || readOnly) return;
    try {
      await upsertNote(tripId, { doc: editor.getJSON() });
    } catch {
      toast("Notes didn't save — try again.");
    }
  }, [editor, tripId, readOnly]);

  useEffect(() => {
    if (!editor) return;
    editor.on("blur", handleBlur);
    return () => { editor.off("blur", handleBlur); };
  }, [editor, handleBlur]);

  return (
    <div>
      {editor && !readOnly && (
        <div className="tt-toolbar">
          {[
            { action: () => editor.chain().focus().toggleBold().run(), label: "Bold", active: editor.isActive("bold"), text: "B" },
            { action: () => editor.chain().focus().toggleItalic().run(), label: "Italic", active: editor.isActive("italic"), text: "I" },
            { action: () => editor.chain().focus().toggleBulletList().run(), label: "Bullet list", active: editor.isActive("bulletList"), text: "·" },
            { action: () => editor.chain().focus().toggleOrderedList().run(), label: "Numbered list", active: editor.isActive("orderedList"), text: "1." },
            { action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), label: "Heading", active: editor.isActive("heading", { level: 2 }), text: "H2" },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.action}
              aria-label={btn.label}
              className={`tt-btn ${btn.active ? "active" : ""}`}
            >
              {btn.text}
            </button>
          ))}
        </div>
      )}

      <EditorContent editor={editor} />

      {lastUpdated && (
        <p className="tt-meta">
          Last edited {new Date(lastUpdated).toLocaleString()}{lastUpdatedBy ? ` by ${lastUpdatedBy}` : ""}
        </p>
      )}
    </div>
  );
}
