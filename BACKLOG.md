# Odyssey — Engineering Backlog

> Generated from a full-codebase audit (2026-07-07). Each ticket is scoped to be run
> as a standalone work session by a subagent on a cheaper model. Tickets include the
> files to touch, acceptance criteria, and guardrails so no session needs this audit's context.
>
> **Brand guardrails for every ticket:** keep the editorial, calm, "boarding pass +
> printed map" aesthetic. DM Serif Display for display type, DM Sans body, JetBrains
> Mono for numbers. Palette lives in `src/app/globals.css` (`--peri`, `--teal`,
> `--coral`, `--peach`, `--gold`, `--slate`, `--ink`, `--paper` and the legacy
> `odyssey-*` tokens). Never hardcode hex outside globals.css. No new dependencies
> without strong justification. Prisma only via `src/lib/prisma/db.ts`.

Each ticket opens with an **In plain terms** line — a jargon-free explanation of
what's wrong and what fixing it means for a traveler using the app. Read those to
follow the process without needing the technical details; the bullets underneath
are the engineering spec.

Legend: **P0** correctness/security · **P1** refactor/robustness · **P2** quality-of-life · **P3** new feature
Size: S (<1h) · M (1–3h) · L (3h+) · Model hint: `haiku` for S mechanical, `sonnet` for M/L.

---

## P0 — Correctness & Security

### ODY-036 · Configure production Clerk instance with Google Cloud OAuth — M, sonnet
> **In plain terms:** The app still runs on the login system's "practice mode," which limits who can sign up. This switches it to the real production setup so anyone can create an account (including with Google).
**Production blocker.** The app currently uses Clerk dev keys on production
(`pk_test_*`), which restricts sign-ups and auth. Need to set up a production Clerk
instance and configure Google Cloud OAuth connector for real authentication.
- Create/configure a production Clerk application in Clerk dashboard.
- Set up Google Cloud project and OAuth 2.0 credentials for Clerk connector.
- Update `.env.production` with production Clerk keys (`pk_live_*` and secret key).
- Test sign-in/sign-up flow with real Google OAuth.
- Acceptance: users can sign up and authenticate on production with real credentials (not dev instance limitations).

### ODY-037 · Enable real invitations, join flow, and view-only guest access — L, sonnet
> **In plain terms:** Right now an invite only works if the person already has an account, and there's no way to just *show* someone a trip. This makes invite links work for brand-new people and adds a view-only share link that needs no account at all.
**Depends on ODY-036.** Current invitation system is a placeholder. Need to:
1. **Real invitations:** sending an invite creates a real invite link that a non-user can click to sign up and join the trip (currently only existing users can join).
2. **View-only guest access:** allow trip owner to generate a shareable "view-only" link (no auth required) so external viewers can see the itinerary without signing up or joining.
- Add guest session support (no auth required, read-only access) with a trip-specific token/UUID.
- Update `InviteForm` to support "guest link" generation (copy-able URL, no email needed).
- Modify routes to accept `?guestToken=...` and validate guest token for read-only viewing.
- Real invitation: improve `sendTripInvitation` to generate a join link that creates a new user + adds them to the trip if they don't exist.
- UI: add "Share for viewing" and "Invite to collaborate" buttons on Members page; show active guest links with revoke option.
- Acceptance: (1) non-user can click invite link, sign up, and auto-join trip; (2) non-authenticated user can view itinerary via guest link; (3) owner can revoke both invite and guest links.

### ODY-001 · Enforce the `viewer` role (currently decorative) — M, sonnet — ✅ DONE (PR #5)
> **In plain terms:** The "viewer" role existed in name only — the server never actually stopped viewers from editing anything. Now the server enforces read-only, and viewers don't even see edit buttons.
`TripMember.role` supports `"viewer"` and `InviteForm` lets you invite viewers, but **no
server action checks role** — every mutation only checks membership
(`db.tripMember.findFirst({ tripId, userId })`). A viewer can edit/delete events,
expenses, budget, notes, splits, and invite others.
- Add a `assertTripRole(tripId, userId, minRole)` helper in `src/lib/auth.ts` (owner > editor > viewer).
- Apply to all mutations in `src/app/trips/[tripId]/{itinerary,budget,notes,schedule,members}/actions.ts` and `src/app/trips/actions.ts` (viewers: read-only; inviting: editor+; delete trip/remove member: owner — already enforced).
- UI: hide/disable edit affordances for viewers (pass `role` down from trip layout/pages). Keep visual language intact — disabled states use existing muted tokens.
- Acceptance: a viewer account cannot mutate anything server-side even via direct action invocation; editors unaffected.

### ODY-002 · Reconcile Day records when trip dates change — M, sonnet — ✅ DONE (PR #4)
> **In plain terms:** Changing a trip's dates used to quietly destroy days — and every event planned on them. Now date changes add or remove days safely, never deleting a day that still has plans on it.
`createTrip` auto-creates a `Day` per date, but `updateTrip`
(`src/app/trips/actions.ts:107`) never reconciles days when `startDate`/`endDate`
change. Extending a trip leaves the new dates with no Day rows (nothing to add events
to); shrinking leaves orphan days (with events) outside the range.
- On date change: create missing Day rows; for days now out of range, keep them only if they contain events (surface as "out of range" in the itinerary) or delete if empty. Wrap in `db.$transaction`.
- Watch the `@@unique([tripId, date])` constraint and the local-midnight normalization used in `createTrip` (`setHours(0,0,0,0)`).
- Acceptance: extend a trip by 2 days → 2 new empty days appear in itinerary; shrink → empty out-of-range days removed, days with events preserved and flagged.

### ODY-003 · Normalize Day dates to UTC (timezone drift) — M, sonnet — ✅ DONE (PR #4)
> **In plain terms:** Depending on which timezone the server was in, "July 10" could silently become July 9 or 11. Now a date always means the calendar day you picked.
Day generation uses local server midnight (`current.setHours(0,0,0,0)`), and date
inputs come in as `new Date(validated.startDate)`. Server TZ (Vercel = UTC) vs. the
user's TZ can shift days by one, and `@@unique([tripId, date])` makes mismatched
normalization a constraint bomb.
- Standardize: store trip/day dates as UTC date-only (e.g. `new Date(dateStr + "T00:00:00Z")`) in `createTrip`, ODY-002's reconciliation, and schedule actions; render with a TZ-safe formatter in a shared util (`src/lib/utils`).
- Audit all `toLocaleDateString`/`toISOString().split("T")` call sites (WeatherBanner, itinerary/schedule pages, TripCard) for consistency.
- Acceptance: creating a trip Jul 10–12 from any client TZ yields exactly days 10, 11, 12 in the UI and DB.

### ODY-004 · Validate budget & split inputs server-side — S, haiku — ✅ DONE (PR #4)
> **In plain terms:** The budget box accepted nonsense — negative numbers, infinity, gibberish. Now the server sanity-checks every number before saving it.
`updateTripBudget(tripId, totalBudget)` (`src/app/trips/[tripId]/budget/actions.ts:65`)
accepts any number — negative, NaN-coerced, or absurdly large — with no Zod schema,
unlike every other action.
- Add `updateBudgetSchema` in `src/lib/validations/index.ts` (finite, ≥ 0, sane max e.g. 10M) and parse in the action. Clamp split weights (already ≥0 client-side) in `updateSplitSchema` too (max e.g. 100, finite).
- Acceptance: invalid values rejected server-side; UI unchanged.

### ODY-005 · Wrap multi-step mutations in transactions — S, haiku — ✅ DONE (PR #4)
> **In plain terms:** Some saves take several database steps; if one failed halfway, you'd be left with half-saved data. Now those steps succeed or fail together, like a single action.
Several actions do sequential writes that can half-apply on failure:
`deleteEvent` (expense delete + event delete), `createEvent`/`updateEvent` +
`syncLinkedExpense`, `createTrip` (trip + days), `reorderEvents` (`Promise.all` of
updates).
- Use `db.$transaction` for each. `reorderEvents` becomes a single transaction of `updateMany`s.
- Acceptance: behavior identical on success; no partial state on induced failure.

### ODY-006 · Clerk invitation revocation only scans page 1 — S, haiku — ✅ DONE (PR #5)
> **In plain terms:** Re-sending an invite email sometimes silently did nothing when many invites were pending. Now a re-send always actually sends.
`sendTripInvitation` (`src/app/trips/[tripId]/members/actions.ts:49`) calls
`getInvitationList({ status: "pending" })` without pagination, so with >10 (default
page size) pending invites the stale one may not be revoked and no fresh email goes out.
- Filter server-side by email if the SDK supports `emailAddress` query; otherwise paginate until found. Keep best-effort try/catch semantics.
- Acceptance: re-sending an invite always revokes the prior pending invite for that address.

