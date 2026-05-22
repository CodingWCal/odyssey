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
        class: "prose prose-odyssey max-w-none min-h-[60vh] p-4 rounded-xl border border-odyssey-cream bg-white focus:outline-none focus:ring-2 focus:ring-odyssey-teal/30",
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
        <div className="flex gap-1 mb-2 flex-wrap">
          {[
            { action: () => editor.chain().focus().toggleBold().run(), label: "Bold", active: editor.isActive("bold"), text: "B" },
            { action: () => editor.chain().focus().toggleItalic().run(), label: "Italic", active: editor.isActive("italic"), text: "I" },
            { action: () => editor.chain().focus().toggleBulletList().run(), label: "Bullet list", active: editor.isActive("bulletList"), text: "•" },
            { action: () => editor.chain().focus().toggleOrderedList().run(), label: "Numbered list", active: editor.isActive("orderedList"), text: "1." },
            { action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), label: "Heading", active: editor.isActive("heading", { level: 2 }), text: "H2" },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.action}
              aria-label={btn.label}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                btn.active
                  ? "bg-odyssey-periwinkle text-white border-odyssey-periwinkle"
                  : "bg-white text-odyssey-ink border-odyssey-cream hover:bg-odyssey-mist"
              }`}
            >
              {btn.text}
            </button>
          ))}
        </div>
      )}

      <EditorContent editor={editor} />

      {lastUpdated && (
        <p className="text-xs text-odyssey-slate/60 mt-2">
          Last edited {new Date(lastUpdated).toLocaleString()}{lastUpdatedBy ? ` by ${lastUpdatedBy}` : ""}
        </p>
      )}
    </div>
  );
}
