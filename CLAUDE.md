# Odyssey — Project Context for Claude Code

## What This App Is
Odyssey is a collaborative travel itinerary planner. Users create trips, build
day-by-day event timelines, view everything on a Leaflet map, track budgets,
and invite collaborators in real time.

## Tech Stack
- Next.js 16 App Router, TypeScript strict mode
- Supabase (PostgreSQL + Storage)
- Prisma ORM (schema-first) via lib/prisma/db.ts
- Clerk (auth) via @clerk/nextjs
- Tailwind CSS v4 + shadcn/ui
- Leaflet JS for maps (dynamic import, ssr: false)
- dnd-kit for drag and drop
- Notes are plain auto-grow textareas; the data layer (lib/tripNotes.ts) still
  reads legacy TipTap/ProseMirror `{doc}` JSON for backward compatibility, but no
  TipTap runtime is used (the packages were removed as unused).
- Vercel deployment target

## Key Conventions
- All server actions live in app/[route]/actions.ts
- All database queries use Prisma via lib/prisma/db.ts
- All forms validate with Zod (lib/validations/index.ts) before server action
- Use `next/font/google` for DM Serif Display, DM Sans, JetBrains Mono
- Custom color tokens use `odyssey-` prefix in Tailwind classes
- Tailwind v4 tokens defined in globals.css @theme block (no tailwind.config.ts)

## Design Tokens (the editorial system — canonical, ODY-012)
One token system: CSS custom properties defined in the `:root` of
`src/app/globals.css`. Use them via `var(--…)` in globals.css classes.
The legacy `odyssey-*` Tailwind aliases were removed — do not reintroduce them.
- --peri (periwinkle): accents, links, day headers, selected states
- --teal: success, availability, activity type
- --coral: alerts, danger, flight type
- --peach: warm accents, maybe-states, restaurant type
- --gold: ratings, hotel type
- --slate: secondary, misc/transport contexts
- --ink / --ink-2 / --ink-3: text (primary → muted)
- --paper / --paper-2 / --paper-3: backgrounds (page → cards → wells)
- --rule / --rule-2: borders; --radius-md/lg/xl: corners
- Soft variants exist for fills: --peri-soft, --teal-soft, …

## Event Type Colors
flight -> coral | hotel -> gold | restaurant -> peach
activity -> teal | transport -> peri | misc -> slate
(see TYPE_VAR in EventBlock.tsx / TYPE_HEX in mapTypes.ts)

## File Naming
- Components: PascalCase.tsx
- Hooks: camelCase.ts with `use` prefix
- Server actions: actions.ts inside route folder
- Utilities: lib/utils.ts

## Database
Prisma models: User, Trip, TripMember, Day, Event, Expense, Note.
Never use raw SQL. Use Prisma via lib/prisma/db.ts.
User sync: Clerk user -> getOrCreateUser() in each action file.

## Do Not
- Use localStorage or sessionStorage
- Add inline styles (Tailwind utilities or globals.css classes only).
  Exception: truly dynamic per-element values (progress widths, per-item
  accent colors, animation delays) may be passed inline as CSS custom
  properties, e.g. `style={{ "--f-color": color }}`, consumed by a class.
- Import Leaflet on server (use dynamic import with ssr: false)
- Use Pages Router patterns
- Hardcode hex values outside globals.css
- Create tailwind.config.ts (project uses Tailwind v4)

<!-- BEGIN:handoff-protocol -->
## Multi-thread handoff protocol (all agents — Claude Code, Codex, OpenCode)

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
   the owner before writing code.**

When **writing** a handoff (`.handoffs/current.md`): capture live git state
yourself (`git rev-parse HEAD`, `git branch --show-current`, `git status
--porcelain`, `git log --oneline -30`); make **the ONE next step** specific *and*
verified-still-open against the log (never transcribed from a stale queue); list
**all uncommitted / untracked files** (a fresh thread won't see them until
committed); propose the commit, never auto-commit; never write secrets.
<!-- END:handoff-protocol -->
