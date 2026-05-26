"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { upsertNote } from "@/app/trips/[tripId]/notes/actions";
import { useCallback, useEffect } from "react";

interface TiptapEditorProps {
  tripId: string;
  initialContent: object | null;
  lastUpdated: Date | null;
  lastUpdatedBy: string | null;
}

export function TiptapEditor({ tripId, initialContent, lastUpdated, lastUpdatedBy }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
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
    if (!editor) return;
    await upsertNote(tripId, editor.getJSON());
  }, [editor, tripId]);

  useEffect(() => {
    if (!editor) return;
    editor.on("blur", handleBlur);
    return () => { editor.off("blur", handleBlur); };
  }, [editor, handleBlur]);

  return (
    <div>
      {editor && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
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
              style={{
                padding: "4px 12px", fontSize: 13, borderRadius: 8, cursor: "pointer",
                border: "1px solid var(--rule-2)", fontFamily: "var(--font-mono)",
                background: btn.active ? "var(--peri)" : "var(--paper)",
                color: btn.active ? "white" : "var(--ink-2)",
                transition: "all .15s ease",
              }}
            >
              {btn.text}
            </button>
          ))}
        </div>
      )}

      <EditorContent editor={editor} />

      {lastUpdated && (
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 16 }}>
          Last edited {new Date(lastUpdated).toLocaleString()}{lastUpdatedBy ? ` by ${lastUpdatedBy}` : ""}
        </p>
      )}
    </div>
  );
}
