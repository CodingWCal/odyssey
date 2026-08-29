# Token economics — why deliberate handoff beats a bloated thread

The goal is the highest-quality output at the lowest latency and cost. Long,
dense threads work against all three. This file is the "why" behind the budget
rules in `SKILL.md`.

## The three costs of a long thread

1. **Quality decay (context rot).** As a thread grows, the signal you care about
   (the current decision, the actual next step) is diluted by thousands of tokens
   of tool output, dead ends, and superseded plans. Models attend less reliably
   to the middle of a very long context ("lost in the middle"), so early
   decisions silently stop influencing later turns. Symptoms: the agent re-asks a
   settled question, contradicts an earlier choice, or re-reads a file it already
   read.

2. **Latency drag.** Every turn re-processes the whole running context. Even with
   prompt caching, output slows as the thread grows and the model reasons over a
   larger, noisier field. A lean thread returns tighter answers faster.

3. **Cost.** You pay to carry the transcript forward on every turn. Most of a
   mature thread is history the next turn does not need. A fresh thread seeded
   from a 1–2 KB handoff pays for signal only.

## Why auto-compact is the wrong tool for this job

Auto-compact is a safety net, not a strategy:

- **It fires late** (near the wall, ~90%+ of the window), so you often hit it
  mid-thought, exactly when you least want a discontinuity.
- **It is indiscriminate** — it summarizes the entire transcript, weighting a
  debugging cul-de-sac the same as the decision that actually matters.
- **You don't choose what survives.** A deliberate handoff lets *you* keep the
  goal, the key decisions, the gotchas, and the one next step — and drop the rest.

A handoff is essentially **compaction you control, externalized to a durable
file**, done early enough to leave headroom.

## The budget rule

Windows and auto-compact thresholds differ by model and tool, and they change.
So don't chase an exact number — use a **reserve + symptoms** rule:

- **Reserve headroom.** Initiate the handoff around **60–70%** of the working
  window while you still have room to write a clean artifact and think straight.
  Handing off at 95% risks a truncated, low-quality handoff — the worst outcome.
- **Watch symptoms** (above). They can appear before any threshold; trust them.
- **Bigger windows don't cancel this.** A 1M-token window that's 80% full is
  still a slow, rotted thread. The window size raises the ceiling; it does not
  fix decay. Scope, don't fill.

## The one principle that drives everything

**Preserve signal, not transcript.** A good handoff is small on purpose:

- **Decisions and their rationale**, not the discussion that produced them.
- **The current state and the ONE next action**, not a replay of every step.
- **Pointers, not payloads** — reference `AGENTS.md`, the PRD, `BACKLOG.md`, and
  file paths; let the new thread pull only what it needs, when it needs it.

If the handoff doc is getting long, that's a smell: you're transcribing, not
distilling. Cut it to the decisions, the state, and the next move.
