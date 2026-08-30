<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:handoff-protocol -->
# Multi-thread handoff protocol (all agents — Claude Code, Codex, OpenCode)

This project runs **one unit of work per thread**. Threads are retired and
resumed via `.handoffs/current.md` (see the `context-handoff` skill). Whenever
you resume a thread, pick up a handoff, or choose "what's next," **ground
yourself in git before acting**:

1. Run `git log --oneline -30`. Recent history — **not** any planning doc — is
   the source of truth for what has already shipped.
2. Treat `.handoffs/current.md`, `BACKLOG.md`, PRDs, and TODO lists as **claims
   to verify, never a to-do list to trust.** Before starting any named "next"
   item, confirm it is *not* already in the git history. A task in the log is DONE.
3. If a handoff or backlog names work that git shows already merged, **discard
   it, say so plainly, re-derive the real next unit from git, and confirm with
   the owner before writing code.** (A stale task queue sending a thread after
   already-shipped work is the failure this protocol exists to prevent.)

When **writing** a handoff (`.handoffs/current.md`):
- Capture live git state yourself: `git rev-parse HEAD`, `git branch
  --show-current`, `git status --porcelain`, `git log --oneline -30`.
- Make **the ONE next step** specific *and* verified-still-open against the log —
  never transcribed from a stale queue. Note how you verified it.
- List **all uncommitted / untracked files** — a fresh thread won't see them
  until they're committed or stashed. Propose the commit; never auto-commit.
- Never write secrets (`.env`, keys, tokens) into the handoff or bootstrap prompt.
<!-- END:handoff-protocol -->
