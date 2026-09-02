# Odyssey — MVP Roadmap Planning Doc (2026-09-02)

> **Status: PLANNING ONLY.** Nothing here is committed to `BACKLOG.md` yet. This
> is a highlight-level map of the six workstreams the owner raised in one sitting,
> grounded against current git history (`main` @ `2c62ef8`, verified 2026-09-02),
> so we can sequence and scope before turning any of it into tickets. Once a
> workstream is agreed, split it into properly-scoped `ODY-###` tickets in
> `BACKLOG.md` following the existing format (In plain terms → repro/files →
> acceptance).

---

## Why this order

Two things gate everything else and should move first:

1. **Clerk production domain** (ODY-036) — until real auth exists, invite links,
   real user identities, and any "who's on this trip" feature are all built on
   a placeholder. This is the single biggest launch blocker already logged.
2. **A safe checkpoint before the design refresh** — fonts + spacing changes
   touch nearly every screen. We want a clean, tagged commit to hand to Claude
   Design and a clean branch to hand back to Claude Code, so a visual pass
   doesn't get tangled with in-flight feature branches.

Everything else (mobile audit, Explore provider swap, globe recolor, doc
cross-check) can run in parallel once those two are moving.

---

## 1. Clerk production auth + real invite links (launch blocker)

**Already scoped in the backlog** as ODY-036 (prod Clerk + Google OAuth) and
ODY-037 (real invitations/join flow/guest access) — ODY-037 explicitly depends
on ODY-036. Nothing new to invent here; this is a sequencing decision, not a
research task.

- **ODY-036** — point the app at a production Clerk instance (not the dev
  "practice mode" instance), wire up Google OAuth for prod.
- **ODY-037** — once prod auth exists, invite emails need to carry a **real
  domain link** (not a placeholder/dev URL) that lands the invitee on the join
  flow for that specific trip.
- **Cross-cutting ask from this session:** audit `BACKLOG.md` itself once
  ODY-036/037 ship — confirm every ticket in the doc that assumed "prod auth
  not stable yet" (there are several: ODY-045 follow-ons, ODY-068 offline,
  ODY-112 receipt capture gating) gets its gate lifted or explicitly re-gated,
  rather than silently going stale. This is a documentation-hygiene pass, not
  new code — same spirit as the "ground truth is git, not the doc" rule already
  in the backlog's header.

**Owner action needed:** the actual domain (what real domain the invite link
points to) and DNS/Clerk dashboard access are outside what a coding session can
decide — needs the domain name + Clerk production keys before ODY-036 can be
implemented, not just planned.

---

## 2. Design refresh — typography, spacing, safe checkpoint for Claude Design handoff

Three distinct pieces, sequenced so nothing gets designed against code that's
about to move:

1. **Cut a safe checkpoint.** Before any visual work starts: confirm `main` is
   green (tests/build/lint), tag or branch it (e.g.
   `checkpoint/pre-design-refresh-2026-09`), and hand that exact commit to
   Claude Design. This makes "handoff back to Claude Code" unambiguous — Claude
   Code resumes from the tagged commit, not from whatever `main` has drifted to.
2. **New font pairing, less "AI-generated" look.** Current stack is DM Serif
   Display / DM Sans / JetBrains Mono — these are legitimate, purposeful
   choices already but read as a common "safe AI pick" pairing. Needs a
   **design research pass** (Claude Design, using the `design`/`design-mockup`
   skill) to propose 2–3 alternate serif+sans pairings that keep the
   "boarding pass + printed map" editorial feel — same personality, different
   typefaces — plus a mockup to approve before wiring into
   `next/font/google` and the `globals.css` `@theme` tokens.
3. **Desktop white-space audit.** Independent of fonts — likely a layout/
   container-width issue (max-width too narrow relative to viewport, or
   vertical rhythm too generous) rather than a token problem. Needs a screen-
   by-screen desktop pass (dashboard, itinerary, map, budget, schedule) to
   find where the editorial "breathing room" tips into "empty."

**Sequencing:** checkpoint tag → Claude Design mockup (fonts + fixes for the
worst white-space offenders) → owner approval → Claude Code implements against
the tagged checkpoint, not against whatever else has merged to `main` since.

---

## 3. Mobile UI audit — seamless user journey

