Odyssey — Product Requirements Document
Version: 2.0  
Status: Active  
Author: Calvin Van, Emily Castillo  
Date: May 2026  
Environment: Cursor IDE + Claude Code + Agentic Dev Workflow
---
1. Problem Statement
Travelers experience decision fatigue and fragmentation when planning trips. Flights, hotels, restaurants, transport, and shared group coordination are scattered across multiple apps, tabs, and threads. There is no single calm, beautiful space to hold all of it together.
---
2. Product Vision
Odyssey is a collaborative trip planning web app that centralizes every detail of a journey — from a solo city day trip to a multi-week group vacation — into one classy, joy-inducing workspace. It should feel less like a planning tool and more like the beginning of the adventure itself.
---
3. Target Users
Solo travelers who want organized, drag-and-drop itineraries
Friend groups and families coordinating shared trips
Couples or small crews planning weekend city escapes or retreats
Budget-conscious planners who want cost transparency in one view
---
4. MVP Scope
Core itinerary management with collaboration, map integration, and trip dashboard. No AI features, no booking integrations, no mobile app in v1.
---
5. Core Features
5.1 Trip Dashboard (Homepage)
Centralized card grid view of all trips: upcoming, in-progress, and past
Each card: trip name, destination, date range, collaborator avatars, cover photo or destination-based gradient
Quick CTA to create a new trip
5.2 Trip Workspace (Multi-Tab)
Each trip opens into a persistent multi-tab workspace:
Tab	Description
Itinerary	Day-by-day timeline, default landing view
Map	Interactive Leaflet map with pinned destinations
Budget	Expense tracker with category breakdowns
Notes	Shared freeform rich text pad
Members	Collaborator management and invite flow
5.3 Day-by-Day Itinerary
Vertical timeline with sticky day headers
Event blocks: title, type, time, location, notes, cost
Event types: flight, hotel, restaurant, activity, transport, misc
Full CRUD on all event blocks
Drag and drop reorder within and across days
Color-coded type badges using Odyssey palette tokens
5.4 Interactive Map
Leaflet JS with pinned itinerary locations
Drag pins to reorder or reassign to days
Click a pin to view or edit the linked event
Toggle map layers: standard and satellite
Optional: static polyline route between destinations
5.5 Collaboration
Invite by email via Clerk
Roles: Owner and Editor only in v1
Real-time updates via Supabase subscriptions
Collaborator avatars in trip card and workspace header
5.6 Budget Tracker
Expenses by category: flights, lodging, food, transport, activities, misc
Equal per-person split view in v1
Total budget vs. spent summary header
Tracking only, no payment processing
5.7 Weather Widget
Open-Meteo API (free, no key required)
Ambient banner in itinerary tab: temp, condition icon, trip-date forecast
Degrades gracefully if unavailable
5.8 Notes Tab
Shared rich text per trip via Tiptap (headless)
Autosaves to Supabase on blur
---
6. Out of Scope for MVP
Native booking integrations (flights, hotels)
AI-generated suggestions
Notifications or email reminders
Native mobile app
Offline mode
Public trip sharing
Advanced roles (view-only, admin)
Currency conversion
---
7. Tech Stack
Layer	Choice	Notes
Framework	Next.js 14+ App Router	SSR on dashboard, client components for interactive views
Language	TypeScript (strict)	Strict mode throughout
Auth	Clerk	Social login, email, org support for collaborators
Database	PostgreSQL via Supabase	Realtime subscriptions
ORM	Prisma	Type-safe queries, schema-first
Styling	Tailwind CSS + shadcn/ui	Custom Odyssey token overrides in tailwind.config.ts
Map	Leaflet JS	Open-source, no billing
Weather	Open-Meteo	No API key needed
Rich Text	Tiptap (headless)	Notes tab only
Drag and Drop	dnd-kit	Accessible, composable
Deployment	Vercel	Edge-optimized, branch previews
File Storage	Supabase Storage	Cover photos only
---
8. Data Models
User
```ts
id: uuid
email: string
name: string
avatar_url: string | null
created_at: timestamp
```
Trip
```ts
id: uuid
owner_id: uuid (ref: User)
title: string
destination: string
start_date: date
end_date: date
cover_image_url: string | null
created_at: timestamp
```
TripMember
```ts
id: uuid
trip_id: uuid (ref: Trip)
user_id: uuid (ref: User)
role: 'owner' | 'editor'
joined_at: timestamp
```
Day
```ts
id: uuid
trip_id: uuid (ref: Trip)
date: date
label: string | null
```
Event
```ts
id: uuid
day_id: uuid (ref: Day)
trip_id: uuid (ref: Trip)
type: 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport' | 'misc'
title: string
location: string | null
start_time: time | null
end_time: time | null
notes: string | null
cost: number | null
order_index: number
lat: number | null
lng: number | null
created_by: uuid (ref: User)
created_at: timestamp
```
Expense
```ts
id: uuid
trip_id: uuid (ref: Trip)
event_id: uuid | null (ref: Event)
label: string
amount: number
category: 'flights' | 'lodging' | 'food' | 'transport' | 'activities' | 'misc'
added_by: uuid (ref: User)
created_at: timestamp
```
Note
```ts
id: uuid
trip_id: uuid (ref: Trip)
content: Json (Tiptap JSON doc)
updated_at: timestamp
updated_by: uuid (ref: User)
```
---
9. Design Direction
Palette (Derived from Sunset Cloud Photo)
Warm peachy golds layered over deep atmospheric blues and muted violets, grounded by coral and sage. Editorial and evocative, not default SaaS.
Token	Hex	Usage
`--odyssey-teal`	`#5DCAA5`	Primary CTAs, active states, success
`--odyssey-slate`	`#4A6B8C`	Navigation, secondary buttons, map chrome
`--odyssey-periwinkle`	`#7F77C0`	Day headers, selected states, badge accents
`--odyssey-coral`	`#D9634F`	Alerts, delete actions, flight event type
`--odyssey-peach`	`#F0A08A`	Warm hover states, restaurant event type
`--odyssey-cream`	`#F5D9B0`	Page backgrounds, empty states
`--odyssey-ink`	`#1C1C2E`	Primary text, dark surfaces
`--odyssey-mist`	`#F0EEF8`	Light page background
Define these in `tailwind.config.ts` under `theme.extend.colors.odyssey` and as CSS custom properties in `globals.css`.
Typography
Display / Headings: `DM Serif Display` — editorial, travel-magazine weight
Body: `DM Sans` — clean and readable at all sizes
Monospace: `JetBrains Mono` — budget figures, coordinates
Load all three from Google Fonts via `next/font/google`
Layout Patterns
Dashboard: 3-column responsive card grid, generous whitespace, masonry on wide screens
Trip workspace: persistent left sidebar (tab nav, 240px) with full-height main content panel
Itinerary: vertical timeline, sticky day headers with periwinkle accent
Map: full-bleed Leaflet panel, floating event drawer on pin click
Corners: 12–16px radius throughout
Elevation: soft ambient shadows only, no heavy drop shadows
Tone and Mood
Blissful, euphoric, wanderlust. The app should feel like holding a boarding pass and a printed map at the same time. Copy is warm and direct, never enterprise-dry.
---
10. Route Map
```
/                               Marketing landing or /dashboard redirect if authed
/sign-in                        Clerk embedded sign-in
/sign-up                        Clerk embedded sign-up
/dashboard                      All trips card grid
/trips/new                      Trip creation form
/trips/[tripId]                 Workspace shell — redirects to /itinerary
/trips/[tripId]/itinerary       Day-by-day view (default tab)
/trips/[tripId]/map             Leaflet map
/trips/[tripId]/budget          Expense tracker
/trips/[tripId]/notes           Shared notes
/trips/[tripId]/members         Collaborator management
```
---
11. Folder Structure
```
odyssey/
  .cursor/
    rules                       Cursor IDE rules (see Section 14)
  src/
    app/
      (auth)/
        sign-in/
        sign-up/
      (dashboard)/
        dashboard/
      trips/
        [tripId]/
          itinerary/
          map/
          budget/
          notes/
          members/
      layout.tsx
      globals.css
    components/
      ui/                       shadcn primitives
      trips/                    Trip card, trip creation form
      itinerary/                DayBlock, EventBlock, EventForm
      map/                      LeafletMap, MapPin, EventDrawer
      budget/                   ExpenseSummary, ExpenseForm, CategoryChart
      notes/                    TiptapEditor
      shared/                   AvatarGroup, TypeBadge, WeatherBanner
    lib/
      supabase/                 Client, server, and realtime helpers
      prisma/                   db.ts singleton
      hooks/                    useTrip, useItinerary, useBudget
      utils/                    formatDate, formatCurrency, eventColors
      validations/              Zod schemas for all forms
    types/
      index.ts                  Shared TypeScript types matching Prisma schema
  prisma/
    schema.prisma
    seed.ts
  public/
    fonts/
  CLAUDE.md                     Claude Code project context (see Section 13)
  .env.local.example
  tailwind.config.ts
  next.config.ts
```
---
12. MVP Success Criteria
User can create a trip, add days, and add events with full CRUD in under 5 minutes
User can invite a collaborator by email who can immediately edit the itinerary
All trip events render as pins on the Leaflet map
Budget tab reflects all costs entered across the itinerary
App deploys cleanly to Vercel with no build errors and passes `tsc --noEmit`
Supabase realtime updates reflect within 2 seconds on a second active browser tab
---
13. CLAUDE.md — Claude Code Project Context File
Place this file at the project root. Claude Code reads it automatically as persistent context.
```markdown
# Odyssey — Project Context for Claude Code

## What This App Is
Odyssey is a collaborative travel itinerary planner. Users create trips, build
day-by-day event timelines, view everything on a Leaflet map, track budgets,
and invite collaborators in real time.

## Tech Stack
- Next.js 14 App Router, TypeScript strict mode
- Supabase (PostgreSQL + Realtime + Storage)
- Prisma ORM (schema-first)
- Clerk (auth and org/invite management)
- Tailwind CSS + shadcn/ui
- Leaflet JS for maps
- dnd-kit for drag and drop
- Tiptap for rich text (notes tab only)
- Vercel deployment target

## Key Conventions
- All server actions live in app/[route]/actions.ts
- All database queries use Prisma via lib/prisma/db.ts
- Supabase realtime helpers are in lib/supabase/realtime.ts
- All forms validate with Zod before server action is called
- Use `next/font/google` for DM Serif Display, DM Sans, JetBrains Mono
- Custom color tokens are prefixed `odyssey-` in Tailwind and as CSS vars

## Design Tokens (Reference These for All UI Work)
- --odyssey-teal: #5DCAA5 (primary actions)
- --odyssey-slate: #4A6B8C (nav, secondary)
- --odyssey-periwinkle: #7F77C0 (day headers, selected)
- --odyssey-coral: #D9634F (alerts, flight type)
- --odyssey-peach: #F0A08A (hover, food type)
- --odyssey-cream: #F5D9B0 (backgrounds, empty states)
- --odyssey-ink: #1C1C2E (primary text)
- --odyssey-mist: #F0EEF8 (light page bg)

## Event Types and Their Colors
flight -> coral (#D9634F)
hotel -> slate (#4A6B8C)
restaurant -> peach (#F0A08A)
activity -> teal (#5DCAA5)
transport -> periwinkle (#7F77C0)
misc -> cream (#F5D9B0)

## File Naming
- Components: PascalCase.tsx
- Hooks: camelCase.ts prefixed with `use`
- Utility functions: camelCase.ts
- Server actions: actions.ts inside the route folder

## Database
All Prisma model names are singular PascalCase (Trip, Day, Event, Expense).
Never use raw SQL. Use Prisma client via lib/prisma/db.ts.
Supabase realtime is used only for TripMember presence and Event updates.

## Do Not
- Use localStorage or sessionStorage
- Add inline styles (use Tailwind classes only)
- Import Leaflet on the server (use dynamic import with ssr: false)
- Use deprecated Next.js Pages Router patterns
- Hardcode any color hex values outside of globals.css and tailwind.config.ts
```
---
14. .cursor/rules — Cursor IDE Rules File
Place at `.cursor/rules` in the project root. These rules shape all Cursor AI completions project-wide.
```
You are working inside Odyssey, a Next.js 14 App Router collaborative travel planning app.

Always follow these rules:

STACK
- TypeScript strict mode throughout
- Use Prisma for all DB queries, never raw SQL or Supabase JS for DB reads
- Use Supabase JS client only for auth (via Clerk bridge), realtime, and storage
- All API mutations use Next.js Server Actions
- Zod schema validation required on every form before server action is called

STYLE
- Tailwind CSS only, no inline styles
- Use shadcn/ui primitives before writing custom components
- All colors must use odyssey- prefixed Tailwind tokens
- No new hardcoded hex values; add to tailwind.config.ts if a new token is needed
- Font imports only via next/font/google

COMPONENTS
- Client components must have 'use client' at the top
- Keep server components as the default; only add 'use client' when necessary
- Data fetching belongs in Server Components or in server actions
- Prefer composition over prop drilling

MAPS
- Leaflet must be imported dynamically: dynamic(() => import(...), { ssr: false })
- All map components live in src/components/map/

NAMING
- Components: PascalCase
- Hooks: camelCase starting with use
- Server actions: verbNoun pattern (createTrip, updateEvent, deleteExpense)

ACCESSIBILITY
- All interactive elements must have aria-label or visible text
- Color is never the only differentiator; use icons and text alongside color badges

DO NOT
- Suggest localStorage, sessionStorage, or cookies for app state
- Use the Pages Router
- Add new npm dependencies without noting them in a comment with justification
- Write useEffect for data fetching (use Server Components or SWR)
```
---
15. Agentic Dev Workflow
This section defines how to work with Claude Code and Cursor Composer across all six phases. The workflow has three layers: design in Claude chat, scaffold in Cursor Composer, and implement with Claude Code agents.
---
Layer 1 — Design in Claude (This Chat Interface)
Before writing any production code, use Claude chat artifacts for UI design validation. This replaces V0.
What to generate here:
Full-page component mockups (dashboard, itinerary, map panel) as HTML/React artifacts
Color and typography system validation
Responsive layout exploration
Component-level design decisions (event block, trip card, budget summary)
Workflow:
Describe the component or page to Claude in this chat
Claude renders an interactive HTML or React artifact with Odyssey tokens applied
Iterate on layout, spacing, color, and interaction patterns in chat
When approved, export the structure (not pixel-perfect code) as a written spec
Use that spec as context in Cursor Composer for production implementation
Key distinction from V0: Claude artifacts run in a sandboxed iframe and are fully interactive. They are design validation tools, not production code. Do not copy artifact HTML directly into the Next.js app; instead treat them as interactive specs that inform the Cursor/Claude Code implementation.
---
Layer 2 — Scaffold and Architecture in Cursor Composer
Cursor Composer (Cmd+I or Cmd+Shift+I) is used for multi-file architectural work.
What to run in Composer:
Phase 1 scaffold prompt:
```
Scaffold the full Odyssey project structure using Next.js 14 App Router,
TypeScript strict mode, Tailwind CSS, shadcn/ui, Clerk auth, and Prisma.

Create:
- The full folder structure from the PRD
- tailwind.config.ts with all odyssey- color tokens
- globals.css with CSS custom property definitions
- CLAUDE.md at the project root
- prisma/schema.prisma with all models: User, Trip, TripMember, Day, Event, Expense, Note
- lib/prisma/db.ts Prisma singleton
- .env.local.example with all required keys

Do not generate any UI pages yet. Focus on config, schema, and structure only.
```
Subsequent Composer prompts follow the same pattern: scoped to one concern, referencing the PRD section number for context.
---
Layer 3 — Feature Implementation with Claude Code
Claude Code is the agentic terminal tool used for feature-by-feature implementation after the scaffold is in place.
How to structure Claude Code sessions:
Each Claude Code session should open with a context reminder:
```
Read CLAUDE.md first. Then implement the following task.
Task: [task description]
Acceptance criteria: [specific, testable outcome]
Do not modify files outside the scope of this task.
```
This keeps the agent focused and prevents drift across unrelated files.
---
16. Phase-by-Phase Agent Task Prompts
Use these prompts verbatim or adapted inside Claude Code terminal sessions. Each prompt is scoped, testable, and references CLAUDE.md for grounding.
---
Phase 1 — Auth, Trip CRUD, Dashboard
Task 1.1 — Clerk auth setup
```
Read CLAUDE.md. Configure Clerk auth for Odyssey.
Install @clerk/nextjs. Add ClerkProvider to app/layout.tsx.
Create (auth)/sign-in and (auth)/sign-up routes using Clerk components.
Add middleware.ts with Clerk's authMiddleware protecting /dashboard and /trips.
Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local.example.
Do not create any UI beyond what Clerk provides out of the box.
```
Task 1.2 — Trip CRUD server actions
```
Read CLAUDE.md. Create server actions for Trip CRUD.
File: src/app/trips/actions.ts
Implement: createTrip, updateTrip, deleteTrip, getTripsByUser, getTripById
Use Prisma via lib/prisma/db.ts.
Validate all inputs with Zod before hitting the database.
createTrip should also create a TripMember record with role 'owner'.
```
Task 1.3 — Dashboard page
```
Read CLAUDE.md. Build the /dashboard Server Component.
Fetch all trips for the current Clerk user via getTripsByUser.
Render a responsive 3-column card grid using the TripCard component.
TripCard props: title, destination, startDate, endDate, collaboratorAvatars, coverImageUrl.
Use odyssey-cream as the card background, odyssey-periwinkle for the date text.
Include a Create New Trip button linking to /trips/new.
```
---
Phase 2 — Itinerary: Days and Events
Task 2.1 — Day and Event server actions
```
Read CLAUDE.md. Create server actions in src/app/trips/[tripId]/itinerary/actions.ts.
Implement: createDay, updateDay, deleteDay, createEvent, updateEvent, deleteEvent, reorderEvents.
reorderEvents accepts an array of event IDs with updated order_index values.
Validate all inputs with Zod.
```
Task 2.2 — Itinerary page layout
```
Read CLAUDE.md. Build /trips/[tripId]/itinerary as a Server Component.
Fetch the trip and all its days and events.
Render a vertical timeline: sticky DayHeader per day, then a list of EventBlocks.
DayHeader: date formatted as "Monday, Apr 12", odyssey-periwinkle left border accent.
EventBlock: title, type badge (use event type color map from CLAUDE.md), time range, location, cost.
Include an Add Event button per day that opens an EventForm in a sheet (shadcn Sheet component).
```
Task 2.3 — Drag and drop reorder
```
Read CLAUDE.md. Add dnd-kit drag and drop to the itinerary.
Wrap the EventBlock list inside each day with a DndContext and SortableContext.
On drag end, call reorderEvents server action with updated order_index values.
Use optimistic UI: update local state immediately, then revalidate on server response.
Keep the DnD logic in a client component wrapper; keep EventBlock itself a shared component.
```
---
Phase 3 — Leaflet Map
Task 3.1 — LeafletMap component
```
Read CLAUDE.md. Create src/components/map/LeafletMap.tsx.
Import Leaflet dynamically with ssr: false.
Props: events (array of Event with lat and lng), onPinClick (eventId: string) => void.
Render a custom pin per event using the event type color map from CLAUDE.md.
Clicking a pin calls onPinClick with the event ID.
Default map center to the centroid of all provided coordinates.
```
Task 3.2 — Map tab page
```
Read CLAUDE.md. Build /trips/[tripId]/map as a page.
Fetch all events for the trip that have lat and lng values populated.
Render LeafletMap full-bleed inside the workspace layout.
On pin click, open a shadcn Sheet drawer on the right with EventBlock details and an Edit button.
```
---
Phase 4 — Collaboration
Task 4.1 — Invite flow
```
Read CLAUDE.md. Build the /trips/[tripId]/members page.
Show current members with their role and avatar.
Include an Invite by Email form.
Server action inviteCollaborator: look up or create a Clerk user by email,
create a TripMember record with role 'editor'.
Display pending invites separately from accepted members.
```
Task 4.2 — Supabase realtime for events
```
Read CLAUDE.md. Add Supabase realtime to the itinerary page.
Create lib/supabase/realtime.ts with a subscribeToTripEvents helper.
Subscribe to INSERT, UPDATE, DELETE on the Event table filtered by trip_id.
On change, optimistically update the local events list without a full page reload.
This must be a client component; wrap only the events list, not the full page.
```
---
Phase 5 — Budget, Notes, Weather
Task 5.1 — Budget tracker
```
Read CLAUDE.md. Build /trips/[tripId]/budget.
Server Component fetches all Expense records for the trip.
Show: total budget input (editable), total spent, remaining, per-person split.
Expense list grouped by category with subtotals.
ExpenseForm in a Sheet: label, amount, category (select), linked event (optional select).
Server actions: createExpense, updateExpense, deleteExpense in budget/actions.ts.
```
Task 5.2 — Notes tab
```
Read CLAUDE.md. Build /trips/[tripId]/notes.
Render a full-height Tiptap editor (headless, styled with Tailwind).
Load existing Note content from Supabase on mount.
Autosave on blur via upsertNote server action.
Show last updated timestamp and the name of the last editor below the editor.
```
Task 5.3 — Weather banner
```
Read CLAUDE.md. Build src/components/shared/WeatherBanner.tsx.
Fetch from Open-Meteo API using the trip destination's coordinates.
Show: current condition icon (use a simple icon map), temperature, and a 3-day forecast.
Display as a slim ambient banner at the top of the itinerary tab.
Fetch server-side in the itinerary page, pass as props. Fail silently if unavailable.
```
---
Phase 6 — Polish and Deploy
Task 6.1 — Responsive layout
```
Read CLAUDE.md. Audit all pages for responsive behavior.
Dashboard: 1-column on mobile, 2 on tablet, 3 on desktop.
Workspace sidebar: collapses to bottom tab bar on mobile (odyssey-slate background).
Itinerary: full width on all sizes, event drawer becomes full-screen sheet on mobile.
Map: full-bleed on all sizes. Pin drawer: bottom sheet on mobile, right sheet on desktop.
No horizontal scroll on any viewport.
```
Task 6.2 — Vercel deploy prep
```
Read CLAUDE.md. Prepare for Vercel deployment.
Run tsc --noEmit and fix all TypeScript errors.
Run next build locally and resolve any build-time errors.
Ensure all environment variables in .env.local.example are documented with descriptions.
Add a vercel.json if any build config is needed.
Write a README.md with setup steps: clone, install, env setup, prisma migrate, dev server.
```
---
17. Claude Code Best Practices for This Project
Always lead with CLAUDE.md context. Start every session with "Read CLAUDE.md first." The file is short and grounding it prevents token waste on wrong conventions.
One task per session. Claude Code performs best with a single, scoped task. Avoid compound prompts like "build the itinerary and the map." Split them.
Acceptance criteria are non-negotiable. Every task prompt must end with a specific, testable outcome. This prevents the agent from stopping at a partial implementation.
Scope protection. Always include "Do not modify files outside the scope of this task." Claude Code agents can drift into touching unrelated config or component files.
Review before accepting. After each agent task, review the diff in Cursor's source control panel before accepting. Pay special attention to Prisma schema changes, which can trigger migrations.
Iterative design validation. For any component with significant UI, generate a Claude chat artifact first. Approve the design, then use it as a written spec for the Claude Code agent. This prevents multiple rounds of agentic iteration on purely visual concerns.
Use Cursor Composer for multi-file refactors. When a change touches more than 3 files (e.g., renaming a Prisma model field), use Cursor Composer rather than Claude Code. Composer can see the full file tree and handles cascading changes better than the terminal agent.
---
18. Environment Variables Reference
```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Prisma
DATABASE_URL=
DIRECT_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
---
19. Milestones
Phase	Scope	Method	Target
Phase 1	Auth, trip CRUD, dashboard	Cursor Composer scaffold + Claude Code tasks 1.1–1.3	Week 1
Phase 2	Itinerary CRUD, drag and drop	Claude Code tasks 2.1–2.3	Week 2
Phase 3	Leaflet map, pin interactions	Claude Code tasks 3.1–3.2	Week 3
Phase 4	Collaboration, Supabase realtime	Claude Code tasks 4.1–4.2	Week 4
Phase 5	Budget, notes, weather	Claude Code tasks 5.1–5.3	Week 5
Phase 6	Polish, responsive, Vercel deploy	Claude Code tasks 6.1–6.2	Week 6
---
Odyssey — where the plan is part of the adventure.