### ODY-048 · Trip start/end dates don't persist after edit — S, sonnet — ✅ DONE
> **In plain terms:** You change a trip's dates and hit save, but when you look again the old (or a day-shifted) dates are still there. This makes edits stick to the calendar day you picked.
Editing trip dates via `TripEditModal` appears to save then revert or shift by one day.
**Root cause (investigate, don't bandage):** trip/day dates are stored as midnight timestamps, but the edit form formats them with **local** `getFullYear/getMonth/getDate`. On a US client reading a UTC-midnight value from the server, the `<input type="date">` shows the previous calendar day — so a re-open looks like the save failed, and a blind re-save writes the wrong day.
- Add `toDateInputValue(date)` in `src/lib/dates.ts` that formats the **UTC calendar day** (`toISOString().slice(0, 10)` or UTC getters); unit-test it.
- Use it in `TripEditModal` (and any other date `<input>` seeding). Align `formatDate` / `formatShortDate` for trip/day dates with `timeZone: "UTC"` so hero/sidebar match.
- Ensure `updateTrip` writes via `parseDateString` only (don't let string fields from Zod overwrite Date fields). Revalidate layout after save (already does).
- Acceptance: set Jul 30–Aug 3 in any US TZ → save → reopen edit modal and sidebar still show Jul 30–Aug 3; itinerary day headers match; no off-by-one.

### ODY-051 · TipTap Notes vs TripNotes clobber the same Note row — M, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Rich notes and the itinerary's pinned notes fight over the same storage — saving one can wipe the other. This makes one shared notes system that doesn't erase itself.
Two editors write incompatible shapes into `Note.content`: itinerary `TripNotes` saves `{ text }`; TipTap at `/trips/[id]/notes` saves ProseMirror JSON. Last write wins and can blank the other surface.
- Pick one canonical format (prefer TipTap JSON with a plain-text projection, or separate fields).
- Migrate `upsertNote` to Zod-validated schema + max size; update both UIs to read/write that shape.
- Pair with ODY-060 (nav IA) so travelers have one place for trip notes.
- Files: `src/components/itinerary/TripNotes.tsx`, `src/components/notes/TiptapEditor.tsx`, `src/app/trips/[tripId]/notes/actions.ts`, itinerary page note read path.
- Acceptance: saving TipTap never blanks itinerary pinned notes (and vice versa); oversized payloads rejected.

### ODY-052 · createEvent dayId/tripId IDOR — S, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** A sneaky request could attach an event to someone else's trip day. The server must confirm the day belongs to the trip you're editing.
`createEvent` asserts membership on `tripId` only; it never checks that `dayId` belongs to that trip. An editor who knows another trip's day UUID can inject events onto it. Same risk via Explore → itinerary save.
- Before create: `db.day.findFirst({ where: { id: dayId, tripId } })` or reject.
- Apply to `saveExploreToItinerary` path as well.
- Files: `src/app/trips/[tripId]/itinerary/actions.ts`, `src/app/trips/[tripId]/explore/actions.ts`.
- Acceptance: mismatched `dayId`/`tripId` is rejected; honest same-trip creates still work.

### ODY-098 · Day-of-week label off by one on itinerary — S, haiku — ✅ DONE
> **In plain terms:** A trip's day headers show the wrong weekday name — e.g. "Monday" next to "Tuesday, Aug 4." The calendar date is right; only the big weekday word is wrong.
> Shipped: added `formatWeekday()` (UTC-safe) to `src/lib/dates.ts`, used in `DayBlock.tsx`. Swept the rest of the app for the same bug class (missing `timeZone: "UTC"` on stored trip/day dates) and fixed dashboard trip cards, schedule/budget/map/members date ranges, the map's per-day date label, and the weather forecast's weekday labels.
`DayBlock.tsx:169` computes the weekday with `new Date(day.date).toLocaleDateString("en-US", { weekday: "long" })`, which resolves in the **browser's local timezone**. Day dates are stored as UTC-midnight (ODY-003) and `formatDate`/`formatShortDate` in `src/lib/utils.ts` already correctly pass `timeZone: "UTC"` for the adjacent date line, but this one call site doesn't — so on any negative-UTC-offset timezone (all of the US) the large weekday heading renders one day behind the correct date shown right next to it. Confirmed on-device 2026-07-27 (screenshot: "Monday" heading over "Tuesday, Aug 4" date line).
- Fix: add `{ timeZone: "UTC" }` to the `toLocaleDateString` options at `DayBlock.tsx:169`, matching the pattern already used in `src/lib/utils.ts`. Prefer a shared `formatWeekday(date)` helper in `src/lib/dates.ts` (or `src/lib/utils.ts`) over a local one-off, and use it here.
- Grep for any other bare `toLocaleDateString`/`toLocaleString` call sites on `Day`/`Trip` dates missing `timeZone: "UTC"` (revisit ODY-003's original audit) and fix those too.
- Acceptance: for a trip starting Monday Aug 3, Day 1 shows "Monday" (not "Sunday") in every US timezone; the date line and weekday heading always agree.

### ODY-099 · New Trip wizard: submit button unreachable on mobile — S, haiku — ✅ DONE
> **In plain terms:** On a phone, the "Create trip" button at the bottom of the new-trip form can be scrolled past or cut off — it's hard to actually submit.
`NewTripWizard.tsx` renders its own `.wizard` / `.wizard-body` / `.wizard-foot` classes instead of the `.modal-head` / `.modal-body` / `.modal-foot` convention `Modal.tsx` documents it expects callers to use (`src/components/shared/Modal.tsx:18`). On mobile, `Modal` renders the shadcn `Sheet` (`.sheet-panel`, `max-height: 90vh`), and only `.sheet-panel .modal-body { overflow-y: auto }` / `.sheet-panel .modal-foot { position: sticky; bottom: 0 }` (`globals.css:853-861`) get scroll + sticky-footer treatment. `.wizard-foot` (`globals.css:2597`) gets neither, so on a tall step (e.g. vibes/cover-mood picker) the submit button can sit past the visible sheet height with no guaranteed way to reach it.
> Shipped: reusing `.modal-body`/`.modal-foot` directly would have double-applied desktop's `.modal-body` padding on top of `.wizard`'s own (breaking the desktop layout), so instead added scoped rules — `.sheet-panel .wizard { overflow-y: auto; max-height: 90vh }` and `.sheet-panel .wizard-foot { position: sticky; bottom: 0; ... }` — mirroring the same scroll + sticky-footer treatment without touching desktop. Verified with Playwright at 375×812: the submit button sits in a sticky bar at the bottom of the sheet after scrolling through all of step 3 (name, budget, invites, 8 cover moods).
- Acceptance: at 375px, every wizard step's primary action ("Create trip ✨") stays reachable — sticky or scrollable within the sheet — no clipped/unreachable submit button on any step.

### ODY-110 · Schedule "best window" reports an impossible number of free travelers — S, haiku — ✅ DONE
> **In plain terms:** The Schedule tab's "Best window" card can claim more people are free than the trip even has — "12 travelers free" on a 4-person trip. It's adding up each day's headcount instead of counting the distinct people who are free across the window, so any poll with a desired trip length shows an inflated, nonsense number.
`computeBestWindow` in `src/app/trips/[tripId]/schedule/actions.ts` builds `perDate[].availableCount` as a distinct-user `Set` per date (correct), then in the sliding-window loop does `availableCount += perDate[j].availableCount` across the window's days — summing per-day counts rather than unioning the users. `AvailabilityHeatmap.tsx` renders that value directly as `{bestWindow.availableCount} traveler(s) free`.
- Only shows when `desiredLengthDays` is set: with it unset `windowLen = 1`, so the sum happens to equal the single day's distinct count and the bug is invisible. A 3-day window with 4 travelers all free reads "12 travelers free."
- Fix: carry the per-date `Set<string>` of available users through to the window loop and union them (or intersect — **decide the intended meaning first**, and make the label match it). "Free at some point during the window" (union) and "free every day of the window" (intersection) are both defensible; intersection is the more useful planning signal, union is closer to today's per-day framing. Whichever is picked, the copy must say it ("4 of 6 travelers free all 3 days").
- `score` (which weights `maybe` at 0.5) is a separate ranking signal and is fine as a sum — this ticket only changes the number that is *displayed*.
- Files: `src/app/trips/[tripId]/schedule/actions.ts` (`computeBestWindow`, `BestWindow` type), `src/components/trips/AvailabilityHeatmap.tsx` (label copy).
- Guardrails: no schema; unit-test `computeBestWindow` (currently untested) — multi-day window with overlapping and disjoint availability, `desiredLengthDays` unset, and a member free on only some days.
- Acceptance: the displayed count can never exceed the trip's member count; the label states exactly what the number means; a case with `desiredLengthDays > 1` is covered by a test.
> Shipped as intersection ("free every day of the window"), per the ticket's own recommendation. `computeBestWindow` extracted out of `schedule/actions.ts` into a new pure module `src/lib/scheduleWindow.ts` (`WindowPollInput`/`WindowSlotInput`/`BestWindow` types) so it's unit-testable without a live db — the same split this codebase already uses for `budget.ts`, `sortEvents.ts`, etc. The window loop now intersects each day's `availableUsers` set instead of summing counts. 7 new tests in `src/lib/__tests__/scheduleWindow.test.ts`: the exact "4 travelers, 3-day window" repro case (was 12, now 4), a partial-overlap case (only the traveler free every day counts), a disjoint case (positive score, zero intersection — proves score and availableCount are correctly decoupled), the `desiredLengthDays` unset default, maybe-weighting, and two null-return edge cases. `AvailabilityHeatmap.tsx`'s label now reads "N of M travelers free all D days" (D omitted when the poll has no `desiredLengthDays`), so the number is self-explanatory. Landed together with ODY-109 below, per this file's own instruction to ship them as one PR.

---

## P1 — Refactors & Robustness

### ODY-010 · Proxy Nominatim through an internal API route — M, sonnet — ✅ DONE (PR #10)
> **In plain terms:** Every visitor's browser was hitting a free map-lookup service directly — enough traffic and the whole app gets banned from it. Now lookups go through our own server, which remembers recent answers and stops anyone from hammering it.
Nominatim is hit from the browser (`LocationAutocomplete.tsx`) and the server
(`itinerary/actions.ts geocode()`) with no rate limiting or caching. Nominatim's usage
policy is 1 req/s per app; a few concurrent users can get the app (or users' IPs) blocked.
- Add `src/app/api/geocode/route.ts`: authenticated (Clerk), validates `q`, calls Nominatim with the descriptive User-Agent, caches responses (`unstable_cache` or in-memory LRU keyed on query, TTL ~24h), soft rate-limits per user.
- Point both the autocomplete and server `geocode()` at shared logic (`src/lib/geocode.ts`).
- Acceptance: no direct browser→nominatim requests; repeated identical queries served from cache; behavior of pin resolution unchanged.

### ODY-011 · Migrate inline styles to the design system — L, sonnet (can split per file) — ✅ DONE (PRs #14/15/16/19)
> **In plain terms:** Styling was scattered ad-hoc inside components instead of living in the shared stylesheet, so the design was hard to keep consistent or change. This moved all of it into one system — same pixels, tidier house.
CLAUDE.md forbids inline styles, yet the audit counts 37 `style={{}}` blocks in
`LandingPage.tsx`, 14 in `AvailabilityHeatmap.tsx`, 13 in `AvailabilityGrid.tsx`, 10
each in `MapClient.tsx` and `trips/new/page.tsx`, plus more (~120 total). Meanwhile
`globals.css` has grown to 3,061 lines of bespoke classes.
- Convert inline styles to Tailwind utilities or existing globals.css classes, **pixel-faithful** — this is a mechanical refactor, not a redesign. Dynamic values (progress widths, flexGrow by amount, animation delays) may stay inline via CSS custom properties (`style={{ "--w": pct + "%" }}`) — document that exception in CLAUDE.md.
- Suggested split: (a) LandingPage, (b) Availability grid+heatmap, (c) MapClient + trips/new, (d) remainder.
- Acceptance: visual diff-free (screenshot before/after), zero static `style={{}}` blocks outside the documented dynamic-value exception.

### ODY-012 · Consolidate the styling system & prune globals.css — L, sonnet — ✅ DONE (PR #22)
> **In plain terms:** The app has two competing naming systems for its colors and styles, plus a lot of leftover dead styling. This picks one system, translates the old names onto it, and throws out what nothing uses.
Two parallel systems coexist: the CLAUDE.md `odyssey-*` Tailwind tokens (used in
`WeatherBanner`, older components) and the newer `--paper/--ink/--peri` editorial
system with 3k lines of handwritten component CSS (`.hero`, `.cat-block`, `.canvas`…).
- Decide the newer editorial system is canonical (it is the shipped aesthetic). Map `odyssey-*` tokens onto the same underlying values in the `@theme` block, migrate the few `odyssey-*` consumers, and delete dead CSS (audit selectors against actual usage with grep).
- Update CLAUDE.md's design-token section to match reality so future agents don't reintroduce drift.
- Acceptance: one documented token system; globals.css shrinks meaningfully; no visual changes.

### ODY-013 · Error UX for server actions (Zod throws are invisible) — M, sonnet — ✅ DONE (PR #6)
> **In plain terms:** When a save failed, the app just… did nothing, and you'd assume it worked. Now failures show a small toast message, and broken pages show a friendly branded error instead of a wall of code.
Actions `throw new Error("Unauthorized")` / Zod `.parse()` throws propagate as opaque
Next.js digest errors; clients like `SplitSection.save()` and `saveBudget()` fire and
forget with no failure feedback.
- Adopt a typed result pattern `{ ok: true, data } | { ok: false, error }` for mutating actions (or wrap with a small helper), surface failures with a lightweight toast in the existing visual language (no new toast lib — a small `Toast` in `src/components/shared/` styled with existing tokens).
- Add `error.tsx` boundaries under `src/app/trips/[tripId]/` and `dashboard` with on-brand copy ("The map slipped out of our hands — try again.").
- Acceptance: failed saves show feedback; nothing silently no-ops; route errors render a branded boundary instead of the default.

### ODY-014 · Add route-level loading states — S, haiku — ✅ DONE (PR #6)
> **In plain terms:** Pages went blank for a beat while loading. Now you see calm placeholder shapes immediately, so the app always feels alive.
No `loading.tsx` files exist; heavy pages (itinerary with full trip include, map) show
a blank stall on navigation.
- Add `loading.tsx` skeletons for dashboard and trip tabs using existing paper/rule tokens — calm shimmer, no spinners-in-your-face.
- Acceptance: navigating between tabs shows branded skeletons instantly.

### ODY-015 · Fix the 6 deferred react-hooks lint suppressions — M, sonnet — ✅ DONE (PR #12)
> **In plain terms:** In six places the code told the quality-checker to look away instead of fixing the real problem. This fixed the problems for real, so the checker runs at full strength.
Known deferred work: `DayBlock.tsx:66`, `LeafletMap.tsx:139,164` (+ others per
`npx eslint src --max-warnings=0`). Each `eslint-disable-next-line react-hooks/exhaustive-deps`
hides a potential stale-closure bug; `LeafletMap.tsx` also has a file-wide
`no-explicit-any` disable.
- Fix deps properly (useCallback/refs), type the Leaflet interop instead of `any` (types are already installed via `@types/leaflet`).
- Acceptance: `npm run lint` clean with the suppressions removed; map + itinerary drag/expand behavior verified unchanged.

### ODY-016 · Test foundation + CI — L, sonnet — ✅ DONE (PR #13)
> **In plain terms:** There were no automated tests — every change was verified by hand and hope. This added a test suite plus a robot (CI) that re-runs every check on every single change before it can be merged.
Zero tests, no CI. The riskiest logic is pure and cheap to test: split-balance math
(`SplitSection`), `syncLinkedExpense`, day-range generation, validation schemas,
`getConditionFromCode`.
- Add Vitest (unit only, no E2E yet), extract split math into `src/lib/budget.ts` so it's testable, cover the listed units. GitHub Actions workflow: install → prisma generate → lint → typecheck (`tsc --noEmit`) → test → build.
- Acceptance: `npm test` green locally and in CI on PRs.

### ODY-043 · Event form gives no feedback on invalid/failed submit — S, haiku — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** If you try to add an event without a title, nothing happens and there's no explanation. This shows a clear reason, and warns you when a save actually fails.
`handleSave` in `src/components/itinerary/AddEventModal.tsx` early-returns on
`!form.title.trim()` with zero feedback (the submit button is merely disabled), and
the `createEvent`/`updateEvent` awaits aren't wrapped — a server throw closes the
modal as if it succeeded.
- Use the existing toast + error infrastructure (ODY-013) — **no new toast library**. Import `toast` from `src/components/shared/Toast`.
- Add field-level error state on Title (invalid on attempted submit, clears on input) using `--coral` tokens; optionally toast on blocked submit. On-brand copy ("Give this event a title first.").
- Wrap the create/update await in try/catch and toast a branded failure message so a failed save never looks like a success.
- Guardrails: no inline styles except dynamic CSS custom properties; editorial voice.
- Acceptance: submitting without a title shows a visible on-brand error; server failures show a toast instead of silently closing the modal.

### ODY-044 · Collect name on email sign-up (defaults to "Traveler") — S, sonnet — relates to ODY-036
> **In plain terms:** People who sign up with email instead of Google are never asked their name, so the whole app calls them "Traveler." This captures a real name.
Email/password sign-ups don't collect a name, so `src/lib/auth.ts:19` falls back to
"Traveler" everywhere (dashboard, members, budget, itinerary).
- Primary fix is Clerk config: enable Name (first/last) as required fields on the sign-up form for the instance in use — document this dashboard step in the ticket.
- Verify the `<SignUp>` component in `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` renders name fields once configured. If Clerk config can't be relied on, add a lightweight post-signup "What should we call you?" step that updates the Clerk user and resyncs via `getOrCreateDbUser`.
- Ensure `getOrCreateDbUser` (`src/lib/auth.ts`) picks up the provided name on first sync (it already reads firstName/lastName). Keep dev-instance behavior working (overlaps ODY-036).
- Acceptance: a new email/password signup shows their real name (not "Traveler") on the dashboard and members list after first login.

### ODY-046 · Full user-journey QA audit — new & returning users — M, sonnet
> **In plain terms:** Walk through the whole app as a brand-new person and as a returning user, writing down everything that's broken, confusing, or silently fails.
Audit-only deliverable (a prioritized markdown findings report + candidate tickets),
**not** code changes. Two personas: (A) brand-new no-account user, (B) returning user
with existing trips.
- Trace both: landing → sign-up/sign-in (email AND Google) → dashboard (empty state for new) → NewTripWizard (all 3 steps, vibes, cover mood, invites) → itinerary → add/edit/delete events, day notes, budget + splits, schedule/availability, map, members/invites.
- Returning user: re-auth, existing trips load, viewer/editor role behavior (ODY-001), invite flow (note ODY-037 is a placeholder).
- Per screen check: broken/empty states, silent failures (ODY-043), mobile at 375px (ODY-038/021), auth redirects (dev Clerk instance — preview pane can't complete the accounts.dev handshake, use a real browser for authed flows).
- Deliverable: prioritized P0–P3 list with repro steps + suspected files; cross-reference existing tickets to avoid duplicates.
- Acceptance: a findings report exists; each concrete defect is filed as a candidate ticket with a file path and repro.

### ODY-053 · Pin invite email origin to allowlisted app URL — S, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Invite emails should always send people to *our* sign-up page, never a fake one. Right now the link can follow a spoofed request host.
`getAppOrigin()` in members actions builds Clerk invite `redirectUrl` from the request `Host` / `x-forwarded-*` headers. A crafted invite request can point victims at an attacker-controlled "sign-up."
- Prefer `NEXT_PUBLIC_APP_URL` (or a fixed production origin allowlist) for invite redirects; fall back to request host only in local dev.
- Files: `src/app/trips/[tripId]/members/actions.ts`.
- Acceptance: invite emails always use the configured app origin in staging/prod.

### ODY-054 · Zod + trip-scope for updateExpense / eventId — S, haiku — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Editing an expense still accepts nonsense numbers, and linking an expense to an event doesn't prove that event is on this trip.
`createExpense` uses Zod; `updateExpense` does not (negative/non-finite amounts, arbitrary category). `eventId` is stored without verifying `event.tripId === expense.tripId`.
- Reuse/extend expense schemas for update; verify event belongs to trip before link.
- Files: `src/app/trips/[tripId]/budget/actions.ts`, `src/lib/validations/index.ts`.
- Acceptance: invalid updates rejected; cross-trip `eventId` rejected.

### ODY-055 · Rate-limit server-side geocode and Explore — M, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Only the browser search box is throttled. Server Explore and event saves can still hammer the free map service and get the whole app banned.
`/api/geocode` soft-limits per user; `exploreByVibe`, `createEvent`/`updateEvent`/`createPlace` call `searchPlaces`/`geocode` with no shared limiter.
- Share the rate-limit helper from the geocode route into `src/lib/geocode.ts` (or a tiny limiter module) for all server Nominatim callers.
- Files: `src/lib/geocode.ts`, `src/app/api/geocode/route.ts`, `explore/actions.ts`, itinerary/collections actions.
- Acceptance: sustained Explore/event geocode abuse is soft-limited; normal UX unchanged.

### ODY-056 · Place RLS + note payload size limit — S, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Lock down the new Places table the same way as other tables, and stop notes from accepting huge unbounded JSON.
`Place` (ODY-045) is missing from `prisma/rls.sql`. `upsertNote` accepts arbitrary `object` with no max size (storage DoS / integrity).
- Add `Place` to RLS script (defense-in-depth; Prisma still primary). Zod-validate note content + reasonable byte/char cap.
- Files: `prisma/rls.sql`, `src/app/trips/[tripId]/notes/actions.ts`.
- Acceptance: Place listed in RLS script; oversized notes rejected.

### ODY-057 · Toast remaining silent form failures — S, haiku — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Some saves still fail quietly — trip create, expenses, schedule "apply window." Show the same clear toasts events already get.
Residual of ODY-013 / sibling of ODY-043.
- Wrap try/catch + `toast` in `NewTripWizard` create (and surface invite skip), `ExpenseModal`, `AvailabilityHeatmap` apply.
- Files: those three components; reuse `src/components/shared/Toast`.
- Acceptance: induced failures show branded toasts; success paths unchanged.

### ODY-058 · Toast / sheet / map-card z-index above modals and mobile chrome — S, haiku — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Error messages and some mobile sheets hide under the bottom tab bar or behind modals — you never see them.
`.toast-stack` is `z-index: 200`; desktop modal ~1000; mobile tab bar ~1200; Sheet often `z-50`. Map selected-event card sits at `bottom: 24px` under the tab bar.
- Raise toast (and sheet) above modal + tab bar; pad map-card / toast bottom on mobile for safe-area + tab height.
- Files: `src/app/globals.css`, optionally `Toast.tsx` / `MapClient.tsx`.
- Acceptance: toasts visible during open modals and on trip pages at 375px; map card clear of tab bar.

---

## P2 — Quality of Life

### ODY-038 · Mobile UX for adding events and cross-tab navigation — L, sonnet — ✅ DONE (PR #23)
> **In plain terms:** Using the app on a phone is clunky — forms are cramped and switching tabs takes too much scrolling. This makes phone use feel as natural as desktop.
On mobile (< 768px), adding itinerary items is cumbersome (modals/forms not touch-optimized),
and navigating between trip tabs (itinerary, budget, schedule, map, members) requires
scrolling back to the sidebar or menu. Forms are cramped; workflows interrupt focus.
- **Event add/edit:** bottom sheet modal instead of centered modal on mobile (easier thumb reach, full-height input); larger touch targets, clearer submit buttons.
- **Navigation:** add a mobile-optimized bottom tab bar or persistent top navigation on mobile showing current section + quick jump to other tabs; keep sidebar hidden/collapsed by default on < 768px.
- **Forms:** stacked layout on mobile (full-width inputs), adjust modal widths/padding for 375px viewport.
- Acceptance: adding an event on mobile is as easy as desktop (no hand strain, no excessive scrolling); switching between tabs feels native and intuitive.

### ODY-042 · Auto-sort itinerary events by start time — S, haiku — ✅ DONE
> **In plain terms:** Events should always line up in time order — no mode to switch off. Dragging still works if someone wants to nudge things around (e.g. two stops at the same time), but there is no "Manual" mode that turns off auto-sorting.
> Shipped: removed the `sortMode` state and "By time"/"Manual" toggle from `DayBlock.tsx`'s day header entirely (and the now-dead `.day-sort*` CSS). `displayedEvents` is always `sortEventsByTime(events)`. Drag-and-drop stays enabled unconditionally and `handleDragEnd` now reorders against `displayedEvents`, persisting the new `orderIndex` as the tie-break among same-time/no-time events.
**Previous state (now fixed):** `DayBlock.tsx` had shipped a "By time" / "Manual" toggle (`sortMode` state, `.day-sort` button group in the day header) where "Manual" mode disabled time-sorting entirely and reverted to raw drag order, and "By time" mode disabled the drag handle outright. That was not what was wanted.
- **Remove** the `sortMode` state and the "By time" / "Manual" buttons from the day header entirely — no user-facing toggle.
- **Always** render `displayedEvents = sortEventsByTime(events)` (already exists in `src/lib/sortEvents.ts` — untimed events sort last, ties break on `orderIndex`, no changes needed there).
- **Keep drag-and-drop always enabled** (remove the `dragDisabled` prop path in `SortableEvent`/`handleDragEnd`) so a traveler can still reorder — dragging changes `orderIndex`, which only visibly matters as the tie-break among events sharing a start time (or no start time); events with distinct times stay time-ordered regardless of drag.
- Fix `handleDragEnd` (`DayBlock.tsx:152-167`) to compute old/new index against `displayedEvents` (what's actually rendered/dragged), not the raw `events` state, then persist the resulting `orderIndex` values via `reorderEvents` as before.
- Acceptance: events with start times always appear chronologically, with no way to turn that off; drag-and-drop still works (visibly reorders same-time/no-time events; timed events snap back to time order); no leftover "By time"/"Manual" UI.

### ODY-047 · Cover "skin" doesn't carry to the itinerary page — S, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** The cover look you pick when creating a trip shows on the dashboard card but the itinerary page ignores it and always goes purple. This makes the itinerary match your pick.
`coverIndex` is stored as `"grad:<index>"` in `Trip.coverImageUrl` (`createTripWizard`
in `src/app/trips/actions.ts`) and resolved via `resolveCover`
(`src/components/trips/cover.ts`), but only `DashboardClient`/`TripCard` consume it —
`ItineraryHero` never reads the cover, so it falls back to the default `.hero` styling.
- Pass `coverImageUrl` (+ trip id as seed) into `src/components/itinerary/ItineraryHero.tsx` from `src/app/trips/[tripId]/itinerary/page.tsx`; call `resolveCover(coverImageUrl, tripId)` and apply it via the existing `cover-art` pattern (`style={{ "--cover-img": ... }}` consumed by a globals.css class — the sanctioned dynamic-value exception). Reuse `COVER_ACCENT` like the wizard preview.
- If `TripEditModal` (`src/components/trips/TripEditModal.tsx`) can't already change the cover mood, add the same `COVER_GRADIENTS` picker used in `NewTripWizard` and persist via the update action.
- Guardrails: no hardcoded hex outside globals.css; keep text contrast readable over the gradient.
- Acceptance: the cover mood chosen at creation (and edited later) appears on the itinerary page, matching the dashboard card — no purple default.

### ODY-020 · Landing page honesty pass — S, haiku — ✅ DONE (2026-08-09)
> **Completed across two passes.** ODY-108 F01 (2026-08-09) removed the fabricated "Loved by 4,200 travelers" count, the five-star row, and the invented "Maya R." testimonial + their CSS. This pass finished it: dropped the "Free for solo trips" pricing implication (the app has no payment system, so it implied paid tiers that don't exist) — replaced with a true, non-metric brand line ("Built for every kind of trip — solo, group, spur-of-the-moment."); and removed the dead `href="#"` footer links (Privacy/Terms/Support) + their now-unused CSS. **Note for launch:** real Privacy/Terms pages should exist before a public launch (the app collects auth + trip data) — removed here only because broken links are worse than absent ones; re-add as real pages when written. Layout rhythm/type scale unchanged (copy swap + deletion, no redesign). No invented metrics/testimonials/pricing remain anywhere public. tsc / tests / build clean.
> **In plain terms:** The landing page currently invents things — fake user counts, a fake testimonial, fake pricing. This replaces them with honest copy in the same voice.
The landing claims "Loved by 4,200 travelers", a five-star row, a named testimonial
("Maya R.") and "Free for solo trips" pricing — all fabricated. Footer Privacy/Terms/
Support links are `href="#"`.
- Replace social proof with true brand statements in the same editorial voice (e.g. "Built for the long way around" motifs); remove fake rating/testimonial or clearly reframe as illustrative; drop pricing implication; footer links either go to real stub pages or are removed.
- Keep layout rhythm and type scale identical — copy swap, not redesign.
- Acceptance: no invented metrics/testimonials/pricing anywhere public.

### ODY-021 · Mobile responsiveness sweep — L, sonnet — ✅ DONE (PR #23)
> **In plain terms:** Beyond the big items in ODY-038, lots of screens simply don't fit a phone. This is the sweep that makes every page work at phone width.
Fixed paddings (`48px` gutters on landing), the workspace sidebar, availability grid,
and budget split rows were designed desktop-first. Audit at 375px/768px.
- Landing: collapse nav, scale hero type (already `clamp`), tighten gutters. Trip workspace: sidebar → collapsible sheet (a `sheet.tsx` primitive already exists in `src/components/ui/`). Tables/grids scroll within their container.
- Acceptance: no horizontal page scroll at 375px on landing, dashboard, itinerary, budget, schedule; touch targets ≥ 40px.

### ODY-022 · Accessibility pass — M, sonnet — 🟡 PARTIAL (2026-08-09)
> **Shipped (keyboard + screen-reader wins, all zero-visual-risk):** the two collapse toggles that were `<header onClick>` — budget `.cat-head` (`BudgetClient.tsx`) and itinerary `.day-head` (`DayBlock.tsx`) — are now keyboard-operable: `role="button"`, `tabIndex`, `aria-expanded`, an `aria-label` naming state, and Enter/Space handlers, plus a `:focus-visible` ring (`--peri`) on each. (Used role+tabindex rather than a real `<button>` because `.cat-head` wraps an `<h2>`, which is invalid inside a button; the day header matched for consistency.) `LocationAutocomplete` gained the missing combobox wiring — input `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-autocomplete`/`aria-activedescendant`, listbox `id`, per-option `id`s — so a screen reader now announces the expanded state and the active suggestion (the `role="listbox"`/`role="option"`/`aria-selected` half already existed). tsc / eslint / 199 tests / build clean.
> **Not done — needs a browser this cloud session doesn't have:** the axe pass on the 5 main routes (can't run headless-audit tooling here), and the "color-only category coding in the budget bar" reinforcement (a visual judgment best made against a rendered page — the adjacent category-breakdown list already labels each color in text, so it may already be sufficient; verify with a real audit). Left open at 🟡 so the axe sweep + color check happen in a session that can render.
> **In plain terms:** People using a keyboard or a screen reader currently can't operate parts of the app. This makes it work for them — and it's also just better engineering.
Findings: `cat-head` collapse toggles are `<header onClick>` (no keyboard/role),
emoji icons unlabeled in places, autocomplete listbox lacks `aria-activedescendant`/
input `role="combobox"`, color-only category coding in the budget bar.
- Convert clickable non-buttons to `<button>` with `aria-expanded`; complete combobox ARIA in `LocationAutocomplete`; add text/pattern reinforcement where color is the only signal; run an axe pass on main routes.
- Acceptance: keyboard-only operation of itinerary collapse, budget categories, autocomplete; no serious axe violations on the 5 main routes.

### ODY-118 · Accessibility audit → remediation — M, sonnet — 🟡 IN PROGRESS (8 of 11 done)
> **Fixed (2026-08-19), aesthetic untouched — F1, F3, F4, F6, F7, F8, F9, F11.** F1: shared `Modal` now traps/returns focus (covers every dialog). F3: trip-card menu is keyboard-operable (focus-in, Escape returns focus, honest button semantics). F4: reduced-motion stills the badge pulse + `Globe3D` idle spin. F6: packing add-input `aria-label`. F7: error toasts announce assertively (split live regions). F8: decorative globe `aria-hidden`. F9: skip-to-content link + `<main>` landmarks on trip + dashboard. F11 (color-blindness): map type reads as **icon + label** in the list and in pin tooltips, `TYPE_HEX`/numbered pins unchanged. All behavior/opt-in — no visual change for normal users.
> **Remaining (both need a rendered browser — bundled for one session):** F2 focus-visible rings on the *seamless inline note editors* (a visual-taste judgment, not guessed blind) and F10 the automated **axe** sweep + contrast measurement on the 5 main routes. tsc / eslint / 244 tests / build clean.
> **Full static a11y sweep done (2026-08-19); fixes are the open work.** A code-level pass over all 88 components/routes + `globals.css` is written up in **`docs/ody-118-accessibility-audit.md`** with 10 ranked findings (P0–P3), each with file + fix. Baseline is already solid (`lang`, `<nav aria-label>`+`aria-current` on both navs, combobox ARIA, keyboard disclosures, toast live region, error `role="alert"`, no unlabelled images). The gaps, in fix order:
> - **P0 F1** — the shared desktop `Modal` has no focus management (no focus-in, no Tab trap, no focus-return). One change fixes *every* dialog (Add/Edit event, Trip edit, Duplicate, Copy day, Expense, Apply-window).
> - **P1 F2** — several focusable controls set `outline: none` with only a background change on focus; add `:focus-visible` rings.
> - **P1 F3** — the new trip-card "⋯" menu isn't keyboard-operable (no Escape/arrow-key/focus-move); swap to the base-ui `DropdownMenu` primitive.
> - **P2 F4/F8** — incomplete `prefers-reduced-motion` coverage (badge pulse, globe auto-spin); F6 packing add-input needs `aria-label`; F7 error toasts should be assertive.
> - **P3 F9** — no skip-to-content link; dashboard/auth/onboarding lack a `<main>` landmark.
> - **F11 (color-blindness)** — color coding is already mostly paired with an icon/label/number; the only color-only-at-a-glance signals are map pin *type* and collection-marker category. Fix adds the (already-designed) type icon inside the pin as a second channel — `TYPE_HEX` palette unchanged.
> - **F10** — contrast measurement + automated **axe** sweep on the 5 main routes still needs a browser (shares the ODY-022 browser half).
>
> **Aesthetic guarantee:** every fix is additive (a second channel or a behavior), not a repaint — no color value, font, spacing token, or theme changes. F2 focus rings show only on `:focus-visible` (keyboard), reusing the existing `--peri` ring; F4 reduced-motion only affects users who set the OS preference; F11 keeps `TYPE_HEX` exactly and just adds the type icon to the pin.
> **In plain terms:** We combed the whole app for accessibility problems and wrote them all down with fixes. Most are low-risk, shared-component changes — one `Modal` fix alone repairs keyboard focus for every popup.
- Deliverable (this pass): `docs/ody-118-accessibility-audit.md`. Remediation: work the fix order top-down; each item is small and independently shippable.
- Acceptance: P0–P2 findings fixed with QA green; the axe/contrast items (F10) handed to a browser-capable session and closed against ODY-022.

### ODY-023 · Weather banner beyond 3 days / graceful absence — S, haiku — ✅ DONE (2026-08-09)
> **Shipped.** `fetchWeather` now takes the trip end date too and clamps its request to `[today, today+15] ∩ trip range`. Extracted the pure date math into `planWeatherWindow(start, end, now)` (testable without the network — the pattern used by `scheduleWindow`): returns `{ unavailable: true }` when the trip is fully past or starts beyond the 15-day forecast horizon, else the clamped `{ startStr, endStr }`. In-progress trips now request from **today** (fixes the old "mid-trip still shows the start date's weather" bug), not the start date. `fetchWeather` returns a `WeatherResult` union (`WeatherData | { unavailable: true } | null`); `ItineraryHero` renders a quiet italic placeholder — "Forecast opens closer to departure" (`.hero-weather-soft`) — for the unavailable case instead of the row collapsing to nothing. 6 new unit tests cover past / far-future / near-future / in-progress / horizon-edge-clamp / ends-today. tsc / eslint / 199 tests / build clean.
> **In plain terms:** The weather banner silently vanishes for past trips or trips far in the future. This makes it always show something sensible.
`fetchWeather` (`src/components/shared/WeatherBanner.tsx:63`) requests `startDate`
→ +2 days from the *forecast* API: past trips and trips >16 days out silently render
nothing, and mid-trip it still shows the start date's weather.
- Clamp the request window to [today, today+15] ∩ trip range; if trip is outside the forecast horizon, show a quiet seasonal placeholder line instead of vanishing ("Forecast opens closer to departure"). °F stays default; optional: unit by locale.
- Acceptance: banner renders something sensible for past, current, near-future, and far-future trips.

### ODY-024 · Money formatting & currency field — M, sonnet — ✅ DONE (⚠️ needs `prisma db push`)
> **In plain terms:** Enter $12.50 and the app shows $13 — cents are hidden and rounding drifts. This shows exact amounts and lets a trip choose its currency symbol.
Amounts are `Float` in Prisma and `fmtMoney` rounds to whole dollars — cents are
entered but silently hidden, and floats accumulate drift.
- Display cents when present (`Intl.NumberFormat`), keep JetBrains Mono for figures. Schema: add `currency String @default("USD")` on Trip (db push per Supabase workflow — no migrations dir); format with the trip currency across budget/itinerary. (Full multi-currency conversion is out of scope.)
- Acceptance: $1,234.56 round-trips intact everywhere; trips can set a currency symbol that all money UI respects.
> **Amended by the ODY-111 audit (2026-08-09).** This is now the single highest-value money ticket, and it has one more job: there is no shared money formatter to fix — `fmtMoney` is copy-pasted verbatim into `BudgetClient.tsx:67`, `TripCard.tsx:20` and `DashboardClient.tsx:13`, while a correct `formatCurrency` sits unused in *both* `src/lib/utils.ts:48` and `src/lib/utils/index.ts:28` (dupe overlaps ODY-064). Land one formatter, cents-honest and trip-currency-aware, and delete the three copies. Worked example of the current bug: a $30.50 settle-up is stored correctly as `3050` cents and displayed as "$31" in both the settle-up row and settled history. Scope stays stage 1 — trip base currency only; per-expense foreign currency + stored FX rate is explicitly deferred (ODY-111 gap #1).
> **Shipped (2026-08-09).** One canonical formatter now exists — `formatMoney(amount, currency)` in **`src/lib/money.ts`** (8 unit tests in `money.test.ts`). It's cents-honest by design: whole amounts stay clean (`$13`, `$1,240`) while fractional ones keep their cents (`$12.50`, `$1,234.56`), via `Intl.NumberFormat` with `minimumFractionDigits: isWhole ? 0 : 2`. Zero-decimal currencies (JPY, KRW) fall through to their natural precision, and an unknown code degrades to USD formatting rather than blanking the UI. The three copy-pasted `fmtMoney` funcs are deleted; both dead `formatCurrency` copies (`utils.ts` / `utils/index.ts`) are removed too (the rest of that two-file dupe stays for ODY-064). **Currency reaches every money surface** — the audit named 3, but wiring turned up **5**: dashboard `TripCard` + `LiveCard`, `BudgetClient` (all ~15 figures, incl. the settle-up rows that showed the `$31` bug), itinerary `EventBlock` cost, and the map's selected-event cost card (`MapClient`) — the last two threaded via the same prop path `timeFormat` already uses (page → `DayBlock`/`MapClient` → `EventBlock`). New `currency String @default("USD")` on Trip (ISO 4217); a 12-currency picker (`TRIP_CURRENCIES`) added to `TripEditModal`, validated by `updateTripSchema` (`/^[A-Z]{3}$/`, a format check not a hardcoded enum so the list can grow) and persisted through the existing `updateTrip` action (flows in via `...tripFields`, no action rewrite). Per-expense FX stays deferred as planned. **Deliberately left:** `ExpenseModal`'s exact-split "remaining to allocate" helper stays a bare number — it sits next to bare-number dollar inputs, so a lone currency symbol there would read as inconsistent, not better. The new-trip wizard doesn't ask for currency (defaults USD, changed in trip settings) to keep the wizard short. tsc / eslint / **179 tests** / build all clean.
> **⚠️ DEPLOY STEP REQUIRED:** run **`npx prisma db push`** against Supabase before this code serves traffic. Prisma selects all scalar columns, so every Trip query references `currency` — without the column, trip pages 500. The change is additive and safe: the `@default("USD")` backfills all existing rows automatically, no data migration. Do the push first, then deploy the code.

### ODY-025 · Optimistic UI for reorder & quick edits — M, sonnet — ✅ DONE (verified in code 2026-08-09)
> **Premise was stale — already satisfied by later tickets; verified, not re-implemented.** All three surfaces named here now settle locally *before* the server round-trip and revert with a toast on failure:
> - **Event reorder** — `DayBlock.tsx` `handleDragEnd`: `setEvents(reordered)` runs immediately, then `await reorderEvents(...)`; on catch it `setEvents(previous)` + toasts. Optimistic already.
> - **Day notes** — `DayNotes.tsx` `save()`: local `value` updates on every keystroke, blur-saves inside `startTransition`, and reverts the `lastSaved` ref + toasts on failure. Never blocks on the server.
> - **Budget amount & split weights** — `BudgetClient.tsx`: `budgetVal` (onChange) and `weights` (onChange) update instantly; the server save runs on blur/click and reverts + toasts on failure.
> The ODY-013 revert-toast pattern, ODY-057 form reconciliation, and ODY-101/103 all landed this incrementally, so the original "waits on the server before settling" no longer holds anywhere. No code shipped. (Minor, out of scope: after saving a *new trip budget*, the derived hero figures — remaining / per-person — refresh on revalidation rather than instantly, since they read the `totalBudget` prop, not `budgetVal`; the input itself is instant. Not a lag the ticket was about.)
> **In plain terms:** Dragging events feels laggy because the app waits for the server before settling. This makes it feel instant, quietly undoing only if the server disagrees.
Drag-reorder waits on the server round-trip (`reorderEvents`) before settling; day
notes and budget edits similarly lag.
- Use `useOptimistic`/local state reconciliation for event reorder and day-note saves; revert with a toast (ODY-013) on failure.
- Acceptance: drag drops feel instant; server disagreement reverts visibly.

### ODY-026 · SEO & metadata polish — S, haiku — ✅ DONE (2026-08-09)
> **Shipped.** Root `layout.tsx` now sets `metadataBase` (explicit `NEXT_PUBLIC_SITE_URL` → Vercel production domain → localhost fallback, so OG image paths resolve to absolute URLs), a title template (`"%s — Odyssey"`), a brand-voice default title + description, and full `openGraph` + `twitter` (`summary_large_image`) cards pointing at `public/landing.png` (1280×800, the real on-brand app screenshot). Per-route titles: trip layout gains a lightweight title-only `generateMetadata` → "Tokyo — Odyssey" on every trip tab (auth-free by design — a title behind a UUID isn't sensitive and page content stays gated, so metadata never throws); dashboard exports `title: "Your trips"` → "Your trips — Odyssey". Favicon already present (`src/app/favicon.ico`, Next auto-serves). **Optional follow-up:** set `NEXT_PUBLIC_SITE_URL` to the real custom domain if/when one exists (otherwise Vercel's project URL is used); a purpose-designed 1200×630 OG image would be marginally sharper than the screenshot but the ticket accepts a static PNG. tsc / eslint / 193 tests / build clean.
> **In plain terms:** Shared links show a generic preview and every browser tab says the same thing. This adds real page titles and a branded link-preview card.
Only default metadata; no OG image, no per-route titles.
- `metadata` exports: landing (brand tagline), dashboard/trip routes (`"Trip title — Odyssey"` via `generateMetadata`), OG image in brand palette (static PNG is fine), proper favicon set from the brand mark.
- Acceptance: link unfurls show brand card; tab titles are contextual.

### ODY-039 · Event notes as bullet points — S, haiku — ✅ DONE (PR #17)
> **In plain terms:** Notes typed on multiple lines displayed as one unreadable run-on line. Now dashes become real bullet points and line breaks are respected.
Event notes render as one flat span (`src/components/itinerary/EventBlock.tsx`,
`.event-notes`), so multi-item notes ("bring passport, check in online, gate
closes 30 min early") read as an unscannable run-on line; newlines typed in the
notes textarea (`AddEventModal`) are collapsed on display.
- Display-only transform (storage stays the plain string, no schema change, no new editor): split notes on newlines; lines starting with `-` or `*` render as a real `<ul>` bullet list, plain lines as separate paragraphs.
- Optional nicety: small prose ⇄ bullets toggle on the event card; default to auto-detect.
- Keep XSS discipline: render text nodes only — no HTML parsing of note content.
- Acceptance: a note typed with newlines/dashes shows as readable bullets on the itinerary card; single-line notes look unchanged; day notes and trip notes unaffected.


### ODY-040 · Collapsible event notes — S, haiku — ✅ DONE (PR #20)
> **In plain terms:** Bullet notes read great (ODY-039), but a day full of long notes makes the itinerary a wall of text. Long notes now start folded to their first line with a "Show note" link, so the page stays scannable.
Follow-up to ODY-039. Any note with multiple lines (or a single line over ~140
characters) collapses to a one-line preview with a small periwinkle toggle
("Show note · 4 lines" / "Show less"). Short notes render exactly as before.
- Display-only; per-card local state, no schema change, no persistence.
- Acceptance: long notes collapsed by default; toggle expands/collapses; short notes unaffected.

### ODY-041 · 12-hour / 24-hour time display toggle — S, haiku — ✅ DONE (PR #21)
> **In plain terms:** Event times currently show only in military time (14:30). This adds a setting so a trip can show friendly 2:30 PM times instead — whichever the crew prefers.
Event `startTime`/`endTime` come from `<input type="time">` as "HH:MM" strings and
are displayed raw, so everything reads as military time.
- Storage stays "HH:MM" (unchanged). Add a `timeFormat` preference — simplest: `String @default("12h")` on Trip (db push per Supabase workflow), toggled from the trip edit modal; no localStorage (forbidden by CLAUDE.md).
- Add `formatTime(hhmm, format)` in `src/lib/utils.ts` (unit-test it) and use it everywhere times render: `EventBlock`, map selected-event card, print view when it exists.
- Time *inputs* may stay native (`<input type="time">` renders per browser locale) — this ticket is about display.
- Acceptance: toggling the trip preference flips every displayed time between 2:30 PM and 14:30; stored values unchanged; new util unit-tested.

### ODY-059 · Mobile nav for 7+ trip tabs — M, sonnet — ✅ DONE
> **In plain terms:** The phone bottom bar now has too many tabs (Explore, Collections, …) so labels crush. Keep the four tabs people use every day on the bottom bar and tuck the rest behind a hamburger menu.
After Explore/Collections shipped, `NAV_ITEMS` has 7 destinations; `.mobile-tab-bar` squeezes labels (~50px each) — confirmed cramped on-device (2026-07-27 screenshot, all 7 items visible and tight at 375px).
- **Decision:** bottom tab bar keeps exactly 4 core destinations — Itinerary, Map, Collections, Budget. Everything else (Schedule, Explore, Members) moves into a hamburger-icon drawer/sheet nav triggered from the top-right of the trip header.
> Shipped: `NAV_ITEMS` in `navItems.ts` gained a `core` flag, exported as `CORE_NAV_ITEMS`/`MORE_NAV_ITEMS`; `MobileTabBar` now renders only the 4 core items. New `MobileNavDrawer.tsx` renders a right-side `Sheet` (reusing `.nav`/`.nav a` styling from the sidebar) triggered by a new hamburger icon (`Icons.menu`) in `MobileTripHeader`'s top-right, listing Schedule/Explore/Members; closes on link click. Verified with Playwright at 375×812 — bottom bar shows exactly 4 uncrushed tabs, drawer opens with all 3 overflow items reachable.
- Acceptance: bottom bar shows only Itinerary/Map/Collections/Budget at 375px with no crushed labels; Schedule/Explore/Members are reachable in ≤2 taps via the top-right hamburger drawer; all 7 destinations remain reachable somewhere.

### ODY-100 · Itinerary hero: weather/length/location row cramped on mobile — S, haiku — ✅ DONE
> **In plain terms:** The trip title card's weather, trip-length, and destination line look off-center and crowd together on a phone.
`ItineraryHero.tsx:82-98`'s `.hero-row` (`display:flex; gap:18px; flex-wrap:wrap; font-size:13px`) relies purely on default flex-wrap with no dedicated small-screen breakpoint — the only hero-specific mobile rule is `.hero-title { font-size: 32px }` at `@media (max-width: 768px)` (`globals.css:1011`). There's no `<500px` rule for `.hero-row`/its children, so at phone width the wrapped items read off-center/uneven rather than a deliberate stacked layout. Confirmed on-device 2026-07-27 screenshot.
> Shipped: added `@media (max-width: 500px) { .hero-row { flex-direction: column; align-items: flex-start; gap: 8px; } .hero-row .dot { display: none; } }` — stacks the weather pill, "N days", "N planned events", and pinned destination into an evenly-spaced left-aligned column instead of wrapping mid-row with orphaned `·` separators. Verified with Playwright at 375px. No changes above 500px.
- Acceptance: at 375px the hero's weather/length/location line reads left-aligned and evenly spaced with no visually off-center wrapping; desktop/tablet unchanged.

### ODY-101 · Cap mobile day view to 5 events + "show more"; confirm day collapse works on mobile — S, haiku — ✅ DONE
> **In plain terms:** A busy day can list a dozen events, which turns into a long scroll on a phone. Show the first 5 on mobile with a "Show N more" toggle to reveal the rest, and make sure tapping a day header to collapse/expand it works on mobile too.
`DayBlock.tsx` renders every event in `displayedEvents` with no cap, so a dense day is a long uninterrupted scroll on a 375px screen. Desktop is fine (more vertical room, less scroll fatigue) — this is mobile-only, using the existing `useIsMobile()` hook (`src/lib/hooks/useIsMobile.ts`, 768px breakpoint, same one `Modal.tsx` uses).
> Shipped: `DayBlock` now slices to `displayedEvents.slice(0, 5)` on mobile (`isMobile && !showAllMobile`), with a `.day-more-toggle` "Show N more events" / "Show less" button (periwinkle, `.notes-toggle`-style). Drag-and-drop reorders within the visible slice only; hidden events keep their relative order and get renumbered into the final `orderIndex` alongside the visible ones. Day collapse (`.day-head` onClick) was already unconditional in the code and confirmed working correctly on mobile with Playwright — no fix needed there, just verification. Desktop/tablet always renders every event (no cap). Verified with Playwright at 375×900: 8-event day shows 5 + "Show 3 more events" → expands to 8 + "Show less" → re-collapses to 5; day-head tap toggles the `collapsed` class.
- Acceptance: on a day with >5 events at 375px, only 5 show plus a "Show N more" toggle that reveals the rest; desktop is unaffected (all events always shown); tapping a day header on mobile collapses/expands it.

### ODY-103 · Fix ODY-101 regression: "Show less" / "Add event" clipped after expanding a busy day on mobile — S, haiku — ✅ DONE
> **In plain terms:** Yesterday's "show more" fix has a bug: tap "show more" on a day with lots of events and the extra events appear, but the "Show less" toggle (and the "Add event" button) never show up — they're just gone, cut off before the next day starts. Confirmed on-device (screenshot, 2026-07-28): Day 03 shows its 6th event ("Sweet Treat") fully expanded, then jumps straight to Day 04's header with no "Show less" or "Add event to Day 3" in between.
**Root cause:** `.day-body`'s open/close animation (`DayBlock.tsx`'s `useLayoutEffect`, `globals.css:570` `overflow: hidden`) sets `max-height: <scrollHeight>px` on open, then 360ms later locks it to a **hardcoded `max-height: 3000px`** as a resting value (needed as a concrete number so the *collapse* transition has something to animate from). Mobile event cards are much taller than desktop — addresses alone wrap to 4–6 lines at 375px (see screenshot: one event card is ~breaking 600–700px tall) — so a day with several verbose events (notes + 6+ events) can genuinely exceed 3000px of real content height. Anything past that mark is silently clipped by `overflow: hidden`, which now includes the ODY-101 "Show less" toggle and the "Add event" row since they render *after* the event list. This ceiling likely predates ODY-101 (any sufficiently tall day was always at risk) but ODY-101's expand action is what reliably pushes real content past it.
> Shipped: settling-open value changed from the hardcoded `3000px` to `max-height: none` (no ceiling once expanded). Preserved the smooth *collapsing* animation by seeding a concrete `scrollHeight`px starting value first, then flipping to `0px` on the next `requestAnimationFrame` (a `none → 0` transition doesn't animate since `none` isn't interpolable). Verified with Playwright/an 8-event mock day with long addresses+notes: `.day-body.scrollHeight` reached 5854px (well past the old 3000px cap) after expanding, computed `max-height` correctly read `none`, and both "Show less" and "Add event to Day N" rendered and were visible before the next day's header — reproducing the exact screenshot layout with the fix applied.
- Acceptance: a day with enough content to exceed the old 3000px cap (many events and/or long addresses/notes) on mobile fully shows every event, the "Show less" toggle, and "Add event to Day N" after expanding — nothing after the event list is ever clipped; day collapse/expand animation still looks smooth in both directions.

### ODY-102 · Trip notes card unusable on mobile: tiny scroll box, not collapsible — S, haiku — ✅ DONE
> **In plain terms:** The pinned trip notes box is a fixed-height mini window on mobile — anything past 2-3 lines requires scrolling *inside* a tiny box to read, which is fiddly on a phone. Make the card grow to fit the note (no inner scroll), and let people collapse the whole card out of the way. Confirmed on-device video (2026-07-28): a multi-sentence note only shows its first ~2 lines in a fixed box with an internal scrollbar; scrolling inside reveals the rest but nothing on the page grows.
`TripNotes.tsx`'s `<textarea className="notes-editor" rows={2} ...>` is a fixed-`rows` textarea with no auto-grow; `.notes-editor` (`globals.css:444`) has no `resize`/height logic beyond `min-height: 48px`, so any note longer than ~2 lines scrolls internally inside the small box instead of the card growing. There's also no way to collapse the card at all today.
> Shipped: textarea auto-grows via a `useLayoutEffect` that resets then re-measures `scrollHeight` on every keystroke (plus `overflow-y: hidden` to avoid a scrollbar flash). `.notes-head` is now a real `<button>` (keyboard/a11y correct, not a styled div) toggling a `collapsed` state that conditionally renders the textarea, with a rotating `Icons.chevron`; default expanded, unchanged from before. Deliberately used simple conditional rendering rather than `DayBlock`'s fixed-max-height animation trick, since that exact pattern is what caused ODY-103. Verified with Playwright: a 4-sentence note's `scrollHeight === clientHeight` (256 = 256, zero internal scroll) with the full note visible; collapse/expand toggling correctly mounts/unmounts the textarea.
- Acceptance: a long trip note grows the card to fit (no internal scrollbar) on mobile and desktop; a chevron collapses/expands the whole notes card; autosave still fires on blur; short notes look unchanged.
- **Follow-up idea (not in this ticket, filed as ODY-104):** named, individually-collapsible "shared notes" sections (groceries, packing, etc.) living under the pinned trip notes.

### ODY-104 · Shared notes sections (Important Reminders, Packing List, To Do, etc.) under trip notes — M, sonnet (P3, follow-up to ODY-102) — ✅ DONE
> **In plain terms:** Beyond the one freeform pinned note, let a trip have named, collapsible mini-lists — starting with "Important Reminders," "Packing List," and "To Do" — living under the main trip notes. Each section's heading is editable, and the group can add or remove sections as needed.
> Shipped exactly as scoped: `sections` added to the canonical `Note.content` shape (`src/lib/tripNotes.ts`) with `defaultNoteSections()`, `applySectionsPatch`, and `normalizeSections` (drops malformed entries, caps at `NOTE_SECTIONS_MAX`). `upsertNote` now reads the existing row before saving a `{ text }`/`{ doc }` patch so it can carry the current `sections` through instead of dropping them (and vice versa for a `{ sections }` patch). New `NoteSection.tsx` renders each section (editable title input, auto-grow textarea reusing ODY-102's technique, per-section collapse chevron, remove button); `TripNotes.tsx` seeds the 3 named defaults when a trip has none, autosaves on blur, and saves immediately on add/remove. 7 new unit tests in `tripNotes.test.ts` cover the patch-merge behavior, normalization, and Zod caps. Verified with Playwright: default titles render correctly, title editing and 10-line auto-grow both work (scrollHeight === clientHeight), per-section collapse is independent (1 collapsed, 2 still expanded), add/remove both update the count correctly, and `readOnly` hides add/remove and disables all inputs.
Raised alongside ODY-102 as a "maybe duo task" — bigger in scope (new named sections, each independently collapsible) than the mobile-friendliness fix, so split out rather than bundled.
- Data shape: extend the existing canonical `Note.content` (`src/lib/tripNotes.ts`, `{ v:1, text, doc, sections }`) rather than a new Prisma model — sections don't need independent ownership/permissions or their own row-level access, and this avoids a schema change/Supabase-unpause coordination. `sections: { id, title, text }[]`, always present (default `[]`) in the canonical shape.
- Server: `upsertNote`'s patch union gains a `{ sections }` variant; **must read existing `Note.content` first and merge** — the `{ text }`/`{ doc }` patch paths already fully rebuild `content` from scratch (ODY-051's `applyPlainPatch`/`applyRichPatch`), so without merging, autosaving the main note would silently wipe out sections and vice versa. Zod-cap section count (e.g. 20) and title length; the existing aggregate `NOTE_JSON_MAX` payload-size guard (ODY-056) already bounds total size.
- UI (`TripNotes.tsx` + new section subcomponent): sections render under the pinned note, seeded with 3 named defaults ("Important Reminders", "Packing List", "To Do") when a trip has none yet. Each section: editable title (styled input, not a separate rename mode), auto-grow textarea (reuse ODY-102's technique — explicitly *not* `DayBlock`'s fixed-max-height collapse trick, that caused ODY-103), its own collapse chevron (local/ephemeral state, not persisted — matches existing collapse patterns in the app), and a remove control. "Add section" affordance appends a new blank section. Autosave on blur (title or text) and immediately on add/remove (discrete actions, not continuous typing).
- Pairs with ODY-051 (canonical Note.content shape, already shipped) and ODY-060 (Notes IA) — this must not create a third notes-writing surface; the TipTap `/notes` route is untouched by this ticket.
- Guardrails: editor+ to add/edit/remove sections, viewers read-only (ODY-001); no new deps; editorial aesthetic; no inline styles/hardcoded hex.
- Acceptance: a trip's notes show 3 default named sections if none exist yet; each section's title is editable, its body auto-grows with no internal scroll, and it collapses independently; sections can be added and removed; editing the main pinned note never drops sections and vice versa; viewers see sections read-only.

### ODY-105 · Bullet points & interactive checklists in trip/section notes — M, sonnet (follow-up to ODY-104) — ✅ DONE
> **In plain terms:** "Packing List" and "To Do" sections (and the main pinned note) are just plain paragraphs right now. Let people type a bullet or checklist line and get a real, tappable checkbox instead of a wall of text.
> Shipped exactly as scoped, plus precise cursor placement: new `src/lib/checklist.ts` (`parseChecklistLines`, `toggleChecklistLine`, `appendChecklistItem`, `lineEndOffset`) and shared `ChecklistText.tsx` render both surfaces' blurred/idle view — checkboxes for `- [ ]`/`- [x]` lines, bullets for `- `/`* `, plain paragraphs otherwise. Both `TripNotes` and `NoteSection` gained an edit/view toggle: blurred shows `ChecklistText`, focused (via clicking a line, or "+ Add item") shows the raw auto-grow textarea with the caret placed at the exact clicked line's end (`lineEndOffset`). Checkbox taps toggle + autosave immediately without ever entering edit mode, via a `saveSectionTextNow`/`saveText` path that bypasses the stale-closure risk of computing-then-reading-back state. 12 new unit tests (134/134 passing). Verified with Playwright: checkbox states render correctly, toggling doesn't open the textarea, clicking a line's text opens the textarea with the caret at the exact right offset, "+ Add item" appends and focuses correctly, and `readOnly` disables every checkbox/line-button and hides all "Add item" controls.
Both `TripNotes`' pinned textarea and `NoteSection`'s per-section textarea are plain multi-line text with no structure. Checklists are the obvious fit for "Packing List"/"To Do" — this is the natural next step after ODY-104.
- **Syntax (reuse ODY-039's established convention):** a line starting with `- ` or `* ` renders as a bullet; `- [ ] ` / `- [x] ` (or `* [ ]` / `* [x]`) renders as an interactive checkbox item. Storage stays plain text (no schema change) — the checkbox state lives in the `[ ]`/`[x]` marker itself, same string field already in `Note.content`.
- **Interaction model:** blurred/idle state renders the parsed list (checkboxes + bullets + plain lines); tapping a checkbox toggles that one line's marker and autosaves immediately, **without** entering edit mode (checking off "milk" shouldn't require opening a text editor). Tapping the line's text (not the checkbox) focuses the raw textarea at that point so wording can be edited; on blur, re-render the parsed view.
- **Adding items easily:** don't rely on users knowing the markdown-ish syntax — add a small "+ Add item" quick action (per section, and on the main note) that appends a `- [ ] ` line and focuses the textarea so they can type the item immediately.
- New pure helper module (e.g. `src/lib/checklist.ts`): `parseChecklistLines`, `toggleChecklistLine`, `appendChecklistItem` — unit-test line-parsing edge cases (empty lines, mixed bullet/checkbox/plain, toggling preserves everything else).
- Files: `src/components/itinerary/TripNotes.tsx`, `src/components/itinerary/NoteSection.tsx`, new shared render component (e.g. `ChecklistText.tsx`) so both surfaces share one implementation, `src/lib/checklist.ts`, `globals.css`.
- Guardrails: editor+ can toggle/add/edit; viewers see checkboxes rendered but inert (ODY-001, matches existing read-only handling); no inline styles/hardcoded hex; no new deps.
- Acceptance: typing `- [ ] buy sunscreen` and blurring shows a real checkbox; tapping it checks/unchecks and saves without opening the textarea; a plain `- ` line shows as a bullet; "+ Add item" inserts a new checklist line and focuses it; viewers can see but not toggle checkboxes.

### ODY-060 · One Notes information architecture — S, sonnet — ✅ DONE (2026-08-09)
> **Resolved on UX principle: one discoverable home, no dead parallel system.** Investigation showed it was worse than "two boxes" — the orphaned `/notes` route ran a **TipTap editor writing `note.content.doc`**, while the itinerary's `TripNotes` writes `note.content.sections` (Reminders / Packing List / To Do, with checklists). Two different editors on two different fields of the same record, and `/notes` had **no nav link anywhere** (only in-trip search pointed at it). **Kept the sectioned itinerary notes** — the discoverable, contextual, invested surface (ODY-104 sections, ODY-105 checklists, ODY-067 packing-import handoff) — and **removed the orphaned TipTap route**: deleted `notes/page.tsx`, `notes/loading.tsx`, and `components/notes/TiptapEditor.tsx`. Kept `notes/actions.ts` (its `upsertNote` is the single write path, still used by `TripNotes`) — a folder with only `actions.ts` is a colocated module, not a route. Repointed in-trip search note matches from the dead `/notes` tab to `/itinerary`, and trimmed `upsertNote`'s revalidate to just `/itinerary`. Existing `.doc` data is left untouched in the DB (non-destructive; just no longer surfaced). Result: exactly one notes write path, and it's the good one, per the acceptance criterion. **Optional follow-up:** `@tiptap/*` deps are now unused (tree-shaken from the bundle since nothing imports them) — a future pass could drop them from `package.json`. tsc / eslint / 213 tests / build clean; `/notes` no longer appears in the route manifest.
> **In plain terms:** There's a rich Notes page that never appears in the menu, while the itinerary has a separate notes box. Pick one home for trip notes.
`/trips/[id]/notes` is orphaned from `NAV_ITEMS`; itinerary uses `TripNotes`. Confuses IA and worsens ODY-051.
- Either add Notes to nav (and deprecate/merge itinerary pinned notes) or remove the orphan route and keep one surface.
- Depends on / pairs with ODY-051.
- Acceptance: a traveler can find trip notes without guessing a URL; only one write path remains.

### ODY-061 · loading.tsx for Explore + Collections — S, haiku — ✅ DONE
> **In plain terms:** Switching to Explore or Collections still flashes blank while other tabs show calm skeletons.
- Added branded `loading.tsx` under `explore/` and `collections/` matching other trip tabs.

### ODY-062 · Sign-in `after` redirect parity with sign-up — S, haiku — ✅ DONE
> **In plain terms:** Invite links send people to sign-up with a return path; if they click "sign in" instead, they may not land back on the trip.
- Mirror allowlisted `after` handling on sign-in (`forceRedirectUrl` + `signUpForceRedirectUrl`).
- Acceptance: `/sign-in?after=/trips/...` returns to that trip after auth (same rules as sign-up; no open redirect).

### ODY-063 · Dashboard mobile empty state + ⌘K honesty — S, haiku — ✅ DONE
> **In plain terms:** New users on a phone don't get a clear "no trips yet" card, and the search box used to pretend ⌘K works when it doesn't.
- ⌘K chip removed (ODY-092). Mobile zero-trip empty state + CTA added.
- Acceptance: zero-trip mobile state is clear; ⌘K absent.

### ODY-064 · Dead code and utils dedupe — S, haiku — ✅ DONE (2026-08-11)
> **In plain terms:** Leftover unused trip form code and two copies of the same date/money helpers make the house harder to keep tidy.
- Delete or wire unused `TripForm.tsx`; clarify `/trips/new` (redirect-only) in comments or remove if obsolete.
- Deduplicate `@/lib/utils` vs `@/lib/utils/index` (one export path); prefer UTC-aware date helpers from ODY-048.
- Acceptance: no unused TripForm; single utils entry; `tsc`/lint clean.
> **Completed (2026-08-11).** Deleted the unused `TripForm` and duplicate
> `src/lib/utils/index.ts`. `@/lib/utils` continues to resolve to the one
> canonical, UTC-aware helper module; its unused local-date `generateDaysArray`
> was removed as well. `/trips/new` already has a concise redirect comment, so
> no route change was needed.

### ODY-108 · Full UI/UX design audit — every screen, every control, desktop + mobile — L, sonnet — ✅ DONE
> **In plain terms:** The app has been built ticket by ticket over dozens of sessions, each one polishing its own corner. Nobody has recently sat down and looked at the *whole thing* as one product: is every button clean, legible, and pleasant? Does it still feel like the editorial "boarding pass + printed map" brand, or has it drifted into generic AI-generated-app styling? This is that pass — a systematic sweep of every screen at both desktop and 375px, producing a prioritized findings report and child tickets.
Audit-first deliverable (findings report + candidate tickets), like ODY-046 — **not** a giant refactor PR. Small, obviously-safe fixes may ship in the same PR; anything structural becomes its own ticket.
- **Surfaces to cover (every one, both widths):** landing → sign-in/sign-up → onboarding name → dashboard (empty + populated) → New Trip wizard (all 3 steps) → trip overview → itinerary (day blocks, event cards, add/edit modal, notes + sections, first-steps) → map (pins, filters, legend, selected-event card) → collections → explore → budget (summary, categories, expense modal, split card, settle-up, settled history) → schedule (poll setup, availability grid, heatmap, apply confirm) → members/invites → all toasts, sheets, drawers, empty states, loading skeletons and error states.
- **Per surface, judge:** visual hierarchy and whether the eye lands on the right thing first; type scale, line length and contrast (DM Serif Display / DM Sans / JetBrains Mono used with intent, not at random); spacing rhythm and alignment; whether the control's affordance matches its importance (primary vs ghost vs icon-only); touch-target size ≥40px (the standard set in ODY-021/107); horizontal overflow at 375px; motion/transition consistency; **and the "does this look AI-generated?" test** — generic card-grid sameness, emoji-as-iconography, gradient-for-its-own-sake, over-rounded everything, filler microcopy.
- **Brand fidelity check:** every screen against the original creative direction (README creative direction section, `PRD/Odyssey-MVP-PRD.md`, and the `--peri/--teal/--coral/--peach/--gold/--slate` + `--ink`/`--paper` token system). Flag any surface that reads as a generic SaaS dashboard rather than a calm editorial travel journal, and any color used outside its documented semantic role (see Event Type Colors in `CLAUDE.md`).
- **Known seeds to fold in (found during the 2026-08-08 audit, don't re-discover them):**
  - `LeaveTripButton.tsx:14` and `MemberActions.tsx:31` still use raw `window.confirm()` for destructive actions, while the schedule apply-window flow was upgraded to the branded `Modal` in ODY-090. Two destructive flows drop out of the design system entirely — inconsistent and off-brand.
  - `globals.css` is 3,327 lines with layered `z-index` values from `-1` to `1400` assigned ad hoc across ODY-058 and later tickets; audit for a documented stacking order rather than more one-off numbers.
  - `AvailabilityGrid`/`AvailabilityHeatmap` still mix raw Tailwind utility classes (`w-full`, `text-xs`, `inline-flex`) with the globals.css class system, unlike the rest of the app — a visible inconsistency in how the schedule tab is built (see ODY-109).
  - Money renders through `fmtMoney` with a hardcoded `currency: "USD"` (`src/lib/utils/index.ts:31`) — see ODY-024 / ODY-111.
- Deliverable: `docs/ody-108-design-audit.md` — prioritized P0–P3 findings, each with screen, width, screenshot/repro, suspected file, and a proposed fix; cross-referenced against open tickets (ODY-020/022/023/024/026/060/096/097) so nothing is filed twice.
- Guardrails: audit only, no redesign-by-stealth; no new dependencies; any fix that does ship must use existing tokens and add no hardcoded hex outside globals.css.
- Acceptance: every surface above has been visited at both widths and has a written verdict (pass or finding); every concrete defect is filed with a file path; the report explicitly answers "does it still match the editorial brand" per screen rather than in general.
> **Shipped (2026-08-09), with one method deviation the deliverable itself explains: this was a code + `globals.css` audit, not a live-browser pass.** This cloud container has no `DATABASE_URL` or Clerk credentials (confirmed — no `.env*` files exist), so authenticated pages can't be rendered here at all, let alone screenshotted at two widths. Same constraint, same adaptation ODY-046 used before it. Full findings: **`docs/ody-108-design-audit.md`**.
> **Headline:** the brand holds up — copy is specific and editorial almost everywhere, not generic filler, and the documented type-color roles stay inside their lanes everywhere checked. Real findings: **(P0)** the landing page fabricates social proof — "★★★★★ · Loved by 4,200 travelers" and an invented "Maya R." testimonial sit directly under a "Now in beta" badge; flagged, not auto-removed, since pulling marketing claims is a content decision, not a mechanical fix. **(P1)** a touch-target regression pattern: `bd32e70` bumped `.btn.sm` to 40px per ODY-021's own standard, but sibling classes doing the same job never got the same pass — `.icon-btn` (28px, backs every modal close button app-wide plus "edit event"/"edit expense") and `.opt-chip` (~30px, backs every category/split-mode/participant chip, including three added this session by ODY-114). **(P2)** token drift — 8 literal `border-radius` values living alongside the documented `--radius-*` scale, a 9-value undocumented `z-index` spread (`-1` to `1400`), and one hardcoded hex outside the Leaflet exception (`AvailabilityHeatmap.tsx:95`) — filed as **ODY-117** rather than bundled in, since 15+ scattered edits deserves its own reviewable diff. **(P2)** the landing page's six feature cards share one repeated bare-circle icon despite the app already having six distinct icons for that exact taxonomy — flagged with the exact fix, not auto-applied, since it changes what visitors see on the highest-traffic page.
> **Shipped in this same PR** (both named safe in the deliverable — CSS-only, token-respecting, mirrors the already-accepted `.btn.sm` precedent): `.icon-btn` bumped 28px → 40px; `.opt-chip` given `min-height: 40px`. tsc / eslint / **191 tests** / build all clean — pure sizing changes, no color/spacing/copy touched, no regressions.
> **Two known seeds from the ticket, already resolved before this audit ran:** money formatting (ODY-024/111/114/115/116, shipped earlier this session) and the schedule tab's raw-Tailwind-vs-`.av-*` inconsistency (ODY-109, shipped 2026-08-08) — confirmed clean, removed from the open list rather than re-flagged.
> **Not yet covered:** ODY-020/022/023/026 fall outside the section this pass prioritized and remain open on their own; nothing in this audit supersedes them.

### ODY-117 · Design-token drift cleanup — border-radius, z-index scale, one hex leak — S, haiku — ✅ DONE (2026-08-11)
> **In plain terms:** The app has a documented set of corner-radius sizes and no documented stacking order for overlays — but several places quietly use their own numbers instead of reaching for what already exists. This finishes the migration onto the token system rather than adding another one-off.
Filed from the ODY-108 audit (findings F04-F06) — three small, mechanical, same-shape fixes grouped into one ticket because bundling 15+ scattered edits into the audit PR itself would have made that diff unreviewable.
- **`border-radius` drift:** `--radius-sm/md/lg/xl` (`8/12/18/22px`) is documented and mostly used, but `globals.css` also has literal `6px`, `4px`, `11px`, `7px`, `3px`, `2px`, and `20px` scattered across ~15 rules. Audit each: swap to the nearest existing token where visually equivalent; if a genuine fifth size is needed (e.g. a very tight `4px` for a dense inline element), add it to the token list rather than leaving a bare number.
- **`z-index` scale:** 9 distinct values (`-1, 5, 50, 60, 500, 999, 1000, 1200, 1400`) assigned ad hoc across many tickets, with no comment documenting what layer each belongs to. Define a small documented scale (e.g. dropdown/sheet/modal/toast bands) as CSS custom properties near `:root`, and migrate existing rules onto it. Currently works by accident of no two features colliding yet — the next overlay added will have to guess a number.
- **One hex leak:** `AvailabilityHeatmap.tsx:95` sets `"--cell-fg": ratio > 0.5 ? "#fff" : "var(--ink)"` inline — a plain React contrast decision, not a Leaflet-can't-read-CSS-vars case (that documented exception is `mapTypes.ts`'s `TYPE_HEX` only). Replace `"#fff"` with an existing paper token (or add one if none reads correctly against a saturated heat cell).
- Guardrails: no visual redesign — every swap should render identically or near-identically; this is a token-hygiene pass, not a restyle. No new dependencies.
- Acceptance: `grep` for literal `border-radius: <n>px` outside the documented token values returns nothing (or each remaining literal is a newly-added, deliberate token); every `z-index` in `globals.css` references a documented scale; the `AvailabilityHeatmap` hex leak is gone; visual diff at both widths is a no-op.
> **Partially shipped (2026-08-09).** Done: all 9 `z-index` values now reference a documented `--z-*` scale (`--z-recede/sticky/sticky-2/dropdown/panel/overlay/modal/modal-2/toast` in `:root`) — identical numeric values, purely named, zero visual change. The `AvailabilityHeatmap.tsx:95` hex leak is fixed via a new `--on-fill: #fff` token (kept distinct from `--paper-*`, which are theme backgrounds that aren't always pure white — reusing one would have changed the color).
>
> **Completed (2026-08-11).** The remaining radius values are now named compact tokens (`--radius-focus/inline/control/field/icon/sheet`) and every literal `border-radius: <n>px` use was replaced without changing its numeric value. The 2px drop indicator now uses the existing pill token, which produces the same fully rounded shape. `eslint`, **191 tests**, and the production build all pass.

### ODY-109 · Scheduling poll UX — the vote is ambiguous and easy to lose — M, sonnet — ✅ DONE (2026-08-30)
> **In plain terms:** The Schedule tab lets people tap cells to say when they're free, but the result is genuinely ambiguous: "I'm busy" looks exactly the same as "I haven't answered yet," and "maybe" is collected but then never shown to anyone. You also can't tell who still hasn't voted, there's no way to mark a whole week at once, and if a save fails the app says nothing — you think you voted when you didn't. This makes the poll trustworthy to read and quicker to fill in.
Concrete defects found in the 2026-08-08 audit of `AvailabilityGrid.tsx` / `AvailabilityHeatmap.tsx` / `schedule/actions.ts`:
- **"Busy" and "unset" are visually identical.** `cellClass()` returns `is-unset` for both `"unavailable"` and `undefined`, and the legend collapses them into one swatch labelled "Busy / unset". The four-state tap cycle (unset → free → maybe → busy → unset) therefore has only three visual states, and an explicit "I can't make it" is indistinguishable from silence — the single most important distinction in a scheduling poll. Give `unavailable` its own treatment (`--coral`-family, per the palette's alert role) and leave unset visually empty.
- **"Maybe" never reaches the group.** The heatmap's `counts` only tallies `status === "available"`, so a maybe vote is collectable but invisible to everyone else. (`computeBestWindow` *does* weight it at 0.5 in `score`, so it silently influences the recommendation while never being shown — worse than ignoring it.) Surface maybes in the heatmap cell (e.g. "3 +2?") and in the legend.
- **No "who hasn't voted."** The heatmap says "N of M free" but there's no roster of who has responded, so an empty column is unreadable — is everyone busy, or has nobody opened the tab? Add a quiet responded/not-responded member list (pairs with the ODY-034 nudge idea; the in-app badge is the cheap half).
- **Failed saves are swallowed.** `persist()` in `AvailabilityGrid` catches and discards errors with `// swallow — optimistic state stays`, so a traveler can mark a whole week, have every write fail, and see no indication. Toast on failure and reconcile the optimistic state (ODY-057 did this for the other forms; the grid was missed).
- **Every tap re-sends the entire slot map.** `persist()` serializes all of `statuses` on each click, so the payload grows with the poll's range × blocks and each cell tap rewrites every slot. Send just the changed cell (or debounce a batch).
- **No bulk marking.** A 14-day poll with 3 blocks is 42 cells at up to 3 taps each. Add row ("this whole day"), column ("every morning") and "I'm free the whole range" shortcuts — this is the single biggest time cost in the current flow.
- **Block semantics are unreconciled.** `all_day` defaults on and the other three default off, but nothing stops a poll enabling `all_day` *and* `morning`/`afternoon`/`evening`, leaving "free all day" and "busy in the evening" both true with no defined precedence in `computeBestWindow`. Either make `all_day` mutually exclusive with the granular blocks in `PollSetupForm`, or define and document the precedence.
- **Mobile:** the grid is a `<table>` with `min-width: 80px` cells inside an `overflow-x: auto` container, so with 4 blocks enabled it side-scrolls at 375px with the day column scrolling out of view. Consider a sticky day column or a day-at-a-time mobile layout.
- Files: `src/components/trips/AvailabilityGrid.tsx`, `src/components/trips/AvailabilityHeatmap.tsx`, `src/components/trips/PollSetupForm.tsx`, `src/components/trips/scheduleShared.ts`, `src/app/trips/[tripId]/schedule/actions.ts`, `globals.css` (`.av-*`).
- Related: **ODY-110** (inflated best-window count) should land first or in the same PR — it's the same card. ODY-034 (Phase 2 polish) stays the home for calendar sync and email nudges.
- Guardrails: no new deps; the schedule tab currently mixes raw Tailwind utilities with the globals.css class system — migrate the touched markup to `.av-*` classes rather than adding more utilities (ODY-011/012 posture); keep one-tap "free" as the fastest path.
- Acceptance: busy, maybe, free and unanswered are four visually distinct states in both the personal grid and the group heatmap; the group view shows who hasn't responded; a failed save is visible; a traveler can mark a whole day or the whole range without tapping every cell; no horizontal scroll traps the day labels at 375px.
> **Shipped (2026-08-08):** busy vs. unset are now visually distinct — `.av-cell-btn.is-busy` uses the `--coral` alert family (matches the palette's semantic role) instead of collapsing into `.is-unset`; legend splits into separate Busy / Unset swatches. Maybe now reaches the group: the heatmap tallies `available` and `maybe` counts separately and renders `"N +M?"` per cell (a small `.av-heat-maybe` span, `--peach`), with a one-line legend explaining the notation — `computeBestWindow`'s existing 0.5 weighting was already correct, only the display was hiding it. "Who hasn't voted" ships as a quiet `av-not-responded` line ("Waiting on: Alice, Bob") derived from which member IDs have zero slots recorded at all, not tied to the ODY-034 email-nudge idea (that stays there — this is in-app only). `AvailabilityGrid`'s `persist()` no longer swallows failures — a failed save now toasts ("Couldn't save that — try again.") and reverts the optimistic cell back to its actual prior value (including correctly reverting to *unset*, not just the previous status — a naive revert would have missed that case). Payload reduced to the single changed cell per tap instead of resending the whole slot map (`setMySlots` already upserted per-slot server-side, so this was a client-only fix, no schema/action change). `all_day` and the granular blocks are now mutually exclusive in `PollSetupForm` (turning one on turns the others off), which resolves the precedence ambiguity by construction rather than by defining tie-break rules in `computeBestWindow`. Landed with **ODY-110** in the same change, since it's the same best-window card.
> **Completed (2026-08-30).** Bulk marking shipped: a "Quick fill" toolbar ("I'm free the whole range" + "Clear all"), plus every day-row label and block-column label is now a one-tap "free" button (whole day / that block every day). All the fills set `available` through the existing `setMySlots` batch (one call, optimistic, revert-and-toast on failure); the fill builder is extracted as pure `fillSlots` in `scheduleShared.ts` with 4 unit tests. "Clear all" uses a new membership-gated `clearMySlots` action scoped to the caller's own slots. The mobile half is done too: at ≤640px the day column is `position: sticky; left: 0` so the labels stay pinned while the blocks scroll — no more day labels scrolling out of view at 375px. Headers get `:focus-visible` rings and full aria-labels. The cleared-cell row-deletion gap was **ODY-113**, already resolved. tsc / eslint / 260 tests / build all clean.

### ODY-113 · Clearing an availability cell doesn't delete the underlying row — S, haiku — ✅ DONE
> **In plain terms:** Tapping a schedule cell back to "unset" only changes what you see on your own screen right now — the server still remembers your last real answer. Reload the page, or have someone else load the poll, and your "cleared" answer reappears exactly as it was before you cleared it.
Found incidentally while implementing ODY-109. `setMySlots` (`src/app/trips/[tripId]/schedule/actions.ts`) only ever calls `db.availabilitySlot.upsert(...)` — there is no delete path anywhere in the schedule actions file. `AvailabilityGrid`'s tap-cycle (`empty → available → maybe → unavailable → empty`) simulates "clearing" purely in local React state; the last-persisted `AvailabilitySlot` row for that date+block is never removed. On next load, `getSchedule` reads that stale row back from the db and the cell reverts to whatever it was before the "clear."
- Add a `deleteMySlot({ tripId, date, block })` server action (editor+/self only — a member can only clear their own slot; mirror the auth check already in `setMySlots`), calling `db.availabilitySlot.delete(...)` scoped by the same `tripId_userId_date_block` unique key `upsert` already uses. Missing-row delete should no-op rather than throw (the cell may already be unset server-side).
- Wire `AvailabilityGrid`'s cycle handler to call this instead of silently skipping the network call when `nextStatus === undefined` (see the ODY-109 completion note above for the current stopgap).
- Guardrails: no schema change (uses the existing `AvailabilitySlot` model and its existing unique index); unit-test isn't practical without a db, but do add a manual QA note or a thin integration check if the project gains any db-backed test scaffolding later.
- Acceptance: cycling a cell back to "unset" and reloading the page shows it as genuinely unset, for both the traveler who cleared it and everyone else viewing the poll; clearing a cell that was already unset server-side doesn't error.
> Shipped as planned (2026-08-08), with one deliberate deviation from the draft: any trip member can clear their own slot, not editor+ only — matching `setMySlots`'s existing membership-only check (marking your own availability is personal input, not trip-plan editing; only creating/editing the poll and applying the window are editor+/owner-gated). New `deleteSlotSchema` in `src/lib/validations/index.ts` (no `userId` field — deletion is always scoped server-side to the caller via `dbUser.id`, never client-supplied, verified by a schema test that a passed-in `userId` is silently stripped). New `deleteMySlot({ tripId, date, block })` action uses `db.availabilitySlot.deleteMany(...)` rather than `.delete(...)` — `deleteMany` no-ops on zero matches instead of throwing, satisfying "missing-row delete shouldn't error" without a try/catch. `AvailabilityGrid`'s cycle handler now calls it on the clear path instead of the ODY-109-era stopgap that skipped the network call entirely; the existing optimistic-revert plumbing (added in ODY-109) covers a failed clear the same way it covers a failed set. 4 new schema tests in `validations.test.ts`. RLS already covers deletes (`prisma/rls.sql` enables table-level RLS with no per-operation policies, so no changes needed there).

### ODY-111 · Expense splitting vs Splitwise — competitive gap audit — M, sonnet — ✅ DONE
> **In plain terms:** After ODY-094 and ODY-107 the money features are genuinely good: you can say who paid, who's on each expense, split unevenly, see who owes whom, and mark a transfer as settled. This ticket asks the honest next question — if someone already uses Splitwise for trips, what would still make them keep it open alongside Odyssey? Write that list down and decide which gaps are worth closing.
Audit-first (findings + prioritized child tickets); ships code only for anything trivially small. **Do not re-litigate what already works** — `src/lib/budget.ts` (`weightedSharesCents`, `equalSharesCents`, `aggregateBalances`, `suggestSettlements`, 24 tests), `ExpenseShare`, `Settlement`, `paidBy`, and the `ExpenseModal` paid-by/participants/equal-vs-exact flow are all shipped and verified.
- **Known gaps to assess (each: does a trip planner actually need it? cost? does it fit the calm editorial tone or drag us toward a spreadsheet?):**
  - **Multi-currency.** `fmtMoney` hardcodes `currency: "USD"` (`src/lib/utils/index.ts:31`) and `Expense.amount` carries no currency. This is the biggest single gap for an *international travel* app — Splitwise does per-expense currency with a trip base currency and stored conversion rate. Overlaps ODY-024; this ticket should decide whether ODY-024 grows into that or stays formatting-only.
  - **Percentage and share-based splits.** Today's modes are equal and exact-dollar only. Splitwise also offers %, shares/parts, and "adjustment" (+/− off an even split). `TripMember.splitWeight` already models trip-wide shares — the gap is per-expense.
  - **Itemization + tax/tip** — already scoped as ODY-094 Stage C (`ExpenseLine`); confirm it's still the right shape and priority.
  - **Per-event / per-meal split view** — already scoped as ODY-097 Stage D; cross-reference rather than duplicate.
  - **Simplify debts across the group.** `suggestSettlements` already minimizes transfers; verify it behaves like Splitwise's "simplify debts" and document the difference if not.
  - Others to weigh and explicitly accept or reject with a reason: expense comments/history ("why is this $80?"), an audit trail of edits, partial/uneven settlements (today "Mark as paid" records the exact suggested amount — a partial payment needs a custom amount), recurring expenses (low value for a trip), reminders/nudges to settle, per-person "you are owed / you owe" summary at the top of Budget, and export (CSV/PDF — pairs with ODY-032/072).
  - **Receipt capture** — see **ODY-112**; do not scope it here beyond noting the dependency.
- Deliverable: a gap table in the ticket (gap · does Odyssey need it · effort · verdict), plus child tickets only for the gaps that earn a yes.
- Guardrails: Odyssey is a trip planner with money features, not a ledger app — the bar is "a group can settle a trip fairly without leaving," not feature parity. Equal split must stay one-tap (ODY-094's standing rule); advanced options stay behind progressive disclosure.
- Acceptance: every gap above has a written verdict with a reason; the ones marked "yes" exist as scoped tickets with file paths; multi-currency has an explicit ship-or-defer decision recorded.

> **Audit findings (2026-08-09).** Read: `src/lib/budget.ts` (205 lines), `src/components/budget/BudgetClient.tsx`, `ExpenseModal.tsx`, `src/app/trips/[tripId]/budget/actions.ts`, `prisma/schema.prisma` (`Expense`/`ExpenseShare`/`Settlement`/`TripMember`), `src/lib/utils/index.ts`.
> **Headline:** the *math* is at parity — `weightedSharesCents`/`equalSharesCents` are cent-reconciled by largest-remainder, `aggregateBalances` works off real per-expense participants (not a trip-total pool), and `suggestSettlements` already produces a minimal transfer set. What would keep someone on Splitwise is **not** the engine; it's currency, one missing split affordance, and the fact that the answer to "what do *I* owe?" is nowhere on the page.

| # | Gap | Does a trip planner need it? | Effort | Verdict |
|---|---|---|---|---|
| 1 | Multi-currency | **Yes — biggest gap.** An international trip app that prints `$` on a ¥ amount is wrong, not merely unlocalized. | M (display + trip field) / L (per-expense FX) | **Ship stage 1 via ODY-024** (cents + `Trip.currency`, promoted to the top of the money queue). **Defer stage 2** (per-expense currency + stored rate) — needs an FX-rate source and a dependency we don't have; a trip base currency covers the common case where everyone spends in one place. |
| 2 | Percentage splits | No — exact-dollar mode already expresses any percentage of a known total. A `%` mode is a calculator, not a plan. | — | **Reject.** |
| 3 | Shares / parts per expense | No — `TripMember.splitWeight` already carries "she's travelling with her kid" trip-wide, and it *is* the default for every uncustomized expense. A third per-expense mode fights ODY-094's one-tap rule. | — | **Reject.** |
| 4 | Adjustment (+/− off an even split) | **Yes.** "I had the wine, add $14 to me" is the most common real trip case, and today it forces exact mode and retyping *everyone's* number. | S | **Ship — ODY-114.** |
| 5 | Itemization + tax/tip | Shape still right (`ExpenseLine`, ODY-094 Stage C), but it only pays off with receipt capture (ODY-112). | L | **Keep as scoped, priority unchanged (P3).** No re-scope needed. |
| 6 | Per-event / per-meal split view | Already ODY-097 Stage D. | — | **Cross-referenced, not duplicated.** |
| 7 | Simplify debts across the group | Already equivalent: `suggestSettlements` is greedy largest-debtor→largest-creditor, same minimal-transfer result as Splitwise's "simplify debts". **Difference worth documenting:** ours is always on and unlabelled, so it can tell you to pay someone you never shared an expense with, with no way to see the raw pairwise picture. | S (label only) | **Parity confirmed; honesty fix folded into ODY-116.** |
| 8 | Expense comments / "why is this $80?" | No — a comment thread per expense is chat-app creep; the Notes tab (ODY-104) is where trip talk lives. | — | **Reject.** |
| 9 | Audit trail of edits | No — full history is ledger-app territory. **Accepted risk, recorded:** editing an expense silently rewrites every participant's share with no trace, so a settled-looking balance can move under someone. Revisit only if that bites in real use. | — | **Reject (with the risk noted).** |
| 10 | Partial / custom settle-up amount | **Yes.** `markPaid` (`BudgetClient.tsx:212`) can only record the exact suggested amount; "I'll give you $40 of the $67 now" is unrecordable. `Settlement.amountCents` already accepts any value — this is UI-only. | S | **Ship — ODY-115.** |
| 11 | Recurring expenses | No — a trip is bounded; nothing recurs within it. | — | **Reject.** |
| 12 | Reminders / nudges to settle | Not here — needs the same delivery path as the availability nudge. | — | **Reject; belongs to ODY-034.** |
| 13 | Per-person "you owe / you're owed" summary | **Yes — cheapest, highest-value item found.** `currentUserId` is already a `BudgetClient` prop but is passed straight through to the modal and never used for a personal figure; the hero shows only trip totals, so every traveler must find their own row in the split table to learn their number. | S | **Ship — ODY-116.** |
| 14 | Export (CSV / PDF) | Yes eventually, but it's an export feature, not a splitting gap. | — | **Deferred to ODY-032 / ODY-072**, no new ticket. |
| 15 | Receipt capture | Dependency only, per this ticket's guardrail. | — | **Out of scope — see ODY-112.** |
>
> **Defect found while auditing (file paths, not a gap):** `fmtMoney` is copy-pasted verbatim into three components — `BudgetClient.tsx:67`, `TripCard.tsx:20`, `DashboardClient.tsx:13` — and every copy is `"$" + Math.round(n)`, so **cents are invisible app-wide**. Concretely: `markPaid` records a $30.50 transfer as `3050` cents correctly, and the UI then renders it as "$31" in both the settle-up row and the settled history. Meanwhile `formatCurrency` (a correct `Intl.NumberFormat`) exists **twice** — `src/lib/utils.ts:48` and `src/lib/utils/index.ts:28` — and neither copy is used by any money surface. Folded into **ODY-024** (one formatter, cents-honest, trip-currency-aware) and overlaps **ODY-064**'s utils dedupe.
>
> **Ship-or-defer, recorded as required:** multi-currency **ships as ODY-024 stage 1 only** (cents + a `Trip.currency` symbol respected everywhere); per-expense foreign currency with a stored conversion rate is **explicitly deferred**, not rejected — revisit when a trip actually spans two currencies in practice.
> No code shipped with this audit: the only candidate small fix (unifying `fmtMoney`) changes money display on every surface and belongs in ODY-024 with the currency field, not smuggled into an audit PR.

### ODY-114 · Adjustment split — "I had the wine, add $14 to me" — S, sonnet — ✅ DONE
> **In plain terms:** Splitting a restaurant bill where one person ordered something extra currently means switching to exact-dollar mode and retyping what *everyone* owes. This adds the one thing you actually want: bump one person up (or down) and let the rest of the bill stay even.
Filed from the ODY-111 audit (gap #4). Today `ExpenseModal` offers exactly two modes, `equal` and `exact` (`src/components/budget/ExpenseModal.tsx:69`, `chooseMode` at :106).
- Add an "Adjust" affordance on top of the equal split: a per-participant +/− delta in dollars; the remainder splits evenly among everyone after deltas are applied. Resolve to explicit `ExpenseShare` rows exactly as exact mode does — **no schema change** (`splitMode` stays cosmetic; `ExpenseShare.amountCents` remains authoritative), so `splitMode: "exact"` is what's persisted.
- Reuse `equalSharesCents` for the post-delta remainder so cent reconciliation stays in one place (`src/lib/budget.ts`); add unit tests alongside the existing 24 (deltas summing past the total, negative result, single participant).
- Guardrails: equal stays one tap (ODY-094's standing rule) — adjust is progressive disclosure inside the split section, not a third top-level chip competing with it.
- Acceptance: a 4-person $100 dinner where one person adds $14 yields 14/28.67/28.67/28.66 (or equivalent cent-reconciled split) without typing four numbers; shares sum to the total to the cent.
> **Shipped (2026-08-09), with one deliberate reading of "delta."** The ticket's own worked example (14/28.67/28.67/28.66 for a $100/4-person bill) only holds if the typed number is that person's **absolute final share**, not an amount added on top of an equal split — additive math doesn't produce those digits. Built it that way: "Adjust one person" is a third mode chip alongside Equal/Exact (`ExpenseModal.tsx`), and per participant you either leave it blank (auto-splits the remainder evenly) or type their exact total. UI copy says so directly — "Type an amount for anyone who owes something different — everyone else splits the rest evenly" — so the mechanic reads correctly regardless of what "delta" implied. This is also *more* useful than a true +/- delta: it directly matches "the wine was $14, that's my whole share of this line item" without first computing what an equal cut would have been.
> New pure `adjustmentSharesCents()` in `src/lib/budget.ts`, following the file's existing pattern (`weightedSharesCents`/`equalSharesCents`) — overridden participants get their typed amount exactly, the remainder splits via the same `equalSharesCents` everything else already reconciles through, so there's one cent-rounding implementation in the codebase, not two. **No schema change**, as the ticket specified: `splitMode` persists as `"exact"` for adjust-mode saves too (schema only knows equal/exact; the UI has 3 modes, the wire format has 2) — the one accepted side effect is that re-opening an adjust-mode expense to edit shows it in Exact mode rather than remembering it was Adjust, since that distinction isn't stored. Validation mirrors exact mode's "over the total" warning, extended for the mode's 3-way state (fully allocated / splits among N people / over-allocated).
> 6 new tests for `adjustmentSharesCents`, including the ticket's own acceptance numbers verbatim and the two edge cases it named (deltas exceeding the total, single participant). tsc / eslint / **191 tests** / build all clean.

### ODY-115 · Partial settle-up — record a custom amount — S, haiku — ✅ DONE
> **In plain terms:** "Mark as paid" is all-or-nothing: it records exactly the amount Odyssey suggested. If you hand someone $40 of the $67 you owe, there's no way to say so.
Filed from the ODY-111 audit (gap #10). `markPaid` (`src/components/budget/BudgetClient.tsx:212`) hardcodes `amountCents: Math.round(t.amount * 100)` from the suggested transfer.
- Let the settle-up row record a custom amount (inline amount input, or the branded `Modal` used by the schedule apply-window flow — not `window.confirm`). Default to the suggested figure so the common case stays one tap.
- **No schema or action change needed:** `Settlement.amountCents` is a free `Int` and `recordSettlementSchema` already validates `1..100_000_000` (`src/lib/validations/index.ts`). Server-side is done; this is UI only.
- Balances already re-derive from settlements via `aggregateBalances`, so a partial payment should simply leave a smaller remaining suggestion — verify that and add the case to the budget tests.
- Acceptance: paying $40 against a $67 debt records $40 and the settle-up list then suggests the remaining $27; the existing one-tap full-amount path is unchanged.
> **Shipped (2026-08-09).** Each settle-up row now has a small pencil icon (`Icons.edit`) next to "Mark as paid" that swaps the row into an inline amount field + Record/Cancel — no modal, since a single-field inline edit is lighter than the branded `Modal` for this. Confirming calls the same `recordSettlement` server action with the typed amount instead of the suggested one; the untouched "Mark as paid" button still calls it with no override, so the one-tap full-amount path is byte-identical to before. Confirmed **server-side already handled this correctly** — `recordSettlementSchema` and `Settlement.amountCents` needed zero changes, exactly as the ticket predicted. The $67→$40→$27 worked example from the acceptance criterion is now a named test in `budget.test.ts` (`aggregateBalances` + `suggestSettlements` chained), on top of the pre-existing generic "partial settlement leaves the remainder outstanding" case. tsc / eslint / **185 tests** / build all clean. No schema change.

### ODY-116 · "You owe / you're owed" — the personal answer, at the top — S, sonnet — ✅ DONE
> **In plain terms:** The Budget page opens with what the *trip* spent. The thing every traveler actually came to find out — "what do I owe, and to whom?" — is buried in a table of everyone's rows further down. Put their own number where their eye lands first.
Filed from the ODY-111 audit (gap #13, the cheapest high-value finding). `currentUserId` is already a `BudgetClient` prop (`src/components/budget/BudgetClient.tsx:346`) but is only forwarded to `ExpenseModal` — no personal figure is ever rendered.
- Add a quiet personal line to the budget hero: "You're owed $48" / "You owe $32" / "You're settled", sourced from the same `aggregateBalances` row that already drives the split table — no new math, no new query.
- Fold in the ODY-111 gap #7 honesty fix: label the settle-up list as *simplified* (e.g. "Fewest transfers"), since `suggestSettlements` can name a payee the debtor never shared an expense with. One line of microcopy — do **not** build a raw pairwise view unless someone asks for it.
- Use `--teal` for owed-to-you and `--coral` for you-owe per the documented semantic roles; no new hex, no new tokens. Viewers see it too (it's read-only information).
- Acceptance: opening Budget answers "what do I owe" without scrolling; the figure matches that traveler's row in the split table exactly; the settle-up list says it's showing the fewest-transfer route.
> **Shipped (2026-08-09).** A quiet pill (`.hero-mine`) sits right below the spent figure in the budget hero — "You're owed $48" / "You owe $32" / "You're settled up" — sourced from `splitMembers.find(m => m.userId === currentUserId).balance`, the exact same value that already drives the split table's row, so the two can never drift (both trace to `aggregateBalances`; no new query, no new math). Classification (`owed`/`owe`/`settled`) extracted to a new pure `classifyBalance()` in `src/lib/budget.ts` — reuses the same 0.4¢ epsilon `suggestSettlements` already treats as "effectively zero," so rounding dust reads as settled rather than "you owe $0.00" (5 new tests). Color follows the documented semantic roles — solid `--teal` for owed-to-you, `--coral` for you-owe — as solid text on the hero's dark background rather than the light-mode `-soft` fills, which would be invisible there. Not gated by `readOnly`, so viewers see their own balance too, per the acceptance note. Folded in the ODY-111 gap #7 honesty fix: the settle-up list now carries a one-line caption — "Fewest transfers — may not match who you actually split with" — since `suggestSettlements` minimizes transfer count, not pairwise history, and could otherwise read as a literal "who owes whom" statement it isn't. tsc / eslint / **184 tests** / build all clean. No schema change, no deploy step.

---

## P2 — User Journey (2026-07-25 UX audit)

> Batch focused purely on the traveler's journey: first-run orientation, honest
> states, and returning-user flow. No new external dependencies. Keep the calm,
> editorial "boarding pass + printed map" tone; palette + type from globals.css.

### ODY-074 · Empty-trip guided first steps — M, sonnet — ✅ DONE
> **In plain terms:** Right after the wizard, a brand-new trip is a blank timeline that feels like a chore, not the start of an adventure. Give first-time planners a calm, dismissible checklist so the trip feels *started*.
- `FirstSteps` on itinerary when `totalEvents === 0`; dismissible session state; viewers get calm copy.

### ODY-075 · Progressive tab reveal for new trips — M, sonnet — ✅ DONE
> **In plain terms:** Day one, a trip shows seven tabs (Schedule, Explore, Collections…) which is overwhelming before there's anything in them. Start simple and reveal advanced tabs as they become relevant.
`NAV_ITEMS` always renders all 7 destinations regardless of trip state (pairs with ODY-059/060).
- Show a core set first (Itinerary, Map, Members); reveal Schedule when a poll exists or trip has no fixed dates, Explore/Collections once a destination is set or the traveler opts in via a subtle "More" affordance.
- Keep every tab reachable (don't hard-hide) — this is ordering/emphasis, not permission. Reuse the ODY-059 overflow pattern rather than inventing a second one.
- Files: `src/components/trips/navItems.ts`, `WorkspaceSidebar.tsx`, `MobileTabBar.tsx`.
- Acceptance: a fresh trip presents a calm, minimal nav; advanced tabs appear as they gain purpose; nothing becomes unreachable.
> **Shipped (2026-08-09), desktop sidebar only, with a deliberate re-scope of the reveal conditions.** The ticket's literal triggers ("reveal Explore/Collections *once a destination is set*", "Schedule when *the trip has no fixed dates*") don't work in this codebase: `createTripSchema` **requires** destination + start + end at creation, so every trip has them from second zero — those conditions would always be true and hide nothing. Replaced with real "has the traveler engaged with this feature yet" signals: **Schedule** reveals when an `availabilityPoll` exists, **Explore** when ≥1 `Place` is saved, **Members** when `memberCount > 1` (a solo trip doesn't need it up front). The four core tabs — Itinerary, Collections, Map, Budget (the same set ODY-059 fixed to the mobile bottom bar, so one taxonomy across both platforms) — are always primary. Everything else collapses into a quiet **"More"** disclosure at the bottom of the sidebar (chevron, `--ink-3`, rotates on open), default collapsed. Crucially the **active tab is never hidden** — `splitDesktopNav`'s predicate is `core || isActive(href) || reveal(state)` — so navigating into a not-yet-revealed tab via More keeps it visible while you're there, and it graduates permanently the moment you create the poll / save the place. A fresh solo trip now shows 4 tabs instead of 7; a fully-worked trip shows all 7 with no More group.
> **Why not user-toggleable hide/show (the alternative considered):** it would need a settings surface to build and explain, breaks discoverability ("where did Budget go?"), and requires persisting a per-user-per-trip preference — which this project can't do cheaply (no localStorage/sessionStorage per CLAUDE.md, so it'd mean a new DB column). State-driven reveal delivers the same calm with zero settings and zero persistence.
> **Scope note:** mobile is intentionally untouched. The bottom bar is already a fixed 4-tab minimal set (ODY-059) and tabs appearing/disappearing on the *primary* mobile bar would be disorienting; the overflow drawer already covers the other three. Files: `navItems.ts` (new `splitDesktopNav` + `TripNavState`, pure/tested — 8 tests in `navItems.test.ts`), `WorkspaceSidebar.tsx` (primary + More rendering), `layout.tsx` (computes `navState`), `getTripById` (additive `availabilityPoll {id}` + `_count.places` — existence only, no extra rows), `globals.css` (`.nav-more-toggle`). tsc/eslint/171 tests/build all clean. **Left for a follow-up if wanted:** ODY-075 mentioned a "More" affordance on mobile too — deferred as unnecessary given the existing drawer.

### ODY-076 · Jump to today / in-progress day on itinerary — S, haiku — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** When a trip is happening *now*, the itinerary opens at Day 1 and you have to scroll to find today. Auto-focus today's day and mark it.
The dashboard already computes `live`/`upcoming`/`past`; the itinerary doesn't lean into "today."
- For a live trip (today within start–end, UTC-safe via ODY-048 helpers), scroll the matching `DayBlock` into view on load and give it a quiet "Today" marker/accent. Non-live trips unchanged.
- No auto-scroll for viewers mid-read beyond initial focus; respect reduced-motion.
- Files: `src/components/itinerary/DayBlock.tsx`, `src/app/trips/[tripId]/itinerary/page.tsx`, `globals.css`.
- Acceptance: opening a live trip lands on today's day with a subtle badge; past/upcoming trips open at the top as before.

### ODY-077 · Event time-overlap warnings — S, sonnet — ✅ DONE
> **In plain terms:** Soft non-blocking hint when two timed events on a day overlap.
- `findOverlaps` helper + unit tests; quiet peach hint on `EventBlock`.

### ODY-078 · Collections → add to a day in one tap — S, sonnet — ✅ DONE (2026-08-09)
> **Shipped.** New `addPlaceToItinerary({ tripId, dayId, placeId })` server action (`collections/actions.ts`) mirrors Explore's `saveExploreToItinerary`: it verifies the place belongs to the trip, then reuses `createEvent` — which already enforces editor+ and the ODY-052 day-scope guard — mapping `Place.category` → `Event.type` (shared vocabulary) and carrying the place's geocoded lat/lng so the new event pins like any hand-entered one. `CollectionsClient` gained a per-place day `<select>` + "Add to itinerary" button (reusing Explore's `.explore-day-pick` pattern), gated behind `!readOnly` and `days.length > 0`; the page now passes `days`. The place stays in Collections after adding (non-destructive — it's now also on the plan). Viewers see no controls and the action rejects them server-side. tsc / eslint / 199 tests / build clean.
> **In plain terms:** Explore can drop a place onto the itinerary, but saved Collections places are a dead end — you can't easily say "put this on Thursday." Add that.
Collections are savable but can't be promoted to the plan (Explore already has `saveExploreToItinerary`).
- Add an "Add to itinerary" action on a Collection card → day picker → reuse `createEvent` (with the ODY-052 day-scope guard and shared geocode path). Editor+ only.
- Files: `src/app/trips/[tripId]/collections/actions.ts` (or reuse itinerary action), `src/components/` collections card + a small day-picker (reuse Explore's pattern).
- Acceptance: a saved place becomes a real itinerary event on the chosen day; viewers can't; pins/costs behave like hand-entered events.

### ODY-079 · Map honesty for saved-but-unpinned locations — S, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** If a location can't be geocoded (typed freehand, lookup failed), the event still saves but the map just says "No pins yet" with no explanation — it looks broken. Tell the truth.
QA findings F18/F19: events/places without coordinates silently vanish from the map; autocomplete errors are invisible.
- Map: when there are events/places but some lack `lat`/`lng`, show a small branded note ("N stops aren't pinned yet — add a location we can find"). Distinguish "no stops" from "stops but none mappable."
- Autocomplete: surface a quiet "couldn't search right now" state instead of an empty dropdown on geocode error (reuse toast/inline pattern; no new lib).
- Files: `src/app/trips/[tripId]/map/page.tsx`, `MapClient.tsx`, `src/components/itinerary/LocationAutocomplete.tsx`.
- Acceptance: a trip with unpinned stops explains why on the map; failed lookups show a clear, calm message.

### ODY-080 · Honest schedule apply-window copy + out-of-range day flag — S, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** The "Apply best window" confirm warns that events outside the new dates are "permanently removed," but the server actually keeps days that have events. The scary copy is a lie — fix it, and gently flag any kept-but-out-of-range days.
QA finding F10: `applyWindow` only deletes *empty* out-of-range days (ODY-002 safety), but the confirm dialog claims event days are deleted.
- Rewrite the confirm copy to match reality: empty days outside the new range are removed; days that hold events are kept and may now sit outside your dates.
- Optional (same PR if cheap): flag kept out-of-range days in the itinerary with a quiet "outside trip dates" marker so they're not lost.
- Files: `src/components/trips/AvailabilityHeatmap.tsx`, `src/components/itinerary/DayBlock.tsx`, `src/app/trips/[tripId]/itinerary/page.tsx`.
- Acceptance: confirm copy accurately describes what happens; no event data is implied to be destroyed when it isn't.

### ODY-081 · Editors can open schedule polls (role parity) — S, haiku — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Any editor can plan the whole trip, but only the owner can open a scheduling poll — editors just hit a dead-end empty state. Let editors open/edit polls too.
QA finding F21: `upsertPoll` requires `role: "owner"`; the rest of planning is editor+ (ODY-001).
- Change `upsertPoll` to allow editor+ (reuse `assertTripRole(..., "editor")`). Keep `applyWindow` owner-only for now, since it overwrites trip dates for everyone (document this split in the ticket/comment).
- Update the schedule empty state so editors see a "Start a poll" CTA, not an owner-only message.
- Files: `src/app/trips/[tripId]/schedule/actions.ts`, `src/app/trips/[tripId]/schedule/page.tsx`.
- Acceptance: an editor can create/edit a poll; viewers still can't; applying a window stays owner-only (or is a deliberate follow-up decision).

### ODY-082 · Trip archive / soft hide on dashboard — M, sonnet — ✅ DONE (⚠️ needs `prisma db push`)
> **Shipped (2026-08-09), revised to per-member archive after live feedback.** First cut used a shared `Trip.archivedAt` gated to the owner — but real use surfaced the flaw: a collaborator couldn't tidy a trip they didn't own, and archiving would've hidden it for everyone. Reworked to **per-member**: `archivedAt` now lives on **`TripMember`** (each traveler's own row), so **any member can hide any trip from their *own* dashboard** without deleting data or changing what anyone else sees. `archiveTrip`/`unarchiveTrip` (`src/app/trips/actions.ts`) set/clear `archivedAt` on the caller's own membership (membership-checked, not owner-gated). Dashboard reads *this* user's membership `archivedAt` to split `active` vs `archived`: live/upcoming/"Wrapped" and every stat count **active only**; archived trips move to a collapsed **"Archived (N)"** disclosure, restorable. `TripCard` shows an Archive/Restore pill (top-right of the cover, `stopPropagation`) on past active + archived trips for **every** member (no longer owner-only); upcoming/live cards stay uncluttered. `useTransition` + `router.refresh()`, toast on failure. tsc / eslint / 213 tests / build clean.
> **⚠️ DEPLOY STEP — run `npx prisma db push` before this serves traffic.** This migration **drops `Trip.archivedAt` and adds `TripMember.archivedAt`**. Because it drops a column, `db push` may warn about data loss — that's expected and safe: the only data there is trips you archived while testing the first version; accept it (`npx prisma db push --accept-data-loss` if it refuses non-interactively) and re-archive them (now per-member). The dashboard selects the new member column, so it 500s until the push runs.
> **In plain terms:** Past trips ("Wrapped") pile up forever. Let people archive a trip so the dashboard stays calm, without deleting the memories.
Dashboard shows all upcoming/past; no way to tidy.
- Add `archivedAt DateTime?` on Trip via `prisma db push` (Supabase free-tier may be paused — coordinate the push). Owner archives/unarchives; archived trips move to a collapsed "Archived" section, excluded from the main grid and counts.
- Server action + Zod; membership/owner check; revalidate dashboard.
- Files: `prisma/schema.prisma`, `src/app/trips/actions.ts`, `src/components/trips/DashboardClient.tsx`, `TripCard.tsx`.
- Acceptance: owner can archive/restore a trip; archived trips are hidden from the primary grid but recoverable; no data deleted.

### ODY-083 · In-trip search (events, places, notes) — M, sonnet — ✅ DONE (2026-08-09)
> **Shipped as a self-contained command box (the ticket's "small command box; jump-to on select" option), chosen deliberately for a low merge-conflict surface — almost all new files, two additive one-line mounts.** New files: `src/lib/tripSearch.ts` (pure `isSearchable`/`snippetAround`/`searchNoteSections`, 9 unit tests), `src/app/trips/[tripId]/search/actions.ts` (`searchTrip` — viewer+ gated, scoped to the trip; events/places via case-insensitive `contains`, notes matched in JS over the sections JSON, per-kind + total caps), and `src/components/trips/TripSearch.tsx` (debounced overlay using the existing `Modal` primitive; results grouped by kind badge → jump to the relevant tab on click; closing/clearing restores the full view). Mounted with additive one-liners in `WorkspaceSidebar` (desktop, labeled trigger above the nav) and `MobileTripHeader` (mobile, icon trigger) — mutually exclusive by viewport. CSS appended at the end of `globals.css` (`.trip-search-*`, token-based, kind colors = peri/teal/slate). No schema change, no new deps, server-only DB access. tsc / eslint / 208 tests / build clean.
> **In plain terms:** Once a trip is dense, finding "that ramen place" means scrolling every day. Add a simple search within a trip.
No way to search inside a trip.
- Lightweight client-side filter over already-loaded events + collections (title/location/notes), surfaced from the workspace header or a small command box; jump-to on select. No new backend if data is already on the page; otherwise a scoped server action.
- Files: `src/components/trips/` (search box), itinerary/collections client components.
- Acceptance: typing a query highlights/filters matching stops and places within the current trip; clearing restores the full view.

### ODY-084 · Leave trip (self-remove) — S, sonnet — ✅ DONE
> **In plain terms:** A collaborator can be removed by the owner, but can't leave on their own. Add a clear "Leave trip" for non-owners.
- `leaveTrip` action + `LeaveTripButton` on Members (non-owners only); confirm → dashboard.

### ODY-085 · Post-invite "you're in" welcome on the joined trip — S, sonnet — ✅ DONE (2026-08-30)
> **Shipped.** A freshly-joined member landing on the itinerary now sees a slim, dismissible "you're aboard" banner (`JoinWelcome`) carrying the ticket's three asks: their role, who's hosting, and a primary action ("Meet the crew" → members). Eligibility is computed in `getTripById` — a non-owner within 7 days of `joinedAt` who hasn't dismissed it — so there's no schema change and no localStorage. Dismissal persists via an httpOnly per-trip cookie (`ody-welcomed-<tripId>`, set by a membership-gated `dismissJoinWelcome` action); the 7-day window also ages it out on its own. Editor gets a peri accent, viewer a slate accent with view-only wording; both accents and the `--on-fill` button token already exist (no new palette). Rendered at the top of the itinerary canvas (the trip root redirects there), so it inherits the mobile-header/safe-area handling. Owner-reviewed via mockup first. tsc / eslint / 256 tests / build all clean.
> **In plain terms:** After accepting an invite you get dropped on a generic screen. A short welcome on *that trip* (your role, who's hosting, a next step) makes joining feel warm and oriented. Pairs with ODY-037.
Invite deep-links land on the trip, but there's no first-visit context for a joiner.
- On a member's first visit to a trip they just joined (detect via `joinedAt` recency or a one-time session flag — no localStorage), show a dismissible welcome banner: role, owner name, one primary CTA.
- Files: `src/app/trips/[tripId]/` layout or itinerary page, a small `JoinWelcome` component, `globals.css`.
- Acceptance: a freshly joined collaborator sees a warm, dismissible orientation on the trip; returning members don't.

### ODY-090 · Branded apply-window confirm + success toast — S, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** Locking the schedule's best window into your trip dates currently uses the browser's plain grey pop-up, and there's no confirmation once it works. Swap it for Odyssey's own calm confirm and a "Trip dates updated" toast so the action feels finished and on-brand. (From testing feedback: "apply window works but would look better as a stylized notification.")
`AvailabilityHeatmap.handleApply` uses `window.confirm(...)` and shows only a failure toast.
- Replace `window.confirm` with the existing `Modal` shell (`src/components/shared/Modal.tsx`) as a small confirm dialog: title, the honest ODY-080 body copy, Cancel + "Apply dates" (loading state reuses `isPending`). Keep it owner-only (parity with ODY-081).
- On success, `toast("Trip dates updated.", "success")` (Toast already supports the `success` kind); keep the failure toast.
- No schema, no new deps. Reuse `.modal-*` classes; no hardcoded hex.
- Files: `src/components/trips/AvailabilityHeatmap.tsx` (+ `globals.css` only if a confirm-specific class is needed).
- Acceptance: applying the best window shows an on-brand confirm, then a success toast; canceling does nothing; failures still toast an error.

### ODY-091 · Destination-biased location search + clearer autocomplete states — M, sonnet — ✅ DONE (verified in code 2026-08-09)
> **Fully shipped — verified against every acceptance criterion (its own follow-up ODY-106, marked done, already treats this as landed):** `buildBiasedQuery` lives in `src/lib/geoQuery.ts` (unit-tested in `geoQuery.test.ts`) and `searchPlaces` (`geocode.ts`) uses it, threading `near` through the shared cache key; `/api/geocode` accepts a validated `near` param (`route.ts:23-27`, trimmed, ≤200 chars, still server-only per ODY-010, rate-limited per ODY-055); `LocationAutocomplete` distinguishes loading vs. error (ODY-079) vs. **no-matches** — the `noResults` state renders the exact acceptance hint "No matches — try a broader name or add a city, e.g. 'ramen, Tokyo'"; and both `AddEventModal` and `CollectionsClient` pass `near={destination}`. `geocode.test.ts` + `geoQuery.test.ts` cover the query building and bias. ODY-106 later fixed the one edge bug (biased miss now falls back to the raw query). No code shipped here — verified in place.
> **In plain terms:** Adding a place in Collections (and event locations) feels finicky — the search only matches fairly exact addresses, doesn't bias toward the trip's destination, and a miss looks the same as a bug. Bias results toward where the trip actually is and make "no matches" read clearly, so saving "ramen" near Tokyo just works. (From testing feedback: "collection tab is hard to add a location, only takes specific addresses.")
`LocationAutocomplete` → `/api/geocode` → `searchPlaces` sends a bare Nominatim query with no geographic bias; vague names return nothing and the dropdown looks empty/broken (ODY-079 added an error state; this adds a *no-matches* state + relevance).
- **Bias:** thread an optional trip destination/viewbox into the lookup. Simplest: pass the trip `destination` string as a `near`/context hint the server appends to the query (e.g. `"${q}, ${destination}"` when the query looks like a bare place name), or use Nominatim `viewbox`+`bounded=0` / `countrycodes` derived from a one-time destination geocode. Keep it server-side in `src/lib/geocode.ts` (respect the shared cache key — include the bias in the key) and `/api/geocode` (accept an optional `near` param, validated).
- **Clarity:** in `LocationAutocomplete`, distinguish loading vs. error (done in ODY-079) vs. **empty results** ("No matches — try a broader name or add city, e.g. 'ramen, Tokyo'"). Don't silently show an empty menu.
- **Plumb destination:** `CollectionsClient` and `AddEventModal` should pass the trip destination to `LocationAutocomplete` (page already loads the trip). Add a `near?: string` prop.
- Guardrails: still never hit Nominatim from the browser (ODY-010); keep rate limiting (ODY-055); no new deps; unit-test any new query-building/bias helper.
- Acceptance: typing a common place name with a trip destination set surfaces relevant nearby suggestions; a true miss shows a clear "no matches" hint; errors still show the ODY-079 message; rate limiting and the proxy boundary are unchanged.

### ODY-106 · Destination-biased search returns zero results for real places outside the destination (e.g. airports, stadiums) — S, haiku — ✅ DONE
> **In plain terms:** Adding a flight/activity and typing "JFK airport" (or any well-known place that isn't literally in the trip's destination city — a stadium, a restaurant in a different neighborhood) returns nothing — but pasting the full street address works. Diagnosed live against the real `searchPlaces()` code path (not raw Nominatim): `buildBiasedQuery` (ODY-091) appends the trip destination to *any* comma-less query, so "JFK airport" becomes "JFK airport, Newark, New Jersey" for a Newark-destination trip — a nonsensical compound query that Nominatim can't resolve, returning 0 results. Unbiased, "JFK airport" alone resolves perfectly. A pasted address contains a comma, so `buildBiasedQuery` skips biasing entirely for it — which is exactly why manual addresses "just work" while name search doesn't.
This reproduces in the exact reported flow: `AddEventModal`'s location fields (`src/components/itinerary/AddEventModal.tsx:177,190`) pass `near={destination}` into `LocationAutocomplete` → `/api/geocode` → `searchPlaces`, so every flight/activity/hotel search in the DayBlock "Add event" form is destination-biased. The bias itself is good (verified live: "Home Depot"/"Starbucks" biased toward Newark return great local matches) — the bug is that a biased miss never falls back to the traveler's exact query. Also confirmed general (not airport-specific) with "Gillette Stadium" biased toward "Boston, Massachusetts" (Gillette is in Foxborough) — same zero-result failure, same fix.
> Shipped: `searchPlaces` now tries the biased query first, and if it returns zero results *and* biasing actually changed the query, retries once with the raw unbiased query. The single-query fetch (cache read/write + rate-limit + Nominatim call) was refactored into a reusable `fetchOnce` helper so both attempts share identical caching/rate-limiting — a fallback that's a genuine cache miss consumes its own rate-limit unit. No changes to `buildBiasedQuery`, `/api/geocode`, or any calling component. Added a `server-only` test stub (`src/lib/__tests__/__mocks__/server-only.ts`, aliased in `vitest.config.ts`) since `geocode.ts` couldn't be unit-tested before this — 5 new tests cover the fallback triggering, not triggering when biasing already works or wasn't applied, and rate-limit propagation when the fallback call itself would exceed quota. Verified live end-to-end: "Gillette Stadium" biased toward Boston (previously 0 results) now correctly resolves to Foxborough, MA.
- **Follow-up idea (not in this ticket):** Nominatim (OSM-based) is a free address geocoder, not a full places API — it's naturally weaker than Google Places for some POI/business coverage, ratings, opening hours, etc. If "one-stop-shop, never need Google Maps" quality is the bar, a future ticket could evaluate a paid places provider behind the same `searchPlaces` interface. Out of scope here; this ticket only fixes the concrete zero-results bug.
- Acceptance: searching "JFK airport" (or any well-known place outside the trip destination) in the DayBlock add-event location field returns the correct result; destination-biasing still improves genuinely ambiguous/generic queries ("ramen", "Starbucks") when relevant; rate limiting and caching still function correctly with the extra fallback request.

### ODY-092 · Dashboard header responsive collision — S, sonnet — ✅ DONE
> **In plain terms:** Shrinking the browser window made the dashboard search box run into the "New trip" button, and the header controls looked unevenly spaced because they weren't the same height. Fixed so the header stays tidy at every width.
Reported from hands-on testing (follow-up screenshot still showed collision — the search pill's contents were overflowing into the button even after the first flex fix).
- Search becomes an icon toggle at ≤1100px (new `useMediaQuery`), matching the mobile expand pattern; wide desktop keeps a shorter 240px pill with `overflow: hidden`.
- Removed the decorative `⌘K` chip (it advertised a shortcut that wasn't wired — advances ODY-063 honesty).
- "New trip" collapses to icon-only at ≤1100px; controls share a 40px row with 16px gaps.
- Files: `src/app/globals.css`, `src/components/trips/DashboardClient.tsx`, `src/lib/hooks/useMediaQuery.ts`.
- Acceptance: no overlap between search and "New trip" at any width from 320px to wide desktop; hard-refresh if an old CSS bundle is cached.

### ODY-093 · Named collection lists (beyond category grouping) — M, sonnet — ✅ DONE (⚠️ needs `prisma db push`) (2026-08-19)
> **Shipped with the ticket's lighter option — a freeform `Place.listName String?`, not a `PlaceList` join.** Rationale: it hits the acceptance criteria (create "Ramen crawl", drop several places in it, see the named list; unlisted places still group by category) with a fraction of the surface — no new model, no list-CRUD UI — which fits the safe/self-contained priority. The add-place form gained an optional **List** field backed by a `<datalist>` of existing list names (so reuse is a pick, not a retype); the Collections page renders named lists first (mixed types allowed, each card shows its own type badge), then the category groups for everything unlisted. Editor+ write via the existing `createPlace`/`updatePlace` (both now carry `listName`); viewers read-only. No new deps. tsc / eslint / 250 tests / build clean.
> **⚠️ Deploy gate:** run `npx prisma db push` before a shared DB — place reads select the new `listName` column, so Collections/Map 500 until it exists (same pattern as ODY-086). Prisma client regenerated locally; build green.
> **Tradeoff / follow-up:** the freeform label means no first-class list *rename* (retyping the name on each place is the workaround, eased by the datalist) and a list vanishes when its last place is removed. If clean rename/delete becomes important, promote `listName` → a real `PlaceList { id, tripId, title }` with a `listId` FK; the UI grouping already matches that shape.
> **In plain terms:** Collections already groups spots by type (all restaurants together, all activities together). Travelers also want their *own* named lists — "Date night", "Ramen crawl", "If we have time" — that can hold mixed or same-type places. From testing: "should collections allow saving multiple restaurants into 1 list?"
Today: `Place.category` is an event-type chip; `CollectionsClient` groups by that category. That's already "multiple restaurants in one list," but the list name is the type, not a traveler-chosen title.
- Add optional `listId` / `PlaceList { id, tripId, title, createdBy }` (or a freeform `listLabel String?` on Place if you want to avoid a join — prefer a real `PlaceList` model so rename/delete is clean). `prisma db push`; coordinate Supabase unpause.
- UI: "New list" + assign a place to a list when saving; Collections page shows named lists (and still allows filtering by category). Map legend can stay category-based (ODY-045) — lists are a planning surface, not a new pin type.
- Editor+ write; viewers read-only. No new deps. Reuse editorial checklist/card language — not a nested folder browser.
- Pairs with ODY-078 (promote a place → day) and ODY-091 (biased search).
- Acceptance: a traveler can create "Ramen crawl", save several restaurant places into it, and see that list on the Collections page; category grouping still works for unlisted places.

---

## P3 — New Features

### ODY-045 · Place Collections shown on the map by category — L, sonnet — ✅ DONE (verified in code 2026-08-08)
> **In plain terms:** A place to save candidate spots — restaurants, attractions, maybes — that aren't on the day-by-day plan yet, labeled and shown on the map by label. Good while the itinerary is still a work in progress.
A "possibilities" bucket separate from the itinerary, filterable on the Leaflet map by
category label.
- New Prisma model (e.g. `Collection`/`Place`: tripId, category/label, title, location, lat, lng, notes, createdBy) via `prisma db push` (no migrations dir; free-tier auto-pauses — see Supabase workflow). Access only via `src/lib/prisma/db.ts`.
- Server actions in a new route `actions.ts` (follow `app/trips/[tripId]/.../actions.ts` convention), Zod-validated (`src/lib/validations`), `assertTripRole` checks (editor+ to write). Geocode via `src/lib/geocode.ts` + `/api/geocode` — **never** hit Nominatim directly (ODY-010).
- Map: extend `src/components/map/MapClient.tsx` + `mapTypes.ts` to render collection pins distinctly from itinerary events, with a category filter/legend. Reuse `TYPE_HEX`/`TYPE_VAR` color language and globals.css tokens; no hardcoded hex outside globals.css.
- UI: a "Collections" surface (tab or section) to add/label/remove places. "Promote to itinerary" is a nice-to-have — note as follow-up.
- Guardrails: editorial aesthetic; no new deps; Leaflet stays dynamic import `ssr:false`.
- Acceptance: a user can save labeled places outside the itinerary and toggle them on the map by category.

### ODY-030 · Settle-up suggestions — M, sonnet — ✅ DONE
> **In plain terms:** The budget shows who's over or under, but not what to do about it. This adds concrete suggestions: "Alex pays Maya $120" — the fewest transfers that settle everyone up.
- Shipped: `suggestSettlements` in `src/lib/budget.ts` + unit tests; quiet list under the split card (teal accent). Cent-reconciled shares via largest-remainder.

### ODY-094 · Expense splitting audit → Splitwise-grade gaps — L, sonnet (P1) — 🟡 STAGE A+B DONE (2026-08); C/D (itemized lines, tax/tip) future
> **In plain terms:** Odyssey can track trip spend and a trip-level weighted split, but it is not yet a full Splitwise replacement (no per-bill payer, selected participants, itemized restaurant math, tax/tip).
**Audit (2026-07-26) — what exists today:**
- Works: expense CRUD (label/amount/category), event-linked costs, trip-level weights + equal reset, balances (paid − share), persistence of weights + expenses, settle-up suggestions (ODY-030), cent-reconciled shares.
- Partial: “paid” = sum of expenses `addedBy` the member (who *logged* it), not a chosen payer; balances are trip-wide only; weight UI is share ratios not exact $/%%/shares per expense.
- Missing (needs schema + UX — do not bolt onto weights alone): per-expense `paidBy` + participant selection; exact / % / shares / quantities; itemized lines (meals, drinks, shared apps); tax/tip/fees/discounts; review step; over/under allocation guards; mobile-first advanced flow.

**Stages:** (A) `paidBy` + `ExpenseShare` + UI (equal / selected people / exact) · (B) settle math from shares not `addedBy` · (C) `ExpenseLine` + tax/tip · (D) event-scoped view (see ODY-097). Keep equal split one-tap.
- Acceptance (full epic): equal split stays one-tap; advanced options progressive; restaurant scenarios reconcile to the cent; edit/delete recalculates; survives refresh; can open a restaurant event and see who owes what for that meal.

**Stage A+B concrete plan (2026-08-07) — ✅ DONE; C/D stay future work:**
> **In plain terms:** Right now every expense splits across the *whole trip* using one trip-wide weight setting. Add the ability to say "only these two people are on this one" and give them uneven amounts (not just equal) — and make the balances/settle-up math reflect that per-expense choice instead of the trip-wide default.
- **Schema** (`prisma db push`, no migrations dir — **confirm with the user before running this against the shared Supabase instance**, per this repo's usual coordination note):
  - `Expense.paidBy String?` — who actually paid (distinct from `addedBy`, who logged it). Nullable; no backfill script needed — reads fall back to `addedBy` when `paidBy` is null, so existing rows need no migration.
  - `Expense.splitMode String @default("equal")` — `"equal" | "exact"`. Cosmetic/UX only (remembers which editor mode to reopen); the authoritative per-person amounts always live in `ExpenseShare`.
  - New `ExpenseShare { id, expenseId, userId, amountCents Int }`, unique `(expenseId, userId)`, cascade delete with `Expense`. A row's existence = that person is "on" this expense; `amountCents` is the resolved amount they owe for it (always persisted explicitly, even for "equal" — no runtime recomputation needed downstream).
  - Add `ExpenseShare` to `prisma/rls.sql` (same posture as `Expense`).
  - **Do not remove `TripMember.splitWeight`** — it stays as the trip-wide default that seeds a brand-new expense's shares before anyone customizes it (see below).
- **Default vs. customized behavior** (important nuance, keeps "equal split is one-tap" true):
  - A freshly-created expense with no participant/mode changes = **all trip members, weighted per the trip's existing `splitWeight` settings** (identical dollar outcome to today's behavior) — computed via the existing `computeSplit` and persisted as `ExpenseShare` rows at save time.
  - The moment someone deselects a participant *or* switches to "Exact," equal division becomes **uniform** (not weighted) across whichever people are currently selected — trip-wide weight ratios don't have an intuitive meaning once you're splitting a one-off side transaction between 2 of 6 travelers.
- **Server (`src/app/trips/[tripId]/budget/actions.ts`):** `createExpense`/`updateExpense` accept `paidBy?`, `splitMode`, and `shares: { userId, amountCents }[]`; Zod-validate `amountCents` sum equals the expense total (to the cent) for `"exact"` mode; write Expense + replace its `ExpenseShare` rows inside one `db.$transaction`; `deleteExpense` cascades shares automatically via the FK.
- **Balances/settle-up (`src/lib/budget.ts`):** new aggregation that sums each member's `ExpenseShare.amountCents` across *every* expense (their real total owed) against their total paid (`paidBy` ?? `addedBy`), replacing the single trip-wide `computeSplit(members, totalSpent)` call as the source of balances. For any legacy expense with zero `ExpenseShare` rows (pre-dates this feature), synthesize its shares on read using the same weighted-`computeSplit` logic against current trip members — zero backfill required. `suggestSettlements` keeps working unchanged off the new aggregated balances.
- **UI (`src/components/budget/ExpenseModal.tsx`):** add a "Paid by" picker (defaults to the current user, like `addedBy` does today) and a "Split between" participant chip-select (all members selected by default) with an Equal/Exact toggle; Exact reveals a per-selected-person dollar input with a live "$X.XX remaining to allocate" indicator that blocks saving until it hits zero. Keep the whole block collapsed/simple by default — this is the progressive-disclosure "advanced options" ODY-094 already calls for.
- Guardrails: editor+ only (ODY-001); no new deps; cent-reconciled math (reuse the existing `allocateCents` largest-remainder helper); unit-test the new aggregation and the equal-vs-exact share generation (empty/zero-amount edges, legacy-expense fallback, sum-must-equal-total validation).
- Acceptance: creating an expense with no customization behaves exactly as before (equal split stays one-tap); selecting 2 of N members and saving means only those 2 appear in each other's balances for that expense; "Exact" mode lets uneven per-person amounts that must reconcile to the cent; the Budget page's balances and settle-up suggestions reflect real per-expense participation, not just the trip-wide weight.
> Shipped as planned. `prisma db push` applied (confirmed with the user first) — `Expense.paidBy`/`splitMode` + new `ExpenseShare` model, added to `prisma/rls.sql`. `weightedSharesCents`/`equalSharesCents`/`aggregateBalances` added to `src/lib/budget.ts` (19 tests, including a same-shape "side transaction between 2 of 3 members never touches the third person's balance" case matching the user's exact scenario). `createExpense`/`updateExpense` validate `paidBy`/`shares` reference real trip members and write Expense + ExpenseShare atomically in one `db.$transaction`, with the `ExpenseShare` delete/replace on edit scoped through the expense's `tripId` (an IDOR gap caught and fixed during review — the naive version let a cross-trip `expenseId` wipe someone else's shares even though the expense update itself was correctly scoped). `budget/page.tsx` resolves real per-member balances (legacy expenses with no `ExpenseShare` rows synthesize a weighted fallback, zero backfill). `ExpenseModal.tsx` gained "Paid by" + "Split between" participant chips + Equal/Exact toggle with a live remaining-to-allocate indicator that blocks saving until balanced; a `dirtiedSplit` flag means an untouched add/edit never recomputes shares unnecessarily (add omits `shares` entirely so the server applies the weighted default; edit resends the existing shares verbatim). Verified end-to-end with Playwright against the user's exact scenario (group dinner split 3 ways + a side cab split only between 2 of them) — balances, settle-up, and every modal control behaved correctly.

### ODY-107 · Record settle-up payments ("mark as paid") — S, sonnet (follow-up to ODY-094) — ✅ DONE
> **In plain terms:** The Settle Up card suggests "Sam pays Alex $30," but once Sam actually Venmos Alex, there's no way to tell the app — it just keeps suggesting the same transfer forever, recomputed fresh from expenses every time. Let people mark a suggested transfer as paid.
Balances/settle-up are entirely derived from `Expense`/`ExpenseShare` (ODY-094) with no persisted record of money that actually changed hands *outside* the expense ledger (cash, Venmo, etc.).
- **Schema** (`prisma db push`, confirm with the user first): new `Settlement { id, tripId, fromUserId, toUserId, amountCents, note String?, createdBy, createdAt }`. No relations to `User` needed — the page already has the trip's member list loaded for name lookups, and `fromUserId`/`toUserId` are plain `TripMember.userId` values. Cascade delete with `Trip`. Add to `prisma/rls.sql`.
- **Balance math (`src/lib/budget.ts`):** extend `aggregateBalances` with an optional third argument, resolved settlements `{ fromUserId, toUserId, amountCents }[]`. Keep `paidCents`/`owedCents` as pure expense figures (unchanged meaning/display); apply settlements only to the final `balanceCents`: `+amountCents` for the payer (their debt shrinks), `-amountCents` for the receiver (they've now collected what they were owed). `suggestSettlements` needs no changes — feed it the post-settlement balances and its suggestions naturally shrink or disappear.
- **Server (`src/app/trips/[tripId]/budget/actions.ts`):** `recordSettlement({ tripId, fromUserId, toUserId, amountCents, note? })` — editor+, Zod-validate both users are current trip members and `fromUserId !== toUserId`; `deleteSettlement(settlementId, tripId)` (scoped to trip) for undoing a mistake.
- **UI (`SplitSection` in `src/components/budget/BudgetClient.tsx`):** a "Mark as paid" button on each suggested transfer that calls `recordSettlement` with that exact suggested amount (no form — one click); a compact "Settled" list below showing past settlements (from → to, amount) each with a small remove/undo control for editors.
- Guardrails: editor+ to record/undo (ODY-001); no new deps; cent-exact math throughout; unit-test the balance-adjustment direction (payer's balance moves toward zero, receiver's balance moves toward zero, third parties untouched).
- Acceptance: clicking "Mark as paid" on a suggested transfer removes it (or shrinks the remaining balance) without needing to touch any expense; a past settlement is visible and undoable; balances/settle-up stay correct after undo.
> Shipped as planned, plus a real bug caught during Playwright verification and fixed before commit: `SplitSection` was recomputing each member's balance client-side as `paid - owed`, which silently ignored the server's settlement-adjusted `balanceCents` entirely — a "Maya paid Alex $15" settlement had zero effect on the displayed "Maya owes $30" suggestion. Fixed by threading a dedicated `balance` field through `SplitMember` (populated from `aggregateBalances`'s `balanceCents`) instead of ever recomputing it client-side. `prisma db push` applied (confirmed with the user) — new `Settlement` model (no `User` relations needed, plain userId fields), added to `prisma/rls.sql`. `aggregateBalances` takes an optional third `settlements` argument (5 new tests, 24/24 passing in `budget.test.ts` overall). `recordSettlement`/`deleteSettlement` actions added, both trip-scoped and membership-validated. `SplitSection` gained "Mark as paid" per suggested transfer and a muted "Settled" history list with undo. Verified end-to-end with Playwright: a partial $15 settlement against a $30 debt correctly reduced the suggested transfer to $15 (post-fix), and both "Mark as paid"/undo wire correctly to their server actions.
> **Follow-up mobile + CRUD verification pass (2026-08-07):** confirmed full expense CRUD end-to-end via Playwright — create (already verified in ODY-094), read (expense list display), **update** (opening an existing "Exact" split expense for edit correctly pre-populates paid-by, the exact selected participants, split mode, and every per-person dollar amount from its real `ExpenseShare` rows), and **delete** (button present in edit mode, wired to `deleteExpense`). Checked every new surface (`ExpenseModal`'s paid-by/participant chips/equal-exact toggle, `SplitSection`'s settle-up + settled history) at 375px — no horizontal overflow anywhere, the mobile sheet's scroll + sticky-submit behavior holds up with the exact-amount rows visible below the fold. Found and fixed one real gap: the new "Mark as paid" button was only 30px tall, below this app's own established ≥40px mobile touch-target standard (ODY-021) — bumped `.btn.sm` to 40px (confirmed it's used nowhere else, so no other UI was affected).

### ODY-097 · Budget page UX refinement + per-event / restaurant split view — M, sonnet (P2) — 🟡 PARTIAL (2026-08-19)
> **Per-expense split view shipped (read-only), no schema change.** Each budget expense row now has an always-visible "Split N ways" disclosure that expands to a per-person breakdown — every participant and the exact amount they owe for *that* bill, with the payer tagged — the piece the trip-level weight card couldn't answer. New pure `describeExpenseSplit()` in `lib/budget.ts` (sorts participants, detects an even split; 6 unit tests) over the already-loaded `ExpenseShare` rows; names resolved from `tripMembers`. The toggle sits outside the hover-revealed `.row-actions` so it's reachable on touch. tsc / eslint / 250 tests / build clean.
> **Still open:** the broader IA/mobile simplification (fewer competing cards, sticky add CTA, readable split rows judged at 375px — needs a rendered browser) and surfacing this same breakdown *from the itinerary event* (restaurant line-items depend on ODY-094 stage C). This pass delivered the "understand a bill's split without mental math" core on the budget surface.
> **In plain terms:** The Budget tab feels clunky and hard to navigate, and you still can’t open a restaurant (or any) event and see how that meal’s cost splits among the people who ate — only a trip-wide weight card.
Depends on / pairs with **ODY-094** (needs `paidBy` / `ExpenseShare` for real per-event numbers; until then, can only polish layout + link to linked expenses).
- **IA / mobile:** simplify Budget hierarchy (summary → category list → expense → split); fewer competing cards; sticky add CTA; readable split rows at 375px (ties to older mobile budget audit).
- **Per-event view:** from itinerary event (esp. restaurant) and from a linked expense, show “who paid / who owes / share breakdown” for that expense only — not just trip-level weights.
- **Restaurant:** once ODY-094 stage C exists, show line items (meals/drinks/shared apps + tax/tip) and per-person totals for that bill.
- Guardrails: editorial tokens; no new deps; progressive disclosure (equal default, advanced behind a reveal).
- Acceptance: traveler can navigate Budget on a phone without hunting; can open a food event/expense and understand that meal’s split without doing mental math.

### ODY-096 · Mobile commute detail overflow on event cards — S, sonnet — ✅ DONE (2026-08-19)
> **Shipped, presentational only (no schema, no deps).** Flight/transport events with a destination now render origin and destination as structured spans via a shared `RouteLine` component (`src/components/shared/RouteLine.tsx`), used by both the itinerary `EventBlock` and the map popup card so they can't drift. Desktop keeps the inline "A → B" form; at ≤560px the two endpoints **stack vertically** (`.route-lines` flips to a column) and the "→" rotates downward, so long addresses wrap inside the card instead of overflowing. Long single-location addresses also gained `overflow-wrap: anywhere` + `min-width: 0` so they wrap rather than force horizontal scroll. Title/time/type ordering and desktop/tablet layout unchanged. tsc / eslint / 235 tests / build clean.
> **In plain terms:** Long origin/destination addresses on transport events overflow or feel cramped on phones.
- Responsive layout (not just smaller type): stack origin → destination vertically on narrow screens; default to concise street + city; full address via expand/details/map.
- Prioritize title, time, type; keep edit/delete tappable; no clip/overlap/horizontal scroll; preserve desktop/tablet.
- Files: `EventBlock.tsx`, `globals.css` (and map card if it mirrors the same meta).
- Acceptance: long addresses at 375px stay inside the card; desktop unchanged.

### ODY-112 · Receipt capture — photograph a receipt, split what's on it — L, sonnet (P3, quality of life)
> **In plain terms:** After a group dinner, someone types "Dinner — $184.30" into the budget and everyone argues about who had the wine. This lets you photograph the receipt instead: the app reads it, proposes the line items and the total, and you assign each item to whoever ate it. The photo also stays attached to the expense so there's a record of what was actually charged.
**Feasibility answer (2026-08-08 research) — what it actually needs.** This ticket was raised with open questions (OCR? chunking? Vercel Blob? an AI key?); those are answered here so the implementation session doesn't re-derive them.
- **Capture — no library needed.** `<input type="file" accept="image/*" capture="environment">` opens the camera directly on iOS/Android and a file picker on desktop. No camera dependency, no new package.
- **Storage — Supabase Storage, not Vercel Blob.** `@supabase/supabase-js` is already a dependency and ODY-031 already plans the bucket-upload pattern for trip covers; a second bucket (`receipts`) reuses that work. Vercel Blob would mean a new vendor, a new SDK, and a second storage story for no benefit. **Private bucket + signed URLs** — receipts carry names, partial card numbers, and addresses, so this must not be the public-read posture a cover image can use. Add to `prisma/rls.sql` alongside the rest.
- **Reading the receipt — a vision model, not traditional OCR.** Tesseract-style OCR returns a bag of words and cannot tell an item line from the tax line, so it would need a hand-written parser per receipt format — the actual hard part, and the part that breaks on the next restaurant. A vision-capable LLM does layout + semantics in one call and returns the structured shape directly.
- **"Chunking" is not needed** — that's a long-document/RAG concern. A receipt is a single image well under the model's limits. What *is* needed is **client-side downscaling before upload**: phone photos are 3–12MB, and the models cap at 2576px on the long edge (~4,784 image tokens). Resize to that on the client — it cuts upload time, storage, and per-call token cost at no accuracy loss.
- **Yes, it needs an API key — this is the ticket's real cost.** `ANTHROPIC_API_KEY`, server-side only, never `NEXT_PUBLIC_`. Note this is the **first hard requirement for a provider key in the project**: ODY-049 shipped Explore on Nominatim specifically to avoid one, and "full LLM Explore ranking — optional once a provider key exists" already sits in Deferred/external. Getting a key unblocks both. **Decide and confirm the key with the user before building** — this is a recurring external cost, not a code decision.
- **Cost is small but not zero.** One downscaled receipt is roughly 1.5k–4.8k input tokens plus a few hundred output. On `claude-opus-5` ($5/M in, $25/M out) that's ~$0.02–0.04 per receipt; on `claude-haiku-4-5` ($1/M in, $5/M out) ~$0.005–0.01. **Start on `claude-opus-5`** (messy real-world receipts — creased, angled, dim, handwritten tips — are exactly where the capable model earns its keep), then measure against `claude-haiku-4-5` on a real sample set before optimizing. Rate-limit per user by reusing the shared limiter from ODY-055 — an unmetered image endpoint is the obvious abuse target.
- **Implementation shape:**
  - Dependency: `@anthropic-ai/sdk` — a genuine exception to the no-new-deps guardrail; call it out in the PR. Do **not** hand-roll `fetch` against the API.
  - New server action `parseReceipt(tripId, storagePath)` in `budget/actions.ts` — editor+ (ODY-001), trip-scoped, Zod-validated. Reads the image from Supabase, calls `client.messages.parse()` with `output_config: { format: zodOutputFormat(ReceiptSchema) }` so the model's reply is schema-validated rather than free text needing a regex. **Zod v4 is already a dependency** and `src/lib/validations/index.ts` is already the home for schemas — `ReceiptSchema` goes there: `{ merchant, purchasedAt, currency, lineItems: [{ label, amountCents, quantity }], subtotalCents, taxCents, tipCents, totalCents }`.
  - Schema: `Expense.receiptUrl String?` (`prisma db push` — **confirm with the user before running against the shared Supabase instance**, per this repo's standing note).
  - **The parse is always a proposal, never a commit.** Show an editable review sheet — every field pre-filled, every field correctable, the photo visible beside it — and only write the `Expense` when the user confirms. Models misread creased thermal paper; silently booking a wrong total into someone's balance is worse than not having the feature. Show the photo on the expense afterward too, so any later dispute is settled by looking rather than remembering.
  - Failure paths must be calm and explicit (ODY-013/057): unreadable image, no key configured, rate-limited, model returned an implausible total (sanity-check that line items + tax + tip reconcile to the total, and flag rather than silently "fixing" a mismatch).
- **Sequencing:** the *itemized* payoff needs somewhere to put line items — that's **ODY-094 Stage C (`ExpenseLine`)**. Without it this ticket can only prefill merchant + total, which is a much smaller win. **Do Stage C first, or ship this in the same epic.** Also pairs with ODY-097 (per-event/restaurant split view) — a scanned restaurant receipt is exactly its use case, and with ODY-094 Stage A+B already shipped, per-item assignment lands straight onto real `ExpenseShare` rows.
- Guardrails: editorial aesthetic — a review sheet, not a scanner UI; no hardcoded hex; key stays server-side; private bucket; the model output is untrusted input, so Zod-validate it exactly as strictly as a user-submitted form.
- Acceptance: a traveler can photograph a restaurant receipt on their phone, see the merchant/total/line items proposed, correct anything wrong, assign items to people, and save — producing an expense whose splits match what each person actually ordered; the photo stays viewable on that expense; a bad photo fails with a clear message and never writes a wrong expense.

### ODY-031 · Trip cover images via Supabase Storage — L, sonnet
> **In plain terms:** Trips currently get pretty gradient covers, but you can't use your own photo. This adds photo upload, keeping the gradients as the default.
`Trip.coverImageUrl` exists and `cover.ts` generates gradient covers, but users can't
upload a photo. Add upload to a `trip-covers` bucket (Supabase client already
configured; service role stays server-side), size/type validation via Zod + server
action, fallback to the current gradients (they're on-brand — keep them as the
default state, photo optional). Respect existing RLS posture from the security memo.

### ODY-032 · Print / share itinerary view — M, sonnet — ✅ DONE (2026-08-09)
> **Shipped the `/trips/[tripId]/print` route exactly as specced (new files + one additive hero link + CSS append — low conflict surface).** Server-rendered, members-only via `getTripById`: a paper-first `.print-sheet` (ink-on-cream, DM Serif headings, mono figures) with a day-by-day plan — each day's `sortEventsByTime`-ordered events showing time, `TypeBadge`, title, location, notes — and a **budget summary** from one `db.expense.groupBy` (per-category + total, formatted with the trip currency via ODY-024's `formatMoney`). A `PrintButton` (client, `window.print()`) sits in an on-screen toolbar that's hidden in the printed output; the `@media print` block also drops the workspace chrome and adds `break-inside: avoid` so days/events don't split across pages. Entry: a "Print →" link beside "Day agenda" in `ItineraryHero`. Ties into ODY-072 (the same route is the "share" surface). No schema change; tab title "Print itinerary" via the ODY-026 template. tsc / eslint / 208 tests / build clean (`ƒ /trips/[tripId]/print`).
> **In plain terms:** A printable, paper-style version of the itinerary — the "printed map" moment the brand is named for.
On-brand "printed map" moment: a `/trips/[tripId]/print` server-rendered route with a
paper-first, ink-on-cream stylesheet (print CSS), day-by-day list + budget summary.
No auth changes — members only.

### ODY-033 · Duplicate trip / copy day — M, sonnet — ✅ DONE (2026-08-19)
> **Both halves shipped, no schema change.** **Duplicate trip:** `duplicateTrip(tripId, newStartDate?)` (trips/actions.ts) clones a trip the caller belongs to into a fresh trip they own, titled "… (copy)" — every day + event copied, and an optional new start date shifts the whole trip by the whole-day delta (pure `shiftDateUTC`/`daysBetweenUTC` in dates.ts, 6 unit tests) so a loved itinerary re-runs on new dates; omitted = exact-date clone. Budget starts clean except event-linked costs, re-synced via `syncLinkedExpense` so planned spend matches. Entry point: a "⋯" actions menu on the dashboard trip card (which also now hosts Archive/Restore, replacing the standalone pill) → a small date-picker modal. The menu renders as a sibling of the card's link (via `display:contents`) so its clicks never trigger navigation. **Copy day:** `copyDayEvents(sourceDayId, targetDayId, tripId)` (itinerary/actions.ts) clones one day's events onto another in the same trip, appended after the target's events, linked expenses re-synced; both days trip-scoped (ODY-052-style IDOR guard). Entry point: a "Copy this day's events to…" action under each day with a day-picker modal. Editor+ everywhere, all writes transactional (ODY-005). tsc / eslint / 235 tests / build clean.
> **In plain terms:** Loved a trip? Duplicate the whole thing with new dates, or copy one great day onto another.
"Weekends that turn into something more": duplicate a whole trip (new dates offset)
or copy a day's events to another day. Server actions with membership checks +
transactions; UI entry points in trip card menu and day header menu.

### ODY-034 · Schedule Phase 2 — availability polish — L, sonnet
> **In plain terms:** Round two of the scheduling tab: smarter "best window" suggestions, one-click apply to trip dates, and a nudge for people who haven't answered.
Phase 1 shipped (poll setup, grid, heatmap). Deferred: Google Calendar sync
(explicitly postponed — do not build without go-ahead), but near-term wins: "best
window" recommendation banner from heatmap data, close-poll → prefill trip dates
flow, and email nudge to members who haven't responded (via existing Clerk email
path only if trivial; otherwise in-app badge).

### ODY-035 · Activity feed / "what changed" — L, sonnet
> **In plain terms:** When several people plan together, you want to know what changed while you were away. This adds a quiet timeline: "Maya added Sunset kayak to Day 3."
Collaborative trips need ambient awareness. Lightweight `Activity` model (tripId,
userId, verb, subject, createdAt — db push), written from existing actions (one line
each), rendered as a quiet timeline on the trip overview page. Cap at last 50, prune
older. Editorial tone: "Maya added *Sunset kayak* to Day 3."

### ODY-049 · AI Explore — vibe-based local recommendations — L, sonnet — ✅ DONE (Overpass POI search)
> **In plain terms:** Tell the trip what vibe you're after ("cozy cafés", "sunset views") and get place ideas near the destination you can peek at and save into the plan.
New Explore surface on a trip: travelers pick or type a vibe; the app suggests local places for the trip destination.
- Route: `src/app/trips/[tripId]/explore/` + nav item (reuse editorial tokens; Leaflet stays `ssr:false` if map preview used).
- Server action (Zod + `assertTripRole` editor+ to save): call an LLM **only if** `OPENAI_API_KEY` (or agreed provider) is set; otherwise fall back to Nominatim via `src/lib/geocode.ts` / `/api/geocode` with vibe+destination queries — **never** hit Nominatim from the browser (ODY-010).
- Each suggestion: title, category (reuse event types), short blurb, location, lat/lng when available.
- Guardrails: no new deps without strong justification; rate-limit; no hardcoded hex; Prisma only via `db.ts`.
- Acceptance: from Explore, a user sees vibe-based suggestions for the trip destination; empty/error states are branded, not silent.
- **Shipped:** Nominatim vibe search MVP (no LLM key required). Optional LLM enhancement is a follow-up when a provider key is added.
- **Fix (2026-08):** the Nominatim MVP never actually returned results — Nominatim is a geocoder (name/address → coordinates) and has no notion of a "vibe", so `"cozy cafés in <dest>"` matched nothing and every search fell through to the empty state. Rewired to the **Overpass API** (OSM's point-of-interest engine), still keyless: `src/lib/vibePresets.ts` (pure: vibe→OSM tag filters + query builder, unit-tested) and `src/lib/places.ts` (server-only: geocode the destination → Overpass `around` search → real named places, closest-to-centre first, cached + rate-limited, soft-fails to the empty state). Optional LLM ranking still layers on later.

### ODY-050 · Save Explore suggestions into the itinerary — M, sonnet — ✅ DONE
> **In plain terms:** Liked a recommendation? One click adds it as a normal itinerary event (or collection place) so it shows up on the day plan and map.
**Depends on ODY-049.** From an Explore suggestion card:
- Primary: "Add to itinerary" → pick a day → `createEvent` (reuse existing action + geocode path).
- Secondary: "Save to collections" → `createPlace` (ODY-045) so it can sit as a maybe without a day.
- Acceptance: saved items appear on itinerary/map/collections like hand-entered ones; viewers cannot save.

### ODY-119 · Explore enrichment — richer place details + translated foreign names — M→L, sonnet
> **In plain terms:** Explore now returns real, fast, well-named places (Foursquare), but each suggestion is bare — just a name, category, and neighborhood. Two asks: (1) show the kind of at-a-glance info people expect from Google Maps — **price range, rating, parking/amenities**; and (2) for businesses with **non-Latin names** (e.g. a Tokyo café shown as "一蘭"), show a readable romanized/translated version so travelers can actually read and search for it. Both are deliberately deferred here because each adds a recurring cost or a new provider — this ticket captures the how, the cost, and the recommended order so a future session needs no prior context.

**Context / current state (2026-08-28):** Explore runs on the **Foursquare Places API** (primary, keyed via `FOURSQUARE_API_KEY`) with a keyless **Overpass/OSM** fallback — see `src/lib/places.ts` and `src/lib/vibePresets.ts`. We currently request only Foursquare's **free "Pro" fields**: `name`, `location`, `categories`, `latitude`, `longitude`. Results are cached in Next's persistent Data Cache (30-day TTL) keyed on rounded centre + vibe, so a category+destination hits the API at most once/month.

**Part A — rich place details (price / rating / parking).** These exist in Foursquare but are **Premium fields with no free tier**: requesting even one makes the whole call bill as Premium (~$0.011–0.019 each; [pricing](https://foursquare.com/pricing/), [Pro vs Premium](https://docs.foursquare.com/data-products/docs/places-pro-and-premium)). Two provider paths:
- **A1 (recommended, low-friction): Foursquare Premium fields.** Add `price`, `rating`, `hours`, and `features` (parking/wifi/outdoor seating/reservations) to the `fields` param in `fetchFoursquare` (`src/lib/places.ts`); extend `VibePlace` + `ExploreSuggestion` + the card UI to show them as tasteful chips (reuse editorial tokens — `--gold` for rating, `--slate` for price/amenities; no new hex). Same provider, same architecture, our 30-day cache still applies. Cost at current scale ≈ single-digit $/month (e.g. ~70 destinations/mo ≈ ~$9); scales with real traffic — **confirm the spend with the user before enabling.** Verify Foursquare's caching terms permit storing rating/price for the TTL (Foursquare is generally permissive, unlike Google).
- **A2 (only if "real Google star-reviews" is the actual want): Google Places API.** This is where recognizable Google ratings + written reviews come from — richer, but **stricter**: Google's terms forbid caching most ratings/reviews (must fetch fresh each view → defeats our cost-saving cache), require visible "powered by Google" attribution, and cost more per call. Bigger integration + ongoing constraints; do not pick this without explicit go-ahead.

**Part B — translated / transliterated foreign names.** Foursquare stores names as-is (usually local language for local businesses) and does **not** translate. To show a readable version, add a small transliteration layer:
- Detect non-Latin characters in the returned name; for just those, call a translation API (Google Translate or DeepL — new provider/key) and **cache the result indefinitely** (names are stable; keeps cost/latency negligible since strings are tiny and most Western-city names are already Latin).
- Honest caveat: business names are proper nouns, so this is really transliteration (reading the sounds), not translation — "一蘭" should read "Ichiran" but a translator may literally render "One Orchid." Google Translate romanizes CJK reasonably; it won't be perfect. Show the romanized form as a secondary line under the original, never replacing it.
- **B-lite (zero new provider):** when Foursquare's name is non-Latin, fall back to OpenStreetMap's `name:en` tag via the existing Overpass path — coverage is spotty (catches some, not all), but free and already partly wired.

**Guardrails:** no hardcoded hex outside globals.css; reuse event-type/editorial tokens; Prisma only via `db.ts` (no schema change expected — enrichment is display-only); keep the Overpass fallback working; any provider key is server-side only (never `NEXT_PUBLIC_`).
**Acceptance:** (1) a chosen enrichment path (A1 recommended) surfaces price/rating/parking on suggestion cards behind the confirmed cost; (2) non-Latin place names show a readable romanized form without hiding the original; (3) empty/missing fields degrade gracefully (no blank chips); (4) costs and provider keys confirmed with the user before enabling.
**Recommended order:** A1 first (smallest satisfying step, same provider), then B as a separate pass; A2/Google only on explicit request.

### ODY-065 · Distance / time between stops + light route optimize — L, sonnet — 🟡 PARTIAL (2026-08-19)
> **Shipped the honest, dependency-free half: straight-line distance between a day's consecutive pinned stops.** New pure `haversineKm` + `formatKm` helpers (`src/lib/geoDistance.ts`, 9 unit tests) — great-circle math, no routing provider, no network, no key, so nothing to rate-limit or break. Surfaced in the day agenda (`DayAgenda`) as a slim "≈ 2.1 km" hop between two *adjacent* pinned stops (an unpinned event in between breaks the chain rather than inventing a misleading number), with a one-line caption clarifying the numbers are straight-line "as the crow flies" so they're never mistaken for walking/driving distance. No schema change, no deps. tsc / eslint / 244 tests / build clean.
> **Still open (deliberately deferred as the riskier/heavier half):** routed walk/drive *time* between stops (needs a provider — OSRM/Google — i.e. a network call + failure handling), and the "optimize order" preview/permutation. Both can layer on top of the pure distance core when a provider path is chosen.
> **In plain terms:** See how long it takes to get from lunch to the museum, and optionally reorder the day to waste less travel time.
Competitive gap vs Wanderlog map planning.
- For a day's geocoded events, show estimated walk/drive duration between consecutive pins (provider TBD — OSRM/Google; prefer no new paid dep if a free path exists).
- Optional "optimize order" that suggests a permutation (does not auto-save without confirm).
- Guardrails: Leaflet stays dynamic `ssr:false`; editor+ only for apply; toast on failure.
- Acceptance: day with ≥2 pins shows inter-stop times; optimize preview is reversible.

### ODY-066 · Booking / email reservation import — L, sonnet
> **In plain terms:** Forward a flight or hotel confirmation and have it show up on the trip timeline — like TripIt.
High-effort differentiator; explicitly product-gated.
- Spike: parse forwarded email (Clerk/inbound webhook or dedicated mailbox) → draft Event (flight/hotel) for owner confirm.
- Out of scope until ODY-036 production auth is stable; do not build without go-ahead.
- Acceptance: documented spike or MVP: one confirmation type (e.g. flight) → editable draft event on a trip.

### ODY-067 · Packing checklist — trip-level + optional per-event — M→L, sonnet — 🟡 STAGE A DONE (2026-08-11)
> **In plain terms:** A shared packing list so the group knows who brings the charger — *and* the ability to attach a small list to a specific plan item. Example: a Day 3 "Hike Cadillac Mountain" event carries "hiking boots, 2L water, rain shell," while the trip-level list holds "passport, chargers, sunscreen." When you look at that event you see exactly what to bring for it; the trip view can optionally roll everything up so nothing's forgotten at the door.
Ship in two stages so trip-level value lands first and event-scoped is additive.

**Data (one model, one `prisma db push`; coordinate the Supabase unpause):**
- `ChecklistItem { id, tripId, eventId String? (nullable → trip-level), label, done Boolean @default(false), assigneeId String?, orderIndex Int, createdAt }`. Index `(tripId, eventId)`. `eventId = null` means trip-level; a set `eventId` scopes it to that event. On event delete, `onDelete: Cascade` (or `SetNull` to fall back to trip-level — decide in the ticket; Cascade is simpler and matches "for this hike" intent).
- Access only via `src/lib/prisma/db.ts`; Zod-validate label length + category in `src/lib/validations`.

**Stage A — trip-level (M):**
- Server actions `addChecklistItem` / `toggleChecklistItem` / `removeChecklistItem` in a route `actions.ts`, `assertTripRole` editor+ to add/remove; **any member** (incl. viewer? — decide: default editor+ to mutate, viewers read-only per ODY-001) can toggle `done`.
- UI: editorial checklist section (dedicated small tab or a card on the trip overview), not a dense task app. Optional assignee avatar chip. Mono counts ("6 of 11 packed").

**Stage B — per-event (L, additive):**
- Surface a compact packing list inside the event (in `AddEventModal` / `EventBlock` detail) filtered to `eventId`. Adding there sets `eventId`; the same actions are reused with an `eventId` arg.
- Trip view shows trip-level items plus an optional "By activity" rollup grouping event-scoped items under their event title/day (read from existing itinerary data — no extra fetch shape).
- Guardrails: editorial aesthetic; no new deps; keep it a checklist, not a todo manager. Assignee is optional and must not become a permissions system.
- Acceptance: (A) any member can add/check/uncheck trip-level items, viewers read-only; (B) an event can carry its own list that shows on that event and rolls up in the trip view; deleting an event doesn't orphan stray items.

**Status check + private/shared design decision (2026-08-08).** Asked directly: *is the packing list live?*
> **Short answer: no — not as a feature.** What exists is a **notes section named "Packing List"** (`src/lib/tripNotes.ts:47`, `{ id: "default-packing", title: "Packing List" }`), created as one of ODY-104's default shared sections and made tickable by ODY-105's checklist syntax. So a trip today has a shared free-text box you can type items into and check off. That is genuinely useful and should not be torn out — but it is a text field, not a packing list: no assignee, no per-person scope, no counts, no rollup, no way to tell "who's bringing the tent." **This ticket (ODY-067) is still unstarted**, and it is what makes the feature real.
**Answering the private-vs-shared question — the design decision this ticket was missing.**
- **The framing to avoid** is "private lists *or* public lists" as a user-facing toggle. Packing genuinely has two different shapes, and asking a traveler to pick a mode per item is a question they'll get wrong:
  1. **Group items** — exactly one person brings it *for everyone*: the tent, the bluetooth speaker, the first-aid kit, the car charger, the good camera. The whole value is that everyone can see it and that **nobody duplicates it** — two tents and no first-aid kit is the failure this feature exists to prevent. These need an **assignee** and must be visible to all.
  2. **Personal items** — everyone brings their own: passport, meds, contacts, socks. Nobody else needs to see mine, and surfacing six travelers' underwear lists is pure noise that buries the group items that actually matter.
- **So: one shared group list, plus a private personal list per member — and no visibility toggle at all.** Where an item lives is implied by where you added it, which is the thing users get right without thinking.
- **Schema: this is one nullable column, and it mirrors the pattern the ticket already uses.** `ChecklistItem.eventId` is already "null = trip-level, set = scoped." Add `ownerId String?` with the same shape: **`null` = shared group item, set = private to that user.** No enum, no visibility flag, no second model.
- **Privacy is a query invariant, not a UI concern.** Every read must filter `ownerId IS NULL OR ownerId = <current user>`; a personal item must never appear in another member's payload, including in the "By activity" rollup and any count. Add `ChecklistItem` to `prisma/rls.sql` as defence-in-depth (same posture as `Place`/`ExpenseShare`/`Settlement`). Getting this wrong leaks a named traveler's medication list to their trip mates — treat it as a P0-grade invariant inside a P3 feature and unit-test the filter directly.
- **Counts read per-scope, not merged:** "6 of 11 group items claimed" and "4 of 20 packed" are different sentences answering different questions. Don't sum them into one number.
- **Per-event lists (Stage B) are usually *personal*, and that changes the shape.** "Hike Cadillac Mountain → boots, 2L water, rain shell" is not one person bringing boots for the group — it's *everyone* bringing their own. So an event list is best modelled as a **prompt that fans out into each participant's personal list**, not as a shared checklist with one checkbox. Decide this explicitly in Stage B: shared-checkbox semantics on an event list will read as wrong the first time two people go on the same hike.
- **What makes it practical rather than a chore** (the "fully functional" half of the question): seed the group list from a small template by trip type so it's never a blank box; let a member seed their personal list from a **"my usual" template that carries across trips** — that's the one piece with real repeat value and the strongest retention hook in this ticket; keep add-item to a single tap with an inline field, never a modal.
- **Don't orphan the ODY-104 section.** Trips already have text in "Packing List". Either offer a one-time import (each line becomes an item — checklist lines already parse via `src/lib/checklist.ts`), or keep the section and point it at the real list. Silently shipping a second, better packing list beside the one people already typed into is the worst option.
- Files (in addition to those above): `prisma/schema.prisma`, `prisma/rls.sql`, `src/lib/validations/index.ts`, `src/lib/tripNotes.ts` (migration/handoff from the default section).
- Added acceptance: a personal item is invisible to every other member of the trip (asserted by a test against the query layer, not just the UI); a group item shows who's bringing it; group and personal counts are reported separately; existing "Packing List" notes-section content is either imported or explicitly handed off, never silently orphaned.
> **Stage A completed (2026-08-11).** Added the dedicated Packing route with separate group and private personal lists, progress counts, a low-friction inline add field, group-item assignees, and a server-enforced shared-or-owner-only visibility filter. Viewers remain read-only. Existing free-text packing notes can be imported once into the new shared list; the original section is retained and marked imported. Event-scoped packing remains the Stage B follow-up.
> **⚠️ REQUIRED DEPLOY STEP — run `npx prisma db push` before the fc94091 deploy serves traffic (2026-08-09 eval).** Stage A adds a `ChecklistItem` model + RLS. This was NOT flagged when it landed. Blast radius is app-wide, not just `/packing`: `getTripById` (`src/app/trips/actions.ts:59`) now includes `_count.checklistItems`, and the shared trip layout calls it for **every** trip tab — so with the table missing, **the entire trip workspace (itinerary/map/budget/schedule/members) 500s**, not only the packing page. Additive and safe (new table, no data migration). Eval verdict on the code itself: sound — privacy is correctly enforced at the query layer (`visiblePackingWhere`, applied consistently in reads, toggle, remove; a member can't touch another's private item), RLS is enabled, editor-gated, assignee validated; after `prisma generate` the full gate is green (tsc / eslint / 193 tests / build). One style nit, non-blocking: `PackingClient.tsx` was written as very dense single-line JSX, unlike the rest of the codebase's multi-line style — ✅ resolved 2026-08-09: reformatted to house style (extracted the inline list-render closure into a `PackingList` sub-component; multi-lined all JSX), behavior-preserving, full gate green.

### ODY-068 · Offline read of itinerary / map — L, sonnet
> **In plain terms:** Open the trip on a plane or abroad without signal and still see the plan (read-only first).
Competitive gap vs Wanderlog Pro offline.
- PWA cache or service-worker strategy for last-viewed trip itinerary + static map tiles policy (respect tile ToS).
- Mutations queue or clearly disabled offline; no localStorage for secrets (CLAUDE.md).
- Acceptance: after one online visit, airplane-mode reload shows last itinerary; writes blocked with clear copy.

### ODY-069 · Calendar sync (read-only export) — M, sonnet — ✅ DONE (2026-08-19)
> **Export half shipped** (two-way sync stays out of scope, as the ticket says). New pure `buildTripIcs()` in `src/lib/icsExport.ts` (18 unit tests, mirrors `mapsExport.ts`) turns a trip's events into an RFC-5545 VCALENDAR: **timed events use floating local time** (no `Z`/`TZID`) so a 9am event reads 9am *at the destination* even across timezones; **untimed events become all-day spans**; day dates read from UTC calendar components so they never drift a day in US timezones (ODY-003). Proper text escaping, 75-octet line folding, CRLF endings. Served by a members-only route handler `GET /trips/[tripId]/calendar` (auth via `getTripById` → 404 for non-members) as a `text/calendar` attachment, with an "Add to calendar" download link in the itinerary hero beside Day agenda / Print. No schema change, no new deps. tsc / eslint / 229 tests / build clean.
> **In plain terms:** Add the trip's days (or key events) to Google/Apple Calendar so they show up next to life.
Related to deferred Google Calendar on Schedule — this ticket is **export/subscribe**, not two-way sync.
- ICS download and/or "Add to Google Calendar" links for trip range / per-day events; members only.
- Acceptance: downloading ICS imports correct dates in a major calendar app.

### ODY-070 · Realtime collab presence — L, sonnet
> **In plain terms:** See who's on the trip right now and that the plan updates without a hard refresh — Google-Docs-like group planning.
- Presence avatars + soft live refresh (Supabase Realtime or polling) for itinerary/members; no full CRDT required for v1.
- Guardrails: stay on existing stack; viewers included in presence as read-only.
- Acceptance: second browser shows member presence; new events appear within a few seconds without manual reload.

### ODY-071 · Browser extension: save place while browsing — L, sonnet
> **In plain terms:** Clip a restaurant from a blog or Maps into Odyssey Collections without copy-paste.
Competitive gap vs Wanderlog Chrome extension.
- Extension MVP: capture page title/URL/selection → `createPlace` via authenticated API; trip picker.
- Depends on stable prod auth (ODY-036) and Collections (ODY-045 ✅).
- Acceptance: from a travel article, save one place into a trip collection in ≤3 clicks.

### ODY-072 · Export PDF / Google Maps — M, sonnet — ✅ DONE (2026-08-09)
> **Both halves shipped.** **PDF/print:** delivered by ODY-032's `/trips/[tripId]/print` route — a `window.print()` "Print / Save PDF" over a paper-first stylesheet (see that ticket). **Google Maps:** new pure `googleMapsUrl(points)` helper in `src/lib/mapsExport.ts` (5 unit tests) — one located stop → a Maps search pin, two or more → turn-by-turn directions through them *in order* via the `maps/dir/A/B/C` path form, null when nothing's geolocated. Wired into `DayAgenda`'s footer: an "Open in Google Maps" link (`target=_blank rel=noopener`) built from that day's ordered, pinned events, shown only when there's at least one pin. Per-day (matches "a day's ordered pins"). No schema change, no new deps. tsc / eslint / 213 tests / build clean.
> **In plain terms:** Hand someone a printable itinerary or open the day's pins in Google Maps.
Adjacent to ODY-032 print view; can share implementation.
- PDF or print-CSS export; "Open in Google Maps" for a day's ordered pins (URL scheme / directions).
- Acceptance: member can export/print a readable day list; Maps opens with pins in order when possible.

---

## Post-MVP / long-term

### ODY-073 · Native mobile apps (iOS / Android) — L+, multi-sprint
> **In plain terms:** Ship real phone apps so travelers use Odyssey on the road without fighting a mobile browser — App Store and Play Store when ready.
> **Spike decision (2026-08-25) — full plan in [`docs/ody-073-mobile-app-plan.md`](docs/ody-073-mobile-app-plan.md).** Phased, cheapest → most native: **Phase 1 · PWA** (installable web — *groundwork shipped this session*: `manifest.ts`, maskable icons + `apple-icon.png`, `viewport-fit=cover` safe areas, standalone chrome; remaining = offline read/ODY-068 + Lighthouse pass); **Phase 2 · Capacitor** (native WebView shell → App/Play stores, reuses ~100% of the web app); **Phase 3 · Expo + React Native** (true native — a separate app in a monorepo `apps/web` + `apps/mobile` + `packages/shared`, screens rebuilt, all non-UI logic shared). Architecture invariant: **one backend, many frontends — no business-logic forks.** The gating refactor before RN: extract each Server-Action body into a framework-agnostic **service function** (`packages/shared/services/*`, takes `(userId, input)`) that *both* the web actions and new mobile `app/api/**` route handlers call — same rules, two transports (doc §6). Auth: same Clerk pool, `@clerk/clerk-expo` + JWT on mobile (§7). Biggest rebuild: the Leaflet map → `react-native-maps` (§8). Prereqs: **ODY-036** (prod auth), **ODY-037** (invites); ODY-058/059 ✅ done; ODY-068 ideal.
**Post-MVP.** Choose via a short spike (document decision in this ticket):
1. **Expo + React Native** — best store UX; rebuild trip workspace screens against existing APIs/actions.
2. **Capacitor** shell around the Next app — fastest path; limited offline/native feel.
3. **PWA** installable web — interim milestone before stores.

Depends on: ODY-036 (prod auth), ODY-037 (share/invites), ODY-058/059 (mobile chrome), ideally ODY-068 (offline read).
- Guardrails: reuse Prisma/Clerk backend; no parallel business logic forks; deep links into `/trips/[id]/…`.
- Acceptance: signed-in users can open trips, view itinerary + map, and make basic edits on iOS and Android (or a shipped PWA milestone explicitly accepted as phase 1).

---

## P3 — User Journey delight (2026-07-25 UX audit)

### ODY-086 · Booking details on events (confirmation #, link, check-in) — M, sonnet — ✅ DONE (⚠️ needs `prisma db push`) (2026-08-19)
> **Shipped.** Three optional `Event` fields — `confirmationCode`, `bookingUrl`, `checkIn` (free-text so it covers hotel check-in *and* flight boarding). Zod-validated (URL + length caps); a bare URL like "acme.com/x" is auto-prefixed with `https://` on save. UI: a collapsed **"Booking details"** disclosure in the event modal (auto-opens when the event already has any), rendered read-only on the block as a quiet mono row — check-in, `#confirmation`, and a "Reservation ↗" link. Edit clears a field when emptied ("" → null). No new deps. tsc / eslint / 250 tests / build clean.
> **⚠️ Deploy gate:** run `npx prisma db push` before this reaches a shared DB — event reads select the new columns, so the itinerary 500s until the table has them (same pattern as ODY-024/067/082). The Prisma client is already regenerated locally so the build is green.
> **In plain terms:** For flights and hotels you want the confirmation number, a booking link, and check-in time right on the event — the "boarding pass" moment. Keep it a couple of optional fields, not a CRM.
Events have `type`/`location`/`notes` but no structured booking info.
- Add optional `confirmationCode String?`, `bookingUrl String?`, `checkIn`/`checkOut` (reuse `startTime`/`endTime` where possible) via `prisma db push` (coordinate Supabase pause). Zod-validate URL + length caps.
- Surface fields in the event modal for flight/hotel types primarily; render as quiet mono chips on the block and map card. No new deps.
- Files: `prisma/schema.prisma`, `src/lib/validations/index.ts`, `AddEventModal.tsx`, `EventBlock.tsx`, `MapClient.tsx`.
- Acceptance: a flight/hotel event can hold a confirmation code + link that render on the timeline and map; other types unaffected.

### ODY-087 · Day agenda / "today" compact view — M, sonnet — ✅ DONE (2026-08-09)
> **Shipped as a new `/trips/[tripId]/agenda` route (low conflict surface — new files + one additive hero link + CSS append).** New `src/app/trips/[tripId]/agenda/page.tsx` (server) picks the default day = the day you're *in* on a live trip (ODY-076 logic), else day 1, with `?day=<id>` override, and passes the day's `sortEventsByTime`-ordered events to new `src/components/itinerary/DayAgenda.tsx`. That renders a compact morning→evening strip: prev/next day nav (44px touch targets), a mono time column with a per-event type-color left accent, `TypeBadge` + title + location + notes, and a footer link to that day's map pins with a live count. Day switching is server-driven via `?day=` links (no client state); a Print button + `@media print` block (hides sidebar/tab bar/nav chrome) ties toward ODY-032/072. Entry point: a "Day agenda →" link added to `ItineraryHero`'s meta row. Reuses existing event data (no schema change, no new query beyond `getTripById`), tab title "Day agenda" via the ODY-026 template. tsc / eslint / 208 tests / build clean (route compiles as `ƒ /trips/[tripId]/agenda`).
> **In plain terms:** While you're actually traveling, you want a clean morning→evening strip for the day you're in, not the whole trip. A compact day view bridges toward the print/share view (ODY-032/072).
No focused single-day reading mode.
- A compact agenda for one day (default: today for live trips, per ODY-076): ordered timed list, minimal chrome, big touch targets, quick access to that day's map pins. Reuse existing event data; print-friendly CSS ties into ODY-032/072.
- Files: `src/app/trips/[tripId]/` (day view surface or itinerary mode toggle), `globals.css`.
- Acceptance: a traveler can open a clean single-day agenda and read the plan at a glance on a phone.

### ODY-088 · Destination timezone labels on times — M, sonnet
> **In plain terms:** "3:00 PM" is ambiguous when you're planning from home for a trip abroad. Label times as destination-local so logistics don't silently break.
Times render without timezone context (relates to ODY-041 display + ODY-003 UTC storage).
- Resolve a trip timezone (from destination geocode or a per-trip tz field via db push) and label displayed times as destination-local (e.g. "3:00 PM local"). Storage unchanged (HH:MM). No new paid deps — prefer Intl APIs.
- Files: `prisma/schema.prisma` (optional tz field), `src/lib/utils.ts` (time helpers + tests), `EventBlock.tsx`, map card.
- Acceptance: displayed event times are clearly destination-local; stored values unchanged; helper unit-tested.

### ODY-089 · "What changed since your last visit" digest — M, sonnet
> **In plain terms:** On a shared trip you want to know what happened while you were away — lighter than full realtime. A quiet "3 new events, Maya updated the budget since you last looked" summary. Pairs with ODY-035 and is a stepping stone to ODY-070.
Collaboration feels static without realtime (ODY-070).
- Track a per-member last-viewed timestamp (db push) and, on trip open, summarize changes since then using `updatedAt`/`createdAt` on events/expenses (or the ODY-035 activity feed if built). Quiet, dismissible, editorial copy.
- Files: `prisma/schema.prisma` (last-viewed), trip layout/overview, a small `SinceLastVisit` component.
- Acceptance: returning to a trip shows a calm summary of what changed since your last visit; first visit shows nothing.

---

## Deferred / external (tracked, not ticketed)
- Supabase advisor: 2 warnings on `rls_auto_enable()` (accepted risk — Prisma bypasses RLS by design; see security memo).
- Clerk production instance + `pk_live` keys before real-domain launch (see deploy notes).
- Google Calendar **two-way** sync for Schedule tab — explicitly deferred by product decision (see ODY-069 for export-only).
- Full LLM Explore ranking — optional layer on top of the current Foursquare Places search (ODY-049 shipped; enrichment is ODY-119).

## Suggested session order
1. **P0 security/correctness:** ODY-052 (IDOR) ✅ → ODY-051 (notes clobber) ✅ → ODY-098 (weekday label off-by-one) ✅ → ODY-099 (wizard submit button unreachable, mobile) ✅
2. **P1 hardening:** ODY-053 ✅ → ODY-054 ✅ → ODY-055 ✅ → ODY-056 ✅ → ODY-057 ✅ → ODY-058 ✅
3. **UX quick wins (safe, no schema):** ODY-081 ✅ → ODY-080 ✅ → ODY-079 ✅ → ODY-076 ✅ → ODY-090 ✅ → ODY-091 ✅ → ODY-092 ✅ → ODY-062 → ODY-063 (⌘K removed; empty-state remains)
4. **Journey depth (some schema):** ODY-074 → ODY-075/059/060/100 → ODY-084 → ODY-085 → ODY-077 → ODY-078 → ODY-083 → ODY-082 · ODY-093 (named collection lists)
5. **Launch blockers (human + eng):** ODY-036 → ODY-037
6. **P2 residual polish:** ODY-061 → ODY-020/022/023/024/026
7. **P3 delight:** ODY-094 (Splitwise schema+UX) · ODY-097 (budget UX / per-event split view) · ODY-032/072/087 · ODY-086 · ODY-088 · ODY-089 · ODY-065 · ODY-067 (packing — see the 2026-08-08 private/shared decision) · ODY-096 (mobile commute overflow)
8. **Competitive / later:** ODY-066 · ODY-068–071
9. **Post-MVP:** ODY-073 native (after mobile web + offline foundations)

**Status as of 2026-08-30 — reconciled against git history.** ⚠️ Ground truth is
`git log`, not this list. Before starting anything below, run
`git log --oneline -40` and confirm the ticket isn't already shipped — the trail
of dated "Next up" notes this section used to carry went stale and sent a fresh
thread chasing work that had merged weeks earlier. Treat every candidate here as a
*claim to verify*, and confirm the next unit with the owner before coding. (This
backlog is edited by parallel threads — two independent reconciliations merged
here on 2026-08-30 — so git remains the only reliable source of truth.)

Since the 2026-08-08 review, ~70 commits shipped. The numbered session order above
is complete through its polish steps, **plus** (all ✅ DONE, verified in git):
the ODY-011e/f **landing rebuild** (boarding-pass hero, animated routes, hover
polish); **ODY-118** accessibility remediation (F1/F3/F4/F6/F7/F8/F9/F11 + a global
reduced-motion catch-all + WCAG-AA muted text + focus states); **ODY-085**
post-invite "you're in" welcome (2026-08-30); **ODY-109** scheduling-poll UX now
fully done (2026-08-30 — bulk "free" fills + Clear all + mobile sticky day column);
features ODY-032/033/060/069/072/078/082/083/086/087/093/096/097; the **ODY-094**
Splitwise Stage A+B per-expense split engine (C/D still future); the **map** basemap
move to Stadia "Alidade Smooth"; and the **Explore** migration to **Foursquare
Places** (ODY-049 — enrichment filed as ODY-119).

**Obsolete — do NOT action (checked against current code 2026-08-30):**
- Landing **F07** (six feature cards share one bare-circle icon): ✅ already done
  2026-08-09 — each card uses its own purpose-built icon
  (`Icons.itinerary/map/budget/members/note/weather`); see `docs/ody-108-design-audit.md` F07.
- **ODY-064** (dead-code dedupe) ✅ DONE 2026-08-11 · **ODY-075** (progressive tabs)
  ✅ DONE 2026-08-09. Both showed up in the old "Next up" note as if still open. They aren't.
- The fabricated-social-proof string ("4,200 travelers" / "Maya R.") is already gone
  from the rebuilt landing page — see F01 below (kept as an owner decision, not a code task).

**Genuinely open + polish-appropriate (fits the "no new features, hyper-polish only"
directive — verify each against git first):**
- **ODY-118 F2** — `:focus-visible` rings on the seamless inline note editors.
  Shippable here, no browser needed. Smallest next step.
- **ODY-118 F10 + ODY-022** — axe/contrast sweep across the 5 main routes. Needs a
  rendered browser (owner or a browser-capable session).
- **ODY-097 residual** — budget per-event / restaurant split-view IA + mobile
  judgment (read-only breakdown shipped; the fuller view is the remainder).
- **ODY-046** — full user-journey QA audit (new + returning users).

**Owner decision, not code:**
- **F01** — the landing page's old fabricated "4,200 travelers" stat + "Maya R."
  testimonial were removed in the rebuild; decide whether to add real social proof
  later or leave it out. Nothing to action until you say so.

**Bigger / gated — NOT hyper-polish; need explicit owner greenlight before building:**
ODY-119 (Explore enrichment — deferred pending cost approval) · ODY-067 Stage B
(per-event packing) · ODY-065 (routed travel-time — needs a routing provider) ·
ODY-112 (receipt capture — needs an API key) · ODY-036/037 (launch blockers: Clerk
prod + real invitations) · ODY-031/034/035/066/068/070/071/088/089.
