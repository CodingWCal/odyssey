"use client";

import { parseChecklistLines, toggleChecklistLine } from "@/lib/checklist";

interface ChecklistTextProps {
  text: string;
  placeholder: string;
  readOnly?: boolean;
  /** Enter edit mode focused at the end of the clicked line (-1 for the empty-state placeholder). */
  onEnterEdit: (lineIndex: number) => void;
  /** Fired with the full updated text after a checkbox is toggled. */
  onToggle: (nextText: string) => void;
}

/**
 * Read-mode renderer for freeform notes text (ODY-105): "- [ ] "/"- [x] "
 * lines become tappable checkboxes, "- "/"* " lines become bullets, and
 * everything else renders as plain paragraphs. The paired raw `<textarea>`
 * (rendered by the caller while focused) is where actual typing happens —
 * this component only handles the blurred/idle view and checkbox taps.
 */
export function ChecklistText({ text, placeholder, readOnly = false, onEnterEdit, onToggle }: ChecklistTextProps) {
  if (text.trim() === "") {
    return (
      <button
        type="button"
        className="checklist-empty"
        onClick={readOnly ? undefined : () => onEnterEdit(-1)}
        disabled={readOnly}
      >
        {placeholder}
      </button>
    );
  }

  const lines = parseChecklistLines(text);

  return (
    <div className="checklist-view">
      {lines.map((line) => {
        if (line.type === "blank") {
          return <div key={line.lineIndex} className="checklist-blank" />;
        }
        if (line.type === "checkbox") {
          return (
            <div key={line.lineIndex} className={`checklist-item${line.checked ? " checked" : ""}`}>
              <label className="checklist-checkbox-hit">
                <input
                  type="checkbox"
                  checked={line.checked}
                  disabled={readOnly}
                  onChange={() => onToggle(toggleChecklistLine(text, line.lineIndex))}
                />
              </label>
              <button
                type="button"
                className="checklist-line-btn"
                onClick={readOnly ? undefined : () => onEnterEdit(line.lineIndex)}
                disabled={readOnly}
              >
                {line.text || " "}
              </button>
            </div>
          );
        }
        if (line.type === "bullet") {
          return (
            <button
              key={line.lineIndex}
              type="button"
              className="checklist-line-btn checklist-bullet"
              onClick={readOnly ? undefined : () => onEnterEdit(line.lineIndex)}
              disabled={readOnly}
            >
              {line.text}
            </button>
          );
        }
        return (
          <button
            key={line.lineIndex}
            type="button"
            className="checklist-line-btn checklist-plain"
            onClick={readOnly ? undefined : () => onEnterEdit(line.lineIndex)}
            disabled={readOnly}
          >
            {line.text}
          </button>
        );
      })}
    </div>
  );
}
