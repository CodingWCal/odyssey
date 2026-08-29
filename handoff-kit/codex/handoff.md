# Context handoff (Codex custom prompt)

<!--
  Install: copy this file to ~/.codex/prompts/handoff.md
  Then in Codex run:  /handoff        (to write a handoff)
                      /handoff resume  (to resume one)
  Codex also reads AGENTS.md — install the protocol block there too (see kit).
  Codex substitutes $ARGUMENTS with whatever you type after /handoff.
-->

You are running the context-handoff protocol. Mode = "$ARGUMENTS" (empty means
HANDOFF; "resume" means RESUME). Follow the protocol in AGENTS.md.

If HANDOFF:
1. Run and read live git state: repo root, `git branch --show-current`,
   `git rev-parse HEAD`, `git status --porcelain`, ahead/behind vs upstream.
2. Write `.handoffs/current.md` with: goal; status (done/in-progress/next); key
   decisions + rationale; **the one specific next step**; gotchas; pointers to
   AGENTS.md / PRD / BACKLOG and key files; the git block; how to verify; **every
   uncommitted + untracked file**; parked follow-ups; blockers. Keep it short —
   signal, not transcript. Never paste secrets (reference paths). Never
   auto-commit; if the tree is dirty, say so plainly and propose the command.
3. Archive a timestamped copy to `.handoffs/archive/<ISO>-codex.md`.
4. Output a lean **bootstrap prompt** I can paste into a fresh thread: senior
   engineer continuing [project]; mission; 3-line status; read
   .handoffs/current.md + AGENTS.md (+ PRD/BACKLOG if present); the one next
   action; constraints; and a note to hand off again at ~60–70% context.

If RESUME:
1. Read `.handoffs/current.md`. Absent → tell me there's no open handoff and stop.
2. Capture LIVE git state and reconcile against the file's claimed git block.
   Flag STALE if >7 days old, the SHA isn't in local history, or the branch
   differs — and ask before continuing.
3. Set frontmatter `status: resumed`, `resumed_at`. Don't move/delete the file.
4. Print a 5-line brief: goal · next step · blockers · git reconciliation.
5. Never run checkout/reset/pull/stash/merge to fix a mismatch — propose it.
