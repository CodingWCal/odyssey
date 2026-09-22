"use client";

import { useState, useTransition } from "react";
import { addEventChecklistItem, removeChecklistItem, toggleChecklistItem } from "@/app/trips/[tripId]/packing/actions";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";
import type { PackingItem } from "@/types";

interface EventChecklistProps {
  tripId: string;
  eventId: string;
  items: PackingItem[];
  readOnly?: boolean;
}

/**
 * Compact per-event packing list (ODY-067 Stage B) — always the viewer's
 * own items scoped to this event ("hiking boots for this hike"), never a
 * shared/group list. Mirrors PackingClient's toggle/remove pattern but
 * without the assignee picker, which only makes sense for group items.
 */
export function EventChecklist({ tripId, eventId, items, readOnly = false }: EventChecklistProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  if (items.length === 0 && readOnly) return null;

  const doneCount = items.filter((i) => i.done).length;

  const mutate = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch {
        toast("Couldn't save that — try again.");
      }
    });

  function submitAdd() {
    const trimmed = label.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await addEventChecklistItem({ tripId, eventId, label: trimmed });
        setLabel("");
        setAdding(false);
      } catch {
        toast("Couldn't add that item — try again.");
      }
    });
  }

  return (
    <div className="event-checklist">
      <div className="event-checklist-head">
        <Icons.suitcase size={12} />
        <span>Packing for this</span>
        {items.length > 0 && <span className="count">{doneCount}/{items.length}</span>}
      </div>

      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={item.done ? "done" : ""}
                disabled={readOnly}
                onClick={() => mutate(() => toggleChecklistItem({ tripId, itemId: item.id }))}
              >
                <span aria-hidden="true">{item.done ? "✓" : ""}</span>
                {item.label}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => mutate(() => removeChecklistItem({ tripId, itemId: item.id }))}
                >
                  <Icons.close size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly &&
        (adding ? (
          <form
            className="event-checklist-add"
            onSubmit={(e) => {
              e.preventDefault();
              submitAdd();
            }}
          >
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => {
                if (!label.trim()) setAdding(false);
              }}
              placeholder="e.g. Hiking boots"
              maxLength={160}
              aria-label="Add a packing item for this event"
            />
            <button type="submit" disabled={pending}>
              Add
            </button>
          </form>
        ) : (
          <button type="button" className="event-checklist-add-toggle" onClick={() => setAdding(true)}>
            <Icons.plus size={10} /> Pack something for this
          </button>
        ))}
    </div>
  );
}
