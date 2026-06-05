"use client";

import { useState, useTransition } from "react";
import { upsertPoll } from "@/app/trips/[tripId]/schedule/actions";
import { Icons } from "@/components/shared/Icons";
import type { AvailabilityBlock } from "@/types";
import { ALL_BLOCKS, BLOCK_LABEL } from "./scheduleShared";

interface PollSetupFormProps {
  tripId: string;
}

export function PollSetupForm({ tripId }: PollSetupFormProps) {
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [blocks, setBlocks] = useState<Record<AvailabilityBlock, boolean>>({
    all_day: true,
    morning: false,
    afternoon: false,
    evening: false,
  });
  const [desiredLength, setDesiredLength] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleBlock(block: AvailabilityBlock) {
    setBlocks((prev) => ({ ...prev, [block]: !prev[block] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const enabledBlocks = ALL_BLOCKS.filter((b) => blocks[b]);
    if (!rangeStart || !rangeEnd) {
      setError("Pick a start and end date for the window.");
      return;
    }
    if (new Date(rangeEnd) < new Date(rangeStart)) {
      setError("The end date must be on or after the start date.");
      return;
    }
    if (enabledBlocks.length === 0) {
      setError("Enable at least one time block.");
      return;
    }

    const desired = desiredLength.trim() ? Number(desiredLength) : undefined;

    startTransition(async () => {
      try {
        await upsertPoll({
          tripId,
          rangeStart,
          rangeEnd,
          enabledBlocks,
          ...(desired !== undefined ? { desiredLengthDays: desired } : {}),
        });
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="invite-card">
      <h3>Open a <em>scheduling poll</em></h3>
      <p className="sub">
        Choose the widest range of dates to consider. Travelers mark their availability,
        and Odyssey surfaces the window that works for the most people.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 8 }}>
        <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label htmlFor="poll-start">Earliest date</label>
            <input
              id="poll-start"
              type="date"
              className="input"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="poll-end">Latest date</label>
            <input
              id="poll-end"
              type="date"
              className="input"
              value={rangeEnd}
              min={rangeStart || undefined}
              onChange={(e) => setRangeEnd(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field">
          <label>Time blocks to ask about</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ALL_BLOCKS.map((block) => {
              const on = blocks[block];
              return (
                <button
                  type="button"
                  key={block}
                  onClick={() => toggleBlock(block)}
                  aria-pressed={on}
                  className="rounded-xl"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    border: "1px solid var(--rule-2)",
                    cursor: "pointer",
                    background: on ? "var(--ink)" : "var(--paper)",
                    color: on ? "var(--paper)" : "var(--ink-2)",
                  }}
                >
                  {BLOCK_LABEL[block]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="poll-length">Desired trip length (days, optional)</label>
          <input
            id="poll-length"
            type="number"
            min={1}
            className="input"
            value={desiredLength}
            onChange={(e) => setDesiredLength(e.target.value)}
            placeholder="e.g. 4"
          />
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--coral)", margin: 0 }}>{error}</p>}

        <div>
          <button type="submit" className="btn-cta" disabled={isPending}>
            <Icons.schedule size={14} /> {isPending ? "Opening…" : "Open poll"}
          </button>
        </div>
      </form>
    </div>
  );
}
