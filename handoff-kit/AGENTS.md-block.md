<!--
  Paste the block below (including the BEGIN/END markers) into the repo's
  AGENTS.md (or ~/.codex/AGENTS.md / ~/.config/opencode/AGENTS.md for a global
  default). Codex and OpenCode both read AGENTS.md, so this teaches them the same
  handoff protocol the Claude Code skill uses. The markers make it safe to
  re-sync/update idempotently. install.sh inserts/updates this for you.
-->

<!-- BEGIN CONTEXT-HANDOFF PROTOCOL (managed — edit via handoff-kit) -->
## Context-handoff protocol

Long threads rot (quality decay, latency, cost) and auto-compact fires late and
lossy. So retire a thread deliberately **before** it fills, and carry work
forward as plain Markdown that any agent/model can read.

**Bridge file:** `.handoffs/current.md` (git-tracked). Git holds the code; this
holds intent, state, and the ONE next step.

**Hand off when** you've used ~60–70% of the context window with work left, or
responses slow / you start forgetting earlier decisions, or a unit of work is
done. Don't wait for the wall.

**To HAND OFF:**
1. Capture LIVE git state (root, branch, HEAD, `status --porcelain`, ahead/behind).
2. Write `.handoffs/current.md` — mandatory: **the one specific next step** and
   **every uncommitted/untracked file** (a fresh thread won't see dirty work
   unless committed/stashed — never auto-commit; propose the command).
3. Never paste secrets — reference file paths only.
4. Output a short **bootstrap prompt** for the next thread: persona (senior
   engineer continuing work) · mission · status · which docs to read (this file,
   AGENTS.md, PRD, BACKLOG) · the one next action · constraints. Point at docs;
   don't inline them.
5. Archive a timestamped copy under `.handoffs/archive/`.

**To RESUME:** read `.handoffs/current.md` (absent → no open handoff; invent
nothing), capture LIVE git state, reconcile against the file's claimed git block,
flag STALE if >7 days / SHA missing / branch differs, set `status: resumed`, and
print a 5-line brief. Never run checkout/reset/pull/stash/merge to "fix" a
mismatch — propose the command.

**One unit of work = one thread = one branch = one PR.** New feature or fix →
new thread + branch, seeded by the bootstrap prompt. Fix found mid-feature →
park it in the doc's follow-ups, don't derail the thread.
<!-- END CONTEXT-HANDOFF PROTOCOL -->
