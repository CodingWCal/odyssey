---
name: Context Handoff
description: >-
  Proactively hand off an in-progress agent session to a FRESH thread before the
  context window fills and auto-compact fires late — preserving high-signal
  context (goal, decisions, the one next step, live git state) in a durable,
  model-agnostic Markdown artifact, and GENERATING a lean bootstrap prompt that
  seeds the new thread. Use when context is getting full, responses slow, or the
  agent starts forgetting earlier decisions; when starting a new feature or fix
  that deserves its own thread + branch; or when you want a token-efficient
  multi-threaded agentic workflow (thread-per-unit-of-work + sub-agent
  delegation). Triggers: "hand off", "handoff", "context is filling", "before
  auto-compact", "start a fresh thread", "continue in a new session/thread", "new
  thread for this feature", "resume prompt", "bootstrap a new session", "spin up
  a clean session". Complements cross-agent-session-handoff (which MOVES a session
  between Claude Code and Codex on a rate limit); this one is about context-budget
  discipline, fresh-thread bootstrapping, and multi-threaded workflow. Works with
  any model or agent (Claude Code, Codex, OpenCode) — the artifacts are plain
  Markdown.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Context Handoff

Retire a thread on your own terms **before** its context window forces a late,
lossy auto-compact. Carry the work forward as two things: a durable, git-tracked
**handoff document** and a lean, paste-ready **bootstrap prompt** that starts the
next thread already oriented — with a small context footprint, at full model
quality and speed.

> **The transcript is disposable. Git holds the code; the handoff holds the
> intent, state, and the one next move. A fresh thread seeded from those two is
> faster, cheaper, and sharper than a bloated one that auto-compacted.**

This skill is **model- and agent-agnostic** (Claude Code, Codex, OpenCode — any
tool that reads `AGENTS.md`) and **repo-agnostic**. It reuses the same
`.handoffs/current.md` artifact as the `cross-agent-session-handoff` skill, so
the two interoperate: this one handles the *proactive, context-budget* case;
that one handles the *reactive, switch-vendors-on-a-limit* case.

## Why a deliberate handoff beats auto-compact

Auto-compact is a fallback, not a strategy. It fires near the wall (~90%+),
summarizes the whole transcript indiscriminately, and you don't choose what
survives. Long dense threads also **rot**: quality drops (important early facts
get lost in the middle), latency climbs, and every turn re-pays for a huge
prompt. A deliberate handoff inverts all three — *you* pick the high-signal
context, the new thread starts lean, and the artifact outlives any one model.
Full reasoning + the budget math: [references/token-economics.md](references/token-economics.md).

## When to hand off (don't wait for the wall)

Initiate a handoff when **any** of these is true — whichever comes first:

- **Budget:** you've consumed roughly **60–70%** of the window and the task
  still has real work left. Leave headroom; never hand off mid-thought at 95%.
- **Symptoms:** responses slow, the agent re-asks things it already knew,
  contradicts an earlier decision, or re-reads files it already read.
- **Task boundary:** the current unit of work (a feature, a fix) is done or
  cleanly pausable, and the next unit deserves its **own** thread + branch.

The deeper fix is upstream: **scope each thread to one unit of work** so it
rarely approaches the limit at all. See the workflow model in
[references/workflow.md](references/workflow.md).

## What a handoff produces (two artifacts)

1. **Durable handoff doc** — `.handoffs/current.md`, git-tracked, plain Markdown.
   The source of truth for intent/state/next-step. Schema:
   [templates/handoff-template.md](templates/handoff-template.md).
2. **Bootstrap prompt** — a short, copy-paste prompt that seeds the *new* thread:
   persona · mission · status · which canonical docs to read (AGENTS.md / PRD /
   BACKLOG / the handoff doc) · the ONE next action · constraints · optional
   delegation plan. Generator: [templates/resume-prompt.md](templates/resume-prompt.md).

The doc is the detail on demand; the prompt is the lean entry point. Together
they are the whole point of this skill: **preserve signal, not transcript.**

