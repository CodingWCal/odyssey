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

  // "All day" and the granular blocks are mutually exclusive (ODY-109) —
  // otherwise "free all day" and "busy in the evening" could both be true
  // for the same slot with no defined precedence in computeBestWindow.
  function toggleBlock(block: AvailabilityBlock) {
    setBlocks((prev) => {
      const turningOn = !prev[block];
      if (block === "all_day" && turningOn) {
        return { all_day: true, morning: false, afternoon: false, evening: false };
      }
      if (block !== "all_day" && turningOn) {
        return { ...prev, [block]: true, all_day: false };
      }
      return { ...prev, [block]: !prev[block] };
    });
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

      <form onSubmit={handleSubmit} className="poll-form">
        <div className="field-row">
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
          <div className="poll-blocks">
            {ALL_BLOCKS.map((block) => {
              const on = blocks[block];
              return (
                <button
                  type="button"
                  key={block}
                  onClick={() => toggleBlock(block)}
                  aria-pressed={on}
                  className={`rounded-xl poll-chip ${on ? "on" : ""}`}
                >
                  {BLOCK_LABEL[block]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field poll-length">
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

        {error && <p className="form-error">{error}</p>}

        <div>
          <button type="submit" className="btn-cta" disabled={isPending}>
            <Icons.schedule size={14} /> {isPending ? "Opening…" : "Open poll"}
          </button>
        </div>
      </form>
    </div>
  );
}
