# Handoff kit — context-handoff, everywhere

A model- and vendor-agnostic **context handoff** workflow: retire a thread on
your own terms **before** its context window forces a late, lossy auto-compact,
and carry the work forward as (1) a durable git-tracked Markdown doc and (2) a
lean bootstrap prompt that seeds the next thread already oriented.

Works with **Claude Code, Codex, and OpenCode** because the artifacts are plain
Markdown and the protocol lives in `AGENTS.md` (which all three read).

## What's in here

```
.claude/skills/context-handoff/     ← the Claude Code skill (the master copy)
  SKILL.md                            when to hand off, the two-artifact procedure
  references/token-economics.md       why long threads hurt quality + speed
  references/workflow.md               thread-per-unit-of-work, fixes, sub-agents
  templates/handoff-template.md        the durable .handoffs/current.md schema
  templates/resume-prompt.md           the bootstrap-prompt generator

handoff-kit/                         ← cross-tool + installer (this folder)
  AGENTS.md-block.md                   shared protocol block for Codex/OpenCode
  codex/handoff.md                     Codex custom prompt   (/handoff)
  opencode/handoff.md                  OpenCode command      (/handoff)
  install.sh                           one-command installer
  README.md                            you are here
```

## Relationship to your existing `cross-agent-session-handoff` skill

They're complementary and share the same `.handoffs/current.md` file, so either
can resume the other's handoff:

| | cross-agent-session-handoff | **context-handoff (this)** |
|---|---|---|
| Trigger | reactive — rate limit / switching tools | proactive — context budget / task boundary |
| Focus | moving a session **between vendors** | **not filling the window**; bootstrapping the next thread |
| Adds | AGENTS.md bridge, git reconciliation | **budget discipline + bootstrap-prompt generation + multi-thread workflow** |

Keep both. Use context-handoff to *avoid the wall*; use cross-agent when you
actually *switch agents mid-limit*.

## Install per environment

> The one thing that can't be scripted from a remote coding session is reaching
> your other machines/accounts — run these where each tool actually lives.

### Claude Code — desktop app (work account) & any local machine
Global (all repos):
```bash
handoff-kit/install.sh --claude      # -> ~/.claude/skills/context-handoff
```
Restart Claude Code; it auto-triggers on the phrases in the skill description, or
run `/context-handoff`.

### Claude Code / claude.ai on the web
Web sessions read a repo's committed `.claude/skills/`. This kit is already
committed here, so **any repo that contains `.claude/skills/context-handoff/`
gets the skill automatically on the web** — no upload step. To use it in another
project, copy that folder into that repo. To make it a **personal** skill in the
web app the same way your other synced skills appear, add it through the same
skills-sync channel you already use (the skill folder is self-contained and
ready to drop in).

### Codex CLI
```bash
handoff-kit/install.sh --codex                     # -> ~/.codex/prompts/handoff.md
handoff-kit/install.sh --agents ~/.codex/AGENTS.md # teach Codex the protocol
```
Then in Codex: `/handoff` to write one, `/handoff resume` to pick one up.

### OpenCode
```bash
handoff-kit/install.sh --opencode                          # -> ~/.config/opencode/command/handoff.md
handoff-kit/install.sh --agents ~/.config/opencode/AGENTS.md
```
Then in OpenCode: `/handoff` / `/handoff resume`.

### Per-repo (any agent)
```bash
handoff-kit/install.sh --agents ./AGENTS.md   # commit it so the whole team + web sessions inherit it
```

> Paths (`~/.codex/prompts`, `~/.config/opencode/command`) follow current
> conventions; if your CLI version differs, the installer still writes plain
> Markdown you can move. Re-running the installer is safe (idempotent).

## How to use it (the short version)

1. Working a feature/fix in a thread. Around **60–70% context** (or when the
   agent slows / forgets), say **"hand off"** (or run `/context-handoff` /
   `/handoff`).
2. The agent writes/refreshes `.handoffs/current.md` and prints a **bootstrap
   prompt**.
3. Open a **new thread** (new branch if it's a new unit of work), paste the
   bootstrap prompt, keep going — lean and fast.

The reasoning and the full multi-threaded workflow (thread-per-unit-of-work,
when to branch, fixes vs. features, sub-agent delegation) live in
`.claude/skills/context-handoff/references/`.
