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

### ODY-051 · TipTap Notes vs TripNotes clobber the same Note row — M, sonnet
> **In plain terms:** Rich notes and the itinerary's pinned notes fight over the same storage — saving one can wipe the other. This makes one shared notes system that doesn't erase itself.
Two editors write incompatible shapes into `Note.content`: itinerary `TripNotes` saves `{ text }`; TipTap at `/trips/[id]/notes` saves ProseMirror JSON. Last write wins and can blank the other surface.
- Pick one canonical format (prefer TipTap JSON with a plain-text projection, or separate fields).
- Migrate `upsertNote` to Zod-validated schema + max size; update both UIs to read/write that shape.
- Pair with ODY-060 (nav IA) so travelers have one place for trip notes.
- Files: `src/components/itinerary/TripNotes.tsx`, `src/components/notes/TiptapEditor.tsx`, `src/app/trips/[tripId]/notes/actions.ts`, itinerary page note read path.
- Acceptance: saving TipTap never blanks itinerary pinned notes (and vice versa); oversized payloads rejected.

### ODY-052 · createEvent dayId/tripId IDOR — S, sonnet
> **In plain terms:** A sneaky request could attach an event to someone else's trip day. The server must confirm the day belongs to the trip you're editing.
`createEvent` asserts membership on `tripId` only; it never checks that `dayId` belongs to that trip. An editor who knows another trip's day UUID can inject events onto it. Same risk via Explore → itinerary save.
- Before create: `db.day.findFirst({ where: { id: dayId, tripId } })` or reject.
- Apply to `saveExploreToItinerary` path as well.
- Files: `src/app/trips/[tripId]/itinerary/actions.ts`, `src/app/trips/[tripId]/explore/actions.ts`.
- Acceptance: mismatched `dayId`/`tripId` is rejected; honest same-trip creates still work.

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

### ODY-043 · Event form gives no feedback on invalid/failed submit — S, haiku
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

### ODY-053 · Pin invite email origin to allowlisted app URL — S, sonnet
> **In plain terms:** Invite emails should always send people to *our* sign-up page, never a fake one. Right now the link can follow a spoofed request host.
`getAppOrigin()` in members actions builds Clerk invite `redirectUrl` from the request `Host` / `x-forwarded-*` headers. A crafted invite request can point victims at an attacker-controlled "sign-up."
- Prefer `NEXT_PUBLIC_APP_URL` (or a fixed production origin allowlist) for invite redirects; fall back to request host only in local dev.
- Files: `src/app/trips/[tripId]/members/actions.ts`.
- Acceptance: invite emails always use the configured app origin in staging/prod.

### ODY-054 · Zod + trip-scope for updateExpense / eventId — S, haiku
> **In plain terms:** Editing an expense still accepts nonsense numbers, and linking an expense to an event doesn't prove that event is on this trip.
`createExpense` uses Zod; `updateExpense` does not (negative/non-finite amounts, arbitrary category). `eventId` is stored without verifying `event.tripId === expense.tripId`.
- Reuse/extend expense schemas for update; verify event belongs to trip before link.
- Files: `src/app/trips/[tripId]/budget/actions.ts`, `src/lib/validations/index.ts`.
- Acceptance: invalid updates rejected; cross-trip `eventId` rejected.

### ODY-055 · Rate-limit server-side geocode and Explore — M, sonnet
> **In plain terms:** Only the browser search box is throttled. Server Explore and event saves can still hammer the free map service and get the whole app banned.
`/api/geocode` soft-limits per user; `exploreByVibe`, `createEvent`/`updateEvent`/`createPlace` call `searchPlaces`/`geocode` with no shared limiter.
- Share the rate-limit helper from the geocode route into `src/lib/geocode.ts` (or a tiny limiter module) for all server Nominatim callers.
- Files: `src/lib/geocode.ts`, `src/app/api/geocode/route.ts`, `explore/actions.ts`, itinerary/collections actions.
- Acceptance: sustained Explore/event geocode abuse is soft-limited; normal UX unchanged.

### ODY-056 · Place RLS + note payload size limit — S, sonnet
> **In plain terms:** Lock down the new Places table the same way as other tables, and stop notes from accepting huge unbounded JSON.
`Place` (ODY-045) is missing from `prisma/rls.sql`. `upsertNote` accepts arbitrary `object` with no max size (storage DoS / integrity).
- Add `Place` to RLS script (defense-in-depth; Prisma still primary). Zod-validate note content + reasonable byte/char cap.
- Files: `prisma/rls.sql`, `src/app/trips/[tripId]/notes/actions.ts`.
- Acceptance: Place listed in RLS script; oversized notes rejected.

