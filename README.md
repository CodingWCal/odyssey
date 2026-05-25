# Odyssey — Collaborative Trip Planner

A full-stack travel itinerary app built with Next.js 16, Supabase, Clerk, and Prisma.

Odyssey is where the planning feels as good as the trip itself. A collaborative workspace for travelers to build itineraries, coordinate with their crew, map their route, and track their budget! All in one calm, beautiful place. For travelers, dreamers and those who love wanderlust.

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd odyssey
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in all values:

- **Clerk**: Create an app at [clerk.com](https://clerk.com). Copy the publishable key and secret key.
- **Supabase**: Create a project at [supabase.com](https://supabase.com). Copy the project URL, anon key, service role key, and both database URLs (Transaction Pooler on port 6543 for `DATABASE_URL`, Direct Connection on port 5432 for `DIRECT_URL`).

### 3. Run database migration

```bash
npx prisma migrate dev --name init
```

This creates all tables: `User`, `Trip`, `TripMember`, `Day`, `Event`, `Expense`, `Note`.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript (strict) |
| Auth | Clerk v7 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma v7 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Map | Leaflet JS |
| Weather | Open-Meteo (no key needed) |
| Rich Text | Tiptap |
| Drag & Drop | dnd-kit |
| Deployment | Vercel |

## Features

- **Dashboard** — Card grid of all your trips
- **Itinerary** — Day-by-day timeline with drag-and-drop event reordering
- **Map** — Leaflet map with pinned event locations
- **Budget** — Expense tracker with per-person split
- **Notes** — Shared rich-text pad (autosaves on blur)
- **Members** — Invite collaborators by email

## Deploy to Vercel

Add all `.env.local` variables as environment variables in the Vercel project settings, then push to trigger a deploy.

After first deploy, run migrations against your production database:

```bash
npx prisma migrate deploy
```
