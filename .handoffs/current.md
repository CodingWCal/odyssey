---
status: open
reason: task-boundary — Explore→Foursquare migration complete and verified; next polish unit deserves its own thread
next_agent: any (Claude Code / Codex / OpenCode)
created_at: 2026-08-30
head_sha: 22199518e6f95abe8f314706b52661884d3bfb3e
branch: claude/odyssey-eval-backlog-x3edo6
repo: odyssey (CodingWCal/odyssey)
---

# Handoff — Odyssey hyper-polish thread

## Mission / standing directive
Odyssey is a collaborative travel-itinerary planner (Next.js 16 App Router, TS
strict, Prisma/Supabase, Clerk, Tailwind v4, Leaflet). The owner's standing
directive, still in force:

> **"No more brand-new features for now or the foreseeable future of prod — we
> have enough. Just hyper-polishing of everything existing, and refinements
> along the way."**

So: polish/robustness/bug-fixes on existing surfaces only. New features get
filed to `BACKLOG.md`, not built, unless the owner explicitly greenlights.

## Current state — what this thread just finished
The **Explore ("Explore by vibe")** feature was broken and is now fixed and
**verified working in production by the owner**:

- Root problem history: Explore originally queried Nominatim (a geocoder that
  can't do POI/vibe search → always empty). Rewired to keyless Overpass/OSM,
  but public Overpass rate-limits per IP and Vercel's egress IPs are shared →
  "works once then dead," effectively unusable.
- **Resolution (this thread):** migrated Explore to the **Foursquare Places API**
  as the primary provider, keyless **Overpass/OSM kept as automatic fallback**.
  Owner created a Foursquare account, generated a **Service API Key**, and added
  it to Vercel as env var `FOURSQUARE_API_KEY` (Production). Confirmed: Explore
  now returns real, fast, well-named places. (Key VALUE is not recorded here —
  it lives only in Vercel env; never paste it into any file.)

Relevant files:
- `src/lib/places.ts` — server-only. Foursquare primary (requests free "Pro"
  fields only: name/location/categories/lat/lng), Overpass fallback. Both wrapped
  in Next `unstable_cache` (30-day TTL, keyed on rounded centre + vibe). Throws
  `ExploreUnavailableError` when the active provider is busy (→ "try again" toast,
  distinct from a genuine empty result). Logs `[explore] Foursquare unavailable…`
  with HTTP status so a misconfigured key (401/403) is diagnosable in Vercel logs
  instead of silently degrading to Overpass.
- `src/lib/vibePresets.ts` — pure vibe→provider mapping. Each preset has
  `fsqQuery` (Foursquare free-text term) + `filters` (OSM tags for fallback).
  Unit-tested.
- `src/lib/__tests__/vibePresets.test.ts` — 6 tests, all passing.
- `src/app/trips/[tripId]/explore/actions.ts` — `exploreByVibe` server action.

Also earlier in the broader session (already shipped, verified): the **map
basemap** was moved to **Stadia Maps "Alidade Smooth"** (Positron look) via
domain authentication (no exposed key) in `src/components/map/LeafletMap.tsx`,
with a tiny tasteful attribution credit styled in `src/app/globals.css`.

## THE ONE NEXT STEP
**There is no in-flight task.** The Explore→Foursquare unit is done, committed,
pushed, merged to `main`, and owner-verified. The next thread should:

1. Ask the owner for the next hyper-polish target. If none is offered, propose
   from the backlog's genuinely-open candidates (reconciled 2026-08-30 — the
   list this handoff first shipped with was stale; see note below):
   - **ODY-109** remaining — bulk row/column/"free the whole range" marking +
     mobile sticky day column. Code-only, shippable without a browser.
   - **ODY-118 F2** — `:focus-visible` rings on the seamless inline note editors
     (a visual-taste judgment, but code-shippable). **ODY-085** — post-invite
     "you're in" welcome, small.
   - Landing-page **F01** fabricated social proof ("★★★★★ · Loved by 4,200
     travelers" + invented "Maya R." testimonial under a "Now in beta" badge) —
     *needs an owner content decision, do not auto-remove*.
   - Browser-dependent (owner or a browser-capable session): **ODY-118 F10** +
     **ODY-022** axe/contrast sweep · **ODY-097** budget IA/mobile judgment.

   > **Stale-list correction (2026-08-30):** the original candidates this handoff
   > named are already shipped — **F07** landing icon swap (done 2026-08-09; each
   > card already uses `Icons.itinerary/map/budget/members/note/weather`),
   > **ODY-064** (done 2026-08-11), **ODY-075** (done 2026-08-09), **ODY-117**
   > (done 2026-08-11). **ODY-067** is Stage A done; only Stage B remains.
   > `BACKLOG.md`'s "Next up" pointer was corrected to match.
2. **Do NOT start ODY-119** (Explore enrichment: price/rating/parking + translated
   names). It is filed and explicitly **deferred pending owner cost approval** —
   Foursquare Premium fields are paid (no free tier), and translated names need a
   new translation provider. See the ticket for the full research/cost/plan.

## Uncommitted / in-flight work
**None.** `git status --porcelain` is empty; branch is in sync with
`origin/claude/odyssey-eval-backlog-x3edo6`. Everything is committed and pushed.
A fresh thread will see all work.

## Git state (self-reported — reconcile against live git)
- Repo root: `/home/user/odyssey`
- Branch: `claude/odyssey-eval-backlog-x3edo6` (tracks origin, in sync)
- HEAD: `22199518e6f95abe8f314706b52661884d3bfb3e`
- Working tree: clean
- Recent commits (newest first):
  - `2219951` Backlog: ODY-119 — Explore enrichment
  - `c50648b` Explore: log Foursquare failures instead of silently falling back
  - `b68d31e` Explore: use Foursquare Places as primary POI provider
  - `e825e6f` Explore: cache POIs persistently, prefer English names, retry on busy

## Workflow / conventions (important, easy to get wrong)
- **Commits:** author as `CodingWCal <calvintrinhvan@gmail.com>`, timestamp in
  Eastern: `TZ='America/New_York' git commit --author="CodingWCal <calvintrinhvan@gmail.com>" -m "…"`.
- **Never** include any model/AI identifier in commits, PRs, code, or artifacts.
- **Ship flow:** commit → `git push -u origin claude/odyssey-eval-backlog-x3edo6`
  → `git checkout main && git merge --ff-only claude/odyssey-eval-backlog-x3edo6
  && git push origin main && git checkout claude/odyssey-eval-backlog-x3edo6`.
- **QA gate before shipping code:** `npx tsc --noEmit`, `npx eslint <files>`,
  `npx vitest run <tests>`, `npm run build` (expect BUILD EXIT: 0).
- **Design is owner-reviewed:** the owner is very particular about the editorial
  ("boarding pass + printed map") aesthetic. Visual changes → mock up / get
  review first. Safe/mechanical changes can ship directly.
- **CLAUDE.md guardrails:** no hardcoded hex outside `globals.css`; design tokens
  only (`--peri/--teal/--coral/--peach/--gold/--slate/--ink*/--paper*`); Prisma
  only via `src/lib/prisma/db.ts`; Leaflet dynamic `ssr:false`; no localStorage;
  no `tailwind.config.ts` (Tailwind v4 @theme in globals.css).

## Environment note
This runs in a sandbox whose egress proxy blocks external map/POI APIs
(Foursquare, Overpass, Nominatim, Stadia tiles). You **cannot** live-test Explore
or the map from here — the owner is the live tester. Rely on unit tests + build.
Never disable TLS or unset `HTTPS_PROXY`; don't retry policy denials.
