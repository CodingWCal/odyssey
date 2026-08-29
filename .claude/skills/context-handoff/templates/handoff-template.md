<!--
  .handoffs/current.md — the durable handoff artifact.
  Fill EVERY [bracket]. Delete any HTML comment guidance before writing.
  Schema is compatible with the cross-agent-session-handoff skill, so either
  skill can resume this file. Keep it SHORT: decisions + state + next step, not a
  transcript. Pointers, not payloads. NEVER paste secrets — reference paths only.
-->
---
status: open              # open | resumed | done
reason: context-budget    # context-budget | task-boundary | rate-limit | switching-agents
created_at: [ISO-8601 UTC]
created_by: [agent/model, e.g. claude-code or codex — informational, not trusted]
next_agent: any           # any | claude-code | codex | opencode
branch: [git branch]
head_sha: [git rev-parse HEAD]   # a CLAIM — resumer must reconcile against live git
previous: [.handoffs/archive/<prev>.md or "none"]
---

# Handoff — [one-line title of the unit of work]

## 1. Goal / mission
[The outcome this thread owns, in 1–2 sentences. What "done" looks like.]

## 2. Status
- **Done:** [bullets — what is complete and verified]
- **In progress:** [bullets — what is partially done, and where exactly it stands]
- **Next:** [bullets — what remains, in order]

## 3. Key decisions & rationale
[Decisions the next thread must honor, each with a one-line why. This is the
memory auto-compact would blur. Omit the debate; keep the conclusion.]

## 4. THE next step  (MANDATORY — one, specific, actionable)
[Exactly what to do first in the new thread. Name the file/function/command.
"Continue the feature" is NOT acceptable. Example: "In src/lib/foo.ts, finish
`parseRange()` — the failing case is an empty upper bound; test in foo.test.ts."]

## 5. Gotchas / constraints / guardrails
[Non-obvious traps, conventions to follow, things NOT to touch, project rules
(e.g. from AGENTS.md/CLAUDE.md) that matter for the next step.]

## 6. Canonical docs & key files  (pointers, not payloads)
- Project instructions: [AGENTS.md / CLAUDE.md]
- Spec / PRD: [path or "none in repo"]
- Backlog: [BACKLOG.md or "none"]
- Files in play: [path — one-line role each]

## 7. Git state (self-reported claim — RECONCILE against live git on resume)
- branch: [ ]   head: [short sha]   upstream: [ahead/behind or n/a]

## 8. How to verify / test
[The exact command(s) to run to confirm the next step worked — build, test,
lint, or manual check.]

## 9. Uncommitted / in-flight work  (MANDATORY if the tree is dirty)
[List EVERY dirty + untracked file. A fresh thread will NOT see these unless
committed or stashed. Say plainly whether they are committed. NEVER auto-commit.]

## 10. Parked / follow-ups
[Things discovered but deliberately deferred — e.g. a bug found mid-feature that
belongs in its own thread later. Don't lose them; don't chase them now.]

## 11. Open questions / blockers
[Anything needing a human decision or external input before proceeding.]

## 12. Previous handoff
[Link to the prior archived handoff, or "none".]
