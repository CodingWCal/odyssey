---
description: Context handoff — write or resume a .handoffs/current.md before context fills
agent: build
---

<!--
  Install (global): copy to ~/.config/opencode/command/handoff.md
  Install (project): copy to .opencode/command/handoff.md
  Use in OpenCode:   /handoff        (write a handoff)
                     /handoff resume  (resume one)
  OpenCode also reads AGENTS.md — install the protocol block there too (see kit).
  $ARGUMENTS holds text typed after /handoff. The !`...` lines inject live git.
-->

Run the context-handoff protocol. Mode = "$ARGUMENTS" (empty = HANDOFF,
"resume" = RESUME). Follow the protocol in AGENTS.md.

Live git state:
- root/branch: !`git rev-parse --show-toplevel; git branch --show-current`
- head: !`git rev-parse HEAD`
- tree: !`git status --porcelain`
- upstream: !`git rev-list --left-right --count @{u}...HEAD 2>/dev/null || echo "no upstream"`

If HANDOFF: write `.handoffs/current.md` with goal; status (done/in-progress/
next); key decisions + rationale; **the one specific next step**; gotchas;
pointers to AGENTS.md / PRD / BACKLOG and key files; the git block above; how to
verify; **every uncommitted + untracked file**; parked follow-ups; blockers.
Keep it short — signal, not transcript. Never paste secrets (reference paths).
Never auto-commit; if dirty, say so and propose the command. Archive a
timestamped copy to `.handoffs/archive/<ISO>-opencode.md`. Then output a lean
**bootstrap prompt** for a fresh thread: senior engineer continuing this project;
mission; 3-line status; read .handoffs/current.md + AGENTS.md (+ PRD/BACKLOG);
the one next action; constraints; hand off again at ~60–70% context.

If RESUME: read `.handoffs/current.md` (absent → say so and stop). Reconcile the
live git state above against the file's claimed block; flag STALE if >7 days /
SHA missing / branch differs, and ask before continuing. Set `status: resumed`,
`resumed_at`. Print a 5-line brief (goal · next step · blockers · reconciliation).
Never run checkout/reset/pull/stash/merge to fix a mismatch — propose it.
