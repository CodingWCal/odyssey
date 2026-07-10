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
- Tiptap for rich text (notes tab only)
- Vercel deployment target

## Key Conventions
- All server actions live in app/[route]/actions.ts
- All database queries use Prisma via lib/prisma/db.ts
- All forms validate with Zod (lib/validations/index.ts) before server action
- Use `next/font/google` for DM Serif Display, DM Sans, JetBrains Mono
- Custom color tokens use `odyssey-` prefix in Tailwind classes
- Tailwind v4 tokens defined in globals.css @theme block (no tailwind.config.ts)

## Design Tokens
- odyssey-teal: #5DCAA5 (primary actions, CTAs)
- odyssey-slate: #4A6B8C (nav, secondary)
- odyssey-periwinkle: #7F77C0 (day headers, selected)
- odyssey-coral: #D9634F (alerts, flight type)
- odyssey-peach: #F0A08A (hover, food type)
- odyssey-cream: #F5D9B0 (backgrounds, empty states)
- odyssey-ink: #1C1C2E (primary text)
- odyssey-mist: #F0EEF8 (light page bg)

## Event Type Colors
flight -> coral | hotel -> slate | restaurant -> peach
activity -> teal | transport -> periwinkle | misc -> cream

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