### ODY-057 · Toast remaining silent form failures — S, haiku
> **In plain terms:** Some saves still fail quietly — trip create, expenses, schedule "apply window." Show the same clear toasts events already get.
Residual of ODY-013 / sibling of ODY-043.
- Wrap try/catch + `toast` in `NewTripWizard` create (and surface invite skip), `ExpenseModal`, `AvailabilityHeatmap` apply.
- Files: those three components; reuse `src/components/shared/Toast`.
- Acceptance: induced failures show branded toasts; success paths unchanged.

### ODY-058 · Toast / sheet / map-card z-index above modals and mobile chrome — S, haiku
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

### ODY-042 · Auto-sort itinerary events by start time — M, sonnet
> **In plain terms:** Events should line up in time order on their own instead of making you drag every one into place.
Events currently render only by `orderIndex` (manual dnd-kit order via
`reorderEvents`). Add time-aware ordering without breaking drag-to-reorder.
- Add a per-day sort mode: "By time" (default) vs "Manual" — a small toggle in the day header (`src/components/itinerary/DayBlock.tsx`). Persist per-trip only if trivial (Trip field via `prisma db push`, no migrations dir); otherwise per-card local state defaulting to "By time".
- "By time": sort by `startTime` ("HH:MM" ascending); events with no start time sort last, keeping their `orderIndex` among themselves. Disable the drag handle in this mode. "Manual": current dnd-kit behavior untouched.
- Put the sort in a pure helper in `src/lib` (e.g. `sortEventsByTime`) and unit-test it (Vitest, matching `src/lib/__tests__` patterns): empty-times-last, stable tie-break, 12h/24h-agnostic.
- Guardrails: no new deps, no inline styles, editorial aesthetic intact.
- Acceptance: events with start times appear chronologically by default; drag reorder still works in Manual mode; helper is unit-tested.

### ODY-047 · Cover "skin" doesn't carry to the itinerary page — S, sonnet
> **In plain terms:** The cover look you pick when creating a trip shows on the dashboard card but the itinerary page ignores it and always goes purple. This makes the itinerary match your pick.
`coverIndex` is stored as `"grad:<index>"` in `Trip.coverImageUrl` (`createTripWizard`
in `src/app/trips/actions.ts`) and resolved via `resolveCover`
(`src/components/trips/cover.ts`), but only `DashboardClient`/`TripCard` consume it —
`ItineraryHero` never reads the cover, so it falls back to the default `.hero` styling.
- Pass `coverImageUrl` (+ trip id as seed) into `src/components/itinerary/ItineraryHero.tsx` from `src/app/trips/[tripId]/itinerary/page.tsx`; call `resolveCover(coverImageUrl, tripId)` and apply it via the existing `cover-art` pattern (`style={{ "--cover-img": ... }}` consumed by a globals.css class — the sanctioned dynamic-value exception). Reuse `COVER_ACCENT` like the wizard preview.
- If `TripEditModal` (`src/components/trips/TripEditModal.tsx`) can't already change the cover mood, add the same `COVER_GRADIENTS` picker used in `NewTripWizard` and persist via the update action.
- Guardrails: no hardcoded hex outside globals.css; keep text contrast readable over the gradient.
- Acceptance: the cover mood chosen at creation (and edited later) appears on the itinerary page, matching the dashboard card — no purple default.

### ODY-020 · Landing page honesty pass — S, haiku
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

### ODY-022 · Accessibility pass — M, sonnet
> **In plain terms:** People using a keyboard or a screen reader currently can't operate parts of the app. This makes it work for them — and it's also just better engineering.
Findings: `cat-head` collapse toggles are `<header onClick>` (no keyboard/role),
emoji icons unlabeled in places, autocomplete listbox lacks `aria-activedescendant`/
input `role="combobox"`, color-only category coding in the budget bar.
- Convert clickable non-buttons to `<button>` with `aria-expanded`; complete combobox ARIA in `LocationAutocomplete`; add text/pattern reinforcement where color is the only signal; run an axe pass on main routes.
- Acceptance: keyboard-only operation of itinerary collapse, budget categories, autocomplete; no serious axe violations on the 5 main routes.

