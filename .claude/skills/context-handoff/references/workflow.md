# The multi-threaded agentic workflow (senior-dev fit)

This is the workflow the handoff artifacts exist to serve. It answers: *when do
I start a new thread? per feature? per fix? where do sub-agents fit?*

## The core unit: one thread = one unit of work = one branch = one PR

Map the boundaries you already use in engineering onto threads:

| Real-world unit        | Thread            | Branch                     | Ends with        |
| ---------------------- | ----------------- | -------------------------- | ---------------- |
| A feature              | one feature thread| `feat/<slug>`              | a PR             |
| A bug fix              | one fix thread    | `fix/<slug>`               | a PR             |
| A refactor / chore     | one thread        | `chore/<slug>`             | a PR             |
| A spike / exploration  | one thread        | throwaway or `spike/<slug>`| notes → decision |

Why this mapping wins:
- **Lean, cacheable threads.** Each thread carries only its own unit's context,
  so it stays fast and sharp and rarely nears the context wall.
- **Reviewable.** One thread → one focused branch → one PR a human can actually
  review. It also matches how CI, revert, and blame work.
- **Parallelizable.** Independent units run as independent threads at the same
  time without polluting each other's context.

### So: new feature → new thread + new branch? — Yes.

Start a fresh thread and a fresh branch per feature, seeded by a bootstrap
prompt. Don't grow one mega-thread across features: you pay the full context tax
on unrelated work and quality decays. The **only** time you stay in-thread across
a boundary is a trivial, tightly-coupled follow-up.

### And fixes? — Same rule, sized down.

A fix is just a smaller unit of work, so it still gets its own thread + branch +
PR. Two nuances:

- **Small, isolated fix:** a short standalone thread. It may not need a full
  `.handoffs/current.md` at all — the bootstrap prompt alone (or just the branch)
  is enough. Reserve the durable doc for work that will actually be handed off.
- **Fix discovered *mid-feature*:** do **not** derail the feature thread. Park it
  in the handoff doc's "Parked / follow-ups" list (or `BACKLOG.md`), finish or
  cleanly pause the feature, then spin the fix as its own thread later. Context
  switching inside a thread is what bloats and rots it.

## Two distinct reasons to open a new thread

1. **Task boundary** (planned): the unit is done or cleanly pausable → new
   thread + **new branch**. The bootstrap prompt describes the *next* unit.
2. **Context pressure** (mid-unit): you're not done but the window is filling →
   new thread, **same branch**, to continue the *same* unit. The bootstrap prompt
   + handoff doc carry you across the seam. This is the case auto-compact handles
   badly and this skill handles well.

Knowing which one you're in tells you whether to branch. The handoff doc's
`reason` field records it.

## Bootstrap prompt, then delegate (the two-layer pattern)

You asked whether this should pair with a prompt generator and sub-agent
delegation. Yes — and they layer:

**Layer 1 — Bootstrap the orchestrator thread.** Paste the generated prompt
(see `templates/resume-prompt.md`) into the new thread. It establishes:
- **Persona:** "You are a senior engineer continuing work on <project>."
- **Mission / goal:** the outcome this thread owns.
- **Status:** done / in-progress / next — three short lists.
- **Canonical docs to read:** point at `AGENTS.md` (or `CLAUDE.md`), the PRD if
  one is in the repo, `BACKLOG.md`, and `.handoffs/current.md`. **Point, don't
  paste** — the thread reads them on demand, keeping the entry cost tiny.
- **The ONE next action** and the constraints/guardrails.

This keeps the *seed* small (a lean orchestrator context) while giving the thread
everything it needs to reconstruct depth itself.

**Layer 2 — Delegate the heavy reading to sub-agents.** Within the thread, hand
well-scoped, parallelizable subtasks to sub-agents (Task/agent tools, or separate
worker threads):
- The orchestrator stays lean and **keeps the plan + integration** context.
- Each sub-agent does the token-expensive work (sweeping many files, running a
  broad search, drafting an isolated module) in **its own** context window and
  returns only the **conclusion** — not the file dumps.
- Net effect: the parent's context budget is spent on decisions and wiring, not
  on raw material. This is the same "preserve signal, not transcript" principle
  applied *within* a thread.

Good sub-agent tasks: "find every call site of X and report the list,"
"reproduce this failure and report the root cause," "draft module Y against this
interface." Bad sub-agent tasks: anything where you need the full intermediate
reasoning in the parent, or anything not cleanly scoped.

## End-to-end loop for a senior dev

1. **Plan the unit.** From a PRD/backlog item, define one unit of work + its
   branch. (Use a PRD/backlog generator up front if the idea is fresh.)
2. **Open a thread**, paste the bootstrap prompt, point it at the canonical docs.
3. **Delegate** the fan-out reading/searching to sub-agents; integrate results.
4. **Watch the budget.** At ~60–70% or on symptoms, **hand off**: write/refresh
   `.handoffs/current.md`, generate the next bootstrap prompt.
5. **Land the unit:** commit, open the PR, let CI/review run.
6. **Next unit → new thread + new branch**, seeded from the handoff. Repeat.

The discipline that makes this fast: every thread stays lean because its context
is *scoped* (one unit) and *distilled* (handoff + delegation), never *accumulated*.