## HANDOFF — retire this thread cleanly

1. **Capture live git state yourself** (never trust memory):
   `git rev-parse --show-toplevel`, `git branch --show-current`,
   `git rev-parse HEAD`, `git status --porcelain`, and ahead/behind vs upstream.
2. **Draft `.handoffs/current.md`** from the template. Two fields are mandatory
   and must be *specific*: **the ONE next step** and **all uncommitted /
   in-flight work**. "Continue the feature" is a rejected non-answer.
3. **Uncommitted-work warning:** if the tree is dirty, list every dirty +
   untracked file and tell the user plainly — *a fresh thread will not see these
   unless they are committed or stashed.* Never auto-commit; propose the command.
4. **Secrets scan** the drafted text before writing. Reference file paths; never
   paste `.env`/key/token/credential contents. Redact and refuse on a hit.
5. **Write** `current.md` (frontmatter `status: open`, `reason`, `next_agent`)
   and archive a timestamped copy to `.handoffs/archive/<ISO>-<agent>.md`.
6. **Generate the bootstrap prompt** using [templates/resume-prompt.md](templates/resume-prompt.md)
   and hand it to the user in a copy-paste block. This is what they paste into
   the new thread.
7. **Quality gate — redraft** if any `[TODO]`/placeholder remains, the next step
   is vague, a mandatory section is empty, or a secret was detected.
8. **Tell the user** exactly how to start the next thread (new chat/session, same
   branch to continue the unit — or a new branch if this is a task boundary) and
   paste the bootstrap prompt there.

## RESUME — start the new thread already oriented

1. Find repo root; read `.handoffs/current.md`. **Absent → no open handoff;
   proceed normally and invent nothing.**
2. Read it fully, then **capture LIVE git state** and **reconcile** against the
   doc's self-reported block. Show a 3-line diff: branch match? `head_sha`
   present locally? tree clean as claimed? Flag **STALE** if >7 days old, the SHA
   isn't in local history, or the branch differs — and confirm before proceeding.
3. **Acknowledge non-destructively:** set frontmatter `status: resumed`,
   `resumed_at`. Do not move or delete the file.
4. Print a 5-line brief: goal · next step · blockers · git reconciliation.
5. **Never** run `checkout`/`reset`/`pull`/`stash`/`merge` to "fix" a mismatch —
   propose the exact command and let the user run it.

## Model-agnostic + cross-tool

- Artifacts are plain Markdown, so any model or agent can read them.
- The bootstrap prompt names **no vendor** — it says "you are a senior engineer
  continuing work," points at docs, and states the next action.
- For Codex/OpenCode, the same protocol is carried by an `AGENTS.md` managed
  block. Install variants + one-command installer are in the kit:
  see `handoff-kit/README.md` at the repo root (or wherever you placed the kit).

## Safety (non-negotiable)

- **Read-only on git history.** Only write inside `.handoffs/` (and an
  `AGENTS.md` managed block when syncing the bridge). Commits, pushes, checkouts,
  stashes, resets, merges are **always user-confirmed** — propose, never perform.
- **Never write secrets** into handoff files or the bootstrap prompt.
- **Never fabricate state.** No repo, no handoff, a missing SHA — report it.
- **Reconcile, don't trust.** The doc's git block is a claim; live `git` is truth.

## Detail files (load on demand)

- [references/workflow.md](references/workflow.md) — the multi-threaded workflow:
  thread-per-unit-of-work, features vs. fixes, when to branch, sub-agent
  delegation, and the "bootstrap then delegate" pattern for a senior dev.
- [references/token-economics.md](references/token-economics.md) — why long
  threads hurt quality *and* speed, budget thresholds, and the signal-vs-
  transcript principle.
- [templates/handoff-template.md](templates/handoff-template.md) — the durable
  `.handoffs/current.md` schema (compatible with `cross-agent-session-handoff`).
- [templates/resume-prompt.md](templates/resume-prompt.md) — the bootstrap-prompt
  generator (persona · mission · status · docs · next action · delegation).