### ODY-023 · Weather banner beyond 3 days / graceful absence — S, haiku
> **In plain terms:** The weather banner silently vanishes for past trips or trips far in the future. This makes it always show something sensible.
`fetchWeather` (`src/components/shared/WeatherBanner.tsx:63`) requests `startDate`
→ +2 days from the *forecast* API: past trips and trips >16 days out silently render
nothing, and mid-trip it still shows the start date's weather.
- Clamp the request window to [today, today+15] ∩ trip range; if trip is outside the forecast horizon, show a quiet seasonal placeholder line instead of vanishing ("Forecast opens closer to departure"). °F stays default; optional: unit by locale.
- Acceptance: banner renders something sensible for past, current, near-future, and far-future trips.

### ODY-024 · Money formatting & currency field — M, sonnet
> **In plain terms:** Enter $12.50 and the app shows $13 — cents are hidden and rounding drifts. This shows exact amounts and lets a trip choose its currency symbol.
Amounts are `Float` in Prisma and `fmtMoney` rounds to whole dollars — cents are
entered but silently hidden, and floats accumulate drift.
- Display cents when present (`Intl.NumberFormat`), keep JetBrains Mono for figures. Schema: add `currency String @default("USD")` on Trip (db push per Supabase workflow — no migrations dir); format with the trip currency across budget/itinerary. (Full multi-currency conversion is out of scope.)
- Acceptance: $1,234.56 round-trips intact everywhere; trips can set a currency symbol that all money UI respects.

### ODY-025 · Optimistic UI for reorder & quick edits — M, sonnet
> **In plain terms:** Dragging events feels laggy because the app waits for the server before settling. This makes it feel instant, quietly undoing only if the server disagrees.
Drag-reorder waits on the server round-trip (`reorderEvents`) before settling; day
notes and budget edits similarly lag.
- Use `useOptimistic`/local state reconciliation for event reorder and day-note saves; revert with a toast (ODY-013) on failure.
- Acceptance: drag drops feel instant; server disagreement reverts visibly.

### ODY-026 · SEO & metadata polish — S, haiku
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

### ODY-059 · Mobile nav for 7+ trip tabs — M, sonnet
> **In plain terms:** The phone bottom bar now has too many tabs (Explore, Collections, …) so labels crush. Make switching sections usable at 375px.
After Explore/Collections shipped, `NAV_ITEMS` has 7 destinations; `.mobile-tab-bar` squeezes labels (~50px each).
- Overflow pattern: primary 4–5 tabs + "More" sheet, or scrollable tab strip with ≥40px targets; keep editorial look.
- Files: `src/components/trips/navItems.ts`, `MobileTabBar.tsx`, `globals.css`.
- Acceptance: no crushed/illegible labels at 375px; all sections still reachable in ≤2 taps.

### ODY-060 · One Notes information architecture — S, sonnet
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

### ODY-064 · Dead code and utils dedupe — S, haiku
> **In plain terms:** Leftover unused trip form code and two copies of the same date/money helpers make the house harder to keep tidy.
- Delete or wire unused `TripForm.tsx`; clarify `/trips/new` (redirect-only) in comments or remove if obsolete.
- Deduplicate `@/lib/utils` vs `@/lib/utils/index` (one export path); prefer UTC-aware date helpers from ODY-048.
- Acceptance: no unused TripForm; single utils entry; `tsc`/lint clean.

---

## P2 — User Journey (2026-07-25 UX audit)

> Batch focused purely on the traveler's journey: first-run orientation, honest
> states, and returning-user flow. No new external dependencies. Keep the calm,
> editorial "boarding pass + printed map" tone; palette + type from globals.css.

### ODY-074 · Empty-trip guided first steps — M, sonnet — ✅ DONE
> **In plain terms:** Right after the wizard, a brand-new trip is a blank timeline that feels like a chore, not the start of an adventure. Give first-time planners a calm, dismissible checklist so the trip feels *started*.
- `FirstSteps` on itinerary when `totalEvents === 0`; dismissible session state; viewers get calm copy.