This is broader than the ODY-120–126 mobile fixes already filed (add-member
visibility, date-picker spacing, Explore action buttons, traveler stat wrap,
notes-section collapse). Those are **point fixes** found from one round of
owner testing. What's being asked for now is a **structured, full-journey
audit**: sign-up → create trip → invite → build itinerary → explore → schedule
→ budget → settle-up, walked end-to-end on a real phone (or Playwright at
375–428px), looking for friction rather than isolated bugs.

- Reuse the existing pattern from ODY-046 ("full user-journey QA audit") and
  ODY-108 (full UI/UX design audit) — same audit discipline, mobile-scoped.
  ODY-046 is already listed as open in the backlog; this may simply be that
  ticket, executed now.
- Deliverable: a findings doc (like `docs/ody-108-design-audit.md` /
  `docs/ody-118-accessibility-audit.md`) ranking friction points, which then
  get filed as individual tickets — not one giant ticket.

---

## 4. Explore provider research — Google Places swap

**Research + decision, not a build yet** — this direction already exists in
the backlog as **ODY-123** (research+decision ticket for richer Explore
preview: map thumbnail, photos, reviews, "open in Google Maps"), filed
specifically because it was flagged as "decide before build." What's new in
this ask:

- **Reviews** — Google Places has them; current provider (Foursquare, chosen
  for its free tier per ODY-119's notes) doesn't expose review content the
  same way.
- **Map view with distance/info** — an in-card or in-panel map preview,
  distance from other itinerary stops, richer place info.
- **Multi-city support** — partially exists already: `splitDestinations`
  (`src/lib/destinations.ts`, shipped 2026-09-01) parses multi-city trip
  destinations and Explore filters by city chip. What's *not* yet covered:
  whether a Google Places swap changes how multi-city search/ranking works,
  and whether itinerary-side multi-city display (ODY-124, city-per-day
  headers) needs to know about the same city list.

**This should extend ODY-123's existing research memo**, not start a second
one — add a Google Places section (cost per call, review data availability,
attribution/ToS requirements, quota) alongside the "zero-provider-switch"
option (static map + deep-link) it already proposed. The owner explicitly
flagged this earlier as a cost tradeoff to decide, not rubber-stamp — that
constraint still holds.

---

## 5. Three.js globe — recolor to purple gradient

Small, isolated, cosmetic. `Globe3D` (landing page) already exists and already
has a reduced-motion accessibility fix (ODY-118 F4, ships idle-spin stillness
for `prefers-reduced-motion`). This is a shader/material color-parameter
change — swap whatever current gradient/color uniforms it uses for a purple
gradient consistent with the `--peri` token family, not a new component. Low
risk, easy to slot in alongside the design refresh (workstream 2) since it's
touching the same "brand look" surface — worth doing in the same pass rather
than as a separate thread.

---

## 6. Mobile app development checklist — cross-check against current plans

The owner has a Google Doc checklist for mobile app development that needs to
be diffed against what's already in `BACKLOG.md`'s mobile-related tickets
(ODY-058/059 mobile chrome, ODY-096 mobile overflow, ODY-102/103 notes mobile
fixes, the new ODY-120–126 punch list, and the "Post-MVP: ODY-073 native"
line already in the backlog's priority list).

**Blocked on access** — I don't have a way to read a Google Doc from here.
**Owner action needed:** either paste the checklist content in, share it as an
exported file, or grant a way to fetch it, and the next session can do the
gap analysis (what's covered, what's missing, what's redundant) in one pass.

---

## Suggested sequencing (once this doc is reviewed)

| Order | Workstream | Depends on | Can run in parallel with |
|---|---|---|---|
| 1 | Clerk prod domain (ODY-036) | owner's domain + Clerk prod keys | 3, 4, 5, 6 |
| 2 | Real invite links + backlog audit (ODY-037 + doc hygiene) | (1) | 3, 4, 5, 6 |
| 3 | Mobile UI audit (full journey) | none | 1, 2, 4, 5, 6 |
| 4 | Explore/Google Places research (extends ODY-123) | none | 1, 2, 3, 5, 6 |
| 5 | Design checkpoint → fonts + spacing + globe recolor | a tagged checkpoint commit | 1, 2, 3, 4 |
| 6 | Google Doc checklist gap analysis | owner shares the doc | everything |

Nothing above is committed to `BACKLOG.md`. Next step is the owner picking
which of these become real tickets first (or confirming this order), then a
session turns each into properly-scoped `ODY-###` entries the same way
ODY-120–126 were filed.