### ODY-075 · Progressive tab reveal for new trips — M, sonnet
> **In plain terms:** Day one, a trip shows seven tabs (Schedule, Explore, Collections…) which is overwhelming before there's anything in them. Start simple and reveal advanced tabs as they become relevant.
`NAV_ITEMS` always renders all 7 destinations regardless of trip state (pairs with ODY-059/060).
- Show a core set first (Itinerary, Map, Members); reveal Schedule when a poll exists or trip has no fixed dates, Explore/Collections once a destination is set or the traveler opts in via a subtle "More" affordance.
- Keep every tab reachable (don't hard-hide) — this is ordering/emphasis, not permission. Reuse the ODY-059 overflow pattern rather than inventing a second one.
- Files: `src/components/trips/navItems.ts`, `WorkspaceSidebar.tsx`, `MobileTabBar.tsx`.
- Acceptance: a fresh trip presents a calm, minimal nav; advanced tabs appear as they gain purpose; nothing becomes unreachable.

### ODY-076 · Jump to today / in-progress day on itinerary — S, haiku
> **In plain terms:** When a trip is happening *now*, the itinerary opens at Day 1 and you have to scroll to find today. Auto-focus today's day and mark it.
The dashboard already computes `live`/`upcoming`/`past`; the itinerary doesn't lean into "today."
- For a live trip (today within start–end, UTC-safe via ODY-048 helpers), scroll the matching `DayBlock` into view on load and give it a quiet "Today" marker/accent. Non-live trips unchanged.
- No auto-scroll for viewers mid-read beyond initial focus; respect reduced-motion.
- Files: `src/components/itinerary/DayBlock.tsx`, `src/app/trips/[tripId]/itinerary/page.tsx`, `globals.css`.
- Acceptance: opening a live trip lands on today's day with a subtle badge; past/upcoming trips open at the top as before.

### ODY-077 · Event time-overlap warnings — S, sonnet — ✅ DONE
> **In plain terms:** Soft non-blocking hint when two timed events on a day overlap.
- `findOverlaps` helper + unit tests; quiet peach hint on `EventBlock`.

### ODY-078 · Collections → add to a day in one tap — S, sonnet
> **In plain terms:** Explore can drop a place onto the itinerary, but saved Collections places are a dead end — you can't easily say "put this on Thursday." Add that.
Collections are savable but can't be promoted to the plan (Explore already has `saveExploreToItinerary`).
- Add an "Add to itinerary" action on a Collection card → day picker → reuse `createEvent` (with the ODY-052 day-scope guard and shared geocode path). Editor+ only.
- Files: `src/app/trips/[tripId]/collections/actions.ts` (or reuse itinerary action), `src/components/` collections card + a small day-picker (reuse Explore's pattern).
- Acceptance: a saved place becomes a real itinerary event on the chosen day; viewers can't; pins/costs behave like hand-entered events.

### ODY-079 · Map honesty for saved-but-unpinned locations — S, sonnet
> **In plain terms:** If a location can't be geocoded (typed freehand, lookup failed), the event still saves but the map just says "No pins yet" with no explanation — it looks broken. Tell the truth.
QA findings F18/F19: events/places without coordinates silently vanish from the map; autocomplete errors are invisible.
- Map: when there are events/places but some lack `lat`/`lng`, show a small branded note ("N stops aren't pinned yet — add a location we can find"). Distinguish "no stops" from "stops but none mappable."
- Autocomplete: surface a quiet "couldn't search right now" state instead of an empty dropdown on geocode error (reuse toast/inline pattern; no new lib).
- Files: `src/app/trips/[tripId]/map/page.tsx`, `MapClient.tsx`, `src/components/itinerary/LocationAutocomplete.tsx`.
- Acceptance: a trip with unpinned stops explains why on the map; failed lookups show a clear, calm message.

### ODY-080 · Honest schedule apply-window copy + out-of-range day flag — S, sonnet
> **In plain terms:** The "Apply best window" confirm warns that events outside the new dates are "permanently removed," but the server actually keeps days that have events. The scary copy is a lie — fix it, and gently flag any kept-but-out-of-range days.
QA finding F10: `applyWindow` only deletes *empty* out-of-range days (ODY-002 safety), but the confirm dialog claims event days are deleted.
- Rewrite the confirm copy to match reality: empty days outside the new range are removed; days that hold events are kept and may now sit outside your dates.
- Optional (same PR if cheap): flag kept out-of-range days in the itinerary with a quiet "outside trip dates" marker so they're not lost.
- Files: `src/components/trips/AvailabilityHeatmap.tsx`, `src/components/itinerary/DayBlock.tsx`, `src/app/trips/[tripId]/itinerary/page.tsx`.
- Acceptance: confirm copy accurately describes what happens; no event data is implied to be destroyed when it isn't.

### ODY-081 · Editors can open schedule polls (role parity) — S, haiku
> **In plain terms:** Any editor can plan the whole trip, but only the owner can open a scheduling poll — editors just hit a dead-end empty state. Let editors open/edit polls too.
QA finding F21: `upsertPoll` requires `role: "owner"`; the rest of planning is editor+ (ODY-001).
- Change `upsertPoll` to allow editor+ (reuse `assertTripRole(..., "editor")`). Keep `applyWindow` owner-only for now, since it overwrites trip dates for everyone (document this split in the ticket/comment).
- Update the schedule empty state so editors see a "Start a poll" CTA, not an owner-only message.
- Files: `src/app/trips/[tripId]/schedule/actions.ts`, `src/app/trips/[tripId]/schedule/page.tsx`.
- Acceptance: an editor can create/edit a poll; viewers still can't; applying a window stays owner-only (or is a deliberate follow-up decision).

### ODY-082 · Trip archive / soft hide on dashboard — M, sonnet
> **In plain terms:** Past trips ("Wrapped") pile up forever. Let people archive a trip so the dashboard stays calm, without deleting the memories.
Dashboard shows all upcoming/past; no way to tidy.
- Add `archivedAt DateTime?` on Trip via `prisma db push` (Supabase free-tier may be paused — coordinate the push). Owner archives/unarchives; archived trips move to a collapsed "Archived" section, excluded from the main grid and counts.
- Server action + Zod; membership/owner check; revalidate dashboard.
- Files: `prisma/schema.prisma`, `src/app/trips/actions.ts`, `src/components/trips/DashboardClient.tsx`, `TripCard.tsx`.
- Acceptance: owner can archive/restore a trip; archived trips are hidden from the primary grid but recoverable; no data deleted.

### ODY-083 · In-trip search (events, places, notes) — M, sonnet
> **In plain terms:** Once a trip is dense, finding "that ramen place" means scrolling every day. Add a simple search within a trip.
No way to search inside a trip.
- Lightweight client-side filter over already-loaded events + collections (title/location/notes), surfaced from the workspace header or a small command box; jump-to on select. No new backend if data is already on the page; otherwise a scoped server action.
- Files: `src/components/trips/` (search box), itinerary/collections client components.
- Acceptance: typing a query highlights/filters matching stops and places within the current trip; clearing restores the full view.

### ODY-084 · Leave trip (self-remove) — S, sonnet — ✅ DONE
> **In plain terms:** A collaborator can be removed by the owner, but can't leave on their own. Add a clear "Leave trip" for non-owners.
- `leaveTrip` action + `LeaveTripButton` on Members (non-owners only); confirm → dashboard.

### ODY-085 · Post-invite "you're in" welcome on the joined trip — S, sonnet
> **In plain terms:** After accepting an invite you get dropped on a generic screen. A short welcome on *that trip* (your role, who's hosting, "start on the itinerary") makes joining feel warm and oriented. Pairs with ODY-037.
Invite deep-links land on the trip, but there's no first-visit context for a joiner.
- On a member's first visit to a trip they just joined (detect via `joinedAt` recency or a one-time session flag — no localStorage), show a dismissible welcome banner: role, owner name, one primary CTA.
- Files: `src/app/trips/[tripId]/` layout or itinerary page, a small `JoinWelcome` component, `globals.css`.
- Acceptance: a freshly joined collaborator sees a warm, dismissible orientation on the trip; returning members don't.

### ODY-090 · Branded apply-window confirm + success toast — S, sonnet
> **In plain terms:** Locking the schedule's best window into your trip dates currently uses the browser's plain grey pop-up, and there's no confirmation once it works. Swap it for Odyssey's own calm confirm and a "Trip dates updated" toast so the action feels finished and on-brand. (From testing feedback: "apply window works but would look better as a stylized notification.")
`AvailabilityHeatmap.handleApply` uses `window.confirm(...)` and shows only a failure toast.
- Replace `window.confirm` with the existing `Modal` shell (`src/components/shared/Modal.tsx`) as a small confirm dialog: title, the honest ODY-080 body copy, Cancel + "Apply dates" (loading state reuses `isPending`). Keep it owner-only (parity with ODY-081).
- On success, `toast("Trip dates updated.", "success")` (Toast already supports the `success` kind); keep the failure toast.
- No schema, no new deps. Reuse `.modal-*` classes; no hardcoded hex.
- Files: `src/components/trips/AvailabilityHeatmap.tsx` (+ `globals.css` only if a confirm-specific class is needed).
- Acceptance: applying the best window shows an on-brand confirm, then a success toast; canceling does nothing; failures still toast an error.

### ODY-091 · Destination-biased location search + clearer autocomplete states — M, sonnet
> **In plain terms:** Adding a place in Collections (and event locations) feels finicky — the search only matches fairly exact addresses, doesn't bias toward the trip's destination, and a miss looks the same as a bug. Bias results toward where the trip actually is and make "no matches" read clearly, so saving "ramen" near Tokyo just works. (From testing feedback: "collection tab is hard to add a location, only takes specific addresses.")
`LocationAutocomplete` → `/api/geocode` → `searchPlaces` sends a bare Nominatim query with no geographic bias; vague names return nothing and the dropdown looks empty/broken (ODY-079 added an error state; this adds a *no-matches* state + relevance).
- **Bias:** thread an optional trip destination/viewbox into the lookup. Simplest: pass the trip `destination` string as a `near`/context hint the server appends to the query (e.g. `"${q}, ${destination}"` when the query looks like a bare place name), or use Nominatim `viewbox`+`bounded=0` / `countrycodes` derived from a one-time destination geocode. Keep it server-side in `src/lib/geocode.ts` (respect the shared cache key — include the bias in the key) and `/api/geocode` (accept an optional `near` param, validated).
- **Clarity:** in `LocationAutocomplete`, distinguish loading vs. error (done in ODY-079) vs. **empty results** ("No matches — try a broader name or add city, e.g. 'ramen, Tokyo'"). Don't silently show an empty menu.
- **Plumb destination:** `CollectionsClient` and `AddEventModal` should pass the trip destination to `LocationAutocomplete` (page already loads the trip). Add a `near?: string` prop.
- Guardrails: still never hit Nominatim from the browser (ODY-010); keep rate limiting (ODY-055); no new deps; unit-test any new query-building/bias helper.
- Acceptance: typing a common place name with a trip destination set surfaces relevant nearby suggestions; a true miss shows a clear "no matches" hint; errors still show the ODY-079 message; rate limiting and the proxy boundary are unchanged.

### ODY-092 · Dashboard header responsive collision — S, sonnet — ✅ DONE
> **In plain terms:** Shrinking the browser window made the dashboard search box run into the "New trip" button, and the header controls looked unevenly spaced because they weren't the same height. Fixed so the header stays tidy at every width.
Reported from hands-on testing (follow-up screenshot still showed collision — the search pill's contents were overflowing into the button even after the first flex fix).
- Search becomes an icon toggle at ≤1100px (new `useMediaQuery`), matching the mobile expand pattern; wide desktop keeps a shorter 240px pill with `overflow: hidden`.
- Removed the decorative `⌘K` chip (it advertised a shortcut that wasn't wired — advances ODY-063 honesty).
- "New trip" collapses to icon-only at ≤1100px; controls share a 40px row with 16px gaps.
- Files: `src/app/globals.css`, `src/components/trips/DashboardClient.tsx`, `src/lib/hooks/useMediaQuery.ts`.
- Acceptance: no overlap between search and "New trip" at any width from 320px to wide desktop; hard-refresh if an old CSS bundle is cached.

### ODY-093 · Named collection lists (beyond category grouping) — M, sonnet
> **In plain terms:** Collections already groups spots by type (all restaurants together, all activities together). Travelers also want their *own* named lists — "Date night", "Ramen crawl", "If we have time" — that can hold mixed or same-type places. From testing: "should collections allow saving multiple restaurants into 1 list?"
Today: `Place.category` is an event-type chip; `CollectionsClient` groups by that category. That's already "multiple restaurants in one list," but the list name is the type, not a traveler-chosen title.
- Add optional `listId` / `PlaceList { id, tripId, title, createdBy }` (or a freeform `listLabel String?` on Place if you want to avoid a join — prefer a real `PlaceList` model so rename/delete is clean). `prisma db push`; coordinate Supabase unpause.
- UI: "New list" + assign a place to a list when saving; Collections page shows named lists (and still allows filtering by category). Map legend can stay category-based (ODY-045) — lists are a planning surface, not a new pin type.
- Editor+ write; viewers read-only. No new deps. Reuse editorial checklist/card language — not a nested folder browser.
- Pairs with ODY-078 (promote a place → day) and ODY-091 (biased search).
- Acceptance: a traveler can create "Ramen crawl", save several restaurant places into it, and see that list on the Collections page; category grouping still works for unlisted places.

---

## P3 — New Features

### ODY-045 · Place Collections shown on the map by category — L, sonnet
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

### ODY-094 · Expense splitting audit → Splitwise-grade gaps — L, sonnet (P1)
> **In plain terms:** Odyssey can track trip spend and a trip-level weighted split, but it is not yet a full Splitwise replacement (no per-bill payer, selected participants, itemized restaurant math, tax/tip).
**Audit (2026-07-26) — what exists today:**
- Works: expense CRUD (label/amount/category), event-linked costs, trip-level weights + equal reset, balances (paid − share), persistence of weights + expenses, settle-up suggestions (ODY-030), cent-reconciled shares.
- Partial: “paid” = sum of expenses `addedBy` the member (who *logged* it), not a chosen payer; balances are trip-wide only; weight UI is share ratios not exact $/%%/shares per expense.
- Missing (needs schema + UX — do not bolt onto weights alone): per-expense `paidBy` + participant selection; exact / % / shares / quantities; itemized lines (meals, drinks, shared apps); tax/tip/fees/discounts; review step; over/under allocation guards; mobile-first advanced flow.
**Remaining after this branch:** implement ODY-094 stages (schema `ExpenseShare` / `paidBy`, then itemization). Keep equal split as the default fast path.
- Acceptance (full epic): equal split stays one-tap; advanced options progressive; restaurant scenarios reconcile to the cent; edit/delete recalculates; survives refresh.

### ODY-096 · Mobile commute detail overflow on event cards — S, sonnet (future only)
> **In plain terms:** Long origin/destination addresses on transport events overflow or feel cramped on phones.
- Responsive layout (not just smaller type): stack origin → destination vertically on narrow screens; default to concise street + city; full address via expand/details/map.
- Prioritize title, time, type; keep edit/delete tappable; no clip/overlap/horizontal scroll; preserve desktop/tablet.
- Files: `EventBlock.tsx`, `globals.css` (and map card if it mirrors the same meta).
- Acceptance: long addresses at 375px stay inside the card; desktop unchanged.

### ODY-031 · Trip cover images via Supabase Storage — L, sonnet
> **In plain terms:** Trips currently get pretty gradient covers, but you can't use your own photo. This adds photo upload, keeping the gradients as the default.
`Trip.coverImageUrl` exists and `cover.ts` generates gradient covers, but users can't
upload a photo. Add upload to a `trip-covers` bucket (Supabase client already
configured; service role stays server-side), size/type validation via Zod + server
action, fallback to the current gradients (they're on-brand — keep them as the
default state, photo optional). Respect existing RLS posture from the security memo.

### ODY-032 · Print / share itinerary view — M, sonnet
> **In plain terms:** A printable, paper-style version of the itinerary — the "printed map" moment the brand is named for.
On-brand "printed map" moment: a `/trips/[tripId]/print` server-rendered route with a
paper-first, ink-on-cream stylesheet (print CSS), day-by-day list + budget summary.
No auth changes — members only.

### ODY-033 · Duplicate trip / copy day — M, sonnet
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

### ODY-049 · AI Explore — vibe-based local recommendations — L, sonnet — ✅ DONE (Nominatim MVP)
> **In plain terms:** Tell the trip what vibe you're after ("cozy cafés", "sunset views") and get place ideas near the destination you can peek at and save into the plan.
New Explore surface on a trip: travelers pick or type a vibe; the app suggests local places for the trip destination.
- Route: `src/app/trips/[tripId]/explore/` + nav item (reuse editorial tokens; Leaflet stays `ssr:false` if map preview used).
- Server action (Zod + `assertTripRole` editor+ to save): call an LLM **only if** `OPENAI_API_KEY` (or agreed provider) is set; otherwise fall back to Nominatim via `src/lib/geocode.ts` / `/api/geocode` with vibe+destination queries — **never** hit Nominatim from the browser (ODY-010).
- Each suggestion: title, category (reuse event types), short blurb, location, lat/lng when available.
- Guardrails: no new deps without strong justification; rate-limit; no hardcoded hex; Prisma only via `db.ts`.
- Acceptance: from Explore, a user sees vibe-based suggestions for the trip destination; empty/error states are branded, not silent.
- **Shipped:** Nominatim vibe search MVP (no LLM key required). Optional LLM enhancement is a follow-up when a provider key is added.

### ODY-050 · Save Explore suggestions into the itinerary — M, sonnet — ✅ DONE
> **In plain terms:** Liked a recommendation? One click adds it as a normal itinerary event (or collection place) so it shows up on the day plan and map.
**Depends on ODY-049.** From an Explore suggestion card:
- Primary: "Add to itinerary" → pick a day → `createEvent` (reuse existing action + geocode path).
- Secondary: "Save to collections" → `createPlace` (ODY-045) so it can sit as a maybe without a day.
- Acceptance: saved items appear on itinerary/map/collections like hand-entered ones; viewers cannot save.

### ODY-065 · Distance / time between stops + light route optimize — L, sonnet
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

### ODY-067 · Packing checklist — trip-level + optional per-event — M→L, sonnet
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

### ODY-068 · Offline read of itinerary / map — L, sonnet
> **In plain terms:** Open the trip on a plane or abroad without signal and still see the plan (read-only first).
Competitive gap vs Wanderlog Pro offline.
- PWA cache or service-worker strategy for last-viewed trip itinerary + static map tiles policy (respect tile ToS).
- Mutations queue or clearly disabled offline; no localStorage for secrets (CLAUDE.md).
- Acceptance: after one online visit, airplane-mode reload shows last itinerary; writes blocked with clear copy.

### ODY-069 · Calendar sync (read-only export) — M, sonnet
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

### ODY-072 · Export PDF / Google Maps — M, sonnet
> **In plain terms:** Hand someone a printable itinerary or open the day's pins in Google Maps.
Adjacent to ODY-032 print view; can share implementation.
- PDF or print-CSS export; "Open in Google Maps" for a day's ordered pins (URL scheme / directions).
- Acceptance: member can export/print a readable day list; Maps opens with pins in order when possible.

---

## Post-MVP / long-term

### ODY-073 · Native mobile apps (iOS / Android) — L+, multi-sprint
> **In plain terms:** Ship real phone apps so travelers use Odyssey on the road without fighting a mobile browser — App Store and Play Store when ready.
**Post-MVP.** Choose via a short spike (document decision in this ticket):
1. **Expo + React Native** — best store UX; rebuild trip workspace screens against existing APIs/actions.
2. **Capacitor** shell around the Next app — fastest path; limited offline/native feel.
3. **PWA** installable web — interim milestone before stores.

Depends on: ODY-036 (prod auth), ODY-037 (share/invites), ODY-058/059 (mobile chrome), ideally ODY-068 (offline read).
- Guardrails: reuse Prisma/Clerk backend; no parallel business logic forks; deep links into `/trips/[id]/…`.
- Acceptance: signed-in users can open trips, view itinerary + map, and make basic edits on iOS and Android (or a shipped PWA milestone explicitly accepted as phase 1).

---

## P3 — User Journey delight (2026-07-25 UX audit)

### ODY-086 · Booking details on events (confirmation #, link, check-in) — M, sonnet
> **In plain terms:** For flights and hotels you want the confirmation number, a booking link, and check-in time right on the event — the "boarding pass" moment. Keep it a couple of optional fields, not a CRM.
Events have `type`/`location`/`notes` but no structured booking info.
- Add optional `confirmationCode String?`, `bookingUrl String?`, `checkIn`/`checkOut` (reuse `startTime`/`endTime` where possible) via `prisma db push` (coordinate Supabase pause). Zod-validate URL + length caps.
- Surface fields in the event modal for flight/hotel types primarily; render as quiet mono chips on the block and map card. No new deps.
- Files: `prisma/schema.prisma`, `src/lib/validations/index.ts`, `AddEventModal.tsx`, `EventBlock.tsx`, `MapClient.tsx`.
- Acceptance: a flight/hotel event can hold a confirmation code + link that render on the timeline and map; other types unaffected.

### ODY-087 · Day agenda / "today" compact view — M, sonnet
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
- Full LLM Explore ranking — optional once a provider key exists (ODY-049 MVP already ships Nominatim).

## Suggested session order
1. **P0 security/correctness:** ODY-052 (IDOR) ✅ → ODY-051 (notes clobber) ✅
2. **P1 hardening:** ODY-053 ✅ → ODY-054 ✅ → ODY-055 ✅ → ODY-056 ✅ → ODY-057 ✅ → ODY-058 ✅
3. **UX quick wins (safe, no schema):** ODY-081 ✅ → ODY-080 ✅ → ODY-079 ✅ → ODY-076 ✅ → ODY-090 ✅ → ODY-091 ✅ → ODY-092 ✅ → ODY-062 → ODY-063 (⌘K removed; empty-state remains)
4. **Journey depth (some schema):** ODY-074 → ODY-075/059/060 → ODY-084 → ODY-085 → ODY-077 → ODY-078 → ODY-083 → ODY-082 · ODY-093 (named collection lists)
5. **Launch blockers (human + eng):** ODY-036 → ODY-037
6. **P2 residual polish:** ODY-061 → ODY-020/022/023/024/026
7. **P3 delight:** ODY-094 (Splitwise-grade) · ODY-032/072/087 · ODY-086 · ODY-088 · ODY-089 · ODY-065 · ODY-067 · ODY-096 (mobile commute overflow)
8. **Competitive / later:** ODY-066 · ODY-068–071
9. **Post-MVP:** ODY-073 native (after mobile web + offline foundations)
